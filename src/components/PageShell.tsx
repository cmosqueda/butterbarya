import { IonContent, IonIcon, IonMenuButton, IonPage } from '@ionic/react';
import { gridOutline, menuOutline } from 'ionicons/icons';
import type { PropsWithChildren, ReactNode } from 'react';

export default function PageShell({ eyebrow, title, action, module = 'payroll', children }: PropsWithChildren<{ eyebrow: string; title: string; action?: ReactNode; module?: 'payroll' | 'budget' }>) {
  const isBudget = module === 'budget';
  return <IonPage><IonContent fullscreen>
    <main className="page-shell">
      <header className="page-header">
        <div className="app-context-bar">
          <IonMenuButton className="module-menu-trigger" menu="module-menu" aria-label="Open module navigation"><IonIcon icon={menuOutline} /></IonMenuButton>
          <a className="brand" href={isBudget ? '/budget' : '/overview'} aria-label={`Butterbarya ${isBudget ? 'budget' : 'payroll'} module`}><span className="brand-mark">B</span><span>butterbarya</span></a>
          <span className={`module-context-chip ${isBudget ? 'budget' : ''}`}><IonIcon icon={gridOutline} />{isBudget ? 'Budget' : 'Payroll'}</span>
        </div>
        <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</div>
      </header>
      {children}
    </main>
  </IonContent></IonPage>;
}
