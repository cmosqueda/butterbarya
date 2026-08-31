import type { AttendanceEntry, AttendanceStatus, SalaryBreakdown, Settings } from './types';
export const defaultSettings: Settings = { monthlySalary: 35000, workHoursPerDay: 8, workDaysPerMonth: 22, standardTimeIn: '08:00', standardTimeOut: '17:00', lunchBreakHours: 1, lateGraceMinutes: 5, otMultiplier: 1.25, differenceTolerance: 50 };
export const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value);
export const shortDate = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
export const todayText = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
export function periodId(dateText: string) { const [year, month, day] = dateText.split('-').map(Number); return `${year}-${String(month).padStart(2, '0')}-${day <= 15 ? 'A' : 'B'}`; }
export function periodLabel(id: string) { const [year, month, cutoff] = id.split('-'); const name = new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(Number(year), Number(month) - 1, 1)); const end = cutoff === 'A' ? '15' : new Date(Number(year), Number(month), 0).getDate(); return `${name} ${cutoff === 'A' ? '1' : '16'}–${end}, ${year}`; }
const minutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculateAttendance(input: { date: string; timeIn: string; timeOut: string; status: AttendanceStatus; remarks: string }, settings: Settings): AttendanceEntry {
  let totalHours = 0, workedHours = 0, lateMinutes = 0, undertimeMinutes = 0, overtimeHours = 0;
  const nonWorked: AttendanceStatus[] = ['Absent', 'Leave', 'Holiday', 'Rest Day'];
  if (!nonWorked.includes(input.status)) { const start = minutes(input.timeIn); let end = minutes(input.timeOut); if (end < start) end += 1440; totalHours = round((end - start) / 60); workedHours = round(Math.max(totalHours - settings.lunchBreakHours, 0)); lateMinutes = Math.max(start - minutes(settings.standardTimeIn) - settings.lateGraceMinutes, 0); undertimeMinutes = Math.max(minutes(settings.standardTimeOut) - end, 0); overtimeHours = round(Math.max((end - minutes(settings.standardTimeOut)) / 60, 0)); }
  return { ...input, id: crypto.randomUUID(), payrollPeriod: periodId(input.date), totalHours, workedHours, lateMinutes, undertimeMinutes, overtimeHours };
}
export function salaryBreakdown(payrollPeriod: string, rows: AttendanceEntry[], settings: Settings): SalaryBreakdown {
  const periodRows = rows.filter((row) => row.payrollPeriod === payrollPeriod); const dailyRate = settings.monthlySalary / settings.workDaysPerMonth; const hourlyRate = dailyRate / settings.workHoursPerDay; const minuteRate = hourlyRate / 60;
  const lateDeduction = periodRows.reduce((sum, row) => sum + row.lateMinutes, 0) * minuteRate; const undertimeDeduction = periodRows.reduce((sum, row) => sum + row.undertimeMinutes, 0) * minuteRate; const absentDays = periodRows.reduce((sum, row) => sum + (row.status === 'Absent' ? 1 : row.status === 'Half Day' ? .5 : 0), 0); const overtimePay = periodRows.reduce((sum, row) => sum + row.overtimeHours, 0) * hourlyRate * settings.otMultiplier; const basePay = settings.monthlySalary / 2;
  return { basePay: round(basePay), overtimePay: round(overtimePay), lateDeduction: round(lateDeduction), undertimeDeduction: round(undertimeDeduction), absenceDeduction: round(absentDays * dailyRate), expectedGross: round(basePay + overtimePay - lateDeduction - undertimeDeduction - absentDays * dailyRate) };
}
