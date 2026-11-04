'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAdminFeed, placePhotoUrl, type AdminEvent, type AdminKind } from '@/lib/places';
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
export default function AdminFeed({ sb, kind = null }: { sb: SupabaseClient; kind?: AdminKind | null }) {
  const L = useL();
  const lang = L.lang;
  const [rows, setRows] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState('');

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
  const action = (r: AdminEvent) => ({
    user: L('נרשם/ה לאתר', 'Signed up'),
    place: L('הוסיף/ה מקום', 'Added a place'),
    claim: L(`הוסיף/ה מידע: ${level(r)}`, `Added: ${level(r)}`),
    vote: r.rating === 1 ? L(`אישר/ה: ${level(r)}`, `Confirmed: ${level(r)}`) : L(`דיווח/ה שלא נכון: ${level(r)}`, `Said this is wrong: ${level(r)}`),
    review: `${'★'.repeat(r.rating ?? 0)} ${r.detail ?? ''}`.trim(),
    photo: L('העלה/תה תמונה', 'Added a photo'),
    report: r.detail || L('דיווח/ה על המקום', 'Reported the place'),
    suggestion: L(`הציע/ה סיווג: ${placeTypeLabel(r.level ?? '', lang)}${r.detail ? `, ${r.detail}` : ''}`, `Suggested: ${placeTypeLabel(r.level ?? '', lang)}`),
    list: L('יצר/ה רשימה', 'Made a list'),
    message: r.detail ?? '',
  })[r.kind];
  const when = (at: string) => {
    const d = new Date(at);
    const today = d.toDateString() === new Date().toDateString();
    const locale = lang === 'he' ? 'he-IL' : 'en-GB';
    return today ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });
  };

  if (error) return <p className="warnbox">{error}</p>;
  if (!rows) return <p className="muted">{L('טוען…', 'Loading…')}</p>;
  if (rows.length === 0) return <p className="muted">{L('עוד אין כאן כלום.', 'Nothing here yet.')}</p>;

  return (
    <ul className="admin-feed">
      {rows.map((r) => (
        <li key={`${r.kind}-${r.id}`} className={KIND_LOOK[r.kind].cls}>
          <span className="feed-icon" aria-hidden="true">{KIND_LOOK[r.kind].emoji}</span>
          <div>
            <p>
              {r.user_id ? <Link href={`/u/${r.user_id}`}><b>{r.user_name || L('משתמש/ת', 'A user')}</b></Link> : <b>{L('אורח/ת', 'A guest')}</b>}
              {r.place_id && <> <span aria-hidden="true">·</span> <Link href={`/map?place=${r.place_id}`}>{r.title}</Link></>}
              {r.kind === 'list' && <> <span aria-hidden="true">·</span> <Link href={`/list/${r.id}`}>{r.title}</Link></>}
            </p>
            <small>{action(r)}</small>
          </div>
          {r.path && (
            <Link href={`/map?place=${r.place_id}`} className="feed-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={placePhotoUrl(sb, r.path)} alt="" loading="lazy" />
            </Link>
          )}
          <time>{when(r.at)}</time>
        </li>
      ))}
    </ul>
  );
}
