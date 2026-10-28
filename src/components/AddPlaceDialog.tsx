'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import CertificateCapture, { type CertificateValue } from './CertificateCapture';
import { LEVELS, NEED_LABELS, PLACE_TYPES, type Level, type Need } from '@/lib/types';
import { NEED_CLASS, NEED_ORDER } from '@/lib/claims';
import { addPlace, proposeClaim, proposeKosherClaim } from '@/lib/places';
import { friendly } from '@/lib/errors';
import type { LatLng } from '@/lib/geo';

interface Props {
  sb: SupabaseClient;
  location: LatLng;
  onClose: () => void;
  /** `warning` is set when the place was saved but some of its details weren't. */
  onDone: (placeId: string, warning?: string) => void;
}

function LevelPicker({ need, value, onChange }: { need: 'vegan' | 'gluten_free'; value: Level; onChange: (v: Level) => void }) {
  return (
    <div className="levels" role="radiogroup" aria-label={`רמה: ${NEED_LABELS[need].label}`}>
      {LEVELS[need].map((l) => (
        <label key={l.value}>
          <input type="radio" name={`lvl-${need}`} value={l.value} checked={value === l.value} onChange={() => onChange(l.value)} />
          {l.label}
        </label>
      ))}
    </div>
  );
}

export default function AddPlaceDialog({ sb, location, onClose, onDone }: Props) {
  const [name, setName] = useState('');
  const [placeType, setPlaceType] = useState('restaurant');
  const [address, setAddress] = useState('');
  const [needs, setNeeds] = useState<Record<Need, boolean>>({ kosher: false, vegan: false, gluten_free: false });
  const [levels, setLevels] = useState<Record<'vegan' | 'gluten_free', Level>>({ vegan: 'options', gluten_free: 'menu' });
  const [cert, setCert] = useState<CertificateValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('צריך שם למקום.');
    if (!NEED_ORDER.some((n) => needs[n])) return setError('סמנו לפחות דבר אחד: כשר, טבעוני או ללא גלוטן.');
    if (needs.kosher && !cert) return setError('כדי לסמן כשרות צריך לצלם את התעודה ולוודא שכל השדות מלאים.');

    setBusy(true);
    let placeId: string | null = null;
    try {
      placeId = await addPlace(sb, { name: name.trim(), placeType, address: address.trim() || undefined, ...location });
      for (const n of ['vegan', 'gluten_free'] as const) {
        if (needs[n]) await proposeClaim(sb, { placeId, need: n, level: levels[n] });
      }
      if (needs.kosher && cert) await proposeKosherClaim(sb, { placeId, ...cert });
      onDone(placeId);
    } catch (e) {
      if (placeId) onDone(placeId, `המקום נוסף, אבל חלק מהפרטים לא נשמרו: ${friendly(e)}`);
      else {
        setError(friendly(e));
        setBusy(false);
      }
    }
  };

  return (
    <Modal title="מקום חדש" subtitle="מה שתוסיפו יופיע במפה אחרי ששלושה אנשים נוספים יאשרו." onClose={onClose}>
      <div className="field">
        <label htmlFor="add-name">שם המקום</label>
        <input id="add-name" type="text" maxLength={120} placeholder="למשל: קפה הפינה" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="add-type">סוג</label>
          <select id="add-type" value={placeType} onChange={(e) => setPlaceType(e.target.value)}>
            {Object.entries(PLACE_TYPES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-address">כתובת (לא חובה)</label>
          <input id="add-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <span className="lab">מה יש שם?</span>
        <div className="need-list">
          {NEED_ORDER.map((n) => (
            <div key={n} className={`need-box ${NEED_CLASS[n]}${needs[n] ? ' on' : ''}`}>
              <label>
                <input type="checkbox" checked={needs[n]} onChange={(e) => setNeeds({ ...needs, [n]: e.target.checked })} />
                {NEED_LABELS[n].label}
              </label>
              {needs[n] && n === 'kosher' && <CertificateCapture sb={sb} onChange={setCert} />}
              {needs[n] && n !== 'kosher' && (
                <LevelPicker
                  need={n as 'vegan' | 'gluten_free'}
                  value={levels[n as 'vegan' | 'gluten_free']}
                  onChange={(v) => setLevels({ ...levels, [n as 'vegan' | 'gluten_free']: v })}
                />
              )}
            </div>
          ))}
        </div>
        <span className="hint">כשרות נוספת רק עם צילום של התעודה.</span>
      </div>

      {error && <div className="err" role="alert">{error}</div>}
      <p className="consent">בשליחה אתם מאשרים שהמידע נכון למיטב ידיעתכם, ומסכימים ל<a href="/terms" target="_blank" rel="noopener noreferrer">תנאי השימוש</a>.</p>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>ביטול</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>
          {busy ? 'שולח…' : 'שליחה לאישור הקהילה'}
        </button>
      </div>
    </Modal>
  );
}
