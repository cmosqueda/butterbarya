import { fireEvent, render } from '@testing-library/react';
import { vi } from 'vitest';
import Settings from './Settings';
import { defaultScheduleConfig, defaultSettings, defaultWeeklySchedule } from '../state/payroll';

const mocks = vi.hoisted(() => ({ updateSettings: vi.fn() }));
const weeklySchedule = defaultWeeklySchedule(defaultSettings);

vi.mock('../state/PayrollContext', () => ({
  usePayroll: () => ({
    settings: defaultSettings,
    scheduleConfig: defaultScheduleConfig,
    weeklySchedule,
    updateSettings: mocks.updateSettings,
  }),
}));

test('updates the weekly time map as a day interval changes', () => {
  const { getAllByTitle, getByDisplayValue, getByTitle } = render(<Settings />);
  expect(getAllByTitle('Work 08:00-12:00')).toHaveLength(5);

  fireEvent.change(getByDisplayValue('08:00'), { target: { value: '09:00' } });

  expect(getByTitle('Work 09:00-12:00')).toBeInTheDocument();
});

test('switches to a configurable rotating cycle', async () => {
  const { findByLabelText, getByRole } = render(<Settings />);
  const rotating = getByRole('button', { name: 'Rotating' });
  fireEvent.click(rotating);
  expect(rotating).toHaveClass('active');
  expect(await findByLabelText(/Cycle starts on/)).toBeInTheDocument();
  fireEvent.change(await findByLabelText(/Days in cycle/), { target: { value: '4' } });
  expect(getByRole('columnheader', { name: /D4/ })).toBeInTheDocument();
});

test('selects and enables a rest day for editing', () => {
  const { getByRole, getByText } = render(<Settings />);
  fireEvent.click(getByRole('columnheader', { name: /Sun/ }));
  expect(getByText('No regular work intervals are expected. Logged work on this day is treated as overtime.')).toBeInTheDocument();

  fireEvent.click(getByRole('button', { name: 'Working' }));
  expect(getByRole('heading', { name: 'Sunday' })).toBeInTheDocument();
  expect(getByRole('combobox', { name: 'Type' })).toHaveValue('work');
});
