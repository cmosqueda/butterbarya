import { Navigate, Route, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { calendarClearOutline, homeOutline, receiptOutline, settingsOutline } from 'ionicons/icons';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Payslips from './pages/Payslips';
import Settings from './pages/Settings';
import Budget from './pages/Budget';
import GlobalSettings from './pages/GlobalSettings';
import ModuleMenu from './components/ModuleMenu';
import Onboarding from './components/Onboarding';
import { PayrollProvider } from './state/PayrollContext';
import { loadGlobalPreferences, saveGlobalPreferences } from './state/database';
import { applyTheme } from './theme/appearance';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme/variables.css';
import './theme/app.css';

setupIonicReact({ mode: 'md' });
const AppNavigation: React.FC = () => {
  const location = useLocation();
  const inPayroll = !location.pathname.startsWith('/budget') && !location.pathname.startsWith('/global-settings');
  const [preferences, setPreferences] = useState<{ theme: 'system' | 'light' | 'dark'; onboardingComplete: boolean } | null>(null);
  useEffect(() => { loadGlobalPreferences().then((loaded) => { applyTheme(loaded.theme); setPreferences(loaded); }).catch(() => setPreferences({ theme: 'system', onboardingComplete: true })); }, []);
  const completeOnboarding = async () => {
    if (!preferences) return;
    const saved = { ...preferences, onboardingComplete: true };
    await saveGlobalPreferences(saved);
    setPreferences(saved);
  };
  return <><ModuleMenu /><IonTabs>
  <IonRouterOutlet id="module-content">
    <Route path="/overview" element={<Dashboard />} /><Route path="/attendance" element={<Attendance />} />
    <Route path="/payslips" element={<Payslips />} /><Route path="/settings" element={<Settings />} />
    <Route path="/budget" element={<Budget />} />
    <Route path="/global-settings" element={<GlobalSettings />} />
    <Route path="/" element={<Navigate to="/overview" replace />} />
  </IonRouterOutlet>
  {inPayroll && <IonTabBar slot="bottom" className="app-tabs">
    <IonTabButton tab="overview" href="/overview"><IonIcon icon={homeOutline} /><IonLabel>Overview</IonLabel></IonTabButton>
    <IonTabButton tab="attendance" href="/attendance"><IonIcon icon={calendarClearOutline} /><IonLabel>Time</IonLabel></IonTabButton>
    <IonTabButton tab="payslips" href="/payslips"><IonIcon icon={receiptOutline} /><IonLabel>Payslips</IonLabel></IonTabButton>
    <IonTabButton tab="settings" href="/settings"><IonIcon icon={settingsOutline} /><IonLabel>Settings</IonLabel></IonTabButton>
  </IonTabBar>}
</IonTabs>{preferences && !preferences.onboardingComplete && <Onboarding onComplete={completeOnboarding} />}</>;
};

const App: React.FC = () => <IonApp><PayrollProvider><IonReactRouter><AppNavigation /></IonReactRouter></PayrollProvider></IonApp>;
export default App;
