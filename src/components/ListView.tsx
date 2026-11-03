'use client';

import Link from 'next/link';
import PlaceTile from './PlaceTile';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { fetchList, removeFromList, type ListDetails } from '@/lib/places';
import { placeEmoji } from '@/lib/emoji';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A list of places that anyone with the link can open. */
export default function ListView({ id }: { id: string }) {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const { user } = useUser(sb);
  const [list, setList] = useState<ListDetails | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!UUID.test(id)) { setList(null); return; }
    fetchList(sb, id).then(setList);
  }, [sb, id]);

  const share = async () => {
    await navigator.clipboard?.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mine = !!list && user?.id === list.ownerId;

  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="page-narrow">
        {list === undefined && <p className="muted">{L('טוען…', 'Loading…')}</p>}
        {list === null && <p>{L('לא מצאנו את הרשימה הזו.', "We couldn't find this list.")}</p>}
        {list && (
          <>
            <h1>{list.title}</h1>
            <p className="muted">{L('רשימה של ', 'A list by ')}<Link href={`/u/${list.ownerId}`}>{list.ownerName}</Link></p>
            <button type="button" className="btn small" onClick={share}>🔗 {copied ? L('הקישור הועתק', 'Link copied') : L('העתקת קישור לשיתוף', 'Copy link to share')}</button>
            {list.places.length === 0 && <p className="muted">{L('עוד אין כאן מקומות.', 'No places here yet.')}</p>}
            <ul className="tiles">
              {list.places.map((p) => (
                <PlaceTile key={p.id} href={`/map?place=${p.id}`} emoji={placeEmoji(p.placeType)} name={p.name} sub={p.address ?? undefined} action={mine ? (
                    <button type="button" className="link" onClick={async () => {
                      await removeFromList(sb, list.id, p.id);
                      setList({ ...list, places: list.places.filter((x) => x.id !== p.id) });
                    }}>{L('הסרה', 'Remove')}</button>
                  ) : undefined} />
              ))}
            </ul>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
