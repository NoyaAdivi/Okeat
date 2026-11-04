'use client';

import { useEffect, useState } from 'react';
import { useL } from './LangProvider';
import Modal from './Modal';
import { markRetry } from './LocationAsk';

/** The browser said no. Try again comes first; the settings are there only if that doesn't help. */
export default function LocationHelp({ onRetry, onPick, onClose }: { onRetry: () => void; onPick: () => void; onClose: () => void }) {
  const L = useL();
  const ua = navigator.userAgent;
  const iphone = /iPhone|iPad|iPod/.test(ua);
  const app = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : null;
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' }).then((p) => setBlocked(p.state === 'denied')).catch(() => undefined);
  }, []);

  const steps = iphone && app
    ? [
      L('פותחים את ההגדרות של הטלפון', 'Open your phone settings'),
      L(`נכנסים ל-${app}. בגרסאות חדשות זה תחת "יישומים"`, `Go to ${app}. On newer versions it is under "Apps"`),
      L('בוחרים "מיקום" ואז "בעת השימוש ביישום"', 'Choose "Location", then "While Using the App"'),
    ]
    : iphone
      ? [
        L('בשורת הכתובת לוחצים על aA', 'In the address bar, tap aA'),
        L('בוחרים "הגדרות אתר"', 'Choose "Website Settings"'),
        L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
      ]
      : [
        L('לוחצים על הסמל שליד הכתובת, למעלה', 'Tap the icon next to the address, at the top'),
        L('בוחרים "הרשאות" או "הגדרות אתר"', 'Choose "Permissions" or "Site settings"'),
        L('ליד "מיקום" בוחרים "לאפשר"', 'Set Location to "Allow"'),
      ];

  // An iPhone asks again only after the page reloads.
  const retry = () => {
    if (iphone) { markRetry(); window.location.reload(); } else onRetry();
  };

  return (
    <Modal title={L('לא קיבלנו את המיקום', 'We did not get your location')} subtitle={L('אפשר לנסות שוב, או לבחור מיקום בעצמך.', 'You can try again, or choose a location yourself.')} onClose={onClose}>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onPick}>{L('בחירה ידנית', 'Choose myself')}</button>
        <button type="button" className="btn primary" onClick={retry}>{L('לנסות שוב', 'Try again')}</button>
      </div>
      <details className="loc-more" open={blocked}>
        <summary>{L('הדפדפן לא שואל? כך פותחים', 'Browser not asking? Here is how')}</summary>
        <ol className="loc-steps">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </details>
    </Modal>
  );
}
