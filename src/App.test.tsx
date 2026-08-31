import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock('./state/database', () => ({
  loadPayrollStore: async () => ({
    settings: { monthlySalary: 35000, workHoursPerDay: 8, workDaysPerMonth: 22, standardTimeIn: '08:00', standardTimeOut: '17:00', lunchBreakHours: 1, lateGraceMinutes: 5, otMultiplier: 1.25, differenceTolerance: 50 },
    attendance: [],
    payslips: [],
  }),
  insertAttendance: vi.fn(), removeAttendance: vi.fn(), insertPayslip: vi.fn(), removePayslip: vi.fn(), saveSettings: vi.fn(),
}));

test('renders the dashboard after the database is ready', async () => {
  const { getByText } = render(<App />);
  await waitFor(() => expect(getByText('Expected gross')).toBeDefined());
});
