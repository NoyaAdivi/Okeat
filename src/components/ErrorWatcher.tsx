'use client';

import { useEffect } from 'react';
import { logClientError } from '@/lib/errorLog';

/** Notices errors in the browser, so problems are known before someone has to report them. */
export default function ErrorWatcher() {
  useEffect(() => {
    // After a new version goes live, an open page may ask for files that no longer exist.
    // Reload once to get the new version, instead of leaving the page broken.
    const staleVersion = (msg: string) => {
      if (!/Loading chunk|ChunkLoadError|Loading CSS chunk/i.test(msg)) return false;
      try {
        if (sessionStorage.getItem('okeat-reloaded')) return false;
        sessionStorage.setItem('okeat-reloaded', '1');
      } catch { return false; }
      window.location.reload();
      return true;
    };
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
