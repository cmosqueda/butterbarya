import { IonIcon, IonToast } from '@ionic/react';
import { addOutline, checkmarkCircle, closeOutline, createOutline, receiptOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { FormEvent, useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { defaultPayrollPeriod, money, periodLabel, salaryBreakdown, shortDate, todayText, validatePayrollPeriod } from '../state/payroll';
import type { PayrollPeriod } from '../state/types';

export default function Payslips() {
  const { attendance, payrollPeriods, payslips, settings, addPayrollPeriod, editPayrollPeriod, deletePayrollPeriod, addPayslip, deletePayslip } = usePayroll();
  const [payrollPeriod, setPayrollPeriod] = useState(payrollPeriods[0]?.id ?? '');
  const [releaseDate, setReleaseDate] = useState(todayText());
  const [grossPay, setGrossPay] = useState('');
  const [netPay, setNetPay] = useState('');
  const [tax, setTax] = useState('0');
  const [sss, setSss] = useState('0');
  const [philhealth, setPhilhealth] = useState('0');
  const [pagibig, setPagibig] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [periodDraft, setPeriodDraft] = useState<PayrollPeriod>(() => defaultPayrollPeriod());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState({ open: false, message: '', color: 'danger' as 'danger' | 'success' });

  useEffect(() => {
    if (!payrollPeriods.some((period) => period.id === payrollPeriod)) setPayrollPeriod(payrollPeriods[0]?.id ?? '');
  }, [payrollPeriod, payrollPeriods]);

  const periodName = (id: string) => payrollPeriods.find((period) => period.id === id)?.label || periodLabel(id);
  const resetPeriodForm = () => {
    setEditingId(null);
    setPeriodDraft(defaultPayrollPeriod());
  };

  const submitPeriod = async (event: FormEvent) => {
    event.preventDefault();
    const period = { ...periodDraft, id: periodDraft.id.trim().toUpperCase(), label: periodDraft.label.trim() || periodDraft.id.trim().toUpperCase() };
    const validation = validatePayrollPeriod(period, payrollPeriods, editingId ?? undefined);
    if (validation) {
      setNotice({ open: true, message: validation, color: 'danger' });
      return;
    }
    try {
      if (editingId) await editPayrollPeriod(editingId, period);
      else await addPayrollPeriod(period);
      setPayrollPeriod(period.id);
      setNotice({ open: true, message: editingId ? 'Payroll period updated.' : 'Payroll period added.', color: 'success' });
      resetPeriodForm();
    } catch (error) {
      setNotice({ open: true, message: error instanceof Error ? error.message : String(error), color: 'danger' });
    }
  };

  const startEditing = (period: PayrollPeriod) => {
    setEditingId(period.id);
    setPeriodDraft(period);
  };

  const removePeriod = async (period: PayrollPeriod) => {
    if (!window.confirm(`Delete ${period.label}?`)) return;
    try {
      await deletePayrollPeriod(period.id);
      if (editingId === period.id) resetPeriodForm();
      setNotice({ open: true, message: 'Payroll period deleted.', color: 'success' });
    } catch (error) {
      setNotice({ open: true, message: error instanceof Error ? error.message : String(error), color: 'danger' });
    }
  };

  const submitPayslip = async (event: FormEvent) => {
    event.preventDefault();
    await addPayslip({ payrollPeriod, releaseDate, grossPay: Number(grossPay), netPay: Number(netPay), tax: Number(tax), sss: Number(sss), philhealth: Number(philhealth), pagibig: Number(pagibig), remarks });
    setGrossPay('');
    setNetPay('');
    setRemarks('');
  };

  return <PageShell eyebrow="Pay records" title="Check every payslip.">
    <section className="surface period-manager">
      <div className="section-title">
        <div><p className="section-kicker">Configuration</p><h2>Payroll periods</h2></div>
        <span className="count-chip">{payrollPeriods.length} configured</span>
      </div>
      <div className="period-manager-grid">
        <form className="period-form" onSubmit={submitPeriod}>
          <div className="period-form-heading"><strong>{editingId ? 'Edit period' : 'Add period'}</strong>{editingId && <button type="button" onClick={resetPeriodForm}><IonIcon icon={closeOutline} /> Cancel</button>}</div>
          <label className="field"><span>Period ID</span><input required placeholder="2026-09-A" value={periodDraft.id} onChange={(event) => setPeriodDraft((current) => ({ ...current, id: event.target.value }))} /></label>
          <label className="field"><span>Label</span><input required placeholder="September 1-15, 2026" value={periodDraft.label} onChange={(event) => setPeriodDraft((current) => ({ ...current, label: event.target.value }))} /></label>
          <div className="field-row period-date-row">
            <label className="field"><span>Start date</span><input type="date" required value={periodDraft.startDate} onChange={(event) => setPeriodDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
            <label className="field"><span>End date</span><input type="date" required value={periodDraft.endDate} onChange={(event) => setPeriodDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
          </div>
          <button className="secondary-button" type="submit"><IonIcon icon={editingId ? createOutline : addOutline} />{editingId ? 'Save period changes' : 'Add payroll period'}</button>
        </form>
        <div className="period-list">
          {payrollPeriods.length ? payrollPeriods.map((period) => {
            const attendanceCount = attendance.filter((row) => row.payrollPeriod === period.id).length;
            const payslipCount = payslips.filter((slip) => slip.payrollPeriod === period.id).length;
            const inUse = attendanceCount + payslipCount > 0;
            return <article className={`period-item ${editingId === period.id ? 'is-editing' : ''}`} key={period.id}>
              <div><strong>{period.label}</strong><span>{shortDate(period.startDate)} - {shortDate(period.endDate)}</span><small>{period.id} · {attendanceCount} time logs · {payslipCount} payslips</small></div>
              <div className="period-actions">
                <button type="button" className="icon-button" aria-label={`Edit ${period.label}`} onClick={() => startEditing(period)}><IonIcon icon={createOutline} /></button>
                <button type="button" className="icon-button" aria-label={`Delete ${period.label}`} title={inUse ? 'Delete its time logs and payslips first' : 'Delete period'} disabled={inUse} onClick={() => removePeriod(period)}><IonIcon icon={trashOutline} /></button>
              </div>
            </article>;
          }) : <div className="empty-state period-empty"><p>No payroll periods configured yet.</p></div>}
        </div>
      </div>
    </section>

    <div className="workspace-grid">
      <form className="surface form-card" onSubmit={submitPayslip}><div className="section-title"><div><p className="section-kicker">New record</p><h2>Add payslip</h2></div><span className="form-icon"><IonIcon icon={receiptOutline} /></span></div>
        <label className="field"><span>Payroll period</span><select required value={payrollPeriod} onChange={(event) => setPayrollPeriod(event.target.value)} disabled={!payrollPeriods.length}><option value="" disabled>Select a payroll period</option>{payrollPeriods.map((period) => <option value={period.id} key={period.id}>{period.label} ({period.startDate} to {period.endDate})</option>)}</select></label>
        <label className="field"><span>Release date</span><input type="date" required value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></label>
        <div className="field-row"><label className="field"><span>Gross pay</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required placeholder="0.00" value={grossPay} onChange={(event) => setGrossPay(event.target.value)} /></div></label><label className="field"><span>Net pay</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required placeholder="0.00" value={netPay} onChange={(event) => setNetPay(event.target.value)} /></div></label></div>
        <p className="form-divider">Government deductions</p>
        <div className="field-row"><MoneyField label="Tax" value={tax} set={setTax} /><MoneyField label="SSS" value={sss} set={setSss} /></div><div className="field-row"><MoneyField label="PhilHealth" value={philhealth} set={setPhilhealth} /><MoneyField label="Pag-IBIG" value={pagibig} set={setPagibig} /></div>
        <label className="field"><span>Notes <em>optional</em></span><textarea rows={2} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label><button className="primary-button" type="submit" disabled={!payrollPeriods.length}>Save and compare</button>
      </form>
      <section className="surface records-card"><div className="section-title"><div><p className="section-kicker">Audit trail</p><h2>Payslip history</h2></div><span className="count-chip">{payslips.length} saved</span></div>
        {payslips.length ? <div className="payslip-list">{payslips.map((slip) => { const expected = salaryBreakdown(slip.payrollPeriod, attendance, settings).expectedGross; const difference = slip.grossPay - expected; const matched = Math.abs(difference) <= settings.differenceTolerance; return <article className="payslip-item" key={slip.id}><div className="payslip-head"><div><span>{periodName(slip.payrollPeriod)}</span><strong>{money(slip.netPay)}</strong><small>Net pay · released {shortDate(slip.releaseDate)}</small></div><span className={`status-pill ${matched ? 'success' : 'danger'}`}><IonIcon icon={matched ? checkmarkCircle : warningOutline} />{matched ? 'Matched' : 'Review'}</span></div><div className="payslip-math"><div><span>Expected gross</span><strong>{money(expected)}</strong></div><div><span>Actual gross</span><strong>{money(slip.grossPay)}</strong></div><div><span>Difference</span><strong className={difference < 0 ? 'negative' : ''}>{money(difference)}</strong></div><button type="button" className="icon-button" aria-label="Delete payslip" onClick={() => deletePayslip(slip.id)}><IonIcon icon={trashOutline} /></button></div></article>; })}</div> : <div className="empty-state"><p>Add a payslip to compare it with your attendance estimate.</p></div>}
      </section>
    </div>
    <IonToast isOpen={notice.open} onDidDismiss={() => setNotice((current) => ({ ...current, open: false }))} message={notice.message} duration={2800} color={notice.color} />
  </PageShell>;
}

function MoneyField({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return <label className="field"><span>{label}</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" value={value} onChange={(event) => set(event.target.value)} /></div></label>;
}
