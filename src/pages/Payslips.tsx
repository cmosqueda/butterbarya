import { IonIcon } from '@ionic/react';
import { checkmarkCircle, receiptOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { FormEvent, useMemo, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { money, periodId, periodLabel, salaryBreakdown, shortDate, todayText } from '../state/payroll';

export default function Payslips() {
  const { attendance, payslips, settings, addPayslip, deletePayslip } = usePayroll();
  const periods = useMemo(() => Array.from(new Set([periodId(todayText()), ...attendance.map((row) => row.payrollPeriod)])).sort().reverse(), [attendance]);
  const [payrollPeriod, setPayrollPeriod] = useState(periods[0]); const [releaseDate, setReleaseDate] = useState(todayText()); const [grossPay, setGrossPay] = useState(''); const [netPay, setNetPay] = useState(''); const [tax, setTax] = useState('0'); const [sss, setSss] = useState('0'); const [philhealth, setPhilhealth] = useState('0'); const [pagibig, setPagibig] = useState('0'); const [remarks, setRemarks] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); addPayslip({ payrollPeriod, releaseDate, grossPay: Number(grossPay), netPay: Number(netPay), tax: Number(tax), sss: Number(sss), philhealth: Number(philhealth), pagibig: Number(pagibig), remarks }); setGrossPay(''); setNetPay(''); setRemarks(''); };
  return <PageShell eyebrow="Pay records" title="Check every payslip.">
    <div className="workspace-grid">
      <form className="surface form-card" onSubmit={submit}><div className="section-title"><div><p className="section-kicker">New record</p><h2>Add payslip</h2></div><span className="form-icon"><IonIcon icon={receiptOutline} /></span></div>
        <label className="field"><span>Payroll period</span><select value={payrollPeriod} onChange={(e) => setPayrollPeriod(e.target.value)}>{periods.map((item) => <option value={item} key={item}>{periodLabel(item)}</option>)}</select></label>
        <label className="field"><span>Release date</span><input type="date" required value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} /></label>
        <div className="field-row"><label className="field"><span>Gross pay</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required placeholder="0.00" value={grossPay} onChange={(e) => setGrossPay(e.target.value)} /></div></label><label className="field"><span>Net pay</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required placeholder="0.00" value={netPay} onChange={(e) => setNetPay(e.target.value)} /></div></label></div>
        <p className="form-divider">Government deductions</p>
        <div className="field-row"><MoneyField label="Tax" value={tax} set={setTax} /><MoneyField label="SSS" value={sss} set={setSss} /></div><div className="field-row"><MoneyField label="PhilHealth" value={philhealth} set={setPhilhealth} /><MoneyField label="Pag-IBIG" value={pagibig} set={setPagibig} /></div>
        <label className="field"><span>Notes <em>optional</em></span><textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></label><button className="primary-button" type="submit">Save and compare</button>
      </form>
      <section className="surface records-card"><div className="section-title"><div><p className="section-kicker">Audit trail</p><h2>Payslip history</h2></div><span className="count-chip">{payslips.length} saved</span></div>
        {payslips.length ? <div className="payslip-list">{payslips.map((slip) => { const expected = salaryBreakdown(slip.payrollPeriod, attendance, settings).expectedGross; const difference = slip.grossPay - expected; const matched = Math.abs(difference) <= settings.differenceTolerance; return <article className="payslip-item" key={slip.id}><div className="payslip-head"><div><span>{periodLabel(slip.payrollPeriod)}</span><strong>{money(slip.netPay)}</strong><small>Net pay · released {shortDate(slip.releaseDate)}</small></div><span className={`status-pill ${matched ? 'success' : 'danger'}`}><IonIcon icon={matched ? checkmarkCircle : warningOutline} />{matched ? 'Matched' : 'Review'}</span></div><div className="payslip-math"><div><span>Expected gross</span><strong>{money(expected)}</strong></div><div><span>Actual gross</span><strong>{money(slip.grossPay)}</strong></div><div><span>Difference</span><strong className={difference < 0 ? 'negative' : ''}>{money(difference)}</strong></div><button type="button" className="icon-button" aria-label="Delete payslip" onClick={() => deletePayslip(slip.id)}><IonIcon icon={trashOutline} /></button></div></article>; })}</div> : <div className="empty-state"><p>Add a payslip to compare it with your attendance estimate.</p></div>}
      </section>
    </div>
  </PageShell>;
}

function MoneyField({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label className="field"><span>{label}</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" value={value} onChange={(e) => set(e.target.value)} /></div></label>; }
