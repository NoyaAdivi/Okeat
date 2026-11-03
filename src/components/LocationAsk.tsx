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

/** Our own question, before the browser's. It explains why, and the browser's window comes only after "yes". */
export default function LocationAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const L = useL();
  return (
    <Modal title={L('לשתף את המיקום שלך? 📍', 'Share your location? 📍')} subtitle={L('כך נראה מה קרוב אלייך וכמה זמן לוקח להגיע. המיקום לא נשמר אצלנו.', "So we can show what's near you and how long it takes to get there. We don't store it.")} onClose={onNo}>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onNo}>{L('לא עכשיו', 'Not now')}</button>
        <button type="button" className="btn primary" onClick={onYes}>{L('שיתוף מיקום', 'Share location')}</button>
      </div>
    </Modal>
  );
}

/** The same question when entering the home page. */
export function HomeLocationAsk() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (readAsked() || !('geolocation' in navigator)) return;
    const show = () => setOpen(true);
    const query = navigator.permissions?.query({ name: 'geolocation' });
    if (query) query.then((p) => { if (p.state !== 'granted') show(); }).catch(show);
    else show();
  }, []);
  if (!open) return null;
  return (
    <LocationAsk
      onNo={() => { saveAsked('no'); setOpen(false); }}
      onYes={() => {
        saveAsked('yes');
        setOpen(false);
        navigator.geolocation.getCurrentPosition(() => undefined, () => undefined);
      }}
    />
  );
}
