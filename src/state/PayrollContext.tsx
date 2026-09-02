import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateAttendance, defaultPayrollPeriod, defaultScheduleConfig, defaultSettings, defaultWeeklySchedule, scheduleDayForConfig } from './payroll';
import { insertAttendance, insertPayrollPeriod, insertPayslip, loadPayrollStore, removeAttendance, removePayrollPeriod, removePayslip, saveSchedule, saveSettings, updateAttendanceCalculations, updatePayrollPeriod } from './database';
import type { AttendancePunch, AttendanceStatus, PayrollPeriod, PayrollStore, Payslip, ScheduleConfig, Settings, WeeklyScheduleDay } from './types';

const initialStore: PayrollStore = { settings: defaultSettings, scheduleConfig: defaultScheduleConfig, weeklySchedule: defaultWeeklySchedule(defaultSettings), payrollPeriods: [], attendance: [], payslips: [] };

interface PayrollContextValue extends PayrollStore {
  addAttendance: (input: { date: string; timeIn?: string; timeOut?: string; punches?: AttendancePunch[]; status: AttendanceStatus; remarks: string }) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  addPayslip: (input: Omit<Payslip, 'id'>) => Promise<void>;
  deletePayslip: (id: string) => Promise<void>;
  addPayrollPeriod: (period: PayrollPeriod) => Promise<void>;
  editPayrollPeriod: (previousId: string, period: PayrollPeriod) => Promise<void>;
  deletePayrollPeriod: (id: string) => Promise<void>;
  updateSettings: (settings: Settings, weeklySchedule?: WeeklyScheduleDay[], scheduleConfig?: ScheduleConfig) => Promise<void>;
}

const PayrollContext = createContext<PayrollContextValue | null>(null);

export const PayrollProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [store, setStore] = useState<PayrollStore>(initialStore);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadPayrollStore()
      .then((loaded) => { if (active) { setStore(loaded); setReady(true); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, []);

  const value = useMemo<PayrollContextValue>(() => ({
    ...store,
    addAttendance: async (input) => {
      let matchingPeriod = store.payrollPeriods.find((period) => input.date >= period.startDate && input.date <= period.endDate);
      let createdPeriod: PayrollPeriod | undefined;
      if (!matchingPeriod) {
        createdPeriod = defaultPayrollPeriod(input.date);
        await insertPayrollPeriod(createdPeriod);
        matchingPeriod = createdPeriod;
      }
      const row = calculateAttendance(input, store.settings, matchingPeriod.id, scheduleDayForConfig(input.date, store.scheduleConfig, store.weeklySchedule));
      await insertAttendance(row);
      setStore((current) => ({
        ...current,
        payrollPeriods: createdPeriod ? [createdPeriod, ...current.payrollPeriods].sort((a, b) => b.startDate.localeCompare(a.startDate)) : current.payrollPeriods,
        attendance: [row, ...current.attendance],
      }));
    },
    deleteAttendance: async (id) => {
      await removeAttendance(id);
      setStore((current) => ({ ...current, attendance: current.attendance.filter((item) => item.id !== id) }));
    },
    addPayslip: async (input) => {
      const row = { ...input, id: crypto.randomUUID() };
      await insertPayslip(row);
      setStore((current) => ({ ...current, payslips: [row, ...current.payslips] }));
    },
    deletePayslip: async (id) => {
      await removePayslip(id);
      setStore((current) => ({ ...current, payslips: current.payslips.filter((item) => item.id !== id) }));
    },
    addPayrollPeriod: async (period) => {
      await insertPayrollPeriod(period);
      setStore((current) => ({ ...current, payrollPeriods: [period, ...current.payrollPeriods].sort((a, b) => b.startDate.localeCompare(a.startDate)) }));
    },
    editPayrollPeriod: async (previousId, period) => {
      await updatePayrollPeriod(previousId, period);
      setStore((current) => ({
        ...current,
        payrollPeriods: current.payrollPeriods.map((item) => item.id === previousId ? period : item).sort((a, b) => b.startDate.localeCompare(a.startDate)),
        attendance: current.attendance.map((item) => item.payrollPeriod === previousId ? { ...item, payrollPeriod: period.id } : item),
        payslips: current.payslips.map((item) => item.payrollPeriod === previousId ? { ...item, payrollPeriod: period.id } : item),
      }));
    },
    deletePayrollPeriod: async (id) => {
      await removePayrollPeriod(id);
      setStore((current) => ({ ...current, payrollPeriods: current.payrollPeriods.filter((item) => item.id !== id) }));
    },
    updateSettings: async (settings, weeklySchedule = store.weeklySchedule, scheduleConfig = store.scheduleConfig) => {
      const attendance = store.attendance.map((row) => ({
        ...calculateAttendance({ date: row.date, punches: row.punches, status: row.status, remarks: row.remarks }, settings, row.payrollPeriod, scheduleDayForConfig(row.date, scheduleConfig, weeklySchedule)),
        id: row.id,
      }));
      await saveSettings(settings);
      await saveSchedule(scheduleConfig, weeklySchedule);
      await updateAttendanceCalculations(attendance);
      setStore((current) => ({ ...current, settings, scheduleConfig, weeklySchedule, attendance }));
    },
  }), [store]);

  if (error) return <div className="database-state" role="alert"><strong>Couldn’t open Butterbarya</strong><span>{error}</span><button onClick={() => window.location.reload()}>Try again</button></div>;
  if (!ready) return <div className="database-state"><span className="database-spinner" /><strong>Opening your payroll…</strong><span>Preparing the secure local database</span></div>;
  return <PayrollContext.Provider value={value}>{children}</PayrollContext.Provider>;
};

export function usePayroll() {
  const context = useContext(PayrollContext);
  if (!context) throw new Error('usePayroll must be used within PayrollProvider');
  return context;
}
