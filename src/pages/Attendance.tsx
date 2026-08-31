import { IonIcon, IonToast } from '@ionic/react';
import { calendarOutline, trashOutline } from 'ionicons/icons';
import { FormEvent, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { periodLabel, shortDate, todayText } from '../state/payroll';
import type { AttendanceStatus } from '../state/types';

const statuses: AttendanceStatus[] = ['Present', 'Late', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Rest Day'];
const noHours: AttendanceStatus[] = ['Absent', 'Leave', 'Holiday', 'Rest Day'];

export default function Attendance() {
  const { attendance, addAttendance, deleteAttendance } = usePayroll();
  const [date, setDate] = useState(todayText()); const [timeIn, setTimeIn] = useState('08:00'); const [timeOut, setTimeOut] = useState('17:00'); const [status, setStatus] = useState<AttendanceStatus>('Present'); const [remarks, setRemarks] = useState(''); const [toast, setToast] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (attendance.some((row) => row.date === date)) { setToast(true); return; } addAttendance({ date, timeIn: noHours.includes(status) ? '' : timeIn, timeOut: noHours.includes(status) ? '' : timeOut, status, remarks }); setRemarks(''); };
  return <PageShell eyebrow="Attendance" title="Log the workday.">
    <div className="workspace-grid">
      <form className="surface form-card" onSubmit={submit}>
        <div className="section-title"><div><p className="section-kicker">New entry</p><h2>Time log</h2></div><span className="form-icon"><IonIcon icon={calendarOutline} /></span></div>
        <label className="field"><span>Date</span><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
        {!noHours.includes(status) && <div className="field-row"><label className="field"><span>Time in</span><input type="time" required value={timeIn} onChange={(e) => setTimeIn(e.target.value)} /></label><label className="field"><span>Time out</span><input type="time" required value={timeOut} onChange={(e) => setTimeOut(e.target.value)} /></label></div>}
        <label className="field"><span>Notes <em>optional</em></span><textarea rows={3} placeholder="Anything worth remembering?" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label>
        <button className="primary-button" type="submit">Save time log</button>
      </form>
      <section className="surface records-card"><div className="section-title"><div><p className="section-kicker">History</p><h2>Your time logs</h2></div><span className="count-chip">{attendance.length} total</span></div>
        {attendance.length ? <div className="record-list">{attendance.map((row) => <article className="record-row" key={row.id}><div className="record-date"><strong>{shortDate(row.date)}</strong><span>{periodLabel(row.payrollPeriod)}</span></div><span className={`record-status ${row.status.toLowerCase().replace(' ', '-')}`}>{row.status}</span><div className="record-time"><strong>{row.timeIn ? `${row.timeIn}–${row.timeOut}` : 'No hours'}</strong><span>{row.workedHours ? `${row.workedHours.toFixed(1)} worked hours` : row.remarks || '—'}</span></div><button type="button" className="icon-button" aria-label={`Delete ${row.date}`} onClick={() => deleteAttendance(row.id)}><IonIcon icon={trashOutline} /></button></article>)}</div> : <div className="empty-state"><p>Your saved time logs will show up here.</p></div>}
      </section>
    </div><IonToast isOpen={toast} onDidDismiss={() => setToast(false)} message="A time log already exists for this date." duration={2400} color="danger" />
  </PageShell>;
}
