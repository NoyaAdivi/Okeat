'use client';

import { useL } from './LangProvider';
import Modal from './Modal';

/**
 * Once location is refused, the browser never asks again and a site cannot make it ask.
 * So this shows the way to turn it back on.
 */
export default function LocationHelp({ onRetry, onPick, onClose }: { onRetry: () => void; onPick: () => void; onClose: () => void }) {
  const L = useL();
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/.test(ua);
  const app = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : null;
  const steps = iphone && app
    ? [
      L('פותחים את ההגדרות של הטלפון', 'Open your phone settings'),
      L(`נכנסים ל-${app}. בגרסאות חדשות זה תחת "יישומים"`, `Go to ${app}. On newer versions it is under "Apps"`),
      L('בוחרים "מיקום" ואז "בעת השימוש ביישום"', 'Choose "Location", then "While Using the App"'),
      L('חוזרים לכאן ולוחצים "לנסות שוב"', 'Come back and tap "Try again"'),
    ]
    : iphone
      ? [
        L('בשורת הכתובת לוחצים על aA', 'In the address bar, tap aA'),
        L('בוחרים "הגדרות אתר"', 'Choose "Website Settings"'),
        L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
        L('לוחצים "לנסות שוב"', 'Tap "Try again"'),
      ]
      : [
        L('לוחצים על הסמל שליד הכתובת, למעלה', 'Tap the icon next to the address, at the top'),
        L('בוחרים "הרשאות" או "הגדרות אתר"', 'Choose "Permissions" or "Site settings"'),
        L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
        L('לוחצים "לנסות שוב"', 'Tap "Try again"'),
      ];

  // On an iPhone the browser asks again only after the page reloads.
  const retry = () => { if (iphone) window.location.reload(); else onRetry(); };

  return (
    <Modal title={L('צריך לאשר מיקום', 'Location is off')} subtitle={L('הדפדפן חוסם כרגע את המיקום. אפשר לפתוח אותו, או פשוט לבחור מיקום ידנית.', 'Your browser is blocking location. You can turn it on, or just choose a location yourself.')} onClose={onClose}>
      <ol className="loc-steps">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onPick}>{L('בחירה ידנית', 'Choose myself')}</button>
        <button type="button" className="btn primary" onClick={retry}>{L('לנסות שוב', 'Try again')}</button>
      </div>
    </Modal>
  );
}
