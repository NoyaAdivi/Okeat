'use client';

import Link from 'next/link';
import { useL } from './LangProvider';
import Avatar from './Avatar';
import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

interface Props {
  sb: SupabaseClient;
  user: User | null;
  ready: boolean;
  onSignIn: () => void;
  onSignedOut: () => void;
}

export default function AccountButton({ sb, user, ready, onSignIn, onSignedOut }: Props) {
  const L = useL();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!ready) return <span className="account" aria-hidden="true" />;

  // Anonymous visitors (who added or confirmed without registering) still see "sign in".
  if (!user || user.is_anonymous) {
    return (
      <button type="button" className="account-in" onClick={onSignIn}>{L('התחברות', 'Sign in')}</button>
    );
  }

  const name = (user.user_metadata?.name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? '';
  const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <div className="account-wrap" ref={wrap}>
      <button type="button" className="account" aria-haspopup="menu" aria-expanded={open} aria-label={L(`החשבון של ${name}`, `${name}'s account`)} onClick={() => setOpen((o) => !o)}>
        <Avatar name={name || '?'} url={avatar} size={36} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="who">{name}</div>
          <Link href="/u/me" role="menuitem" className="menu-link" onClick={() => setOpen(false)}>
            <span aria-hidden="true">👤</span> {L('הפרופיל שלי', 'My profile')}
          </Link>
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
