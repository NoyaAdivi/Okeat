'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { logVisit } from '@/lib/places';

const KEY = 'okeat-visit';

/** Counts a visit and how long it lasted, under a random number that says nothing about the person. */
export default function Analytics() {
  const sb = useMemo(() => createClient(), []);
  const { user } = useUser(sb);
  const path = usePathname();
  const sid = useRef('');
  const seconds = useRef(0);
  const pages = useRef(0);
  const signed = useRef(false);
  signed.current = !!user && !user.is_anonymous;

  useEffect(() => { pages.current += 1; }, [path]);

  useEffect(() => {
    try {
      sid.current = sessionStorage.getItem(KEY) ?? crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      sessionStorage.setItem(KEY, sid.current);
    } catch { return; } // no storage, no count
    const send = () => {
      if (!seconds.current && !pages.current) return;
      logVisit(sb, sid.current, seconds.current, pages.current, signed.current);
      seconds.current = 0;
      pages.current = 0;
    };
    const tick = setInterval(() => { if (!document.hidden) seconds.current += 5; }, 5000);
    const report = setInterval(send, 30000);
    const hidden = () => { if (document.hidden) send(); };
    document.addEventListener('visibilitychange', hidden);
    send();
    return () => { clearInterval(tick); clearInterval(report); document.removeEventListener('visibilitychange', hidden); };
  }, [sb]);

  return null;
}
