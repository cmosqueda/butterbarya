import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection, type capSQLiteSet } from '@capacitor-community/sqlite';
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader';
import { defaultSettings } from './payroll';
import type { AttendanceEntry, PayrollStore, Payslip, Settings } from './types';

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
    lunch_break_hours REAL NOT NULL,
    late_grace_minutes INTEGER NOT NULL,
    ot_multiplier REAL NOT NULL,
    difference_tolerance REAL NOT NULL
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
  await insertDefaultSettings(db);
  await migrateLegacyLocalStorage(db);
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
  return [1, settings.monthlySalary, settings.workHoursPerDay, settings.workDaysPerMonth, settings.standardTimeIn, settings.standardTimeOut, settings.lunchBreakHours, settings.lateGraceMinutes, settings.otMultiplier, settings.differenceTolerance];
}

const settingsSql = `INSERT OR REPLACE INTO settings
  (id, monthly_salary, work_hours_per_day, work_days_per_month, standard_time_in, standard_time_out, lunch_break_hours, late_grace_minutes, ot_multiplier, difference_tolerance)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

async function insertDefaultSettings(db: SQLiteDBConnection) {
  await db.run(settingsSql.replace('INSERT OR REPLACE', 'INSERT OR IGNORE'), settingsValues(defaultSettings));
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
  const [settingsResult, attendanceResult, payslipsResult] = await Promise.all([
    db.query('SELECT * FROM settings WHERE id = 1;'),
    db.query('SELECT * FROM attendance ORDER BY date DESC;'),
    db.query('SELECT * FROM payslips ORDER BY release_date DESC, rowid DESC;'),
  ]);
  const saved = settingsResult.values?.[0];
  const settings: Settings = saved ? { monthlySalary: saved.monthly_salary, workHoursPerDay: saved.work_hours_per_day, workDaysPerMonth: saved.work_days_per_month, standardTimeIn: saved.standard_time_in, standardTimeOut: saved.standard_time_out, lunchBreakHours: saved.lunch_break_hours, lateGraceMinutes: saved.late_grace_minutes, otMultiplier: saved.ot_multiplier, differenceTolerance: saved.difference_tolerance } : defaultSettings;
  const attendance: AttendanceEntry[] = (attendanceResult.values ?? []).map((row) => ({ id: row.id, date: row.date, timeIn: row.time_in, timeOut: row.time_out, status: row.status, remarks: row.remarks, payrollPeriod: row.payroll_period, totalHours: row.total_hours, workedHours: row.worked_hours, lateMinutes: row.late_minutes, undertimeMinutes: row.undertime_minutes, overtimeHours: row.overtime_hours }));
  const payslips: Payslip[] = (payslipsResult.values ?? []).map((row) => ({ id: row.id, payrollPeriod: row.payroll_period, releaseDate: row.release_date, grossPay: row.gross_pay, netPay: row.net_pay, tax: row.tax, sss: row.sss, philhealth: row.philhealth, pagibig: row.pagibig, remarks: row.remarks }));
  return { settings, attendance, payslips };
}

export async function insertAttendance(row: AttendanceEntry) { const db = await getDatabase(); await db.executeSet([attendanceSet(row)]); await persistWebDatabase(); }
export async function removeAttendance(id: string) { const db = await getDatabase(); await db.run('DELETE FROM attendance WHERE id = ?;', [id]); await persistWebDatabase(); }
export async function insertPayslip(row: Payslip) { const db = await getDatabase(); await db.executeSet([payslipSet(row)]); await persistWebDatabase(); }
export async function removePayslip(id: string) { const db = await getDatabase(); await db.run('DELETE FROM payslips WHERE id = ?;', [id]); await persistWebDatabase(); }
export async function saveSettings(settings: Settings) { const db = await getDatabase(); await db.run(settingsSql, settingsValues(settings)); await persistWebDatabase(); }
