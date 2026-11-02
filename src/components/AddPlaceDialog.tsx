'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import CertificateCapture, { type CertificateValue } from './CertificateCapture';
import { LEVELS, PLACE_TYPES, levelText, needLabel, placeTypeLabel, type Level, type Need } from '@/lib/types';
import { useL } from './LangProvider';
import { MAIN_NEEDS, NEED_CLASS, NEED_ORDER } from '@/lib/claims';
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

function LevelPicker({ need, value, onChange }: { need: Need; value: Level; onChange: (v: Level) => void }) {
  const L = useL();
  return (
    <div className="levels" role="radiogroup" aria-label={`${L('רמה', 'Level')}: ${needLabel(need, L.lang)}`}>
      {LEVELS[need].filter((l) => l.value !== 'marked').map((l) => (
        <label key={l.value}>
          <input type="radio" name={`lvl-${need}`} value={l.value} checked={value === l.value} onChange={() => onChange(l.value)} />
          {levelText(l, L.lang)}
        </label>
      ))}
    </div>
  );
}

export default function AddPlaceDialog({ sb, location, onClose, onDone }: Props) {
  const L = useL();
  const lang = L.lang;
  const [name, setName] = useState('');
  const [placeType, setPlaceType] = useState('restaurant');
  const [address, setAddress] = useState('');
  const [needs, setNeeds] = useState<Record<Need, boolean>>(() => Object.fromEntries(NEED_ORDER.map((n) => [n, false])) as Record<Need, boolean>);
  const [levels, setLevels] = useState<Record<Need, Level>>(() =>
    Object.fromEntries(NEED_ORDER.map((n) => [n, n === 'kosher' ? 'rabanut' : LEVELS[n][0].value])) as Record<Need, Level>);
  const [withPhoto, setWithPhoto] = useState(false);
  const [moreNeeds, setMoreNeeds] = useState(false);
  const [cert, setCert] = useState<CertificateValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError(L('צריך שם למקום.', 'The place needs a name.'));
    if (!NEED_ORDER.some((n) => needs[n])) return setError(L('סמנו לפחות דבר אחד, למשל כשר, טבעוני, צמחוני או ללא גלוטן.', 'Mark at least one thing, e.g. kosher, vegan, vegetarian or gluten-free.'));
    if (needs.kosher && withPhoto && !cert) return setError(L('צלמו את התעודה ובדקו שהפרטים מלאים, או בטלו את הצילום.', 'Photograph the certificate and check the details, or turn the photo off.'));

    setBusy(true);
    let placeId: string | null = null;
    try {
      placeId = await addPlace(sb, { name: name.trim(), placeType, address: address.trim() || undefined, ...location });
      for (const n of NEED_ORDER) {
        if (!needs[n]) continue;
        if (n === 'kosher' && withPhoto && cert) await proposeKosherClaim(sb, { placeId, ...cert });
        else await proposeClaim(sb, { placeId, need: n, level: levels[n] });
      }
      onDone(placeId);
    } catch (e) {
      if (placeId) onDone(placeId, L(`המקום נוסף, אבל חלק מהפרטים לא נשמרו: ${friendly(e)}`, `The place was added, but some details weren't saved: ${friendly(e, 'en')}`));
      else {
        setError(friendly(e, lang));
        setBusy(false);
      }
    }
  };

  return (
    <Modal title={L('מקום חדש', 'New place')} subtitle={L('המקום יופיע במפה מיד, ומה שסימנתם יאושר אחרי ששלושה אנשים נוספים יאשרו.', 'The place appears on the map right away; what you marked is confirmed after three more people agree.')} onClose={onClose}>
      <div className="field">
        <label htmlFor="add-name">{L('שם המקום', "The place's name")}</label>
        <input id="add-name" type="text" maxLength={120} placeholder={L('למשל: קפה הפינה', 'e.g. Corner Café')} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="add-type">{L('סוג', 'Type')}</label>
          <select id="add-type" value={placeType} onChange={(e) => setPlaceType(e.target.value)}>
            {Object.keys(PLACE_TYPES).map((v) => <option key={v} value={v}>{placeTypeLabel(v, lang)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-address">{L('כתובת (לא חובה)', 'Address (optional)')}</label>
          <input id="add-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <span className="lab">{L('מה יש שם?', "What's there?")}</span>
        <div className="need-list">
          {(moreNeeds ? NEED_ORDER : MAIN_NEEDS).map((n) => (
            <div key={n} className={`need-box ${NEED_CLASS[n]}${needs[n] ? ' on' : ''}`}>
              <label>
                <input type="checkbox" checked={needs[n]} onChange={(e) => setNeeds({ ...needs, [n]: e.target.checked })} />
                {needLabel(n, lang)}
              </label>
              {needs[n] && (
                <LevelPicker need={n} value={levels[n]} onChange={(v) => setLevels({ ...levels, [n]: v })} />
              )}
              {needs[n] && n === 'kosher' && (
                <>
                  <label className="small-check">
                    <input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} />
                    {L('יש לי צילום של התעודה (לא חובה)', 'I have a photo of the certificate (optional)')}
                  </label>
                  {withPhoto && <CertificateCapture sb={sb} onChange={setCert} />}
                </>
              )}
            </div>
          ))}
        </div>
        {!moreNeeds && (
          <button type="button" className="link more-needs" onClick={() => setMoreNeeds(true)}>
            + {L('אלרגיות (חלב, ביצים, בוטנים, אגוזים, שומשום, סויה)', 'Allergies (dairy, egg, peanuts, nuts, sesame, soy)')}
          </button>
        )}
        <span className="hint">{L('צילום של תעודת הכשרות לא חובה, אבל הוא מחזק את המידע.', "A photo of the kosher certificate isn't required, but it makes the information stronger.")}</span>
      </div>

      {error && <div className="err" role="alert">{error}</div>}
      <p className="consent">{L('בשליחה אתם מאשרים שהמידע נכון למיטב ידיעתכם, ומסכימים ל', 'By sending you confirm the information is correct to the best of your knowledge, and agree to the ')}<a href="/terms" target="_blank" rel="noopener noreferrer">{L('תנאי השימוש', 'terms of use')}</a>.</p>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>
          {busy ? L('שולח…', 'Sending…') : L('שליחה לאישור הקהילה', 'Send for the community to confirm')}
        </button>
      </div>
    </Modal>
  );
}
