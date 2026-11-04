'use client';

import { useEffect, useState } from 'react';
import { useL } from './LangProvider';
import Modal from './Modal';

/** Remembered until the browser is closed, so the question comes once per visit. */
export const LOCATION_ASKED = 'okeat-location-asked';

export function readAsked(): string | null {
  try { return sessionStorage.getItem(LOCATION_ASKED); } catch { return null; }
}
export function saveAsked(answer: 'yes' | 'no') {
  try { sessionStorage.setItem(LOCATION_ASKED, answer); } catch { /* private window */ }
}

const RETRY = 'okeat-location-retry';
export const markRetry = () => { try { sessionStorage.setItem(RETRY, '1'); } catch { /* private window */ } };
export function takeRetry(): boolean {
  try { const on = !!sessionStorage.getItem(RETRY); sessionStorage.removeItem(RETRY); return on; } catch { return false; }
}

/** Our own question, before the browser's. It explains why, and the browser's window comes only after "yes". */
export default function LocationAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const L = useL();
  // One window at a time: it waits for the sign-in or first-visit window to close.
  const [clear, setClear] = useState(false);
  useEffect(() => {
    const check = () => { if (!document.querySelector('.modal')) setClear(true); };
    check();
    const t = setInterval(check, 500);
    return () => clearInterval(t);
  }, []);
  if (!clear) return null;
  return (
    <Modal title={L('לשתף את המיקום שלך? 📍', 'Share your location? 📍')} subtitle={L('כך נראה מה קרוב אלייך וכמה זמן לוקח להגיע. המיקום לא נשמר אצלנו.', "So we can show what's near you and how long it takes to get there. We don't store it.")} onClose={onNo}>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onNo}>{L('לא עכשיו', 'Not now')}</button>
        <button type="button" className="btn primary" onClick={onYes}>{L('שיתוף מיקום', 'Share location')}</button>
      </div>
    </Modal>
  );
}
