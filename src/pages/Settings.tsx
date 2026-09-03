import { IonIcon, IonModal, IonToast } from '@ionic/react';
import { addOutline, briefcaseOutline, cashOutline, closeOutline, cloudUploadOutline, downloadOutline, informationCircleOutline, moonOutline, timeOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { FormEvent, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { usePayroll } from '../state/PayrollContext';
import { exportBackupJson, importBackupJson, resetPayrollData } from '../state/database';
import { defaultRotatingSchedule, defaultWeeklySchedule, validateSchedule } from '../state/payroll';
import type { ScheduleConfig, ScheduleInterval, ScheduleIntervalType, Settings as SettingsType, WeeklyScheduleDay } from '../state/types';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const { settings, scheduleConfig, weeklySchedule, updateSettings } = usePayroll();
  const [form, setForm] = useState(settings);
  const [config, setConfig] = useState<ScheduleConfig>(scheduleConfig);
  const [schedule, setSchedule] = useState<WeeklyScheduleDay[]>(() => weeklySchedule.map((day) => ({ ...day, intervals: day.intervals.map((item) => ({ ...item })) })));
  const [selectedWeekday, setSelectedWeekday] = useState(1);
  const [breakInfoOpen, setBreakInfoOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState({ open: false, message: '', color: 'success' as 'success' | 'danger' });
  const selectedDay = schedule.find((day) => day.weekday === selectedWeekday) ?? schedule[0];
  const number = (key: keyof SettingsType) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(event.target.value) });

  const changeMode = (mode: ScheduleConfig['mode']) => {
    if (mode === 'weekly') {
      setConfig({ ...config, mode, cycleLength: 7 });
      setSchedule(defaultWeeklySchedule(form));
      setSelectedWeekday(1);
    } else {
      setConfig({ ...config, mode, cycleLength: 7 });
      setSchedule(defaultRotatingSchedule(7).map((day) => ({ ...day, ...(schedule.find((item) => item.weekday === day.weekday) ?? {}) })));
      setSelectedWeekday(0);
    }
  };

  const changeCycleLength = (cycleLength: number) => {
    const safeLength = Math.max(1, Math.min(28, cycleLength));
    setConfig((current) => ({ ...current, cycleLength: safeLength }));
    setSchedule((current) => Array.from({ length: safeLength }, (_, weekday) => current.find((day) => day.weekday === weekday) ?? { weekday, isWorking: false, intervals: [] }));
    setSelectedWeekday((current) => Math.min(current, safeLength - 1));
  };

  const changeDay = (weekday: number, update: (day: WeeklyScheduleDay) => WeeklyScheduleDay) => {
    setSchedule((current) => current.map((day) => day.weekday === weekday ? update(day) : day));
  };

  const setWorking = (isWorking: boolean) => {
    changeDay(selectedWeekday, (day) => ({
      ...day,
      isWorking,
      intervals: isWorking && !day.intervals.length ? [{ id: crypto.randomUUID(), type: 'work', startTime: '08:00', endTime: '17:00' }] : isWorking ? day.intervals : [],
    }));
  };

  const addInterval = (type: ScheduleIntervalType) => {
    const latestEnd = selectedDay.intervals.reduce((latest, item) => Math.max(latest, minuteOfDay(item.endTime)), type === 'work' ? 8 * 60 : 12 * 60);
    const startMinutes = Math.min(latestEnd, 23 * 60);
    const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
    const timeText = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    const item: ScheduleInterval = { id: crypto.randomUUID(), type, startTime: timeText(startMinutes), endTime: timeText(endMinutes) };
    changeDay(selectedWeekday, (day) => ({ ...day, intervals: [...day.intervals, item] }));
  };

  const updateInterval = (id: string, update: Partial<ScheduleInterval>) => {
    changeDay(selectedWeekday, (day) => ({ ...day, intervals: day.intervals.map((item) => item.id === id ? { ...item, ...update } : item) }));
  };

  const deleteInterval = (id: string) => {
    changeDay(selectedWeekday, (day) => ({ ...day, intervals: day.intervals.filter((item) => item.id !== id) }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateSchedule(config, schedule);
    if (validation) {
      setNotice({ open: true, message: validation, color: 'danger' });
      return;
    }
    await updateSettings(form, schedule, config);
    setNotice({ open: true, message: `Your payroll settings and ${config.mode} schedule are saved.`, color: 'success' });
  };

  const exportData = async () => {
    setDataBusy(true);
    try {
      const json = await exportBackupJson();
      const fileName = `butterbarya-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Documents, encoding: Encoding.UTF8 });
        setNotice({ open: true, message: `Backup saved to Documents/${fileName}.`, color: 'success' });
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        setNotice({ open: true, message: 'Backup file downloaded.', color: 'success' });
      }
    } catch (error) {
      setNotice({ open: true, message: error instanceof Error ? error.message : 'Could not export your data.', color: 'danger' });
    } finally {
      setDataBusy(false);
    }
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDataBusy(true);
    try {
      await importBackupJson(await file.text());
      setNotice({ open: true, message: 'Backup restored. Reloading…', color: 'success' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setNotice({ open: true, message: error instanceof Error ? error.message : 'That file could not be imported.', color: 'danger' });
      setDataBusy(false);
    }
  };

  const deleteAllData = async () => {
    setDataBusy(true);
    try {
      await resetPayrollData();
      setDeleteConfirmOpen(false);
      setNotice({ open: true, message: 'All payroll data deleted. Reloading…', color: 'success' });
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setNotice({ open: true, message: error instanceof Error ? error.message : 'Could not delete your data.', color: 'danger' });
      setDataBusy(false);
    }
  };

  return <PageShell eyebrow="Preferences" title="Make the math yours.">
    <form className="settings-layout weekly-settings-layout" onSubmit={submit}>
      <section className="surface settings-section compensation-section">
        <div className="section-title"><div><p className="section-kicker">Compensation</p><h2>Salary & rates</h2></div><span className="form-icon"><IonIcon icon={cashOutline} /></span></div>
        <div className="settings-fields compensation-fields">
          <label className="field"><span>Monthly salary</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.monthlySalary} onChange={number('monthlySalary')} /></div><small>Used for the half-month base pay and to derive daily and hourly rates.</small></label>
          <label className="field"><span>Work days per month</span><input type="number" min="1" step="1" required value={form.workDaysPerMonth} onChange={number('workDaysPerMonth')} /><small>Daily rate = monthly salary ÷ work days.</small></label>
          <label className="field"><span>Paid hours per day</span><input type="number" min="1" step="0.5" required value={form.workHoursPerDay} onChange={number('workHoursPerDay')} /><small>Hourly rate = daily rate ÷ paid hours per day.</small></label>
          <label className="field"><span>Overtime multiplier</span><input type="number" min="1" step="0.01" required value={form.otMultiplier} onChange={number('otMultiplier')} /><small>Multiplied by the hourly rate for overtime.</small></label>
          <label className="field"><span>Late grace period</span><div className="suffix-input"><input type="number" min="0" step="1" required value={form.lateGraceMinutes} onChange={number('lateGraceMinutes')} /><b>minutes</b></div><small>Applied to the first work interval of each day.</small></label>
          <label className="field"><span>Late deduction rate</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.lateDeductionRate} onChange={number('lateDeductionRate')} /></div><small>Every late minute is deducted at this amount. Example: 50 minutes × ₱2.40 = ₱120.00.</small></label>
          <label className="field"><span>Absence daily rate</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.absenceDailyRate} onChange={number('absenceDailyRate')} /></div><small>One full unpaid absence deducts this amount; a half day deducts half.</small></label>
          <label className="field"><span>Match tolerance</span><div className="money-input"><b>₱</b><input type="number" min="0" step="0.01" required value={form.differenceTolerance} onChange={number('differenceTolerance')} /></div><small>An audit threshold only; it never changes your pay.</small></label>
        </div>
      </section>

      <section className="surface settings-section weekly-schedule-section">
        <div className="section-title"><div><p className="section-kicker">Schedule cycle</p><h2>{config.mode === 'weekly' ? 'Recurring weekly pattern' : `${config.cycleLength}-day rotating pattern`}</h2></div><span className="form-icon"><IonIcon icon={timeOutline} /></span></div>
        <div className="schedule-cycle-controls">
          <div className="day-type-toggle schedule-mode-toggle" role="group" aria-label="Schedule pattern">
            <button type="button" className={config.mode === 'weekly' ? 'active' : ''} onClick={(event) => { event.preventDefault(); changeMode('weekly'); }}>Weekly</button>
            <button type="button" className={config.mode === 'rotating' ? 'active' : ''} onClick={(event) => { event.preventDefault(); changeMode('rotating'); }}>Rotating</button>
          </div>
          {config.mode === 'rotating' && <div className="rotation-fields">
            <label className="field"><span>Cycle starts on</span><input type="date" required value={config.anchorDate} onChange={(event) => setConfig({ ...config, anchorDate: event.target.value })} /><small>This date is Day 1 of the rotation.</small></label>
            <label className="field"><span>Days in cycle</span><input type="number" min="1" max="28" step="1" required value={config.cycleLength} onChange={(event) => changeCycleLength(Number(event.target.value))} /><small>The pattern repeats after the last day.</small></label>
          </div>}
        </div>
        <WeeklyTimeMap config={config} schedule={schedule} selectedWeekday={selectedWeekday} onSelectDay={setSelectedWeekday} />

        <div className="day-editor">
          <div className="day-editor-header">
            <div><p className="section-kicker">Selected day</p><h2>{config.mode === 'weekly' ? dayNames[selectedDay.weekday] : `Cycle day ${selectedDay.weekday + 1}`}</h2></div>
            <div className="day-type-toggle" role="group" aria-label={`${config.mode === 'weekly' ? dayNames[selectedDay.weekday] : `Cycle day ${selectedDay.weekday + 1}`} schedule type`}>
              <button type="button" className={selectedDay.isWorking ? 'active' : ''} onClick={() => setWorking(true)}><IonIcon icon={briefcaseOutline} />Working</button>
              <button type="button" className={!selectedDay.isWorking ? 'active rest' : ''} onClick={() => setWorking(false)}><IonIcon icon={moonOutline} />Rest</button>
            </div>
          </div>

          {selectedDay.isWorking ? <>
            <div className="interval-list">
              {selectedDay.intervals.length ? selectedDay.intervals.map((item, index) => <div className={`interval-row ${item.type}`} key={item.id}>
                <span className="interval-number">{index + 1}</span>
                <label className="field"><span>Type</span><select value={item.type} onChange={(event) => updateInterval(item.id, { type: event.target.value as ScheduleIntervalType })}><option value="work">Work</option><option value="break">Unpaid break</option></select></label>
                <label className="field"><span>Starts</span><input type="time" required value={item.startTime} onChange={(event) => updateInterval(item.id, { startTime: event.target.value })} /></label>
                <label className="field"><span>Ends</span><input type="time" required value={item.endTime} onChange={(event) => updateInterval(item.id, { endTime: event.target.value })} /></label>
                <button type="button" className="icon-button interval-delete" aria-label={`Delete ${item.type} interval ${index + 1}`} onClick={() => deleteInterval(item.id)}><IonIcon icon={trashOutline} /></button>
              </div>) : <div className="day-editor-empty">Add at least one work interval for this working day.</div>}
            </div>
            <div className="interval-actions">
              <button type="button" onClick={() => addInterval('work')}><IonIcon icon={addOutline} />Work interval</button>
              <button type="button" onClick={() => addInterval('break')}><IonIcon icon={addOutline} />Unpaid break</button>
              <button type="button" className="interval-info" onClick={() => setBreakInfoOpen(true)}><IonIcon icon={informationCircleOutline} />How intervals affect pay</button>
            </div>
          </> : <div className="rest-day-message"><span><IonIcon icon={moonOutline} /></span><div><strong>Rest day</strong><p>No regular work intervals are expected. Logged work on this day is treated as overtime.</p></div></div>}
        </div>
      </section>

      <div className="settings-save"><p>Saving recalculates existing time logs and payroll estimates using the active schedule cycle.</p><button className="primary-button" type="submit">Save settings & schedule</button></div>
    </form>

    <IonModal isOpen={deleteConfirmOpen} onDidDismiss={() => setDeleteConfirmOpen(false)} className="break-info-modal">
      <div className="break-info-dialog" role="alertdialog" aria-labelledby="delete-all-title">
        <button type="button" className="modal-close" aria-label="Close" onClick={() => setDeleteConfirmOpen(false)}><IonIcon icon={closeOutline} /></button>
        <span className="modal-icon danger"><IonIcon icon={warningOutline} /></span>
        <p className="section-kicker">This cannot be undone</p>
        <h2 id="delete-all-title">Delete all payroll data?</h2>
        <p>This permanently removes every attendance record, payslip, payroll period, and schedule setting, then resets Butterbarya to its defaults.</p>
        <button type="button" className="danger-button danger-button-block" disabled={dataBusy} onClick={deleteAllData}>{dataBusy ? 'Deleting…' : 'Yes, delete everything'}</button>
        <button type="button" className="text-button-cancel" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button>
      </div>
    </IonModal>

    <IonModal isOpen={breakInfoOpen} onDidDismiss={() => setBreakInfoOpen(false)} className="break-info-modal">
      <div className="break-info-dialog" role="dialog" aria-labelledby="break-info-title">
        <button type="button" className="modal-close" aria-label="Close interval information" onClick={() => setBreakInfoOpen(false)}><IonIcon icon={closeOutline} /></button>
        <span className="modal-icon"><IonIcon icon={timeOutline} /></span>
        <p className="section-kicker">Schedule calculation</p>
        <h2 id="break-info-title">How schedule intervals work</h2>
        <p>Work intervals are counted as regular scheduled time. Unpaid break intervals and gaps between split shifts are excluded from worked time.</p>
        <div className="break-example"><span>Example</span><strong>Work 08:00–12:00</strong><strong>Break 12:00–13:00</strong><strong>Work 13:00–17:00</strong><p>9 elapsed hours − 1 unpaid hour = 8 scheduled work hours</p></div>
        <p className="modal-note">Intervals on the same day cannot overlap. A shift may cross midnight, and each day can contain as many work or break intervals as needed.</p>
        <button type="button" className="primary-button" onClick={() => setBreakInfoOpen(false)}>Got it</button>
      </div>
    </IonModal>
    <IonToast isOpen={notice.open} onDidDismiss={() => setNotice((current) => ({ ...current, open: false }))} message={notice.message} duration={2800} color={notice.color} />
  </PageShell>;
}

interface TimelineSegment { start: number; end: number }

function minuteOfDay(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function splitTimelineInterval(startTime: string, endTime: string): TimelineSegment[] {
  const start = minuteOfDay(startTime);
  const end = minuteOfDay(endTime);
  if (start === end) return [];
  return end > start ? [{ start, end }] : [{ start, end: 1440 }, { start: 0, end }];
}

function intervalHours(item: ScheduleInterval) {
  const start = minuteOfDay(item.startTime);
  let end = minuteOfDay(item.endTime);
  if (end < start) end += 1440;
  return (end - start) / 60;
}

function hoursText(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}h`;
}

function WeeklyTimeMap({ config, schedule, selectedWeekday, onSelectDay }: { config: ScheduleConfig; schedule: WeeklyScheduleDay[]; selectedWeekday: number; onSelectDay: (weekday: number) => void }) {
  const totalWorkHours = schedule.reduce((sum, day) => sum + day.intervals.filter((item) => item.type === 'work').reduce((daySum, item) => daySum + intervalHours(item), 0), 0);
  const displaySchedule = [...schedule].sort((left, right) => config.mode === 'weekly' ? ((left.weekday + 6) % 7) - ((right.weekday + 6) % 7) : left.weekday - right.weekday);
  const dayName = (day: WeeklyScheduleDay, short = false) => config.mode === 'weekly' ? (short ? shortDayNames : dayNames)[day.weekday] : `${short ? 'D' : 'Cycle day '}${day.weekday + 1}`;
  return <div className="weekly-map-shell">
    <div className="weekly-map-summary"><span><strong>{schedule.filter((day) => day.isWorking).length}</strong> working days</span><span><strong>{hoursText(totalWorkHours)}</strong> scheduled per cycle</span><small>Scroll horizontally on smaller screens · select a day to edit</small></div>
    <div className="weekly-map-scroll">
      <div className="weekly-map" role="grid" aria-label={`${config.mode === 'weekly' ? 'Weekly' : 'Rotating'} schedule time map`} style={{ gridTemplateColumns: `72px repeat(${displaySchedule.length}, minmax(86px, 1fr))`, minWidth: `${Math.max(760, 72 + displaySchedule.length * 86)}px` }}>
        <div className="weekly-map-corner" />
        {displaySchedule.map((day) => <button type="button" role="columnheader" className={`weekly-day-heading ${selectedWeekday === day.weekday ? 'selected' : ''}`} key={day.weekday} onClick={() => onSelectDay(day.weekday)}><strong>{dayName(day, true)}</strong><span>{day.isWorking ? `${hoursText(day.intervals.filter((item) => item.type === 'work').reduce((sum, item) => sum + intervalHours(item), 0))} work` : 'Rest'}</span></button>)}
        <div className="weekly-time-axis" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ top: `${index * 12.5}%` }}>{String(index * 3).padStart(2, '0')}:00</span>)}</div>
        {displaySchedule.map((day) => <button type="button" role="gridcell" aria-label={`${dayName(day)}: ${day.isWorking ? 'working day' : 'rest day'}`} aria-selected={selectedWeekday === day.weekday} className={`weekly-day-track ${selectedWeekday === day.weekday ? 'selected' : ''} ${day.isWorking ? '' : 'rest'}`} key={day.weekday} onClick={() => onSelectDay(day.weekday)}>
          {!day.isWorking && <span className="rest-label">Rest</span>}
          {day.intervals.flatMap((item) => splitTimelineInterval(item.startTime, item.endTime).map((segment, index) => <span className={`weekly-interval ${item.type}`} title={`${item.type === 'work' ? 'Work' : 'Unpaid break'} ${item.startTime}-${item.endTime}`} key={`${item.id}-${index}`} style={{ top: `${segment.start / 1440 * 100}%`, height: `${(segment.end - segment.start) / 1440 * 100}%` }}><i>{item.type === 'work' ? 'Work' : 'Break'}</i></span>))}
        </button>)}
      </div>
    </div>
    <div className="weekly-map-legend"><span><i className="legend-work" />Work</span><span><i className="legend-break" />Unpaid break</span><span><i className="legend-rest" />Rest day</span></div>
  </div>;
}
