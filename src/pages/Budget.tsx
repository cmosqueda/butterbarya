import { IonIcon } from '@ionic/react';
import { analyticsOutline, arrowBackOutline, walletOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell';

export default function Budget() {
  return <PageShell eyebrow="Budget tracking" title="A clearer plan for your money." module="budget">
    <section className="surface budget-coming-soon">
      <div className="budget-coming-soon-icon"><IonIcon icon={walletOutline} /></div>
      <span className="coming-soon-chip">Coming soon</span>
      <h2>Budget tracking is on the way.</h2>
      <p>This will be a separate workspace for income, expenses, categories, spending limits, and savings goals. Your payroll tools remain in the Payroll module.</p>
      <div className="budget-preview" aria-label="Planned budget features">
        <span><IonIcon icon={analyticsOutline} /><strong>Planned features</strong></span>
        <ul><li>Monthly budgets and categories</li><li>Expense and income tracking</li><li>Savings goals and spending insights</li></ul>
      </div>
      <Link className="budget-back-link" to="/overview"><IonIcon icon={arrowBackOutline} />Return to Payroll tracking</Link>
    </section>
  </PageShell>;
}
