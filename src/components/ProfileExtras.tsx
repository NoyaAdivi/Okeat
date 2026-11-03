'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createList, deleteList, fetchMyLists, fetchNotifications, markNotificationsSeen, type MyList, type MyNotification } from '@/lib/places';
import { needLabel, type Need } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';

/** On your own profile: what's new, and your lists. */
export default function ProfileExtras({ sb, userId, show }: { sb: SupabaseClient; userId: string; show: 'notes' | 'lists' }) {
  const L = useL();
  const [notes, setNotes] = useState<MyNotification[]>([]);
  const [lists, setLists] = useState<MyList[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications(sb).then((n) => { setNotes(n); if (n.some((x) => x.is_new)) markNotificationsSeen(sb); });
    fetchMyLists(sb, userId).then(setLists);
  }, [sb, userId]);

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
        {notes.length === 0 && <p className="muted">{L('אין כרגע. כשמידע שהוספת יאושר, או תעודה שהעלית תתקרב לסיום, נספר לך כאן.', "Nothing right now. When your information is confirmed, or a certificate you added is about to end, you'll see it here.")}</p>}
        <ul className="profile-places">
          {notes.map((n) => (
            <li key={`${n.kind}-${n.place_id}-${n.need}`} className={n.is_new ? 'note-new' : undefined}>
              <Link href={`/map?place=${n.place_id}`}>
                {n.kind === 'approved'
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
        <ul className="profile-places list-places">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/list/${l.id}`}><b>{l.title}</b> <small>{L(`${l.list_places[0]?.count ?? 0} מקומות`, `${l.list_places[0]?.count ?? 0} places`)}</small></Link>
              <button type="button" className="link" onClick={async () => { await deleteList(sb, l.id); setLists(lists.filter((x) => x.id !== l.id)); }}>{L('מחיקה', 'Delete')}</button>
            </li>
          ))}
        </ul>
      </section>}
    </>
  );
}
