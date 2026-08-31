import { describe, expect, it } from 'vitest';
import { calculateAttendance, defaultSettings, periodId, salaryBreakdown } from './payroll';

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

  it('deducts absent and half days from expected gross', () => {
    const absent = calculateAttendance({ date: '2026-08-20', timeIn: '', timeOut: '', status: 'Absent', remarks: '' }, defaultSettings);
    const half = calculateAttendance({ date: '2026-08-21', timeIn: '08:00', timeOut: '12:00', status: 'Half Day', remarks: '' }, defaultSettings);
    const result = salaryBreakdown('2026-08-B', [absent, half], defaultSettings);
    expect(result.basePay).toBe(17500);
    expect(result.absenceDeduction).toBe(2386.36);
    expect(result.expectedGross).toBeLessThan(result.basePay);
  });
});
