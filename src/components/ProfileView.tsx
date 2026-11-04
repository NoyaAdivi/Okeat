'use client';

import Link from 'next/link';
import PlaceTile from './PlaceTile';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { fetchMyFavorites, fetchPlacesAddedBy, fetchProfile, setFavorite, setUserRole, withdrawPlace, type PublicProfile } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { placeTypeLabel } from '@/lib/types';
import { placeEmoji } from '@/lib/emoji';
import { formatDate } from '@/lib/geo';
import { SiteFooter, SiteHeader } from './SiteChrome';
import { useL } from './LangProvider';
import { openProfileForm } from './ProfileSetup';

/** A number that runs up once when the profile opens. */
function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || to === 0) { setShown(to); return; }
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 700);
      setShown(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{shown}</>;
}
import ProfileExtras from './ProfileExtras';
import MyActivity from './MyActivity';
import MyTimeline from './MyTimeline';
import AdminFeed from './AdminFeed';
import ScrollRow from './ScrollRow';
import { markAdminSeen } from '@/lib/adminSeen';
import EditMyPlace from './EditMyPlace';
import { earnedBadges } from '@/lib/checks';
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
  // Site admins see role buttons on other people's profiles.
  const [viewerAdmin, setViewerAdmin] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [editPlace, setEditPlace] = useState<string | null>(null);
  const [section, setSection] = useState<'feed' | 'site' | 'notes' | 'lists' | 'saved' | 'added' | 'info' | 'votes' | 'reviews'>('feed');
  // On someone else's profile the first thing shown is the places they added.
  const view = !mine && section === 'feed' ? 'added' : section;
  const [saved, setSaved] = useState<{ id: string; name: string; place_type: string }[]>([]);
  useEffect(() => { if (mine) fetchMyFavorites(sb).then(setSaved); }, [sb, mine]);
  useEffect(() => {
    if (!user || user.is_anonymous) { setViewerAdmin(false); return; }
    fetchProfile(sb, user.id).then((p) => setViewerAdmin(p?.role === 'admin')).catch(() => setViewerAdmin(false));
  }, [sb, user]);
  const changeRole = async (next: PublicProfile['role']) => {
    if (!profile) return;
    setRoleError('');
    try {
      await setUserRole(sb, profile.id, next);
      setProfile({ ...profile, role: next });
    } catch {
      setRoleError(L('השינוי לא נשמר. נסו שוב.', "The change wasn't saved. Please try again."));
    }
  };
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
              <span className="seal k profile-seal"><Avatar name={profile.display_name} url={profile.avatar_url} size={88} /></span>
              <div className="profile-who">
                <h1>{profile.display_name}</h1>
                {role && <span className="role-tag">🏅 {role}</span>}
                {earnedBadges(profile).length > 0 && (
                  <p className="earned-badges">
                    {earnedBadges(profile).map((b) => <span key={b} className="role-tag">{{
                      confirmer: L('✅ מאשר/ת פעיל/ה', '✅ Active confirmer'),
                      explorer: L('🧭 מגלה מקומות', '🧭 Place finder'),
                      informer: L('💡 מוסיף/ה מידע', '💡 Info helper'),
                      critic: L('⭐ מבקר/ת', '⭐ Reviewer'),
                    }[b]}</span>)}
                  </p>
                )}
                {profile.favorite_food && <p className="fav-food">🍽️ {L('האוכל האהוב:', 'Favorite food:')} <b>{profile.favorite_food}</b></p>}
                {mine && <button type="button" className="link" onClick={() => openProfileForm(profile.favorite_food ?? '')}>{L('עריכת הפרטים', 'Edit details')}</button>}
                <p className="muted">{L('הצטרף/ה ל-Okeat ב-', 'Joined Okeat on ')}{formatDate(profile.joined_at.slice(0, 10))}</p>
              </div>
            </section>
            <ul className="profile-numbers">
              {([
                ['added', 'k', profile.places_added, L('מקומות', 'places')],
                ['info', 'v', profile.info_added, L('מידע', 'info')],
                ['votes', 'h', profile.confirmations, L('אישורים', 'confirmations')],
                ['reviews', 'g', profile.reviews, L('ביקורות', 'reviews')],
              ] as const).map(([value, cls, count, label]) => (
                <li key={value} className={cls}>
                  <button type="button" aria-pressed={view === value} onClick={() => setSection(value)}>
                    <b><CountUp to={count} /></b><span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
            {viewerAdmin && !mine && (
              <section className="role-admin" aria-label={L('הרשאות המשתמש', 'User permissions')}>
                <h2>{L('הרשאות', 'Permissions')}</h2>
                <div className="role-buttons">
                  {([['user', L('משתמש/ת רגיל/ה', 'Regular user')], ['trusted', L('מאשר/ת קהילה', 'Community moderator')], ['admin', L('מנהל/ת', 'Admin')]] as const).map(([value, label]) => (
                    <button key={value} type="button" className="btn" aria-pressed={profile.role === value} onClick={() => changeRole(value)}>{label}</button>
                  ))}
                </div>
                <p className="muted">{L('מאשר/ת קהילה מטפל/ת בדיווחים. מנהל/ת יכול/ה גם למנות אחרים, ומה שמוסיף/ה מאושר מיד.', 'Moderators handle reports. Admins can also appoint others, and what they add is confirmed right away.')}</p>
                {roleError && <div className="err" role="alert">{roleError}</div>}
              </section>
            )}
            {mine && profile.role !== 'user' && (
              <p className="center"><Link className="btn" href="/admin">{L('לדיווחים ולבקשות', 'Reports and requests')}</Link></p>
            )}
            {mine && user && (
              <ScrollRow className="profile-tabs" role="tablist" aria-label={L('החלקים בפרופיל', 'Profile sections')}>
                {([['feed', '✨', L('הפעילות שלי', 'My activity')], ...(profile.role !== 'user' ? [['site', '🛡️', L('מה חדש באתר', 'New on the site')] as const] : []), ['notes', '🔔', L('התראות', 'Notifications')], ['lists', '📋', L('רשימות', 'Lists')], ['saved', '❤️', L('שמורים', 'Saved')], ['added', '📍', L('הוספתי', 'Added')]] as const).map(([value, emoji, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={section === value} onClick={() => { setSection(value); if (value === 'site') markAdminSeen(); }}><span aria-hidden="true">{emoji}</span> {label}</button>
                ))}
              </ScrollRow>
            )}
            <div key={section} className="profile-section">
            {mine && section === 'feed' && <MyTimeline sb={sb} onManage={setSection} />}
            {mine && section === 'site' && <AdminFeed sb={sb} />}
            {mine && user && section === 'notes' && <ProfileExtras sb={sb} userId={user.id} show="notes" />}
            {mine && user && section === 'lists' && (
              <>
                {saved.length > 0 && (
                  <button type="button" className="saved-link" onClick={() => setSection('saved')}>
                    <span aria-hidden="true">❤️</span> {saved.length === 1 ? L('מקום אחד ששמרת', 'One saved place') : L(`${saved.length} מקומות ששמרת`, `${saved.length} saved places`)}
                  </button>
                )}
                <ProfileExtras sb={sb} userId={user.id} show="lists" />
              </>
            )}
            {(view === 'info' || view === 'votes' || view === 'reviews') && (
              <MyActivity sb={sb} userId={mine ? user!.id : undefined} publicId={mine ? undefined : profile.id} show={view} onChanged={() => { if (target) fetchProfile(sb, target).then(setProfile); }} />
            )}
            {section === 'saved' && mine && (
              <section className="sec">
                <h2>{L('מקומות ששמרתי', 'Saved places')}</h2>
                {saved.length === 0 ? <p className="muted">{L('עוד אין. לחצו על הלב במקום שאהבתם.', 'None yet. Press the heart on a place you like.')}</p> : (
                  <ul className="tiles">
                    {saved.map((p, i) => (
                      <PlaceTile key={p.id} index={i} href={`/map?place=${p.id}`} emoji={placeEmoji(p.place_type)} name={p.name} action={
                        <button type="button" className="link" onClick={async () => {
                          await setFavorite(sb, p.id, user!.id, false);
                          setSaved(saved.filter((x) => x.id !== p.id));
                        }}>{L('הסרה', 'Remove')}</button>
                      } />
                    ))}
                  </ul>
                )}
              </section>
            )}
            {view === 'added' && (
            <section className="sec">
              <h2>{L('מקומות שהוסיף/ה', 'Places added')}</h2>
              {roleError && mine && <div className="err" role="alert">{roleError}</div>}
              {editPlace && (
                <EditMyPlace sb={sb} id={editPlace} onClose={() => setEditPlace(null)} onSaved={(name) => {
                  setPlaces(places.map((x) => (x.id === editPlace ? { ...x, name } : x)));
                  setEditPlace(null);
                }} />
              )}
              {places.length === 0 ? <p className="muted">{L('עוד אין.', 'None yet.')}</p> : (
                <ul className="tiles">
                  {places.map((p, i) => (
                    <PlaceTile key={p.id} index={i} href={`/map?place=${p.id}`} emoji={placeEmoji(p.place_type)} name={p.name} sub={`${placeTypeLabel(p.place_type, lang)}, ${formatDate(p.created_at.slice(0, 10))}`} action={mine ? (
                      <span className="my-acts">
                      <button type="button" className="link" onClick={() => setEditPlace(p.id)}>{L('עריכה', 'Edit')}</button>
                      <button type="button" className="link" onClick={async () => {
                        setRoleError('');
                        try {
                          await withdrawPlace(sb, p.id);
                          setPlaces(places.filter((x) => x.id !== p.id));
                          if (target) fetchProfile(sb, target).then(setProfile);
                        } catch (e) { setRoleError(friendly(e, lang)); }
                      }}>{L('מחיקה', 'Delete')}</button>
                      </span>
                    ) : undefined} />
                  ))}
                </ul>
              )}
            </section>
            )}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
