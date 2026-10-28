'use client';

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
      <button type="button" className="account-in" onClick={onSignIn}>התחברות</button>
    );
  }

  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="account-wrap" ref={wrap}>
      <button type="button" className="account" aria-haspopup="menu" aria-expanded={open} aria-label={`החשבון של ${name}`} onClick={() => setOpen((o) => !o)}>
        {initial}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="who">{name}</div>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await sb.auth.signOut();
              setOpen(false);
              onSignedOut();
            }}
          >
            התנתקות
          </button>
        </div>
      )}
    </div>
  );
}
