import { IonIcon, IonToast } from '@ionic/react';
import { addOutline, calendarOutline, chevronBackOutline, chevronForwardOutline, trashOutline } from 'ionicons/icons';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { periodLabel, shortDate, todayText, validateAttendancePunches } from '../state/payroll';
import type { AttendanceEntry, AttendancePunch, AttendanceStatus } from '../state/types';

const statuses: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Rest Day'];
const noHours: AttendanceStatus[] = ['Absent', 'Leave', 'Holiday', 'Rest Day'];
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const punchText = (entry: AttendanceEntry) => entry.punches.length ? entry.punches.map((punch) => `${punch.timeIn}-${punch.timeOut}`).join(', ') : 'No hours';

function dateParts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function dateText(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthFor(value: string) {
  const { year, month } = dateParts(value);
  return new Date(year, month - 1, 1);
}

function statusClass(status: AttendanceStatus) {
  return status.toLowerCase().replaceAll(' ', '-');
}

interface AttendanceCalendarProps {
  entries: AttendanceEntry[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

function AttendanceCalendar({ entries, selectedDate, onSelectDate }: AttendanceCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthFor(selectedDate));
  const entriesByDate = useMemo(() => new Map(entries.map((entry) => [entry.date, entry])), [entries]);
  const today = todayText();
  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const monthEntries = entries.filter((entry) => {
    const parts = dateParts(entry.date);
    return parts.year === year && parts.month === monthIndex + 1;
  });
  const selectedEntry = entriesByDate.get(selectedDate);

  useEffect(() => {
    setVisibleMonth(monthFor(selectedDate));
  }, [selectedDate]);

  const moveMonth = (amount: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const selectToday = () => {
    onSelectDate(today);
    setVisibleMonth(monthFor(today));
  };

  return <section className="surface attendance-calendar" aria-label="Attendance calendar">
    <div className="calendar-header">
      <div>
        <p className="section-kicker">Monthly overview</p>
        <h2>{new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth)}</h2>
      </div>
      <div className="calendar-controls">
        <button type="button" className="calendar-today" onClick={selectToday}>Today</button>
        <button type="button" className="calendar-arrow" aria-label="Previous month" onClick={() => moveMonth(-1)}><IonIcon icon={chevronBackOutline} /></button>
        <button type="button" className="calendar-arrow" aria-label="Next month" onClick={() => moveMonth(1)}><IonIcon icon={chevronForwardOutline} /></button>
      </div>
    </div>
    <div className="calendar-summary">
      <span><strong>{monthEntries.length}</strong> logged {monthEntries.length === 1 ? 'day' : 'days'}</span>
      <span className="calendar-hint">Select a day to use it in the time-log form.</span>
    </div>
    <div className="calendar-grid" role="grid">
      {weekdays.map((weekday) => <div className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</div>)}
      {Array.from({ length: cellCount }, (_, index) => {
        const day = index - firstWeekday + 1;
        if (day < 1 || day > daysInMonth) return <div className="calendar-day calendar-day-empty" key={`empty-${index}`} />;
        const value = dateText(year, monthIndex, day);
        const entry = entriesByDate.get(value);
        const classes = [
          'calendar-day',
          value === today ? 'is-today' : '',
          value === selectedDate ? 'is-selected' : '',
          entry ? `has-entry ${statusClass(entry.status)}` : '',
        ].filter(Boolean).join(' ');
        const label = `${shortDate(value)}${entry ? `, ${entry.status}${entry.punches.length ? `, ${punchText(entry)}` : ''}` : ', no time log'}`;
        return <button type="button" role="gridcell" className={classes} aria-label={label} aria-selected={value === selectedDate} key={value} onClick={() => onSelectDate(value)}>
          <span className="calendar-day-number">{day}</span>
          {entry && <span className="calendar-entry">
            <i aria-hidden="true" />
            <strong>{entry.status}</strong>
            <small>{punchText(entry)}</small>
          </span>}
        </button>;
      })}
    </div>
    <div className={`calendar-selection ${selectedEntry ? 'has-log' : ''}`}>
      <div><span>Selected date</span><strong>{shortDate(selectedDate)}</strong></div>
      {selectedEntry
        ? <div><span>{selectedEntry.status}</span><strong>{selectedEntry.punches.length ? punchText(selectedEntry) : selectedEntry.remarks || 'No hours required'}</strong></div>
        : <p>No time log saved for this day yet.</p>}
    </div>
  </section>;
}

export default function Attendance() {
  const { attendance, payrollPeriods, addAttendance, deleteAttendance } = usePayroll();
  const [date, setDate] = useState(todayText());
  const [punches, setPunches] = useState<AttendancePunch[]>([{ id: crypto.randomUUID(), timeIn: '08:00', timeOut: '17:00' }]);
  const [status, setStatus] = useState<AttendanceStatus>('Present');
  const [remarks, setRemarks] = useState('');
  const [toast, setToast] = useState('');

  const updatePunch = (id: string, update: Partial<AttendancePunch>) => setPunches((current) => current.map((punch) => punch.id === id ? { ...punch, ...update } : punch));
  const addPunch = () => setPunches((current) => [...current, { id: crypto.randomUUID(), timeIn: current.at(-1)?.timeOut ?? '13:00', timeOut: '17:00' }]);
  const deletePunch = (id: string) => setPunches((current) => current.filter((punch) => punch.id !== id));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (attendance.some((row) => row.date === date)) {
      setToast('A time log already exists for this date.');
      return;
    }
    const savedPunches = noHours.includes(status) ? [] : punches;
    const punchError = savedPunches.length ? validateAttendancePunches(savedPunches) : '';
    if (punchError) {
      setToast(punchError);
      return;
    }
    await addAttendance({ date, punches: savedPunches, status, remarks });
    setRemarks('');
  };

  return <PageShell eyebrow="Attendance" title="Log the workday.">
    <AttendanceCalendar entries={attendance} selectedDate={date} onSelectDate={setDate} />
    <div className="workspace-grid attendance-workspace">
      <form className="surface form-card" onSubmit={submit}>
        <div className="section-title"><div><p className="section-kicker">New entry</p><h2>Time log</h2></div><span className="form-icon"><IonIcon icon={calendarOutline} /></span></div>
        <label className="field"><span>Date</span><input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        {!noHours.includes(status) && <div className="punch-editor">
          <div className="punch-editor-heading"><div><strong>Attendance punches</strong><small>Add another pair for split shifts or when you clock out during a break.</small></div><button type="button" onClick={addPunch}><IonIcon icon={addOutline} />Add punch</button></div>
          {punches.map((punch, index) => <div className="punch-row" key={punch.id}>
            <span className="interval-number">{index + 1}</span>
            <label className="field"><span>Clock in</span><input type="time" required value={punch.timeIn} onChange={(event) => updatePunch(punch.id, { timeIn: event.target.value })} /></label>
            <label className="field"><span>Clock out</span><input type="time" required value={punch.timeOut} onChange={(event) => updatePunch(punch.id, { timeOut: event.target.value })} /></label>
            <button type="button" className="icon-button" aria-label={`Delete punch ${index + 1}`} disabled={punches.length === 1} onClick={() => deletePunch(punch.id)}><IonIcon icon={trashOutline} /></button>
          </div>)}
        </div>}
        <label className="field"><span>Notes <em>optional</em></span><textarea rows={3} placeholder="Anything worth remembering?" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        <button className="primary-button" type="submit">Save time log</button>
      </form>
      <section className="surface records-card"><div className="section-title"><div><p className="section-kicker">History</p><h2>Your time logs</h2></div><span className="count-chip">{attendance.length} total</span></div>
        {attendance.length ? <div className="record-list">{attendance.map((row) => <article className="record-row" key={row.id}><div className="record-date"><strong>{shortDate(row.date)}</strong><span>{payrollPeriods.find((period) => period.id === row.payrollPeriod)?.label || periodLabel(row.payrollPeriod)}</span></div><span className={`record-status ${statusClass(row.status)}`}>{row.status}</span><div className="record-time"><strong>{punchText(row)}</strong><span>{row.punches.length > 1 ? `${row.punches.length} punches · ` : ''}{row.workedHours ? `${row.workedHours.toFixed(1)} worked hours` : row.remarks || '-'}</span></div><button type="button" className="icon-button" aria-label={`Delete ${row.date}`} onClick={() => deleteAttendance(row.id)}><IonIcon icon={trashOutline} /></button></article>)}</div> : <div className="empty-state"><p>Your saved time logs will show up here.</p></div>}
      </section>
    </div>
    <IonToast isOpen={Boolean(toast)} onDidDismiss={() => setToast('')} message={toast} duration={2400} color="danger" />
  </PageShell>;
}
