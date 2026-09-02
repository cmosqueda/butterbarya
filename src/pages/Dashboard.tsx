import { IonIcon } from '@ionic/react';
import { addOutline, arrowForwardOutline, checkmarkCircle, timeOutline, warning } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { money, periodLabel, salaryBreakdown, shortDate } from '../state/payroll';

export default function Dashboard() {
  const { attendance, payrollPeriods, payslips, settings } = usePayroll();
  const periods = useMemo(() => Array.from(new Set([...payrollPeriods.map((period) => period.id), ...attendance.map((row) => row.payrollPeriod), ...payslips.map((row) => row.payrollPeriod)])).sort().reverse(), [attendance, payrollPeriods, payslips]);
  const [selected, setSelected] = useState(periods[0]);
  useEffect(() => { if (!periods.includes(selected)) setSelected(periods[0] ?? ''); }, [periods, selected]);
  const rows = attendance.filter((row) => row.payrollPeriod === selected);
  const slip = payslips.find((row) => row.payrollPeriod === selected);
  const breakdown = salaryBreakdown(selected, attendance, settings);
  const difference = slip ? slip.grossPay - breakdown.expectedGross : null;
  const matched = difference !== null && Math.abs(difference) <= settings.differenceTolerance;
  const status = !slip ? 'Awaiting payslip' : matched ? 'Matched' : 'Needs review';
  const totalDeductions = breakdown.lateDeduction + breakdown.undertimeDeduction + breakdown.absenceDeduction;

  return <PageShell eyebrow="Personal payroll" title="Here’s your pay, at a glance." action={<div className="period-picker"><label htmlFor="period">Pay period</label><select id="period" value={selected} onChange={(e) => setSelected(e.target.value)}>{periods.map((item) => <option key={item} value={item}>{payrollPeriods.find((period) => period.id === item)?.label || periodLabel(item)}</option>)}</select></div>}>
    <section className="hero-grid">
      <article className="pay-card">
        <div className="card-top"><span>Expected gross</span><span className={`status-pill ${matched ? 'success' : slip ? 'danger' : ''}`}><IonIcon icon={slip ? matched ? checkmarkCircle : warning : timeOutline} />{status}</span></div>
        <strong className="hero-amount">{money(breakdown.expectedGross)}</strong>
        <p>Based on {rows.length} attendance {rows.length === 1 ? 'entry' : 'entries'} this cutoff</p>
        <div className="pay-comparison">
          <div><span>Actual gross</span><strong>{slip ? money(slip.grossPay) : '—'}</strong></div>
          <div><span>Difference</span><strong className={difference && difference < 0 ? 'negative' : ''}>{difference === null ? '—' : money(difference)}</strong></div>
        </div>
      </article>
      <article className="snapshot-card">
        <div><p className="section-kicker">This cutoff</p><h2>Pay snapshot</h2></div>
        <div className="snapshot-row"><span>Base pay</span><strong>{money(breakdown.basePay)}</strong></div>
        <div className="snapshot-row positive"><span>Overtime</span><strong>+ {money(breakdown.overtimePay)}</strong></div>
        <div className="snapshot-row negative"><span>Deductions</span><strong>− {money(totalDeductions)}</strong></div>
        <div className="snapshot-total"><span>Estimated net before gov’t deductions</span><strong>{money(breakdown.expectedGross)}</strong></div>
      </article>
    </section>

    <section className="stats-grid">
      <article className="stat-card"><span className="stat-dot coral" /><div><span>Days logged</span><strong>{rows.length}</strong></div><small>for this cutoff</small></article>
      <article className="stat-card"><span className="stat-dot gold" /><div><span>Late minutes</span><strong>{rows.reduce((sum, row) => sum + row.lateMinutes, 0)}</strong></div><small>{money(breakdown.lateDeduction)} impact</small></article>
      <article className="stat-card"><span className="stat-dot green" /><div><span>Overtime</span><strong>{rows.reduce((sum, row) => sum + row.overtimeHours, 0).toFixed(1)}h</strong></div><small>{money(breakdown.overtimePay)} earned</small></article>
    </section>

    <section className="lower-grid">
      <article className="surface recent-card">
        <div className="section-title"><div><p className="section-kicker">Latest</p><h2>Recent time logs</h2></div><a href="/attendance">View all <IonIcon icon={arrowForwardOutline} /></a></div>
        {rows.length ? <div className="activity-list">{rows.slice(0, 4).map((row) => <div className="activity-row" key={row.id}><div className="date-tile"><strong>{new Date(`${row.date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(`${row.date}T00:00:00`))}</span></div><div className="activity-main"><strong>{row.status}</strong><span>{row.punches.length ? `${row.punches.map((punch) => `${punch.timeIn}–${punch.timeOut}`).join(', ')}${row.punches.length > 1 ? ` · ${row.punches.length} punches` : ''}` : row.remarks || 'No hours required'}</span></div><div className="activity-hours"><strong>{row.workedHours.toFixed(1)}h</strong><span>{row.lateMinutes ? `${row.lateMinutes}m late` : 'On time'}</span></div></div>)}</div> : <EmptyState text="No time logged for this cutoff yet." link="/attendance" label="Log your first day" />}
      </article>
      <article className="surface breakdown-card">
        <div className="section-title"><div><p className="section-kicker">Transparent math</p><h2>Adjustments</h2></div></div>
        <div className="bar-item"><div><span>Late</span><strong>− {money(breakdown.lateDeduction)}</strong></div><i><b style={{ width: `${Math.min(100, breakdown.lateDeduction / Math.max(totalDeductions, 1) * 100)}%` }} /></i></div>
        <div className="bar-item"><div><span>Undertime</span><strong>− {money(breakdown.undertimeDeduction)}</strong></div><i><b style={{ width: `${Math.min(100, breakdown.undertimeDeduction / Math.max(totalDeductions, 1) * 100)}%` }} /></i></div>
        <div className="bar-item"><div><span>Absences</span><strong>− {money(breakdown.absenceDeduction)}</strong></div><i><b style={{ width: `${Math.min(100, breakdown.absenceDeduction / Math.max(totalDeductions, 1) * 100)}%` }} /></i></div>
        <p className="fine-print">Calculated using your saved work schedule and salary settings.</p>
      </article>
    </section>
  </PageShell>;
}

function EmptyState({ text, link, label }: { text: string; link: string; label: string }) { return <div className="empty-state"><div className="empty-icon"><IonIcon icon={timeOutline} /></div><p>{text}</p><a className="text-button" href={link}><IonIcon icon={addOutline} />{label}</a></div>; }
