'use client';

import { useL } from './LangProvider';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LEVELS, levelNote, levelText, type ExtractedCertificate, type KosherLevel } from '@/lib/types';
import { extractCertificate, uploadCertificatePhoto } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { readCertificateLocally } from '@/lib/certificateOcr';

/** What the parent submits to propose_kosher_claim(). */
export interface CertificateValue {
  imagePath: string;
  level: KosherLevel;
  supervisingBody: string;
  validUntil: string;
  businessName: string | null;
  extracted: ExtractedCertificate | null;
  confidence?: number;
}

interface Props {
  sb: SupabaseClient;
  /** Called with a complete value, or null while something is missing. */
  onChange: (value: CertificateValue | null) => void;
}

type Phase = 'idle' | 'uploading' | 'reading' | 'review';
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Photo -> upload to Storage -> the server reads it with Claude -> the person checks
 * and fixes the fields. Nothing is trusted blindly: every field stays editable.
 */
export default function CertificateCapture({ sb, onChange }: Props) {
  const L = useL();
  const lang = L.lang;
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedCertificate | null>(null);
  const [readError, setReadError] = useState('');
  const [error, setError] = useState('');

  const [body, setBody] = useState('');
  const [level, setLevel] = useState<KosherLevel | ''>('');
  const [validUntil, setValidUntil] = useState('');
  const [businessName, setBusinessName] = useState('');

  const input = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const expired = !!validUntil && validUntil < today();

  // Report a complete value upward, or null.
  useEffect(() => {
    const ready = phase === 'review' && imagePath && body.trim() && level && validUntil && !expired;
    onChangeRef.current(
      ready
        ? {
            imagePath: imagePath!,
            level: level as KosherLevel,
            supervisingBody: body.trim(),
            validUntil,
            businessName: businessName.trim() || null,
            extracted,
            confidence: extracted?.confidence,
          }
        : null,
    );
  }, [phase, imagePath, body, level, validUntil, businessName, expired, extracted]);

  const reset = () => {
    setPhase('idle');
    setPreview(null);
    setImagePath(null);
    setExtracted(null);
    setReadError('');
    setError('');
    setBody(''); setLevel(''); setValidUntil(''); setBusinessName('');
    if (input.current) input.current.value = '';
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(L('צריך קובץ תמונה.', 'Please choose an image file.'));
      return;
    }
    setError('');
    setReadError('');
    setPreview(URL.createObjectURL(file));
    setPhase('uploading');

    let path: string;
    try {
      path = await uploadCertificatePhoto(sb, file);
      setImagePath(path);
    } catch (e) {
      setPhase('idle');
      setPreview(null);
      setError(friendly(e, lang));
      return;
    }

    setPhase('reading');
    try {
      // the server first; if it can't read, the free reader in the browser
      const r = await extractCertificate(path).catch(() => readCertificateLocally(file));
      setExtracted(r);
      setBody(r.supervisingBody ?? '');
      setLevel(r.level === 'unknown' ? '' : r.level);
      setValidUntil(r.validUntil ?? '');
      setBusinessName(r.businessName ?? '');
    } catch (e) {
      // The photo is uploaded; let them type the details instead.
      setReadError(friendly(e, lang));
    }
    setPhase('review');
  };

  if (phase === 'idle') {
    return (
      <div className="capture">
        <label className="drop" htmlFor="cert-file">
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
          <b>{L('צילום או העלאה של תעודת הכשרות', 'Photograph or upload the kosher certificate')}</b>
          <small>{L('הגוף המשגיח, הרמה ותאריך התוקף ייקראו מהתמונה', 'The supervising body, level and expiry date are read from the photo')}</small>
        </label>
        <input id="cert-file" ref={input} className="vh" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} />
        {error && <div className="err" role="alert">{error}</div>}
      </div>
    );
  }

  if (phase === 'uploading' || phase === 'reading') {
    return (
      <div className="reading" aria-live="polite">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="extract-img" />
        )}
        <span>{phase === 'uploading' ? L('מעלה את התמונה…', 'Uploading the photo…') : L('קורא את התעודה…', 'Reading the certificate…')}</span>
        <div className="bar"><i className={phase === 'reading' ? 'go' : ''} /></div>
      </div>
    );
  }

  const warnings: string[] = [];
  if (extracted && !extracted.isKosherCertificate) warnings.push(L('זה לא נראה כמו תעודת כשרות. בדקו את התמונה.', "This doesn't look like a kosher certificate. Please check the photo."));
  if (extracted && extracted.isKosherCertificate && extracted.confidence < 0.6) warnings.push(L('חלק מהפרטים לא היו ברורים. בדקו כל שדה.', 'Some details were unclear. Please check every field.'));
  if (extracted) warnings.push(...extracted.issues);

  return (
    <div className="extract">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={L('התעודה שצילמתם', 'The certificate you photographed')} className="extract-img" />
      )}
      {readError && <div className="warnbox">{readError} {L('אפשר למלא את הפרטים ידנית.', 'You can fill in the details by hand.')}</div>}
      {warnings.length > 0 && (
        <ul className="issues">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <div className="grid">
        <div className="field">
          <label htmlFor="cert-body">{L('גוף משגיח', 'Supervising body')}</label>
          <input id="cert-body" type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder={L('למשל: הרבנות הראשית רמת גן', 'e.g. Chief Rabbinate of Ramat Gan')} />
        </div>
        <div className="field">
          <label htmlFor="cert-level">{L('רמה', 'Level')}</label>
          <select id="cert-level" value={level} onChange={(e) => setLevel(e.target.value as KosherLevel | '')}>
            <option value="">{L('בחרו רמה', 'Choose a level')}</option>
            {LEVELS.kosher.filter((l) => l.value !== 'marked').map((l) => <option key={l.value} value={l.value}>{levelText(l, lang)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cert-until">{L('בתוקף עד', 'Valid until')}</label>
          <input id="cert-until" type="date" value={validUntil} min={today()} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cert-name">{L('שם העסק בתעודה', 'Business name on the certificate')}</label>
          <input id="cert-name" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
      </div>
      {level === 'pikuach' && <span className="hint">{(() => { const i = LEVELS.kosher.find((l) => l.value === 'pikuach'); return i ? levelNote(i, lang) : null; })()}</span>}
      {expired && <div className="err" role="alert">{L('התאריך כבר עבר. אפשר להוסיף רק תעודה בתוקף.', 'That date has passed. Only a valid certificate can be added.')}</div>}
      <button type="button" className="link" onClick={reset}>{L('צילום מחדש', 'Take it again')}</button>
    </div>
  );
}
