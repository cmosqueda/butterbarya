import { fireEvent, render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Attendance from './Attendance';
import { periodId, shortDate, todayText } from '../state/payroll';
import type { AttendanceEntry } from '../state/types';

const mocks = vi.hoisted(() => ({
  addAttendance: vi.fn(),
  deleteAttendance: vi.fn(),
}));

const loggedDate = todayText();
const loggedEntry: AttendanceEntry = {
  id: 'logged-day',
  date: loggedDate,
  timeIn: '08:10',
  timeOut: '17:15',
  punches: [{ id: 'punch-1', timeIn: '08:10', timeOut: '17:15' }],
  status: 'Present',
  remarks: '',
  payrollPeriod: periodId(loggedDate),
  totalHours: 9.08,
  workedHours: 8.08,
  lateMinutes: 5,
  undertimeMinutes: 0,
  overtimeHours: 0.25,
};

vi.mock('../state/PayrollContext', () => ({
  usePayroll: () => ({
    attendance: [loggedEntry],
    payrollPeriods: [],
    addAttendance: mocks.addAttendance,
    deleteAttendance: mocks.deleteAttendance,
  }),
}));

beforeEach(() => {
  mocks.addAttendance.mockReset();
  mocks.addAttendance.mockResolvedValue(undefined);
});

test('maps saved time logs to their calendar date', () => {
  const { getByRole, getByLabelText } = render(<Attendance />);
  const loggedDay = getByRole('gridcell', { name: `${shortDate(loggedDate)}, Present, 08:10-17:15` });

  fireEvent.click(loggedDay);

  expect(getByLabelText('Date')).toHaveValue(loggedDate);
  expect(getByRole('gridcell', { name: `${shortDate(loggedDate)}, Present, 08:10-17:15` })).toHaveAttribute('aria-selected', 'true');
});

test('uses a selected empty calendar day for a new time log', async () => {
  const { getAllByRole, getByLabelText, getByRole } = render(<Attendance />);
  const emptyDay = getAllByRole('gridcell').find((cell) => cell.getAttribute('aria-label')?.endsWith('no time log'));
  expect(emptyDay).toBeDefined();

  fireEvent.click(emptyDay!);
  const selectedDate = (getByLabelText('Date') as HTMLInputElement).value;
  fireEvent.click(getByRole('button', { name: 'Save time log' }));

  await waitFor(() => expect(mocks.addAttendance).toHaveBeenCalledWith({
    date: selectedDate,
    punches: [expect.objectContaining({ timeIn: '08:00', timeOut: '17:00' })],
    status: 'Present',
    remarks: '',
  }));
});

test('adds multiple attendance punch pairs', async () => {
  const { getAllByLabelText, getByLabelText, getByRole } = render(<Attendance />);
  fireEvent.change(getByLabelText('Date'), { target: { value: '2026-09-04' } });
  fireEvent.click(getByRole('button', { name: 'Add punch' }));
  const clockIns = getAllByLabelText('Clock in');
  const clockOuts = getAllByLabelText('Clock out');
  fireEvent.change(clockOuts[0], { target: { value: '12:00' } });
  fireEvent.change(clockIns[1], { target: { value: '13:00' } });
  fireEvent.click(getByRole('button', { name: 'Save time log' }));
  await waitFor(() => expect(mocks.addAttendance).toHaveBeenCalledWith(expect.objectContaining({ punches: [
    expect.objectContaining({ timeIn: '08:00', timeOut: '12:00' }),
    expect.objectContaining({ timeIn: '13:00', timeOut: '17:00' }),
  ] })));
});
