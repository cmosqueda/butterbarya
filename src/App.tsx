import { Navigate, Route } from 'react-router-dom';
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { calendarClearOutline, homeOutline, receiptOutline, settingsOutline } from 'ionicons/icons';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Payslips from './pages/Payslips';
import Settings from './pages/Settings';
import { PayrollProvider } from './state/PayrollContext';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import './theme/variables.css';
import './theme/app.css';

setupIonicReact({ mode: 'md' });
const App: React.FC = () => <IonApp><PayrollProvider><IonReactRouter><IonTabs>
  <IonRouterOutlet>
    <Route path="/overview" element={<Dashboard />} /><Route path="/attendance" element={<Attendance />} />
    <Route path="/payslips" element={<Payslips />} /><Route path="/settings" element={<Settings />} />
    <Route path="/" element={<Navigate to="/overview" replace />} />
  </IonRouterOutlet>
  <IonTabBar slot="bottom" className="app-tabs">
    <IonTabButton tab="overview" href="/overview"><IonIcon icon={homeOutline} /><IonLabel>Overview</IonLabel></IonTabButton>
    <IonTabButton tab="attendance" href="/attendance"><IonIcon icon={calendarClearOutline} /><IonLabel>Time</IonLabel></IonTabButton>
    <IonTabButton tab="payslips" href="/payslips"><IonIcon icon={receiptOutline} /><IonLabel>Payslips</IonLabel></IonTabButton>
    <IonTabButton tab="settings" href="/settings"><IonIcon icon={settingsOutline} /><IonLabel>Settings</IonLabel></IonTabButton>
  </IonTabBar>
</IonTabs></IonReactRouter></PayrollProvider></IonApp>;
export default App;
