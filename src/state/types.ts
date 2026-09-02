export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Leave' | 'Holiday' | 'Rest Day' | 'Half Day';
export interface Settings { monthlySalary: number; workHoursPerDay: number; workDaysPerMonth: number; standardTimeIn: string; standardTimeOut: string; breakStartTime: string; breakEndTime: string; lunchBreakHours: number; lateGraceMinutes: number; otMultiplier: number; differenceTolerance: number; }
export interface PayrollPeriod { id: string; startDate: string; endDate: string; label: string; }
export type ScheduleIntervalType = 'work' | 'break';
export interface ScheduleInterval { id: string; type: ScheduleIntervalType; startTime: string; endTime: string; }
export interface WeeklyScheduleDay { weekday: number; isWorking: boolean; intervals: ScheduleInterval[]; }
export type ScheduleMode = 'weekly' | 'rotating';
export interface ScheduleConfig { mode: ScheduleMode; anchorDate: string; cycleLength: number; }
export interface AttendancePunch { id: string; timeIn: string; timeOut: string; }
export interface AttendanceEntry { id: string; date: string; timeIn: string; timeOut: string; punches: AttendancePunch[]; status: AttendanceStatus; remarks: string; payrollPeriod: string; totalHours: number; workedHours: number; lateMinutes: number; undertimeMinutes: number; overtimeHours: number; }
export interface Payslip { id: string; payrollPeriod: string; releaseDate: string; grossPay: number; netPay: number; tax: number; sss: number; philhealth: number; pagibig: number; remarks: string; }
export interface PayrollStore { settings: Settings; scheduleConfig: ScheduleConfig; weeklySchedule: WeeklyScheduleDay[]; payrollPeriods: PayrollPeriod[]; attendance: AttendanceEntry[]; payslips: Payslip[]; }
export interface SalaryBreakdown { basePay: number; overtimePay: number; lateDeduction: number; undertimeDeduction: number; absenceDeduction: number; expectedGross: number; }
