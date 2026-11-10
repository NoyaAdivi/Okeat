'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createList, deleteList, renameList, fetchMyLists, fetchNotifications, markNotificationsSeen, type MyList, type MyNotification } from '@/lib/places';
import { needLabel, type Need } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';

/** On your own profile: what's new, and your lists. */
const CLEARED = 'okeat-notes-cleared';

export default function ProfileExtras({ sb, userId, show }: { sb: SupabaseClient; userId: string; show: 'notes' | 'lists' }) {
  const L = useL();
  const [notes, setNotes] = useState<MyNotification[]>([]);
  const [lists, setLists] = useState<MyList[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications(sb).then((n) => {
      // Notifications cleared on this device stay cleared; anything that happens later shows again.
      let cleared = '';
      try { cleared = localStorage.getItem(CLEARED) ?? ''; } catch { /* shows all */ }
      setNotes(n.filter((x) => x.happened_at > cleared));
      if (n.some((x) => x.is_new)) markNotificationsSeen(sb);
    });
    fetchMyLists(sb, userId).then(setLists);
  }, [sb, userId]);

  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renaming || renaming.title.trim().length < 2) return;
    setError('');
    try {
      await renameList(sb, renaming.id, renaming.title);
      setLists(lists.map((x) => (x.id === renaming.id ? { ...x, title: renaming.title.trim() } : x)));
      setRenaming(null);
    } catch (err) { setError(friendly(err, L.lang)); }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setError('');
    try {
      await createList(sb, userId, title);
      setTitle('');
      setLists(await fetchMyLists(sb, userId));
    } catch (err) { setError(friendly(err, L.lang)); }
  };

  return (
    <>
      {show === 'notes' && <section className="sec">
        <h2 className="vh">{L('התראות', 'Notifications')}</h2>
        {notes.length > 0 && (
          <p className="notes-clear">
            <button type="button" className="link" onClick={() => {
              try { localStorage.setItem(CLEARED, notes.reduce((m, n) => (n.happened_at > m ? n.happened_at : m), '')); } catch { /* only for now */ }
              setNotes([]);
            }}>{L('ניקוי כל ההתראות', 'Clear all notifications')}</button>
          </p>
        )}
        {notes.length === 0 && <p className="muted">{L('אין כרגע. כשמידע שהוספת יאושר, או תעודה שהעלית תתקרב לסיום, נספר לך כאן.', "Nothing right now. When your information is confirmed, or a certificate you added is about to end, you'll see it here.")}</p>}
        <ul className="profile-places note-cards">
          {notes.map((n) => (
            <li key={`${n.kind}-${n.place_id}-${n.need}`} className={n.is_new ? 'note-new' : undefined}>
              <Link href={`/map?place=${n.place_id}`}>
                {n.kind === 'confirmed'
                  ? <>👍 {L(`מישהו אישר את המידע שהוספת על ${n.place_name}`, `Someone confirmed what you added about ${n.place_name}`)}</>
                  : n.kind === 'approved'
                  ? <>✅ {L(`המידע שהוספת על ${n.place_name} אושר (${needLabel(n.need as Need, 'he')})`, `Your information about ${n.place_name} was confirmed (${needLabel(n.need as Need, 'en')})`)}</>
                  : <>⏰ {L(`תעודת הכשרות של ${n.place_name} עומדת להסתיים. אם התחדשה, אפשר לצלם את החדשה.`, `The kosher certificate of ${n.place_name} is about to end. If it was renewed, you can add the new one.`)}</>}
                <small> · {formatDate(n.happened_at.slice(0, 10))}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>}

      {show === 'lists' && <section className="sec">
        <h2 className="vh">{L('הרשימות שלי', 'My lists')}</h2>
        <form className="mini-form" onSubmit={add}>
          <input maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('למשל: הטבעוני שאני אוהבת בתל אביב', 'For example: my favorite vegan spots in Tel Aviv')} aria-label={L('שם הרשימה', 'List name')} />
          <button type="submit" className="btn small" disabled={title.trim().length < 2}>{L('יצירת רשימה', 'Create a list')}</button>
        </form>
        {error && <div className="err" role="alert">{error}</div>}
        <ul className="profile-places list-places my-lists">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/list/${l.id}`}><span aria-hidden="true">📝</span> <b>{l.title}</b> <small>{(l.list_places[0]?.count ?? 0) === 1 ? L('מקום אחד', 'One place') : L(`${l.list_places[0]?.count ?? 0} מקומות`, `${l.list_places[0]?.count ?? 0} places`)}</small></Link>
              <span className="my-acts">
              <button type="button" className="link" onClick={() => setRenaming({ id: l.id, title: l.title })}>{L('שינוי שם', 'Rename')}</button>
              <button type="button" className="link" onClick={async () => {
                if (sure !== l.id) { setSure(l.id); return; }
                await deleteList(sb, l.id);
                setLists(lists.filter((x) => x.id !== l.id));
              }}>{sure === l.id ? L('למחוק?', 'Delete?') : L('מחיקה', 'Delete')}</button>
              </span>
              {renaming?.id === l.id && (
                <form className="my-edit" onSubmit={saveName}>
                  <label htmlFor={`rename-${l.id}`}>{L('שם הרשימה', 'List name')}</label>
                  <input id={`rename-${l.id}`} maxLength={60} value={renaming.title} onChange={(e) => setRenaming({ id: l.id, title: e.target.value })} />
                  <div>
                    <button type="submit" className="btn small primary" disabled={renaming.title.trim().length < 2}>{L('שמירה', 'Save')}</button>
                    <button type="button" className="btn small" onClick={() => setRenaming(null)}>{L('ביטול', 'Cancel')}</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>}
    </>
  );
}
