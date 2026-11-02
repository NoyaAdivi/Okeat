'use client';

import { useL } from './LangProvider';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import { LEVELS, levelNote, levelText, needLabel, type Level, type Need } from '@/lib/types';
import CertificateCapture, { type CertificateValue } from './CertificateCapture';
import { NEED_CLASS } from '@/lib/claims';
import { NEED_EMOJI } from '@/lib/emoji';
import { proposeClaim, proposeKosherClaim } from '@/lib/places';
import { friendly } from '@/lib/errors';

interface Props {
  sb: SupabaseClient;
  place: { id: string; name: string };
  need: Need;
  onClose: () => void;
  onDone: () => void;
}

/** "What do you know about this place?" for any need. For kosher, a certificate photo is optional and strengthens the claim. */
export default function AddInfoDialog({ sb, place, need, onClose, onDone }: Props) {
  const L = useL();
  const lang = L.lang;
  // people can't choose 'marked' (that's only for places imported from OpenStreetMap)
  const levels = LEVELS[need].filter((l) => l.value !== 'marked');
  const [level, setLevel] = useState<Level>(need === 'kosher' ? 'rabanut' : levels[0].value);
  const [withPhoto, setWithPhoto] = useState(false);
  const [cert, setCert] = useState<CertificateValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (need === 'kosher' && withPhoto) {
        if (!cert) {
          setError(L('צלמו את התעודה ובדקו שהפרטים מלאים, או בטלו את הצילום.', 'Photograph the certificate and check the details, or turn the photo off.'));
          setBusy(false);
          return;
        }
        await proposeKosherClaim(sb, { placeId: place.id, ...cert });
      } else {
        await proposeClaim(sb, { placeId: place.id, need, level });
      }
      onDone();
    } catch (e) {
      setError(friendly(e, lang));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={L(`${NEED_EMOJI[need]} ${needLabel(need)} ב${place.name}?`, `${NEED_EMOJI[need]} ${needLabel(need, 'en')} at ${place.name}?`)}
      subtitle={L('זה יופיע במפה אחרי ששלושה אנשים נוספים יאשרו.', 'This will appear on the map after three more people confirm it.')}
      onClose={onClose}
    >
      <div className={`need-box on ${NEED_CLASS[need]}`}>
        <span className="lab">{L('מה נכון לגבי המקום?', "What's true about this place?")}</span>
        <div className="info-levels" role="radiogroup" aria-label={needLabel(need, lang)}>
          {levels.map((l) => (
            <label key={l.value} className="info-level">
              <input type="radio" name="info-level" checked={level === l.value} onChange={() => setLevel(l.value)} />
              <span>
                <b>{levelText(l, lang)}</b>
                {levelNote(l, lang) && <small>{levelNote(l, lang)}</small>}
              </span>
            </label>
          ))}
        </div>
      </div>
      {need === 'kosher' && (
        <div className="need-box k">
          <label>
            <input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} />
            {L('יש לי צילום של התעודה (לא חובה, מחזק את המידע)', 'I have a photo of the certificate (optional, makes it stronger)')}
          </label>
          {withPhoto && <CertificateCapture sb={sb} onChange={setCert} />}
        </div>
      )}
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
