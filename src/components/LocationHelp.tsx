'use client';

import { useL } from './LangProvider';
import Modal from './Modal';

/**
 * Once location is refused, the browser never asks again and a site cannot make it ask.
 * So this shows the way to turn it back on.
 */
export default function LocationHelp({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const L = useL();
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const steps = iphone
    ? [
      L('בשורת הכתובת של Safari לוחצים על aA', 'In the Safari address bar, tap aA'),
      L('בוחרים "הגדרות אתר"', 'Choose "Website Settings"'),
      L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
    ]
    : [
      L('לוחצים על הסמל שליד הכתובת, למעלה', 'Tap the icon next to the address, at the top'),
      L('בוחרים "הרשאות" או "הגדרות אתר"', 'Choose "Permissions" or "Site settings"'),
      L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
    ];

  return (
    <Modal title={L('צריך לאשר מיקום', 'Location is off')} subtitle={L('הדפדפן זוכר שסירבת, ולא נותן לאתר לשאול שוב. משנים את זה פעם אחת:', 'Your browser remembers you said no, and does not let a site ask again. You only need to change this once:')} onClose={onClose}>
      <ol className="loc-steps">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>{L('סגירה', 'Close')}</button>
        <button type="button" className="btn primary" onClick={onRetry}>{L('לנסות שוב', 'Try again')}</button>
      </div>
    </Modal>
  );
}
