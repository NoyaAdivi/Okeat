'use client';

import Link from 'next/link';
import { useL } from './LangProvider';
import Avatar from './Avatar';
import { adminNews, fetchNotifications, fetchProfile, markNotificationsSeen, type AdminNews, type MyNotification } from '@/lib/places';
import { adminSeen, markAdminSeen } from '@/lib/adminSeen';
import { needLabel, type Need } from '@/lib/types';
import { ago } from '@/lib/geo';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

interface Props {
  sb: SupabaseClient;
  user: User | null;
  ready: boolean;
  onSignIn: () => void;
  onSignedOut: () => void;
}

/** Lets the account button and the profile show a new name or picture at once, without a reload. */
export const PROFILE_SAVED = 'okeat-profile-saved';
export const announceProfile = (p: { name?: string; avatar?: string | null; food?: string | null }) =>
  window.dispatchEvent(new CustomEvent(PROFILE_SAVED, { detail: p }));

export default function AccountButton({ sb, user, ready, onSignIn, onSignedOut }: Props) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const [notes, setNotes] = useState<MyNotification[]>([]);
  const [site, setSite] = useState<AdminNews | null>(null);
  const [me, setMe] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });
  const real = !!user && !user.is_anonymous;

  useEffect(() => {
    if (!real || !user) { setNotes([]); setSite(null); return; }
    fetchNotifications(sb).then(setNotes);
    // For moderators: what people added since they last looked, by kind.
    adminNews(sb, adminSeen()).then(setSite);
    fetchProfile(sb, user.id).then((p) => p && setMe({ name: p.display_name === 'משתמש/ת Okeat' ? null : p.display_name, avatar: p.avatar_url })).catch(() => undefined);
  }, [sb, user, real]);

  useEffect(() => {
    const saved = (e: Event) => {
      const d = (e as CustomEvent<{ name?: string; avatar?: string | null }>).detail;
      setMe((m) => ({ name: d.name ?? m.name, avatar: d.avatar !== undefined ? d.avatar : m.avatar }));
    };
    window.addEventListener(PROFILE_SAVED, saved);
    return () => window.removeEventListener(PROFILE_SAVED, saved);
  }, []);

  const fresh = notes.filter((n) => n.is_new).length + (site?.total ?? 0);
  const markAll = () => {
    markNotificationsSeen(sb);
    markAdminSeen();
    setNotes((list) => list.map((n) => ({ ...n, is_new: false })));
    setSite(null);
  };

  if (!ready) return <span className="account" aria-hidden="true" />;

  // Anonymous visitors (who added or confirmed without registering) still see "sign in".
  if (!user || user.is_anonymous) {
    return (
      <button type="button" className="account-in" onClick={onSignIn}>{L('התחברות', 'Sign in')}</button>
    );
  }

  // Email accounts have no name, so the person sees their own address. Only they see it.
  const name = me.name ?? (user.user_metadata?.name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
  const avatar = me.avatar ?? (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const noteText = (n: MyNotification) => {
    const need = needLabel(n.need as Need, L.lang);
    if (n.kind === 'confirmed') return L(`מישהו אישר את מה שהוספת: ${need} ב${n.place_name}`, `Someone confirmed what you added: ${need} at ${n.place_name}`);
    if (n.kind === 'approved') return L(`המידע שהוספת אושר: ${need} ב${n.place_name}`, `What you added was approved: ${need} at ${n.place_name}`);
    return L(`תעודת הכשרות של ${n.place_name} מסתיימת בקרוב`, `The kosher certificate of ${n.place_name} ends soon`);
  };
  const NOTE_ICON: Record<MyNotification['kind'], string> = { confirmed: '👍', approved: '✅', expiring: '📜' };
  const siteNames: Record<keyof Omit<AdminNews, 'total'>, [string, string, string]> = {
    place: ['📍', 'מקומות חדשים', 'new places'],
    claim: ['📝', 'פרטים חדשים', 'new details'],
    review: ['⭐', 'ביקורות', 'reviews'],
    photo: ['📷', 'תמונות', 'photos'],
    report: ['🚩', 'דיווחים', 'reports'],
    suggestion: ['🏷️', 'הצעות סיווג', 'type suggestions'],
  };
  const shownNotes = notes.slice(0, 6);

  return (
    <div className="account-wrap" ref={wrap}>
      <button type="button" className="account" aria-haspopup="menu" aria-expanded={open} aria-label={L(`החשבון של ${name}${fresh ? `, ${fresh} התראות חדשות` : ''}`, `${name}'s account${fresh ? `, ${fresh} new notifications` : ''}`)} onClick={() => setOpen((o) => !o)}>
        <span className="seal k account-seal"><Avatar name={name || 'O'} url={avatar} size={28} /></span>
        {fresh > 0 && <span className="account-dot" aria-hidden="true">{fresh > 99 ? '99+' : fresh}</span>}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="who">{name}</div>
          <Link href="/u/me" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
            <span aria-hidden="true">👤</span> {L('הפרופיל שלי', 'My profile')}
          </Link>

          <div className="menu-notes" aria-label={L('התראות', 'Notifications')}>
            <div className="menu-notes-head">
              <b>🔔 {L('התראות', 'Notifications')}</b>
              {fresh > 0 && <button type="button" className="menu-mark" onClick={markAll}>{L('סימון הכול כנקרא', 'Mark all as read')}</button>}
            </div>
            {shownNotes.length === 0 && !site && <p className="menu-empty">{L('אין התראות חדשות. כשמישהו יאשר מה שהוספת, זה יופיע כאן.', 'No new notifications. When someone confirms what you added, it shows up here.')}</p>}
            {shownNotes.map((n) => (
              <Link key={`${n.kind}-${n.place_id}-${n.need}`} href={`/map?place=${n.place_id}`} role="menuitem" className={`menu-note${n.is_new ? ' new' : ''}`} onClick={() => setOpen(false)}>
                <span aria-hidden="true">{NOTE_ICON[n.kind]}</span>
                <span>{noteText(n)}<small>{ago(n.happened_at, L.lang)}</small></span>
              </Link>
            ))}
            {site && site.total > 0 && (
              <Link href="/admin" role="menuitem" className="menu-note new site" onClick={() => setOpen(false)}>
                <span aria-hidden="true">🛡️</span>
                <span>
                  {L('חדש באתר מאז הביקור האחרון:', 'New on the site since your last visit:')}
                  <small>{(Object.keys(siteNames) as (keyof typeof siteNames)[]).filter((k) => site[k] > 0).map((k) => `${siteNames[k][0]} ${site[k]} ${L(siteNames[k][1], siteNames[k][2])}`).join(' · ')}</small>
                </span>
              </Link>
            )}
            {notes.length > shownNotes.length && (
              <Link href="/u/me" className="menu-more" onClick={() => setOpen(false)}>{L(`לכל ${notes.length} ההתראות`, `All ${notes.length} notifications`)}</Link>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await sb.auth.signOut();
              setOpen(false);
              onSignedOut();
            }}
          >
            {L('התנתקות', 'Sign out')}
          </button>
        </div>
      )}
    </div>
  );
}
