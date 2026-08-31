import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateAttendance, defaultSettings } from './payroll';
import { insertAttendance, insertPayslip, loadPayrollStore, removeAttendance, removePayslip, saveSettings } from './database';
import type { AttendanceStatus, PayrollStore, Payslip, Settings } from './types';

const initialStore: PayrollStore = { settings: defaultSettings, attendance: [], payslips: [] };

interface PayrollContextValue extends PayrollStore {
  addAttendance: (input: { date: string; timeIn: string; timeOut: string; status: AttendanceStatus; remarks: string }) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
  addPayslip: (input: Omit<Payslip, 'id'>) => Promise<void>;
  deletePayslip: (id: string) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
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
      const row = calculateAttendance(input, store.settings);
      await insertAttendance(row);
      setStore((current) => ({ ...current, attendance: [row, ...current.attendance] }));
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
    updateSettings: async (settings) => {
      await saveSettings(settings);
      setStore((current) => ({ ...current, settings }));
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
