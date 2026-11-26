'use client';

import { useEffect } from 'react';
import { logClientError, reloadIfStaleVersion as staleVersion } from '@/lib/errorLog';

/** Notices errors in the browser, so problems are known before someone has to report them. */
export default function ErrorWatcher() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => { if (!staleVersion(e.message)) logClientError(e.message); };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = String(e.reason?.message ?? e.reason ?? '');
      if (!staleVersion(msg)) logClientError(msg);
    };
    try { setTimeout(() => sessionStorage.removeItem('okeat-reloaded'), 10000); } catch { /* ignore */ }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
