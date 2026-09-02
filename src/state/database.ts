import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection, type capSQLiteSet } from '@capacitor-community/sqlite';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import { breakDurationHours, defaultScheduleConfig, defaultSettings, defaultWeeklySchedule } from './payroll';
import type { AttendanceEntry, PayrollPeriod, PayrollStore, Payslip, ScheduleConfig, Settings, WeeklyScheduleDay } from './types';

const DATABASE_NAME = 'butterbarya';
const DATABASE_VERSION = 1;
const LEGACY_STORAGE_KEY = 'butterbarya.payroll.v1';
const sqlite = new SQLiteConnection(CapacitorSQLite);
let connectionPromise: Promise<SQLiteDBConnection> | null = null;

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    monthly_salary REAL NOT NULL,
    work_hours_per_day REAL NOT NULL,
    work_days_per_month REAL NOT NULL,
    standard_time_in TEXT NOT NULL,
    standard_time_out TEXT NOT NULL,
    break_start_time TEXT NOT NULL DEFAULT '12:00',
    break_end_time TEXT NOT NULL DEFAULT '13:00',
    lunch_break_hours REAL NOT NULL,
    late_grace_minutes INTEGER NOT NULL,
    ot_multiplier REAL NOT NULL,
    difference_tolerance REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payroll_periods (
    id TEXT PRIMARY KEY NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    label TEXT NOT NULL,
    CHECK (start_date <= end_date)
  );
  CREATE TRIGGER IF NOT EXISTS payroll_periods_no_overlap_insert
  BEFORE INSERT ON payroll_periods
  WHEN EXISTS (
    SELECT 1 FROM payroll_periods
    WHERE NEW.start_date <= end_date AND NEW.end_date >= start_date
  )
  BEGIN
    SELECT RAISE(ABORT, 'Payroll period dates overlap');
  END;
  CREATE TRIGGER IF NOT EXISTS payroll_periods_no_overlap_update
  BEFORE UPDATE OF start_date, end_date ON payroll_periods
  WHEN EXISTS (
    SELECT 1 FROM payroll_periods
    WHERE id <> OLD.id AND NEW.start_date <= end_date AND NEW.end_date >= start_date
  )
  BEGIN
    SELECT RAISE(ABORT, 'Payroll period dates overlap');
  END;
  CREATE TABLE IF NOT EXISTS weekly_schedule_days (
    weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    is_working INTEGER NOT NULL DEFAULT 0 CHECK (is_working IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS schedule_intervals (
    id TEXT PRIMARY KEY NOT NULL,
    weekday INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('work', 'break')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (start_time <> end_time),
    FOREIGN KEY (weekday) REFERENCES weekly_schedule_days(weekday) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS schedule_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL CHECK (mode IN ('weekly', 'rotating')),
    anchor_date TEXT NOT NULL,
    cycle_length INTEGER NOT NULL CHECK (cycle_length BETWEEN 1 AND 28)
  );
  CREATE TABLE IF NOT EXISTS schedule_days (
    day_index INTEGER PRIMARY KEY NOT NULL CHECK (day_index BETWEEN 0 AND 27),
    is_working INTEGER NOT NULL DEFAULT 0 CHECK (is_working IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS schedule_day_intervals (
    id TEXT PRIMARY KEY NOT NULL,
    day_index INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('work', 'break')),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (start_time <> end_time),
    FOREIGN KEY (day_index) REFERENCES schedule_days(day_index) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL UNIQUE,
    time_in TEXT NOT NULL DEFAULT '',
    time_out TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    remarks TEXT NOT NULL DEFAULT '',
    payroll_period TEXT NOT NULL,
    total_hours REAL NOT NULL DEFAULT 0,
    worked_hours REAL NOT NULL DEFAULT 0,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    undertime_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_hours REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS attendance_period_idx ON attendance(payroll_period);
  CREATE TABLE IF NOT EXISTS attendance_punches (
    id TEXT PRIMARY KEY NOT NULL,
    attendance_id TEXT NOT NULL,
    time_in TEXT NOT NULL,
    time_out TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (time_in <> time_out),
    FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS attendance_punches_attendance_idx ON attendance_punches(attendance_id, sort_order);
  CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY NOT NULL,
    payroll_period TEXT NOT NULL,
    release_date TEXT NOT NULL,
    gross_pay REAL NOT NULL,
    net_pay REAL NOT NULL,
    tax REAL NOT NULL DEFAULT 0,
    sss REAL NOT NULL DEFAULT 0,
    philhealth REAL NOT NULL DEFAULT 0,
    pagibig REAL NOT NULL DEFAULT 0,
    remarks TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS payslips_period_idx ON payslips(payroll_period);
  CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;

async function openDatabase() {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    defineJeepSqlite(window);
    if (!document.querySelector('jeep-sqlite')) {
      const element = document.createElement('jeep-sqlite');
      element.setAttribute('autoSave', 'true');
      document.body.appendChild(element);
    }
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  const encryptionMode = isNative ? await prepareNativeEncryption() : 'no-encryption';

  const consistent = await sqlite.checkConnectionsConsistency();
  const exists = (await sqlite.isConnection(DATABASE_NAME, false)).result;
  const db = consistent.result && exists
    ? await sqlite.retrieveConnection(DATABASE_NAME, false)
    : await sqlite.createConnection(DATABASE_NAME, isNative, encryptionMode, DATABASE_VERSION, false);
  if (!(await db.isDBOpen()).result) await db.open();
  await db.execute(schema);
  await ensureSettingsBreakColumns(db);
  await insertDefaultSettings(db);
  await migrateLegacyLocalStorage(db);
  await seedWeeklySchedule(db);
  await seedScheduleCycle(db);
  await seedAttendancePunches(db);
  await seedPayrollPeriods(db);
  await persistWebDatabase();
  return db;
}

async function prepareNativeEncryption(): Promise<'secret' | 'encryption'> {
  const configured = (await sqlite.isInConfigEncryption()).result;
  if (!configured) throw new Error('Native SQLite encryption is not enabled in capacitor.config.ts.');

  const secretStored = (await sqlite.isSecretStored()).result;
  if (!secretStored) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const passphrase = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    await sqlite.setEncryptionSecret(passphrase);
  }

  const databaseExists = (await sqlite.isDatabase(DATABASE_NAME)).result;
  if (!databaseExists) return 'secret';

  const databaseEncrypted = (await sqlite.isDatabaseEncrypted(DATABASE_NAME)).result;
  return databaseEncrypted ? 'secret' : 'encryption';
}

export function getDatabase() {
  if (!connectionPromise) connectionPromise = openDatabase();
  return connectionPromise;
}

async function persistWebDatabase() {
  if (Capacitor.getPlatform() === 'web') await sqlite.saveToStore(DATABASE_NAME);
}

function settingsValues(settings: Settings) {
  return [1, settings.monthlySalary, settings.workHoursPerDay, settings.workDaysPerMonth, settings.standardTimeIn, settings.standardTimeOut, settings.breakStartTime, settings.breakEndTime, breakDurationHours(settings.breakStartTime, settings.breakEndTime), settings.lateGraceMinutes, settings.otMultiplier, settings.differenceTolerance];
}

const settingsSql = `INSERT OR REPLACE INTO settings
  (id, monthly_salary, work_hours_per_day, work_days_per_month, standard_time_in, standard_time_out, break_start_time, break_end_time, lunch_break_hours, late_grace_minutes, ot_multiplier, difference_tolerance)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

async function ensureSettingsBreakColumns(db: SQLiteDBConnection) {
  const columns = await db.query('PRAGMA table_info(settings);');
  const names = new Set((columns.values ?? []).map((column) => String(column.name)));
  const missingStart = !names.has('break_start_time');
  const missingEnd = !names.has('break_end_time');
  if (missingStart) await db.execute("ALTER TABLE settings ADD COLUMN break_start_time TEXT NOT NULL DEFAULT '12:00';");
  if (missingEnd) await db.execute("ALTER TABLE settings ADD COLUMN break_end_time TEXT NOT NULL DEFAULT '13:00';");
  if (missingStart || missingEnd) {
    const existing = await db.query('SELECT lunch_break_hours FROM settings WHERE id = 1;');
    if (existing.values?.length) {
      const durationMinutes = Math.max(0, Math.round(Number(existing.values[0].lunch_break_hours ?? 1) * 60));
      const endMinutes = (12 * 60 + durationMinutes) % 1440;
      const migratedEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
      await db.run('UPDATE settings SET break_start_time = ?, break_end_time = ? WHERE id = 1;', ['12:00', migratedEnd]);
    }
  }
}

async function insertDefaultSettings(db: SQLiteDBConnection) {
  await db.run(settingsSql.replace('INSERT OR REPLACE', 'INSERT OR IGNORE'), settingsValues(defaultSettings));
}

function settingsFromRow(saved: Record<string, unknown>): Settings {
  return { monthlySalary: Number(saved.monthly_salary), workHoursPerDay: Number(saved.work_hours_per_day), workDaysPerMonth: Number(saved.work_days_per_month), standardTimeIn: String(saved.standard_time_in), standardTimeOut: String(saved.standard_time_out), breakStartTime: String(saved.break_start_time), breakEndTime: String(saved.break_end_time), lunchBreakHours: Number(saved.lunch_break_hours), lateGraceMinutes: Number(saved.late_grace_minutes), otMultiplier: Number(saved.ot_multiplier), differenceTolerance: Number(saved.difference_tolerance) };
}

async function seedWeeklySchedule(db: SQLiteDBConnection) {
  const count = await db.query('SELECT COUNT(*) AS count FROM weekly_schedule_days;');
  if (Number(count.values?.[0]?.count ?? 0) > 0) return;
  const saved = await db.query('SELECT * FROM settings WHERE id = 1;');
  const settings = saved.values?.[0] ? settingsFromRow(saved.values[0]) : defaultSettings;
  await writeWeeklySchedule(db, defaultWeeklySchedule(settings));
}

async function writeWeeklySchedule(db: SQLiteDBConnection, schedule: WeeklyScheduleDay[]) {
  const statements: capSQLiteSet[] = [
    { statement: 'DELETE FROM schedule_intervals;', values: [] },
    { statement: 'DELETE FROM weekly_schedule_days;', values: [] },
  ];
  for (const day of schedule) {
    statements.push({ statement: 'INSERT INTO weekly_schedule_days (weekday, is_working) VALUES (?, ?);', values: [day.weekday, day.isWorking ? 1 : 0] });
    day.intervals.forEach((item, index) => statements.push({ statement: 'INSERT INTO schedule_intervals (id, weekday, kind, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?, ?);', values: [item.id, day.weekday, item.type, item.startTime, item.endTime, index] }));
  }
  await db.executeSet(statements, true);
}

async function seedScheduleCycle(db: SQLiteDBConnection) {
  const count = await db.query('SELECT COUNT(*) AS count FROM schedule_days;');
  if (Number(count.values?.[0]?.count ?? 0) > 0) return;
  const legacyDays = await db.query('SELECT * FROM weekly_schedule_days ORDER BY weekday;');
  const legacyIntervals = await db.query('SELECT * FROM schedule_intervals ORDER BY weekday, sort_order;');
  const schedule: WeeklyScheduleDay[] = (legacyDays.values ?? []).map((day) => ({
    weekday: Number(day.weekday),
    isWorking: Boolean(day.is_working),
    intervals: (legacyIntervals.values ?? []).filter((item) => Number(item.weekday) === Number(day.weekday)).map((item) => ({ id: String(item.id), type: item.kind, startTime: String(item.start_time), endTime: String(item.end_time) })),
  }));
  await writeSchedule(db, defaultScheduleConfig, schedule);
}

async function writeSchedule(db: SQLiteDBConnection, config: ScheduleConfig, schedule: WeeklyScheduleDay[]) {
  const statements: capSQLiteSet[] = [
    { statement: 'DELETE FROM schedule_day_intervals;', values: [] },
    { statement: 'DELETE FROM schedule_days;', values: [] },
    { statement: 'INSERT OR REPLACE INTO schedule_config (id, mode, anchor_date, cycle_length) VALUES (1, ?, ?, ?);', values: [config.mode, config.anchorDate, config.cycleLength] },
  ];
  for (const day of schedule) {
    statements.push({ statement: 'INSERT INTO schedule_days (day_index, is_working) VALUES (?, ?);', values: [day.weekday, day.isWorking ? 1 : 0] });
    day.intervals.forEach((item, index) => statements.push({ statement: 'INSERT INTO schedule_day_intervals (id, day_index, kind, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?, ?);', values: [item.id, day.weekday, item.type, item.startTime, item.endTime, index] }));
  }
  await db.executeSet(statements, true);
}

async function seedAttendancePunches(db: SQLiteDBConnection) {
  await db.execute(`INSERT OR IGNORE INTO attendance_punches (id, attendance_id, time_in, time_out, sort_order)
    SELECT id || '-legacy-punch', id, time_in, time_out, 0 FROM attendance
    WHERE time_in <> '' AND time_out <> '';`);
}

async function seedPayrollPeriods(db: SQLiteDBConnection) {
  const seeded = await db.query('SELECT value FROM metadata WHERE key = ?;', ['payroll_periods_seeded']);
  if (seeded.values?.length) return;

  const referenced = await db.query(`
    SELECT payroll_period FROM attendance
    UNION
    SELECT payroll_period FROM payslips;
  `);
  const ids = new Set<string>((referenced.values ?? []).map((row) => String(row.payroll_period)).filter(Boolean));
  ids.add(periodIdForDate(new Date()));

  for (const id of ids) {
    const match = /^(\d{4})-(\d{2})-([AB])$/.exec(id);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const firstCutoff = match[3] === 'A';
    const startDay = firstCutoff ? 1 : 16;
    const endDay = firstCutoff ? 15 : new Date(year, month, 0).getDate();
    const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(year, month - 1, 1));
    const period: PayrollPeriod = {
      id,
      startDate: `${match[1]}-${match[2]}-${String(startDay).padStart(2, '0')}`,
      endDate: `${match[1]}-${match[2]}-${String(endDay).padStart(2, '0')}`,
      label: `${monthName} ${startDay}-${endDay}, ${year}`,
    };
    await db.run('INSERT OR IGNORE INTO payroll_periods (id, start_date, end_date, label) VALUES (?, ?, ?, ?);', periodValues(period));
  }
  await db.run('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);', ['payroll_periods_seeded', new Date().toISOString()]);
}

function periodIdForDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getDate() <= 15 ? 'A' : 'B'}`;
}

function periodValues(period: PayrollPeriod) {
  return [period.id, period.startDate, period.endDate, period.label];
}

function attendanceSet(row: AttendanceEntry): capSQLiteSet {
  return { statement: `INSERT OR IGNORE INTO attendance
    (id, date, time_in, time_out, status, remarks, payroll_period, total_hours, worked_hours, late_minutes, undertime_minutes, overtime_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    values: [row.id, row.date, row.timeIn, row.timeOut, row.status, row.remarks, row.payrollPeriod, row.totalHours, row.workedHours, row.lateMinutes, row.undertimeMinutes, row.overtimeHours] };
}

function payslipSet(row: Payslip): capSQLiteSet {
  return { statement: `INSERT OR IGNORE INTO payslips
    (id, payroll_period, release_date, gross_pay, net_pay, tax, sss, philhealth, pagibig, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`, values: [row.id, row.payrollPeriod, row.releaseDate, row.grossPay, row.netPay, row.tax, row.sss, row.philhealth, row.pagibig, row.remarks] };
}

async function migrateLegacyLocalStorage(db: SQLiteDBConnection) {
  const migrated = await db.query('SELECT value FROM metadata WHERE key = ?;', ['local_storage_migrated']);
  if (migrated.values?.length) return;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  let migrationSucceeded = true;
  if (legacy) {
    try {
      const store = JSON.parse(legacy) as Partial<PayrollStore>;
      if (store.settings) await db.run(settingsSql, settingsValues({ ...defaultSettings, ...store.settings }));
      const rows: capSQLiteSet[] = [
        ...(store.attendance ?? []).map(attendanceSet),
        ...(store.payslips ?? []).map(payslipSet),
      ];
      if (rows.length) await db.executeSet(rows, true);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      migrationSucceeded = false;
      console.warn('Butterbarya could not migrate its legacy localStorage data.', error);
    }
  }
  if (migrationSucceeded) await db.run('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);', ['local_storage_migrated', new Date().toISOString()]);
}

export async function loadPayrollStore(): Promise<PayrollStore> {
  const db = await getDatabase();
  const [settingsResult, scheduleConfigResult, scheduleDaysResult, scheduleIntervalsResult, periodsResult, attendanceResult, punchesResult, payslipsResult] = await Promise.all([
    db.query('SELECT * FROM settings WHERE id = 1;'),
    db.query('SELECT * FROM schedule_config WHERE id = 1;'),
    db.query('SELECT * FROM schedule_days ORDER BY day_index;'),
    db.query('SELECT * FROM schedule_day_intervals ORDER BY day_index, sort_order;'),
    db.query('SELECT * FROM payroll_periods ORDER BY start_date DESC;'),
    db.query('SELECT * FROM attendance ORDER BY date DESC;'),
    db.query('SELECT * FROM attendance_punches ORDER BY attendance_id, sort_order;'),
    db.query('SELECT * FROM payslips ORDER BY release_date DESC, rowid DESC;'),
  ]);
  const saved = settingsResult.values?.[0];
  const settings: Settings = saved ? settingsFromRow(saved) : defaultSettings;
  const configRow = scheduleConfigResult.values?.[0];
  const scheduleConfig: ScheduleConfig = configRow ? { mode: configRow.mode, anchorDate: configRow.anchor_date, cycleLength: Number(configRow.cycle_length) } : defaultScheduleConfig;
  const weeklySchedule: WeeklyScheduleDay[] = (scheduleDaysResult.values ?? []).map((day) => ({
    weekday: Number(day.day_index),
    isWorking: Boolean(day.is_working),
    intervals: (scheduleIntervalsResult.values ?? []).filter((item) => Number(item.day_index) === Number(day.day_index)).map((item) => ({ id: item.id, type: item.kind, startTime: item.start_time, endTime: item.end_time })),
  }));
  const payrollPeriods: PayrollPeriod[] = (periodsResult.values ?? []).map((row) => ({ id: row.id, startDate: row.start_date, endDate: row.end_date, label: row.label }));
  const attendance: AttendanceEntry[] = (attendanceResult.values ?? []).map((row) => ({ id: row.id, date: row.date, timeIn: row.time_in, timeOut: row.time_out, punches: (punchesResult.values ?? []).filter((punch) => punch.attendance_id === row.id).map((punch) => ({ id: punch.id, timeIn: punch.time_in, timeOut: punch.time_out })), status: row.status, remarks: row.remarks, payrollPeriod: row.payroll_period, totalHours: row.total_hours, workedHours: row.worked_hours, lateMinutes: row.late_minutes, undertimeMinutes: row.undertime_minutes, overtimeHours: row.overtime_hours }));
  const payslips: Payslip[] = (payslipsResult.values ?? []).map((row) => ({ id: row.id, payrollPeriod: row.payroll_period, releaseDate: row.release_date, grossPay: row.gross_pay, netPay: row.net_pay, tax: row.tax, sss: row.sss, philhealth: row.philhealth, pagibig: row.pagibig, remarks: row.remarks }));
  return { settings, scheduleConfig, weeklySchedule, payrollPeriods, attendance, payslips };
}

export async function insertAttendance(row: AttendanceEntry) { const db = await getDatabase(); await db.executeSet([attendanceSet(row), ...row.punches.map((punch, index) => ({ statement: 'INSERT INTO attendance_punches (id, attendance_id, time_in, time_out, sort_order) VALUES (?, ?, ?, ?, ?);', values: [punch.id, row.id, punch.timeIn, punch.timeOut, index] }))], true); await persistWebDatabase(); }
export async function removeAttendance(id: string) { const db = await getDatabase(); await db.run('DELETE FROM attendance WHERE id = ?;', [id]); await persistWebDatabase(); }
export async function insertPayslip(row: Payslip) { const db = await getDatabase(); await db.executeSet([payslipSet(row)]); await persistWebDatabase(); }
export async function removePayslip(id: string) { const db = await getDatabase(); await db.run('DELETE FROM payslips WHERE id = ?;', [id]); await persistWebDatabase(); }
export async function saveSettings(settings: Settings) { const db = await getDatabase(); await db.run(settingsSql, settingsValues(settings)); await persistWebDatabase(); }
export async function saveWeeklySchedule(schedule: WeeklyScheduleDay[]) { const db = await getDatabase(); await writeWeeklySchedule(db, schedule); await persistWebDatabase(); }
export async function saveSchedule(config: ScheduleConfig, schedule: WeeklyScheduleDay[]) { const db = await getDatabase(); await writeSchedule(db, config, schedule); await persistWebDatabase(); }
export async function updateAttendanceCalculations(rows: AttendanceEntry[]) {
  if (!rows.length) return;
  const db = await getDatabase();
  await db.executeSet(rows.map((row) => ({
    statement: `UPDATE attendance SET total_hours = ?, worked_hours = ?, late_minutes = ?, undertime_minutes = ?, overtime_hours = ? WHERE id = ?;`,
    values: [row.totalHours, row.workedHours, row.lateMinutes, row.undertimeMinutes, row.overtimeHours, row.id],
  })), true);
  await persistWebDatabase();
}
export async function insertPayrollPeriod(period: PayrollPeriod) { const db = await getDatabase(); await db.run('INSERT INTO payroll_periods (id, start_date, end_date, label) VALUES (?, ?, ?, ?);', periodValues(period)); await persistWebDatabase(); }
export async function updatePayrollPeriod(previousId: string, period: PayrollPeriod) {
  const db = await getDatabase();
  await db.executeSet([
    { statement: 'UPDATE payroll_periods SET id = ?, start_date = ?, end_date = ?, label = ? WHERE id = ?;', values: [...periodValues(period), previousId] },
    { statement: 'UPDATE attendance SET payroll_period = ? WHERE payroll_period = ?;', values: [period.id, previousId] },
    { statement: 'UPDATE payslips SET payroll_period = ? WHERE payroll_period = ?;', values: [period.id, previousId] },
  ], true);
  await persistWebDatabase();
}
export async function removePayrollPeriod(id: string) {
  const db = await getDatabase();
  const references = await db.query(`
    SELECT (SELECT COUNT(*) FROM attendance WHERE payroll_period = ?) +
           (SELECT COUNT(*) FROM payslips WHERE payroll_period = ?) AS count;
  `, [id, id]);
  if (Number(references.values?.[0]?.count ?? 0) > 0) throw new Error('This payroll period is in use. Delete its attendance and payslip records first.');
  await db.run('DELETE FROM payroll_periods WHERE id = ?;', [id]);
  await persistWebDatabase();
}

const allTables = ['attendance_punches', 'attendance', 'payslips', 'schedule_intervals', 'weekly_schedule_days', 'schedule_day_intervals', 'schedule_days', 'schedule_config', 'payroll_periods', 'settings', 'metadata'];

async function wipeAllTables(db: SQLiteDBConnection) {
  await db.executeSet(allTables.map((table) => ({ statement: `DELETE FROM ${table};`, values: [] })), true);
}

export async function resetPayrollData(): Promise<PayrollStore> {
  const db = await getDatabase();
  await wipeAllTables(db);
  await insertDefaultSettings(db);
  await seedWeeklySchedule(db);
  await seedScheduleCycle(db);
  await seedPayrollPeriods(db);
  await persistWebDatabase();
  return loadPayrollStore();
}

const BACKUP_VERSION = 1;
interface BackupFile { app: 'butterbarya'; version: number; exportedAt: string; store: PayrollStore }

export async function exportBackupJson(): Promise<string> {
  const store = await loadPayrollStore();
  const backup: BackupFile = { app: 'butterbarya', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), store };
  return JSON.stringify(backup);
}

export async function importBackupJson(jsonString: string): Promise<PayrollStore> {
  let backup: Partial<BackupFile>;
  try { backup = JSON.parse(jsonString); } catch { throw new Error('This file is not a valid Butterbarya backup.'); }
  if (backup.app !== 'butterbarya' || !backup.store) throw new Error('This file is not a valid Butterbarya backup.');
  const { store } = backup;

  const db = await getDatabase();
  await wipeAllTables(db);
  await db.run(settingsSql, settingsValues(store.settings));
  await writeSchedule(db, store.scheduleConfig, store.weeklySchedule);
  await db.executeSet([
    ...store.payrollPeriods.map((period) => ({ statement: 'INSERT INTO payroll_periods (id, start_date, end_date, label) VALUES (?, ?, ?, ?);', values: periodValues(period) })),
    ...store.attendance.flatMap((row) => [attendanceSet(row), ...row.punches.map((punch, index) => ({ statement: 'INSERT INTO attendance_punches (id, attendance_id, time_in, time_out, sort_order) VALUES (?, ?, ?, ?, ?);', values: [punch.id, row.id, punch.timeIn, punch.timeOut, index] }))]),
    ...store.payslips.map(payslipSet),
  ], true);
  await db.run('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);', ['payroll_periods_seeded', new Date().toISOString()]);
  await db.run('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?);', ['local_storage_migrated', new Date().toISOString()]);
  await persistWebDatabase();
  return loadPayrollStore();
}
