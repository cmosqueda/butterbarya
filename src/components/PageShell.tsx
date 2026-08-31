import { IonContent, IonPage } from '@ionic/react';
import type { PropsWithChildren, ReactNode } from 'react';

export default function PageShell({ eyebrow, title, action, children }: PropsWithChildren<{ eyebrow: string; title: string; action?: ReactNode }>) {
  return <IonPage><IonContent fullscreen>
    <main className="page-shell">
      <header className="page-header">
        <a className="brand" href="/overview" aria-label="Butterbarya overview"><span className="brand-mark">B</span><span>butterbarya</span></a>
        <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</div>
      </header>
      {children}
    </main>
  </IonContent></IonPage>;
}
