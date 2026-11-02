'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { fetchPlacesAddedBy, fetchProfile, type PublicProfile } from '@/lib/places';
import { placeTypeLabel } from '@/lib/types';
import { placeEmoji } from '@/lib/emoji';
import { formatDate } from '@/lib/geo';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';
import Avatar from './Avatar';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A public profile: name, picture, when they joined, what they added and confirmed. Never the e-mail. */
export default function ProfileView({ id }: { id: string }) {
  const L = useL();
  const lang = L.lang;
  const sb = useMemo(() => createClient(), []);
  const { user, ready } = useUser(sb);
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [places, setPlaces] = useState<{ id: string; name: string; place_type: string; created_at: string }[]>([]);

  // "/u/me" opens your own profile
  const target = id === 'me' ? (user && !user.is_anonymous ? user.id : null) : id;

  useEffect(() => {
    if (id === 'me' && !ready) return;
    if (!target || !UUID.test(target)) { setProfile(null); return; }
    fetchProfile(sb, target).then(setProfile).catch(() => setProfile(null));
    fetchPlacesAddedBy(sb, target).then(setPlaces).catch(() => setPlaces([]));
  }, [sb, target, id, ready]);

  const mine = !!user && profile?.id === user.id;
  const role = profile?.role === 'admin' ? L('מנהל/ת', 'Admin') : profile?.role === 'trusted' ? L('מאשר/ת קהילה', 'Community moderator') : null;

  return (
    <div className="page">
      <SiteHeader />
      <main id="main" data-read-root className="profile-page">
        {profile === undefined && <div className="skeleton" />}
        {profile === null && (
          <div className="empty">
            <p>{id === 'me' ? L('כדי לראות את הפרופיל שלך צריך להתחבר עם חשבון.', 'Sign in with an account to see your profile.') : L('לא מצאנו את הפרופיל הזה.', "We couldn't find this profile.")}</p>
            <Link className="btn primary" href="/map">{L('למפה', 'To the map')}</Link>
          </div>
        )}
        {profile && (
          <>
            <section className="profile-card">
              <Avatar name={profile.display_name} url={profile.avatar_url} size={88} />
              <div>
                <h1>{profile.display_name}{mine && <small className="me-tag">{L(' (זה את/ה)', ' (you)')}</small>}</h1>
                {role && <span className="role-tag">🏅 {role}</span>}
                <p className="muted">{L('הצטרף/ה ל-Okeat ב-', 'Joined Okeat on ')}{formatDate(profile.joined_at.slice(0, 10))}</p>
              </div>
            </section>
            <ul className="profile-stats">
              <li><b>{profile.places_added}</b><span>{L('מקומות שהוסיף/ה', 'places added')}</span></li>
              <li><b>{profile.info_added}</b><span>{L('פרטי מידע שהוסיף/ה', 'pieces of info added')}</span></li>
              <li><b>{profile.confirmations}</b><span>{L('אישורים בקהילה', 'confirmations')}</span></li>
            </ul>
            {mine && profile.role === 'user' && (
              <p className="hint center">{L('אחרי שתוסיפו יותר מ-5 מקומות או תאשרו יותר מ-10 דברים, תהפכו למאשרי קהילה ותוכלו לתקן סיווגים ולטפל בדיווחים.', 'Add more than 5 places or confirm more than 10 things, and you become a community moderator who can fix guesses and handle reports.')}</p>
            )}
            {mine && profile.role !== 'user' && (
              <p className="center"><Link className="btn" href="/admin">{L('לדיווחים ולבקשות', 'Reports and requests')}</Link></p>
            )}
            <section className="sec">
              <h2>{L('מקומות שהוסיף/ה', 'Places added')}</h2>
              {places.length === 0 ? <p className="muted">{L('עוד אין.', 'None yet.')}</p> : (
                <ul className="profile-places">
                  {places.map((p) => (
                    <li key={p.id}>
                      <Link href={`/map?place=${p.id}`}>
                        <span aria-hidden="true">{placeEmoji(p.place_type)}</span> <b>{p.name}</b>
                        <small> · {placeTypeLabel(p.place_type, lang)} · {formatDate(p.created_at.slice(0, 10))}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
