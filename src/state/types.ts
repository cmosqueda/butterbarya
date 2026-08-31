export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Leave' | 'Holiday' | 'Rest Day' | 'Half Day';
export interface Settings { monthlySalary: number; workHoursPerDay: number; workDaysPerMonth: number; standardTimeIn: string; standardTimeOut: string; lunchBreakHours: number; lateGraceMinutes: number; otMultiplier: number; differenceTolerance: number; }
export interface AttendanceEntry { id: string; date: string; timeIn: string; timeOut: string; status: AttendanceStatus; remarks: string; payrollPeriod: string; totalHours: number; workedHours: number; lateMinutes: number; undertimeMinutes: number; overtimeHours: number; }
export interface Payslip { id: string; payrollPeriod: string; releaseDate: string; grossPay: number; netPay: number; tax: number; sss: number; philhealth: number; pagibig: number; remarks: string; }
export interface PayrollStore { settings: Settings; attendance: AttendanceEntry[]; payslips: Payslip[]; }
export interface SalaryBreakdown { basePay: number; overtimePay: number; lateDeduction: number; undertimeDeduction: number; absenceDeduction: number; expectedGross: number; }
