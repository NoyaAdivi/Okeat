'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDeleteItem, fetchAdminFeed, moderateClaim, markMessage, markReport, placePhotoUrl, type AdminEvent, type AdminKind } from '@/lib/places';
import { googleUrl } from '@/lib/text';
import { friendly } from '@/lib/errors';
import { levelInfo, levelText, needLabel, placeTypeLabel, type Level } from '@/lib/types';
import { useL } from './LangProvider';

export const KIND_LOOK: Record<AdminKind, { emoji: string; cls: string }> = {
  user: { emoji: '🙋', cls: 'k' },
  place: { emoji: '📍', cls: 'v' },
  claim: { emoji: '📝', cls: 'h' },
  vote: { emoji: '👍', cls: 'g' },
  review: { emoji: '⭐', cls: 'e' },
  photo: { emoji: '📷', cls: 'x' },
  report: { emoji: '🚩', cls: 'k' },
  suggestion: { emoji: '🏷️', cls: 'v' },
  list: { emoji: '📋', cls: 'h' },
  message: { emoji: '💌', cls: 'g' },
};

/** Everything people did on the site, newest first. Each name opens the profile, each place opens the place. */
/** Done or still open, for the kinds that need someone to look at them. Null: nothing to handle. */
export function isHandled(r: AdminEvent): boolean | null {
  switch (r.kind) {
    case 'report': return r.status === 'handled';
    case 'message': return r.status === 'seen';
    case 'photo': return r.status === 'approved';
    case 'suggestion': return r.status !== 'pending';
    case 'claim': return r.status !== 'pending' && r.status !== 'disputed';
    default: return null;
  }
}

export default function AdminFeed({ sb, kind = null, canDelete = false, canHandle = canDelete, since = null }: { sb: SupabaseClient; kind?: AdminKind | null; canDelete?: boolean; canHandle?: boolean; since?: string | null }) {
  const L = useL();
  const lang = L.lang;
  const [rows, setRows] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState('');
  const [sure, setSure] = useState<string | null>(null);
  const [show, setShow] = useState<'all' | 'open' | 'done'>('all');
  // Mark a report or a message as handled, or open it again. The label moves at once.
  const toggleHandled = (r: AdminEvent) => {
    const done = !isHandled(r);
    const status = r.kind === 'report' ? (done ? 'handled' : 'pending') : (done ? 'seen' : 'pending');
    setRows((list) => list?.map((x) => (x === r ? { ...x, status } : x)) ?? null);
    const work = r.kind === 'report' ? markReport(sb, r.place_id!, r.user_id!, done) : markMessage(sb, Number(r.id), done);
    work.catch((e) => setError(friendly(e, lang)));
  };
  // An admin's word is enough: the information counts as confirmed right away.
  const approve = (r: AdminEvent) => {
    setRows((list) => list?.map((x) => (x === r ? { ...x, status: 'verified' } : x)) ?? null);
    moderateClaim(sb, r.id, true).catch((e) => setError(friendly(e, lang)));
  };
  const remove = (r: AdminEvent) => {
    setRows((list) => list?.filter((x) => x !== r) ?? null);
    adminDeleteItem(sb, r).catch((e) => setError(friendly(e, lang)));
  };

  useEffect(() => {
    let live = true;
    setRows(null);
    setError('');
    const load = () => fetchAdminFeed(sb, kind).then((r) => { if (live) setRows(r); }).catch((e) => { if (live) setError(friendly(e, lang)); });
    load();
    const again = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { live = false; clearInterval(again); };
  }, [sb, kind, lang]);

  const level = (r: AdminEvent) => {
    if (!r.need) return '';
    const info = levelInfo(r.need, r.level as Level);
    return info ? levelText(info, lang) : needLabel(r.need, lang);
  };
  // Only the line for this row's kind runs: a "wrong" vote is -1, which is not a number of stars.
  const action = (r: AdminEvent) => ({
    user: () => L('נרשם/ה לאתר', 'Signed up'),
    place: () => L('הוסיף/ה מקום', 'Added a place'),
    claim: () => L(`הוסיף/ה מידע: ${level(r)}`, `Added: ${level(r)}`),
    vote: () => r.rating === 1 ? L(`אישר/ה: ${level(r)}`, `Confirmed: ${level(r)}`) : L(`דיווח/ה שלא נכון: ${level(r)}`, `Said this is wrong: ${level(r)}`),
    review: () => `${'★'.repeat(Math.max(r.rating ?? 0, 0))} ${r.detail ?? ''}`.trim(),
    photo: () => L('העלה/תה תמונה', 'Added a photo'),
    report: () => r.detail?.replace(/^\[(.+?)\]\s*/, '$1. ').replace(/\.\s*$/, '') || L('דיווח/ה על המקום', 'Reported the place'),
    suggestion: () => L(`הציע/ה סיווג: ${placeTypeLabel(r.level ?? '', lang)}${r.detail ? `, ${r.detail}` : ''}`, `Suggested: ${placeTypeLabel(r.level ?? '', lang)}`),
    list: () => L('יצר/ה רשימה', 'Made a list'),
    message: () => r.detail ?? '',
  })[r.kind]();
  const when = (at: string) => {
    const d = new Date(at);
    const today = d.toDateString() === new Date().toDateString();
    const locale = lang === 'he' ? 'he-IL' : 'en-GB';
    return today ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  };

  if (error) return <p className="warnbox">{error}</p>;
  if (!rows) return <p className="muted">{L('טוען…', 'Loading…')}</p>;
  if (rows.length === 0) return <p className="muted">{L('עוד אין כאן כלום.', 'Nothing here yet.')}</p>;
  const inRange = since ? rows.filter((r) => r.at >= since) : rows;
  const handledKinds = inRange.filter((r) => isHandled(r) !== null);
  const open = handledKinds.filter((r) => !isHandled(r)).length;
  const shown = show === 'all' ? inRange : inRange.filter((r) => isHandled(r) === (show === 'done'));
  if (inRange.length === 0) return <p className="muted">{L('אין כאן כלום בטווח הזה.', 'Nothing here in this range.')}</p>;

  return (
    <>
    {handledKinds.length > 0 && (
      <div className="handled-filter" role="group" aria-label={L('סינון לפי טיפול', 'Filter by handled')}>
        <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>{L('הכול', 'All')} <b>{inRange.length}</b></button>
        <button type="button" className="open" aria-pressed={show === 'open'} onClick={() => setShow('open')}><span aria-hidden="true">●</span> {L('לא טופל', 'Open')} <b>{open}</b></button>
        <button type="button" className="done" aria-pressed={show === 'done'} onClick={() => setShow('done')}><span aria-hidden="true">✓</span> {L('טופל', 'Handled')} <b>{handledKinds.length - open}</b></button>
      </div>
    )}
    {shown.length === 0 && <p className="muted">{show === 'open' ? L('הכול טופל 🎉', 'Everything is handled 🎉') : L('אין כאן כלום.', 'Nothing here.')}</p>}
    <ul className="admin-feed">
      {shown.map((r) => (
        <li key={`${r.kind}-${r.id}`} className={KIND_LOOK[r.kind].cls}>
          <span className="feed-icon" aria-hidden="true">{KIND_LOOK[r.kind].emoji}</span>
          <div>
            <p>
              {r.user_id ? <Link href={`/u/${r.user_id}`}><b>{r.user_name || L('משתמש/ת', 'A user')}</b></Link> : <b>{L('אורח/ת', 'A guest')}</b>}
              {r.place_id && <> <span aria-hidden="true">·</span> <Link href={`/map?place=${r.place_id}`}>{r.title}</Link></>}
              {r.kind === 'list' && <> <span aria-hidden="true">·</span> <Link href={`/list/${r.id}`}>{r.title}</Link></>}
            </p>
            <small>{action(r)}</small>
            {isHandled(r) !== null && (
              <span className={`handled-tag ${isHandled(r) ? 'done' : 'open'}`}>{isHandled(r) ? L('✓ טופל', '✓ Handled') : L('● לא טופל', '● Open')}</span>
            )}
            {(r.kind === 'report' || (r.kind === 'message' && canDelete)) && canHandle && (
              <button type="button" className="chip-act" onClick={() => toggleHandled(r)}>{isHandled(r) ? L('↩︎ החזרה ללא טופל', '↩︎ Mark open') : L('✓ סימון כטופל', '✓ Mark handled')}</button>
            )}
            {r.place_id && r.title && canDelete && (
              <a className="chip-act" href={googleUrl(r.title)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span> {L('גוגל', 'Google')}</a>
            )}
          </div>
          {r.path && (
            <Link href={`/map?place=${r.place_id}`} className="feed-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={placePhotoUrl(sb, r.path)} alt="" loading="lazy" />
            </Link>
          )}
          <time>{when(r.at)}</time>
          {canDelete && r.kind === 'claim' && r.status === 'pending' && (
            <button type="button" className="btn small admin-ok" onClick={() => approve(r)}><span aria-hidden="true">🛡️</span> {L('אישור', 'Approve')}</button>
          )}
          {canDelete && r.kind !== 'user' && (sure === `${r.kind}-${r.id}`
            ? <button type="button" className="btn small ghost danger" onClick={() => remove(r)}>{r.kind === 'place' ? L('להסתיר?', 'Hide?') : L('למחוק?', 'Delete?')}</button>
            : <button type="button" className="link" onClick={() => setSure(`${r.kind}-${r.id}`)}>{r.kind === 'place' ? L('הסתרה', 'Hide') : L('מחיקה', 'Delete')}</button>)}
        </li>
      ))}
    </ul>
    </>
  );
}
