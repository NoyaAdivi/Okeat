'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminPlaceDialog from './AdminPlaceDialog';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useL } from './LangProvider';
import type { Place } from '@/lib/types';
import {
  fetchPlaceMeta, moderatePlace, reportPlace, requestOwnership, submitOwnershipProof, type PlaceMeta,
} from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import Avatar from './Avatar';

interface Props {
  sb: SupabaseClient;
  place: Place;
  /** signed in with a real account (not anonymous) */
  signedIn: boolean;
  /** The site admin can correct the place itself. */
  isAdmin?: boolean;
  onSignIn: (reason: string) => void;
  onToast: (text: string) => void;
  onChanged: () => void;
}

/** Bottom of a place: who added it, the owner's badge, "report", "I own this business", and moderator tools. */
const REPORT_KINDS = [
  { id: 'closed', he: 'המקום נסגר', en: 'It closed' },
  { id: 'gone', he: 'המקום לא קיים', en: "It doesn't exist" },
  { id: 'address', he: 'הכתובת לא נכונה', en: 'Wrong address' },
  { id: 'other', he: 'אחר', en: 'Something else' },
] as const;

export default function PlaceCommunity({ sb, place, signedIn, isAdmin, onSignIn, onToast, onChanged }: Props) {
  const L = useL();
  const [editing, setEditing] = useState(false);
  const lang = L.lang;
  const [meta, setMeta] = useState<PlaceMeta | null>(null);
  const [panel, setPanel] = useState<'none' | 'report' | 'owner'>('none');
  const [reason, setReason] = useState('');
  const [kind, setKind] = useState<(typeof REPORT_KINDS)[number]['id']>('closed');
  const [code, setCode] = useState('');
  const [proof, setProof] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => fetchPlaceMeta(sb, place.id).then(setMeta);
  useEffect(() => { load(); }, [place.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // the database doesn't have migration 0008 yet: show nothing
  if (!meta) return null;

  const needAccount = (why: string) => {
    if (signedIn) return false;
    onSignIn(why);
    return true;
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(friendly(e, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sec community" aria-labelledby="community-h">
      <h3 id="community-h" className="vh">{L('על המקום בקהילה', 'About this place in the community')}</h3>

      {meta.ownerVerified && (
        <div className="owner-badge">
          <span aria-hidden="true">🏅</span>
          <span><b>{L('אושר על ידי בעל העסק', 'Confirmed by the business owner')}</b> {L('בעל העסק הוכיח שהוא מנהל את המקום.', 'The owner proved they run this place.')}</span>
        </div>
      )}

      {meta.flagged && (
        <div className="warnbox"><span>{L('כמה אנשים דיווחו על המקום הזה, והוא בבדיקה של מנהלי הקהילה.', 'A few people reported this place, and community moderators are checking it.')}</span></div>
      )}

      <div className="added-by">
        {meta.creator ? (
          <Link href={`/u/${meta.creator.id}`} className="who-link">
            <Avatar name={meta.creator.name} url={meta.creator.avatar} size={34} />
            <span>
              <small>{L('הוסיף/ה את המקום', 'Added this place')}</small>
              <b>{meta.creator.name}</b>
            </span>
          </Link>
        ) : (
          <span className="who-link muted-who">
            <Avatar name="OSM" url={null} size={34} />
            <span>
              <small>{L('מקור', 'Source')}</small>
              <b>{L('מאגר פתוח', 'An open database')}</b>
            </span>
          </span>
        )}
        <small className="when">{formatDate(meta.createdAt.slice(0, 10))}</small>
      </div>

      <div className="community-acts">
        {!meta.ownerVerified && !meta.iRequestedOwner && (
          <button type="button" className="link" onClick={() => {
            if (needAccount(L('כדי לאמת שאתם בעלי העסק צריך להתחבר עם חשבון.', 'To verify you own the business, sign in with an account.'))) return;
            run(async () => { setCode(await requestOwnership(sb, place.id)); setPanel('owner'); });
          }}>
            <span aria-hidden="true">🏪</span> {L('אני בעל/ת העסק', 'I own this business')}
          </button>
        )}
        {meta.iRequestedOwner && <span className="hint">{L('בקשת האימות שלך מחכה לאישור מנהל.', 'Your verification request is waiting for an admin.')}</span>}
        {!meta.iReported ? (
          <button type="button" className="link danger" onClick={() => {
            if (needAccount(L('כדי לדווח על מקום צריך להתחבר עם חשבון.', 'To report a place, sign in with an account.'))) return;
            setPanel(panel === 'report' ? 'none' : 'report');
          }}>
            <span aria-hidden="true">🚩</span> {L('דיווח על מקום שגוי', 'Report a wrong place')}
          </button>
        ) : (
          <span className="hint">{L('תודה, הדיווח שלך התקבל.', 'Thanks, your report was received.')}</span>
        )}
      </div>

      {panel === 'report' && (
        <div className="mini-form">
          <span className="lab">{L('מה לא בסדר?', "What's wrong?")}</span>
          <div className="report-kinds" role="radiogroup" aria-label={L('סוג הדיווח', 'Type of report')}>
            {REPORT_KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="btn small ghost" onClick={() => setKind(k.id)}>{L(k.he, k.en)}</button>
            ))}
          </div>
          <label htmlFor="rep">{kind === 'address' ? L('מה הכתובת הנכונה?', 'What is the correct address?') : L('פרטים נוספים (לא חובה)', 'More details (optional)')}</label>
          <input id="rep" type="text" maxLength={260} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="hint">{L('הדיווח מגיע למנהלי הקהילה, והמקום משתנה רק אחרי אישור.', 'Your report goes to the site admin, and the place changes only after approval.')}</p>
          <button type="button" className="btn small" disabled={busy || (kind === 'address' && !reason.trim())} onClick={() => run(async () => {
            const chosen = REPORT_KINDS.find((k) => k.id === kind)!;
            await reportPlace(sb, place.id, `[${chosen.he}] ${reason.trim()}`.trim());
            setPanel('none');
            onToast(L('הדיווח נשלח. תודה!', 'Report sent. Thanks!'));
            await load();
          })}>{L('שליחת דיווח', 'Send report')}</button>
        </div>
      )}

      {panel === 'owner' && code && (
        <div className="mini-form">
          <p><b>{L('איך מוכיחים שהעסק שלכם?', 'How to prove the business is yours')}</b></p>
          <ol className="steps-list">
            <li>{L('הוסיפו את הקוד הזה לזמן קצר באתר של העסק, או בביו / פוסט בעמוד האינסטגרם או הפייסבוק הרשמי שלו:', "Add this code for a short while to the business's website, or to the bio / a post on its official Instagram or Facebook page:")} <code dir="ltr">{code}</code></li>
            <li>{L('הדביקו כאן את הקישור לעמוד שבו רואים את הקוד.', 'Paste the link to the page where the code can be seen.')}</li>
            <li>{L('מנהל יבדוק ויאשר. אחרי האישור אפשר למחוק את הקוד.', 'An admin checks and approves it. After that you can remove the code.')}</li>
          </ol>
          <label htmlFor="proof">{L('קישור (https://…)', 'Link (https://…)')}</label>
          <input id="proof" type="url" dir="ltr" maxLength={500} value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://instagram.com/…" />
          <label htmlFor="pnote">{L('הערה למנהל (לא חובה)', 'A note for the admin (optional)')}</label>
          <input id="pnote" type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn small" disabled={busy || !proof.startsWith('https://')} onClick={() => run(async () => {
            await submitOwnershipProof(sb, place.id, proof.trim(), note.trim());
            setPanel('none');
            onToast(L('נשלח! מנהל יבדוק בקרוב.', 'Sent! An admin will check it soon.'));
            await load();
          })}>{L('שליחה לאימות', 'Send for verification')}</button>
        </div>
      )}

      {meta.canModerate && (
        <div className="mod-tools">
          <span className="mod-tag">{L('כלי מנהל', 'Moderator tools')}</span>
          {isAdmin && <button type="button" className="btn small" onClick={() => setEditing(true)}>{L('עריכת המקום והסיווג', 'Edit place and type')}</button>}
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => {
            if (!window.confirm(L(`למחוק את "${place.name}" מהמפה?`, `Remove "${place.name}" from the map?`))) return;
            run(async () => { await moderatePlace(sb, place.id, true); onToast(L('המקום הוסר', 'The place was removed')); onChanged(); });
          }}>{L('הסרת המקום', 'Remove the place')}</button>
          {meta.flagged && (
            <button type="button" className="btn small" disabled={busy} onClick={() => run(async () => {
              await moderatePlace(sb, place.id, false); onToast(L('המקום נשאר, הדיווחים נמחקו', 'The place stays; the reports were cleared')); await load();
            })}>{L('המקום בסדר', 'The place is fine')}</button>
          )}
          <Link href="/admin" className="btn small ghost">{L('לכל הדיווחים', 'All reports')}</Link>
        </div>
      )}

      {error && <div className="err" role="alert">{error}</div>}
      {editing && (
        <AdminPlaceDialog
          sb={sb}
          place={{ id: place.id, name: place.name, place_type: place.place_type, cuisine: place.cuisine ?? null, address: place.address ?? null, phone: place.phone ?? null, website: place.website ?? null }}
          claims={place.claims}
          onClose={() => { setEditing(false); onChanged(); }}
          onSaved={() => { setEditing(false); onToast(L('הפרטים נשמרו', 'The details were saved')); onChanged(); }}
        />
      )}
    </section>
  );
}
