import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock('./state/database', () => ({
  loadPayrollStore: async () => ({
    settings: { monthlySalary: 35000, workHoursPerDay: 8, workDaysPerMonth: 22, standardTimeIn: '08:00', standardTimeOut: '17:00', breakStartTime: '12:00', breakEndTime: '13:00', lunchBreakHours: 1, lateGraceMinutes: 5, lateDeductionRate: 2.4, absenceDailyRate: 35000 / 22, otMultiplier: 1.25, differenceTolerance: 50 },
    scheduleConfig: { mode: 'weekly', anchorDate: '2026-09-01', cycleLength: 7 },
    weeklySchedule: [
      { weekday: 0, isWorking: false, intervals: [] },
      { weekday: 1, isWorking: true, intervals: [{ id: 'mon-work', type: 'work', startTime: '08:00', endTime: '17:00' }] },
      { weekday: 2, isWorking: true, intervals: [{ id: 'tue-work', type: 'work', startTime: '08:00', endTime: '17:00' }] },
      { weekday: 3, isWorking: true, intervals: [{ id: 'wed-work', type: 'work', startTime: '08:00', endTime: '17:00' }] },
      { weekday: 4, isWorking: true, intervals: [{ id: 'thu-work', type: 'work', startTime: '08:00', endTime: '17:00' }] },
      { weekday: 5, isWorking: true, intervals: [{ id: 'fri-work', type: 'work', startTime: '08:00', endTime: '17:00' }] },
      { weekday: 6, isWorking: false, intervals: [] },
    ],
    payrollPeriods: [{ id: '2026-09-A', startDate: '2026-09-01', endDate: '2026-09-15', label: 'September 1-15, 2026' }],
    attendance: [],
    payslips: [],
  }),
  insertAttendance: vi.fn(), removeAttendance: vi.fn(), insertPayslip: vi.fn(), removePayslip: vi.fn(), insertPayrollPeriod: vi.fn(), updatePayrollPeriod: vi.fn(), removePayrollPeriod: vi.fn(), saveSettings: vi.fn(), saveSchedule: vi.fn(), updateAttendanceCalculations: vi.fn(), loadGlobalPreferences: async () => ({ theme: 'system', onboardingComplete: true }),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

test('renders the payroll dashboard with payroll tabs', async () => {
  window.history.replaceState({}, '', '/overview');
  const { getByText } = render(<App />);
  await waitFor(() => expect(getByText('Expected gross')).toBeDefined());
  expect(document.querySelector('.app-tabs')).toBeInTheDocument();
});

test('renders Budget as a separate module without payroll tabs', async () => {
  window.history.replaceState({}, '', '/budget');
  const { getByText } = render(<App />);
  await waitFor(() => expect(getByText('Budget tracking is on the way.')).toBeInTheDocument());
  expect(document.querySelector('.app-tabs')).not.toBeInTheDocument();
  expect(getByText('Budget')).toBeInTheDocument();
});
