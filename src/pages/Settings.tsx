import { IonIcon, IonToast } from '@ionic/react';
import { cashOutline, timeOutline } from 'ionicons/icons';
import { FormEvent, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import type { Settings as SettingsType } from '../state/types';

export default function Settings() {
  const { settings, updateSettings } = usePayroll(); const [form, setForm] = useState(settings); const [saved, setSaved] = useState(false);
  const number = (key: keyof SettingsType) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(event.target.value) });
  const submit = (event: FormEvent) => { event.preventDefault(); updateSettings(form); setSaved(true); };
  return <PageShell eyebrow="Preferences" title="Make the math yours.">
    <form className="settings-layout" onSubmit={submit}>
      <section className="surface settings-section"><div className="section-title"><div><p className="section-kicker">Compensation</p><h2>Salary & rates</h2></div><span className="form-icon"><IonIcon icon={cashOutline} /></span></div>
        <div className="settings-fields"><label className="field"><span>Monthly salary</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.monthlySalary} onChange={number('monthlySalary')} /></div></label><label className="field"><span>Work days per month</span><input type="number" min="1" step="1" required value={form.workDaysPerMonth} onChange={number('workDaysPerMonth')} /></label><label className="field"><span>Overtime multiplier</span><input type="number" min="1" step="0.01" required value={form.otMultiplier} onChange={number('otMultiplier')} /></label><label className="field"><span>Match tolerance</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.differenceTolerance} onChange={number('differenceTolerance')} /></div><small>Differences within this amount count as matched.</small></label></div>
      </section>
      <section className="surface settings-section"><div className="section-title"><div><p className="section-kicker">Schedule</p><h2>Workday rules</h2></div><span className="form-icon"><IonIcon icon={timeOutline} /></span></div>
        <div className="settings-fields"><div className="field-row"><label className="field"><span>Standard time in</span><input type="time" required value={form.standardTimeIn} onChange={(e) => setForm({ ...form, standardTimeIn: e.target.value })} /></label><label className="field"><span>Standard time out</span><input type="time" required value={form.standardTimeOut} onChange={(e) => setForm({ ...form, standardTimeOut: e.target.value })} /></label></div><label className="field"><span>Paid hours per day</span><input type="number" min="1" step="0.5" required value={form.workHoursPerDay} onChange={number('workHoursPerDay')} /></label><label className="field"><span>Lunch break hours</span><input type="number" min="0" step="0.5" required value={form.lunchBreakHours} onChange={number('lunchBreakHours')} /></label><label className="field"><span>Late grace period</span><div className="suffix-input"><input type="number" min="0" step="1" required value={form.lateGraceMinutes} onChange={number('lateGraceMinutes')} /><b>minutes</b></div></label></div>
      </section>
      <div className="settings-save"><p>Changes apply to all payroll estimates, including previous cutoffs.</p><button className="primary-button" type="submit">Save settings</button></div>
    </form><IonToast isOpen={saved} onDidDismiss={() => setSaved(false)} message="Your payroll settings are saved." duration={2200} color="success" />
  </PageShell>;
}
