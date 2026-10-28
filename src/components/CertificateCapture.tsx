'use client';

import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LEVELS, type ExtractedCertificate, type KosherLevel } from '@/lib/types';
import { extractCertificate, uploadCertificatePhoto } from '@/lib/places';
import { friendly } from '@/lib/errors';

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
      setError('צריך קובץ תמונה.');
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
      setError(friendly(e));
      return;
    }

    setPhase('reading');
    try {
      const r = await extractCertificate(path);
      setExtracted(r);
      setBody(r.supervisingBody ?? '');
      setLevel(r.level === 'unknown' ? '' : r.level);
      setValidUntil(r.validUntil ?? '');
      setBusinessName(r.businessName ?? '');
    } catch (e) {
      // The photo is uploaded; let them type the details instead.
      setReadError(friendly(e));
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
          <b>צילום או העלאה של תעודת הכשרות</b>
          <small>הגוף המשגיח, הרמה ותאריך התוקף ייקראו מהתמונה</small>
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
        <span>{phase === 'uploading' ? 'מעלה את התמונה…' : 'קורא את התעודה…'}</span>
        <div className="bar"><i className={phase === 'reading' ? 'go' : ''} /></div>
      </div>
    );
  }

  const warnings: string[] = [];
  if (extracted && !extracted.isKosherCertificate) warnings.push('זה לא נראה כמו תעודת כשרות. בדקו את התמונה.');
  if (extracted && extracted.isKosherCertificate && extracted.confidence < 0.6) warnings.push('חלק מהפרטים לא היו ברורים. בדקו כל שדה.');
  if (extracted) warnings.push(...extracted.issues);

  return (
    <div className="extract">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="התעודה שצילמתם" className="extract-img" />
      )}
      {readError && <div className="warnbox">{readError} אפשר למלא את הפרטים ידנית.</div>}
      {warnings.length > 0 && (
        <ul className="issues">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
      <div className="grid">
        <div className="field">
          <label htmlFor="cert-body">גוף משגיח</label>
          <input id="cert-body" type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="למשל: הרבנות הראשית רמת גן" />
        </div>
        <div className="field">
          <label htmlFor="cert-level">רמה</label>
          <select id="cert-level" value={level} onChange={(e) => setLevel(e.target.value as KosherLevel | '')}>
            <option value="">בחרו רמה</option>
            {LEVELS.kosher.filter((l) => l.value !== 'marked').map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cert-until">בתוקף עד</label>
          <input id="cert-until" type="date" value={validUntil} min={today()} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cert-name">שם העסק בתעודה</label>
          <input id="cert-name" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
      </div>
      {level === 'pikuach' && <span className="hint">{LEVELS.kosher.find((l) => l.value === 'pikuach')?.note}</span>}
      {expired && <div className="err" role="alert">התאריך כבר עבר. אפשר להוסיף רק תעודה בתוקף.</div>}
      <button type="button" className="link" onClick={reset}>צילום מחדש</button>
    </div>
  );
}
