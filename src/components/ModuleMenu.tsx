import { IonContent, IonIcon, IonMenu, IonMenuToggle } from '@ionic/react';
import { calculatorOutline, chevronForwardOutline, layersOutline, settingsOutline, walletOutline } from 'ionicons/icons';
import { Link, useLocation } from 'react-router-dom';

const modules = [
  { id: 'payroll', name: 'Payroll tracking', description: 'Attendance, periods and payslips', path: '/overview', icon: calculatorOutline },
  { id: 'budget', name: 'Budget tracking', description: 'Plan spending and savings', path: '/budget', icon: walletOutline, comingSoon: true },
];

export default function ModuleMenu() {
  const location = useLocation();
  const activeModule = location.pathname.startsWith('/budget') ? 'budget' : location.pathname.startsWith('/global-settings') ? 'global' : 'payroll';

  return <IonMenu menuId="module-menu" contentId="module-content" type="overlay" className="module-menu">
    <IonContent>
      <aside className="module-drawer" aria-label="Butterbarya modules">
        <div className="module-drawer-brand"><span className="brand-mark">B</span><div><strong>butterbarya</strong><small>Your personal money workspace</small></div></div>
        <div className="module-drawer-heading"><IonIcon icon={layersOutline} /><span>Modules</span></div>
        <nav className="module-list" aria-label="Choose a module">
          {modules.map((module) => <IonMenuToggle autoHide={false} key={module.id}>
            <Link className={`module-link ${activeModule === module.id ? 'active' : ''}`} to={module.path} aria-current={activeModule === module.id ? 'page' : undefined}>
              <span className="module-link-icon"><IonIcon icon={module.icon} /></span>
              <span className="module-link-copy"><strong>{module.name}</strong><small>{module.description}</small></span>
              {module.comingSoon ? <span className="coming-soon-chip">Coming soon</span> : <IonIcon className="module-link-arrow" icon={chevronForwardOutline} />}
            </Link>
          </IonMenuToggle>)}
        </nav>
        <div className="module-drawer-heading module-settings-heading"><IonIcon icon={settingsOutline} /><span>App</span></div>
        <IonMenuToggle autoHide={false}>
          <Link className={`module-link ${activeModule === 'global' ? 'active' : ''}`} to="/global-settings" aria-current={activeModule === 'global' ? 'page' : undefined}>
            <span className="module-link-icon"><IonIcon icon={settingsOutline} /></span>
            <span className="module-link-copy"><strong>Global settings</strong><small>Appearance, backups and data</small></span>
            <IonIcon className="module-link-arrow" icon={chevronForwardOutline} />
          </Link>
        </IonMenuToggle>
        <p className="module-drawer-note">Each module keeps its tools focused while remaining part of the same offline Butterbarya app.</p>
      </aside>
    </IonContent>
  </IonMenu>;
}
