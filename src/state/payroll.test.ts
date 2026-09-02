import { describe, expect, it } from 'vitest';
import { breakDurationHours, calculateAttendance, defaultSettings, defaultWeeklySchedule, periodId, salaryBreakdown, scheduleDayForConfig, scheduleDayForDate, scheduleSummary, validateAttendancePunches, validatePayrollPeriod, validateWeeklySchedule } from './payroll';

describe('payroll calculations', () => {
  it('assigns semi-monthly cutoffs', () => {
    expect(periodId('2026-08-15')).toBe('2026-08-A');
    expect(periodId('2026-08-16')).toBe('2026-08-B');
  });

  it('applies grace, undertime and overtime rules from the legacy tracker', () => {
    const row = calculateAttendance({ date: '2026-08-20', timeIn: '08:12', timeOut: '17:30', status: 'Present', remarks: '' }, defaultSettings);
    expect(row.workedHours).toBe(8.3);
    expect(row.lateMinutes).toBe(7);
    expect(row.undertimeMinutes).toBe(0);
    expect(row.overtimeHours).toBe(0.5);
  });

  it('deducts only the part of a shift that overlaps the unpaid break', () => {
    const beforeBreak = calculateAttendance({ date: '2026-08-20', timeIn: '08:00', timeOut: '12:00', status: 'Half Day', remarks: '' }, defaultSettings);
    const partialOverlap = calculateAttendance({ date: '2026-08-21', timeIn: '12:30', timeOut: '17:00', status: 'Half Day', remarks: '' }, defaultSettings);
    expect(beforeBreak.workedHours).toBe(4);
    expect(partialOverlap.workedHours).toBe(4);
  });

  it('supports overnight unpaid break intervals', () => {
    expect(breakDurationHours('23:30', '00:30')).toBe(1);
    const overnight = calculateAttendance({ date: '2026-08-20', timeIn: '22:00', timeOut: '06:00', status: 'Present', remarks: '' }, { ...defaultSettings, standardTimeIn: '22:00', standardTimeOut: '06:00', breakStartTime: '23:30', breakEndTime: '00:30' });
    expect(overnight.workedHours).toBe(7);
  });

  it('summarizes the same intervals shown by the schedule time map', () => {
    expect(scheduleSummary(defaultSettings)).toEqual({ elapsedHours: 9, unpaidBreakHours: 1, paidHours: 8 });
  });

  it('uses weekday work intervals and excludes split-shift gaps', () => {
    const schedule = defaultWeeklySchedule(defaultSettings);
    const monday = scheduleDayForDate('2026-08-17', schedule);
    const row = calculateAttendance({ date: '2026-08-17', timeIn: '08:00', timeOut: '17:00', status: 'Present', remarks: '' }, defaultSettings, '2026-08-B', monday);
    expect(row.workedHours).toBe(8);

    const splitDay = { weekday: 1, isWorking: true, intervals: [
      { id: 'morning', type: 'work' as const, startTime: '08:00', endTime: '12:00' },
      { id: 'evening', type: 'work' as const, startTime: '16:00', endTime: '20:00' },
    ] };
    const splitRow = calculateAttendance({ date: '2026-08-17', timeIn: '08:00', timeOut: '20:00', status: 'Present', remarks: '' }, defaultSettings, '2026-08-B', splitDay);
    expect(splitRow.totalHours).toBe(12);
    expect(splitRow.workedHours).toBe(8);
  });

  it('treats logged work on a configured rest day as overtime', () => {
    const schedule = defaultWeeklySchedule(defaultSettings);
    const sunday = scheduleDayForDate('2026-08-16', schedule);
    const row = calculateAttendance({ date: '2026-08-16', timeIn: '09:00', timeOut: '12:00', status: 'Present', remarks: '' }, defaultSettings, '2026-08-B', sunday);
    expect(row.workedHours).toBe(3);
    expect(row.overtimeHours).toBe(3);
  });

  it('resolves rotating cycle days from an anchor date', () => {
    const schedule = Array.from({ length: 4 }, (_, weekday) => ({ weekday, isWorking: weekday < 2, intervals: [] }));
    const config = { mode: 'rotating' as const, anchorDate: '2026-09-01', cycleLength: 4 };
    expect(scheduleDayForConfig('2026-09-01', config, schedule)?.weekday).toBe(0);
    expect(scheduleDayForConfig('2026-09-05', config, schedule)?.weekday).toBe(0);
    expect(scheduleDayForConfig('2026-08-31', config, schedule)?.weekday).toBe(3);
  });

  it('sums multiple punches while excluding the gap between them', () => {
    const monday = scheduleDayForDate('2026-08-17', defaultWeeklySchedule(defaultSettings));
    const punches = [
      { id: 'morning', timeIn: '08:00', timeOut: '12:00' },
      { id: 'afternoon', timeIn: '13:00', timeOut: '17:00' },
    ];
    const row = calculateAttendance({ date: '2026-08-17', punches, status: 'Present', remarks: '' }, defaultSettings, '2026-08-B', monday);
    expect(row.totalHours).toBe(8);
    expect(row.workedHours).toBe(8);
    expect(row.punches).toEqual(punches);
    expect(validateAttendancePunches(punches)).toBe('');
  });

  it('validates working days and rejects overlapping intervals', () => {
    const schedule = defaultWeeklySchedule(defaultSettings);
    expect(validateWeeklySchedule(schedule)).toBe('');
    schedule[1].intervals.push({ id: 'overlap', type: 'work', startTime: '11:00', endTime: '14:00' });
    expect(validateWeeklySchedule(schedule)).toContain('cannot overlap');
  });

  it('deducts absent and half days from expected gross', () => {
    const absent = calculateAttendance({ date: '2026-08-20', timeIn: '', timeOut: '', status: 'Absent', remarks: '' }, defaultSettings);
    const half = calculateAttendance({ date: '2026-08-21', timeIn: '08:00', timeOut: '12:00', status: 'Half Day', remarks: '' }, defaultSettings);
    const result = salaryBreakdown('2026-08-B', [absent, half], defaultSettings);
    expect(result.basePay).toBe(17500);
    expect(result.absenceDeduction).toBe(2386.36);
    expect(result.expectedGross).toBeLessThan(result.basePay);
  });

  it('rejects duplicate and overlapping payroll periods', () => {
    const periods = [{ id: '2026-09-A', startDate: '2026-09-01', endDate: '2026-09-15', label: 'First cutoff' }];
    expect(validatePayrollPeriod({ ...periods[0] }, periods)).toContain('already exists');
    expect(validatePayrollPeriod({ id: '2026-09-B', startDate: '2026-09-15', endDate: '2026-09-30', label: 'Second cutoff' }, periods)).toContain('overlaps');
    expect(validatePayrollPeriod({ id: '2026-09-B', startDate: '2026-09-16', endDate: '2026-09-30', label: 'Second cutoff' }, periods)).toBe('');
  });

  it('allows editing a period without treating itself as an overlap', () => {
    const periods = [{ id: '2026-09-A', startDate: '2026-09-01', endDate: '2026-09-15', label: 'First cutoff' }];
    expect(validatePayrollPeriod({ ...periods[0], label: 'September first cutoff' }, periods, '2026-09-A')).toBe('');
  });
});
