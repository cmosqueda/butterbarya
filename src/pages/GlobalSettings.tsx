import { IonIcon, IonModal, IonToast, IonToggle } from '@ionic/react';
import { closeOutline, cloudUploadOutline, downloadOutline, moonOutline, phonePortraitOutline, sunnyOutline, trashOutline, warningOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { exportBackupJson, importBackupJson, loadGlobalPreferences, resetPayrollData, saveGlobalPreferences } from '../state/database';
import { applyTheme } from '../theme/appearance';
import type { AppTheme } from '../state/types';

const themes: { value: AppTheme; label: string; icon: typeof sunnyOutline; description: string }[] = [
  { value: 'system', label: 'System', icon: phonePortraitOutline, description: 'Follow your device' },
  { value: 'light', label: 'Light', icon: sunnyOutline, description: 'Always light' },
  { value: 'dark', label: 'Dark', icon: moonOutline, description: 'Always dark' },
];

export default function GlobalSettings() {
  const [theme, setTheme] = useState<AppTheme>('system');
  const [dataBusy, setDataBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [notice, setNotice] = useState({ open: false, message: '', color: 'success' as 'success' | 'danger' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadGlobalPreferences().then((preferences) => { setTheme(preferences.theme); applyTheme(preferences.theme); }).catch(() => undefined); }, []);

  const changeTheme = async (value: AppTheme) => {
    setTheme(value);
    applyTheme(value);
    try { await saveGlobalPreferences({ theme: value, onboardingComplete: true }); }
    catch { setNotice({ open: true, message: 'Could not save your appearance preference.', color: 'danger' }); }
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
        const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
        setNotice({ open: true, message: 'Backup file downloaded.', color: 'success' });
      }
    } catch (error) { setNotice({ open: true, message: error instanceof Error ? error.message : 'Could not export your data.', color: 'danger' }); }
    finally { setDataBusy(false); }
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setDataBusy(true);
    try { await importBackupJson(await file.text()); setNotice({ open: true, message: 'All data restored. Reloading…', color: 'success' }); setTimeout(() => window.location.reload(), 1200); }
    catch (error) { setNotice({ open: true, message: error instanceof Error ? error.message : 'That file could not be imported.', color: 'danger' }); setDataBusy(false); }
  };

  const clearPayrollData = async () => {
    setDataBusy(true);
    try { await resetPayrollData(); setDeleteConfirmOpen(false); setNotice({ open: true, message: 'Payroll data deleted. Reloading…', color: 'success' }); setTimeout(() => window.location.reload(), 1200); }
    catch (error) { setNotice({ open: true, message: error instanceof Error ? error.message : 'Could not delete payroll data.', color: 'danger' }); setDataBusy(false); }
  };

  return <PageShell eyebrow="App preferences" title="Set up Butterbarya your way." module="global">
    <section className="surface global-settings-section">
      <div className="section-title"><div><p className="section-kicker">Preferences</p><h2>Appearance</h2></div><span className="form-icon"><IonIcon icon={moonOutline} /></span></div>
      <p className="data-section-copy">Choose how Butterbarya looks across every module. Your choice is saved on this device and included in app backups.</p>
      <div className="theme-options" role="group" aria-label="Theme preference">
        {themes.map((option) => <button type="button" key={option.value} className={`theme-option ${theme === option.value ? 'active' : ''}`} onClick={() => changeTheme(option.value)} aria-pressed={theme === option.value}>
          <IonIcon icon={option.icon} /><span><strong>{option.label}</strong><small>{option.description}</small></span>
        </button>)}
      </div>
      <div className="dark-mode-toggle"><div><strong>Dark mode</strong><small>Quickly switch between the light and dark appearance.</small></div><IonToggle checked={theme === 'dark'} onIonChange={(event) => changeTheme(event.detail.checked ? 'dark' : 'light')} aria-label="Toggle dark mode" /></div>
    </section>

    <section className="surface global-settings-section data-section">
      <div className="section-title"><div><p className="section-kicker">All app data</p><h2>Export or restore everything</h2></div><span className="form-icon"><IonIcon icon={downloadOutline} /></span></div>
      <p className="data-section-copy">Save a complete offline backup of every module and app preference. Restoring replaces the current data with the backup contents.</p>
      <div className="data-actions"><button type="button" disabled={dataBusy} onClick={exportData}><IonIcon icon={downloadOutline} />Export all data</button><button type="button" disabled={dataBusy} onClick={() => fileInputRef.current?.click()}><IonIcon icon={cloudUploadOutline} />Import all data</button><input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={importData} /></div>
    </section>

    <section className="surface global-settings-section danger-section">
      <div className="section-title"><div><p className="section-kicker">Danger zone</p><h2>Clear payroll data</h2></div><span className="form-icon danger"><IonIcon icon={trashOutline} /></span></div>
      <p className="data-section-copy">This permanently deletes payroll attendance, payslips, payroll periods, and schedules. Global preferences stay saved; future budget data is not affected.</p>
      <button type="button" className="danger-button" disabled={dataBusy} onClick={() => setDeleteConfirmOpen(true)}><IonIcon icon={trashOutline} />Clear payroll data</button>
    </section>

    <IonModal isOpen={deleteConfirmOpen} onDidDismiss={() => setDeleteConfirmOpen(false)} className="break-info-modal"><div className="break-info-dialog" role="alertdialog" aria-labelledby="clear-payroll-title"><button type="button" className="modal-close" aria-label="Close" onClick={() => setDeleteConfirmOpen(false)}><IonIcon icon={closeOutline} /></button><span className="modal-icon danger"><IonIcon icon={warningOutline} /></span><p className="section-kicker">This cannot be undone</p><h2 id="clear-payroll-title">Clear all payroll data?</h2><p>Attendance, payslips, payroll periods, and schedules will be removed. Your global appearance preference remains.</p><button type="button" className="danger-button danger-button-block" disabled={dataBusy} onClick={clearPayrollData}>{dataBusy ? 'Clearing…' : 'Yes, clear payroll data'}</button><button type="button" className="text-button-cancel" onClick={() => setDeleteConfirmOpen(false)}>Cancel</button></div></IonModal>
    <IonToast isOpen={notice.open} onDidDismiss={() => setNotice((current) => ({ ...current, open: false }))} message={notice.message} duration={2800} color={notice.color} />
  </PageShell>;
}
