'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Finishes the sign-in by itself for a person, so there is nothing to press.
 * Automated link checkers stay on the page, which keeps the one-time link unused.
 */
export default function AutoEnter({ children }: { children: ReactNode }) {
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (navigator.webdriver || document.visibilityState !== 'visible') return;
    const t = setTimeout(() => form.current?.requestSubmit(), 200);
    return () => clearTimeout(t);
  }, []);

  return <form ref={form} method="post" action="/auth/confirm">{children}</form>;
}
