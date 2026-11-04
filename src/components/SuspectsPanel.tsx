'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteHiddenPlace, fetchSuspects, hidePlaces, markPlacesOk, type Suspect, type SuspectReason } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { placeEmoji } from '@/lib/emoji';
import { placeTypeLabel } from '@/lib/types';
import { useL } from './LangProvider';
import AdminPlaceDialog from './AdminPlaceDialog';

const PAGE = 40;

/** For the admin: places that look wrong. "Fine" is remembered, so a place never comes back for nothing. */
export default function SuspectsPanel({ sb, onCount }: { sb: SupabaseClient; onCount: (n: number) => void }) {
  const L = useL();
  const lang = L.lang;
  const [rows, setRows] = useState<Suspect[] | null>(null);
  const [group, setGroup] = useState<SuspectReason | null>(null);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<Suspect | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [error, setError] = useState('');

  const names: Record<SuspectReason, [string, string]> = {
    hand: ['🔎', L('סומנו לבדיקה', 'Marked to check')],
    new: ['✨', L('נוספו לאחרונה', 'Added lately')],
    shop: ['🛍️', L('חנויות', 'Shops')],
    service: ['🧾', L('עסקים ושירותים', 'Businesses')],
    health: ['🩺', L('בריאות', 'Health')],
    other: ['🏛️', L('מוסדות ואחרים', 'Institutions')],
    butcher: ['🥩', L('אטליזים', 'Butchers')],
    hall: ['🎉', L('אולמות אירועים', 'Event halls')],
    catering: ['🍱', L('קייטרינג', 'Catering')],
    spot: ['📍', L('מיקום לא מדויק', 'Rough location')],
  };

  // Why each place is on the list, in plain words.
  const why: Record<SuspectReason, string> = {
    hand: L('צריך לבדוק', 'Needs a look'),
    new: L('משתמש/ת הוסיף/ה אותו לאחרונה, ועוד לא נבדק', 'A user added it lately and nobody checked yet'),
    shop: L('בשם יש מילה של חנות, לא של אוכל', 'The name sounds like a shop, not food'),
    service: L('השם נשמע כמו עסק או שירות, לא אוכל', 'The name sounds like a business, not food'),
    health: L('השם נשמע כמו מקום בריאות', 'The name sounds like a health place'),
    other: L('השם נשמע כמו מוסד או מקום שאינו אוכל', 'The name sounds like an institution'),
    butcher: L('נשמע כמו אטליז: יש שם מה לקנות ולאכול, או רק בשר לא מוכן?', 'Sounds like a butcher: is there anything ready to eat?'),
    hall: L('נשמע כמו אולם: אפשר פשוט לבוא ולאכול?', 'Sounds like a hall: can you just walk in and eat?'),
    catering: L('נשמע כמו קייטרינג: יש מקום לקנות בו?', 'Sounds like catering: is there a place to buy from?'),
    spot: L('כמה מקומות יושבים על אותה נקודה, אז המיקום כנראה כללי', 'Several places share this spot, so the location is probably rough'),
  };

  const load = () => fetchSuspects(sb).then((r) => { setRows(r); onCount(r.length); }).catch((e) => setError(friendly(e, lang)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c: Partial<Record<SuspectReason, number>> = {};
    rows?.forEach((r) => { c[r.reason] = (c[r.reason] ?? 0) + 1; });
    return c;
  }, [rows]);
  // The likeliest mistakes come first, in the same order as the buttons above.
  const order = Object.keys(names);
  const list = (rows?.filter((r) => !group || r.reason === group) ?? [])
    .sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason));

  const pick = (g: SuspectReason | null) => { setGroup(g); setMarked(new Set()); setShown(PAGE); };
  const toggle = (id: string) => setMarked((m) => {
    const next = new Set(m);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  /** The rows leave right away, so going through a long list stays quick. */
  const decide = (ids: string[], fn: (s: SupabaseClient, i: string[]) => Promise<void>) => {
    setRows((r) => {
      const left = r?.filter((x) => !ids.includes(x.id)) ?? null;
      onCount(left?.length ?? 0);
      return left;
    });
    setMarked(new Set());
    fn(sb, ids).catch((e) => { setError(friendly(e, lang)); load(); });
  };

  if (error && !rows) return <p className="warnbox">{error}</p>;
  if (!rows) return <p className="muted">{L('בודק את המקומות…', 'Checking the places…')}</p>;

  return (
    <>
      <h2>{L('מקומות לבדיקה', 'Places to check')} ({rows.length})</h2>
      <p className="muted small">{L('הרשימה מתעדכנת לבד. "תקין" נשמר, והמקום לא יחזור לכאן. "הסתרה" מעבירה ללשונית מוסתרים, ומשם אפשר להחזיר. "מחיקה" אי אפשר לבטל.', 'This list updates by itself. "Fine" is remembered, and the place will not come back. "Hide" moves it to the Hidden tab, where it can come back. "Delete" cannot be undone.')}</p>
      {error && <p className="warnbox" role="alert">{error}</p>}

      <div className="check-groups" role="group" aria-label={L('סוג הבדיקה', 'What to check')}>
        <button type="button" aria-pressed={group === null} onClick={() => pick(null)}>{L('הכול', 'All')} <b>{rows.length}</b></button>
        {(Object.keys(names) as SuspectReason[]).filter((k) => counts[k]).map((k) => (
          <button key={k} type="button" aria-pressed={group === k} onClick={() => pick(k)}>
            <span aria-hidden="true">{names[k][0]}</span> {names[k][1]} <b>{counts[k]}</b>
          </button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">{L('הכול נבדק. אין כרגע מה לעשות כאן.', 'All checked. Nothing to do here.')}</p>}
      {list.slice(0, shown).map((p) => (
        <div key={p.id} className="admin-row check-row">
          <input type="checkbox" checked={marked.has(p.id)} onChange={() => toggle(p.id)} aria-label={L(`בחירת ${p.name}`, `Select ${p.name}`)} />
          <div>
            <a href={`/map?place=${p.id}`} target="_blank" rel="noreferrer"><span aria-hidden="true">{placeEmoji(p.place_type)}</span> <b>{p.name}</b></a>
            <div className="check-why"><span aria-hidden="true">{names[p.reason][0]}</span> {p.note ?? why[p.reason]}</div>
            <div className="muted small">{placeTypeLabel(p.place_type, lang)}{p.address ? `, ${p.address}` : ''}</div>
          </div>
          <div className="admin-row-tools">
            <button type="button" className="btn small" onClick={() => decide([p.id], markPlacesOk)}>{L('תקין', 'Fine')}</button>
            <button type="button" className="btn small ghost danger" onClick={() => decide([p.id], hidePlaces)}>{L('הסתרה', 'Hide')}</button>
            <button type="button" className="btn small ghost" onClick={() => setEditing(p)}>{L('עריכה', 'Edit')}</button>
            {sure === p.id
              ? <button type="button" className="btn small ghost danger" onClick={() => decide([p.id], async (s, i) => { await hidePlaces(s, i); await deleteHiddenPlace(s, p.id); })}>{L('למחוק לגמרי?', 'Delete for good?')}</button>
              : <button type="button" className="btn small ghost danger" onClick={() => setSure(p.id)}>{L('מחיקה', 'Delete')}</button>}
            <a className="btn small ghost" href={`https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.address ?? ''}`.trim())}`} target="_blank" rel="noreferrer">{L('בגוגל', 'Google')}</a>
          </div>
        </div>
      ))}
      {list.length > shown && <button type="button" className="btn" onClick={() => setShown(shown + PAGE)}>{L(`להציג עוד (נשארו ${list.length - shown})`, `Show more (${list.length - shown} left)`)}</button>}

      {list.length > 0 && (
        <div className="check-bar">
          {marked.size === 0 ? (
            <button type="button" className="btn small" onClick={() => setMarked(new Set(list.slice(0, shown).map((p) => p.id)))}>{L('לבחור את כל המוצגים', 'Select all shown')}</button>
          ) : (
            <>
              <b>{L(`נבחרו ${marked.size}`, `${marked.size} selected`)}</b>
              <button type="button" className="btn small" onClick={() => decide([...marked], markPlacesOk)}>{L('כולם תקינים', 'All fine')}</button>
              <button type="button" className="btn small ghost danger" onClick={() => decide([...marked], hidePlaces)}>{L('להסתיר', 'Hide')}</button>
              <button type="button" className="link" onClick={() => setMarked(new Set())}>{L('ביטול', 'Clear')}</button>
            </>
          )}
        </div>
      )}
      {editing && <AdminPlaceDialog sb={sb} place={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}
