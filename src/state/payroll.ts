import type { AttendanceEntry, AttendancePunch, AttendanceStatus, PayrollPeriod, SalaryBreakdown, ScheduleConfig, ScheduleInterval, Settings, WeeklyScheduleDay } from './types';
export const defaultSettings: Settings = { monthlySalary: 35000, workHoursPerDay: 8, workDaysPerMonth: 22, standardTimeIn: '08:00', standardTimeOut: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', lunchBreakHours: 1, lateGraceMinutes: 5, lateDeductionRate: 2.4, absenceDailyRate: 35000 / 22, otMultiplier: 1.25, differenceTolerance: 50 };
export const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value);
export const shortDate = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
export const todayText = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
export const defaultScheduleConfig: ScheduleConfig = { mode: 'weekly', anchorDate: todayText(), cycleLength: 7 };
export function periodId(dateText: string) { const [year, month, day] = dateText.split('-').map(Number); return `${year}-${String(month).padStart(2, '0')}-${day <= 15 ? 'A' : 'B'}`; }
export function periodLabel(id: string) { const [year, month, cutoff] = id.split('-'); const name = new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(Number(year), Number(month) - 1, 1)); const end = cutoff === 'A' ? '15' : new Date(Number(year), Number(month), 0).getDate(); return `${name} ${cutoff === 'A' ? '1' : '16'}–${end}, ${year}`; }
const minutes = (time: string) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function breakDurationHours(startTime: string, endTime: string) {
  const start = minutes(startTime);
  let end = minutes(endTime);
  if (end < start) end += 1440;
  return round((end - start) / 60);
}

function breakOverlapMinutes(workStart: number, workEnd: number, breakStartTime: string, breakEndTime: string) {
  const rawStart = minutes(breakStartTime);
  let rawEnd = minutes(breakEndTime);
  if (rawEnd < rawStart) rawEnd += 1440;
  if (rawStart === rawEnd) return 0;
  return [-1440, 0, 1440].reduce((largest, offset) => {
    const overlap = Math.max(0, Math.min(workEnd, rawEnd + offset) - Math.max(workStart, rawStart + offset));
    return Math.max(largest, overlap);
  }, 0);
}

export function scheduleSummary(settings: Pick<Settings, 'standardTimeIn' | 'standardTimeOut' | 'breakStartTime' | 'breakEndTime'>) {
  const start = minutes(settings.standardTimeIn);
  let end = minutes(settings.standardTimeOut);
  if (end < start) end += 1440;
  const elapsedMinutes = Math.max(0, end - start);
  const unpaidBreakMinutes = breakOverlapMinutes(start, end, settings.breakStartTime, settings.breakEndTime);
  return {
    elapsedHours: round(elapsedMinutes / 60),
    unpaidBreakHours: round(unpaidBreakMinutes / 60),
    paidHours: round(Math.max(0, elapsedMinutes - unpaidBreakMinutes) / 60),
  };
}

type AttendanceInput = { date: string; timeIn?: string; timeOut?: string; punches?: AttendancePunch[]; status: AttendanceStatus; remarks: string };

function punchRange(punch: Pick<AttendancePunch, 'timeIn' | 'timeOut'>) {
  const start = minutes(punch.timeIn);
  let end = minutes(punch.timeOut);
  if (end < start) end += 1440;
  return { start, end };
}

export function validateAttendancePunches(punches: AttendancePunch[]) {
  if (!punches.length) return 'Add at least one clock-in/out pair.';
  if (punches.some((punch) => !punch.timeIn || !punch.timeOut || punch.timeIn === punch.timeOut)) return 'Each punch needs different clock-in and clock-out times.';
  const ranges = punches.map(punchRange).sort((left, right) => left.start - right.start);
  if (ranges.some((range, index) => index > 0 && range.start < ranges[index - 1].end)) return 'Attendance punches cannot overlap.';
  return '';
}

export function calculateAttendance(input: AttendanceInput, settings: Settings, payrollPeriod = periodId(input.date), scheduleDay?: WeeklyScheduleDay): AttendanceEntry {
  let totalHours = 0, workedHours = 0, lateMinutes = 0, undertimeMinutes = 0, overtimeHours = 0;
  const nonWorked: AttendanceStatus[] = ['Absent', 'Leave', 'Holiday', 'Rest Day'];
  const punches = (input.punches ?? (input.timeIn && input.timeOut ? [{ id: crypto.randomUUID(), timeIn: input.timeIn, timeOut: input.timeOut }] : []))
    .map((punch) => ({ ...punch, id: punch.id || crypto.randomUUID() }));
  if (!nonWorked.includes(input.status)) {
    const ranges = punches.map(punchRange).sort((left, right) => left.start - right.start);
    totalHours = round(ranges.reduce((sum, range) => sum + range.end - range.start, 0) / 60);
    const start = ranges[0]?.start ?? 0;
    const end = ranges.reduce((latest, range) => Math.max(latest, range.end), 0);
    if (scheduleDay) {
      const work = scheduleDay.intervals.filter((interval) => interval.type === 'work').sort((left, right) => minutes(left.startTime) - minutes(right.startTime));
      if (!scheduleDay.isWorking || !work.length) {
        const breaks = scheduleDay.intervals.filter((interval) => interval.type === 'break');
        const unpaidBreakMinutes = ranges.reduce((sum, range) => sum + breaks.reduce((breakSum, interval) => breakSum + breakOverlapMinutes(range.start, range.end, interval.startTime, interval.endTime), 0), 0);
        workedHours = round(Math.max(totalHours - unpaidBreakMinutes / 60, 0));
        overtimeHours = workedHours;
      } else {
        const scheduleStart = minutes(work[0].startTime);
        const scheduleEnd = work.reduce((latest, interval) => {
          const intervalStart = minutes(interval.startTime) < scheduleStart ? minutes(interval.startTime) + 1440 : minutes(interval.startTime);
          let intervalEnd = minutes(interval.endTime);
          while (intervalEnd <= intervalStart) intervalEnd += 1440;
          return Math.max(latest, intervalEnd);
        }, scheduleStart);
        lateMinutes = Math.max(start - scheduleStart - settings.lateGraceMinutes, 0);
        undertimeMinutes = Math.max(scheduleEnd - end, 0);
        overtimeHours = round(ranges.reduce((sum, range) => sum + Math.max(range.end - Math.max(range.start, scheduleEnd), 0), 0) / 60);
        const scheduledWorkMinutes = ranges.reduce((sum, range) => sum + work.reduce((workSum, item) => workSum + breakOverlapMinutes(range.start, range.end, item.startTime, item.endTime), 0), 0);
        workedHours = round(scheduledWorkMinutes / 60 + overtimeHours);
      }
    } else {
      const unpaidBreakMinutes = ranges.reduce((sum, range) => sum + breakOverlapMinutes(range.start, range.end, settings.breakStartTime, settings.breakEndTime), 0);
      workedHours = round(Math.max(totalHours - unpaidBreakMinutes / 60, 0));
      lateMinutes = Math.max(start - minutes(settings.standardTimeIn) - settings.lateGraceMinutes, 0);
      undertimeMinutes = Math.max(minutes(settings.standardTimeOut) - end, 0);
      overtimeHours = round(Math.max((end - minutes(settings.standardTimeOut)) / 60, 0));
    }
  }
  return { date: input.date, timeIn: punches[0]?.timeIn ?? '', timeOut: punches[punches.length - 1]?.timeOut ?? '', punches, status: input.status, remarks: input.remarks, id: crypto.randomUUID(), payrollPeriod, totalHours, workedHours, lateMinutes, undertimeMinutes, overtimeHours };
}

function interval(id: string, type: ScheduleInterval['type'], startTime: string, endTime: string): ScheduleInterval {
  return { id, type, startTime, endTime };
}

export function defaultWeeklySchedule(settings: Settings): WeeklyScheduleDay[] {
  const breakInsideDay = settings.breakStartTime > settings.standardTimeIn && settings.breakEndTime < settings.standardTimeOut;
  return Array.from({ length: 7 }, (_, weekday) => {
    const isWorking = weekday >= 1 && weekday <= 5;
    if (!isWorking) return { weekday, isWorking: false, intervals: [] };
    const intervals = breakInsideDay
      ? [
          interval(`${weekday}-work-1`, 'work', settings.standardTimeIn, settings.breakStartTime),
          interval(`${weekday}-break-1`, 'break', settings.breakStartTime, settings.breakEndTime),
          interval(`${weekday}-work-2`, 'work', settings.breakEndTime, settings.standardTimeOut),
        ]
      : [interval(`${weekday}-work-1`, 'work', settings.standardTimeIn, settings.standardTimeOut)];
    return { weekday, isWorking: true, intervals };
  });
}

export function scheduleDayForDate(date: string, schedule: WeeklyScheduleDay[]) {
  const day = new Date(`${date}T00:00:00`).getDay();
  return schedule.find((item) => item.weekday === day);
}

function utcDayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function scheduleDayForConfig(date: string, config: ScheduleConfig, schedule: WeeklyScheduleDay[]) {
  if (config.mode === 'weekly') return scheduleDayForDate(date, schedule);
  const offset = utcDayNumber(date) - utcDayNumber(config.anchorDate);
  const cycleDay = ((offset % config.cycleLength) + config.cycleLength) % config.cycleLength;
  return schedule.find((item) => item.weekday === cycleDay);
}

export function defaultRotatingSchedule(length: number): WeeklyScheduleDay[] {
  return Array.from({ length }, (_, weekday) => ({ weekday, isWorking: false, intervals: [] }));
}

function splitDayInterval(item: ScheduleInterval) {
  const start = minutes(item.startTime);
  const end = minutes(item.endTime);
  if (start === end) return [];
  return end > start ? [{ start, end }] : [{ start, end: 1440 }, { start: 0, end }];
}

export function validateWeeklySchedule(schedule: WeeklyScheduleDay[]) {
  if (schedule.length !== 7 || new Set(schedule.map((day) => day.weekday)).size !== 7) return 'The weekly schedule must contain all seven days.';
  for (const day of schedule) {
    if (!day.isWorking && day.intervals.length) return 'Rest days cannot contain work or break intervals.';
    if (day.isWorking && !day.intervals.some((item) => item.type === 'work')) return 'Every working day needs at least one work interval.';
    if (day.intervals.some((item) => item.startTime === item.endTime)) return 'Interval start and end times must be different.';
    const expanded = day.intervals.flatMap((item) => splitDayInterval(item).map((segment) => ({ ...segment, id: item.id })));
    for (let left = 0; left < expanded.length; left += 1) {
      for (let right = left + 1; right < expanded.length; right += 1) {
        if (expanded[left].id !== expanded[right].id && expanded[left].start < expanded[right].end && expanded[left].end > expanded[right].start) return 'Schedule intervals on the same day cannot overlap.';
      }
    }
  }
  return '';
}


export function validateSchedule(config: ScheduleConfig, schedule: WeeklyScheduleDay[]) {
  if (!config.anchorDate) return 'A rotation anchor date is required.';
  if (!Number.isInteger(config.cycleLength) || config.cycleLength < 1 || config.cycleLength > 28) return 'Cycle length must be between 1 and 28 days.';
  if (schedule.length !== config.cycleLength || new Set(schedule.map((day) => day.weekday)).size !== config.cycleLength) return `The schedule must contain all ${config.cycleLength} cycle days.`;
  return validateScheduleDays(schedule);
}

function validateScheduleDays(schedule: WeeklyScheduleDay[]) {
  for (const day of schedule) {
    if (!day.isWorking && day.intervals.length) return 'Rest days cannot contain work or break intervals.';
    if (day.isWorking && !day.intervals.some((item) => item.type === 'work')) return 'Every working day needs at least one work interval.';
    if (day.intervals.some((item) => item.startTime === item.endTime)) return 'Interval start and end times must be different.';
    const expanded = day.intervals.flatMap((item) => splitDayInterval(item).map((segment) => ({ ...segment, id: item.id })));
    for (let left = 0; left < expanded.length; left += 1) for (let right = left + 1; right < expanded.length; right += 1) {
      if (expanded[left].id !== expanded[right].id && expanded[left].start < expanded[right].end && expanded[left].end > expanded[right].start) return 'Schedule intervals on the same day cannot overlap.';
    }
  }
  return '';
}

export function defaultPayrollPeriod(date = todayText()): PayrollPeriod {
  const [year, month, day] = date.split('-').map(Number);
  const firstCutoff = day <= 15;
  const id = `${year}-${String(month).padStart(2, '0')}-${firstCutoff ? 'A' : 'B'}`;
  const startDay = firstCutoff ? 1 : 16;
  const endDay = firstCutoff ? 15 : new Date(year, month, 0).getDate();
  const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(year, month - 1, 1));
  return {
    id,
    startDate: `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    label: `${monthName} ${startDay}-${endDay}, ${year}`,
  };
}

export function validatePayrollPeriod(period: PayrollPeriod, periods: PayrollPeriod[], editingId?: string) {
  const candidate = { ...period, id: period.id.trim(), label: period.label.trim() };
  if (!candidate.id) return 'Period ID is required.';
  if (!/^\d{4}-(0[1-9]|1[0-2])-[AB]$/.test(candidate.id)) return 'Period ID must use YYYY-MM-A or YYYY-MM-B format.';
  if (!candidate.startDate || !candidate.endDate) return 'Start and end dates are required.';
  if (candidate.startDate > candidate.endDate) return 'The end date must be on or after the start date.';
  if (periods.some((item) => item.id === candidate.id && item.id !== editingId)) return `Payroll period ${candidate.id} already exists.`;
  const overlap = periods.find((item) => item.id !== editingId && candidate.startDate <= item.endDate && candidate.endDate >= item.startDate);
  if (overlap) return `Date range overlaps with ${overlap.label || overlap.id}.`;
  return '';
}
export function salaryBreakdown(payrollPeriod: string, rows: AttendanceEntry[], settings: Settings): SalaryBreakdown {
  const periodRows = rows.filter((row) => row.payrollPeriod === payrollPeriod); const dailyRate = settings.monthlySalary / settings.workDaysPerMonth; const hourlyRate = dailyRate / settings.workHoursPerDay; const minuteRate = hourlyRate / 60;
  const lateDeduction = periodRows.reduce((sum, row) => sum + row.lateMinutes, 0) * settings.lateDeductionRate; const undertimeDeduction = periodRows.reduce((sum, row) => sum + row.undertimeMinutes, 0) * minuteRate; const absentDays = periodRows.reduce((sum, row) => sum + (row.status === 'Absent' ? 1 : row.status === 'Half Day' ? .5 : 0), 0); const overtimePay = periodRows.reduce((sum, row) => sum + row.overtimeHours, 0) * hourlyRate * settings.otMultiplier; const basePay = settings.monthlySalary / 2;
  return { basePay: round(basePay), overtimePay: round(overtimePay), lateDeduction: round(lateDeduction), undertimeDeduction: round(undertimeDeduction), absenceDeduction: round(absentDays * settings.absenceDailyRate), expectedGross: round(basePay + overtimePay - lateDeduction - undertimeDeduction - absentDays * settings.absenceDailyRate) };
}
