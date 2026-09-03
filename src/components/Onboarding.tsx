import { IonIcon } from '@ionic/react';
import { arrowBackOutline, arrowForwardOutline, layersOutline, rocketOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { useRef, useState } from 'react';

const slides = [
  { icon: rocketOutline, eyebrow: 'Welcome to Butterbarya', title: 'Track your finances smoothly, like butter.', copy: 'A calm, private space to understand your money, starting with the payroll details that matter every cutoff.' },
  { icon: layersOutline, eyebrow: 'One money workspace', title: 'Your personal finance modules, together.', copy: 'Payroll tracking is ready now, with attendance, schedules, payroll periods, and payslips. Budget tracking is next.' },
  { icon: shieldCheckmarkOutline, eyebrow: 'Built for your device', title: 'Local-first. No internet needed.', copy: 'Your data stays on your device and works offline. Export a backup whenever you want to keep a copy.' },
];

export default function Onboarding({ onComplete }: { onComplete: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startX = useRef<number | null>(null);
  const slide = slides[index];
  const finish = async () => { setFinishing(true); await onComplete(); };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(delta) < 42) return;
    setIndex((current) => delta < 0 ? Math.min(current + 1, slides.length - 1) : Math.max(current - 1, 0));
  };

  return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Butterbarya introduction">
    <div className="onboarding-card" onPointerDown={(event) => { startX.current = event.clientX; }} onPointerUp={onPointerUp}>
      <button type="button" className="onboarding-skip" disabled={finishing} onClick={finish}>Skip</button>
      <div className="onboarding-art"><IonIcon icon={slide.icon} /></div>
      <p className="section-kicker">{slide.eyebrow}</p>
      <h1>{slide.title}</h1>
      <p className="onboarding-copy">{slide.copy}</p>
      <div className="onboarding-footer">{index > 0 ? <button type="button" className="onboarding-back" onClick={() => setIndex(index - 1)}><IonIcon icon={arrowBackOutline} />Back</button> : <span className="onboarding-footer-spacer" aria-hidden="true" />}<div className="onboarding-dots" aria-label={`Step ${index + 1} of ${slides.length}`}>{slides.map((item, itemIndex) => <i className={itemIndex === index ? 'active' : ''} key={item.eyebrow} />)}</div>{index < slides.length - 1 ? <button type="button" className="primary-button onboarding-next" onClick={() => setIndex(index + 1)}>Next<IonIcon icon={arrowForwardOutline} /></button> : <button type="button" className="primary-button onboarding-next" disabled={finishing} onClick={finish}>{finishing ? 'Opening…' : 'Start tracking'}<IonIcon icon={arrowForwardOutline} /></button>}</div>
    </div>
  </div>;
}
