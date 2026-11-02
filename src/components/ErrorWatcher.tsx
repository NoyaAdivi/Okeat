'use client';

import { useEffect } from 'react';
import { logClientError } from '@/lib/errorLog';

/** Notices errors in the browser, so problems are known before someone has to report them. */
export default function ErrorWatcher() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => logClientError(e.message);
    const onRejection = (e: PromiseRejectionEvent) => logClientError(String(e.reason?.message ?? e.reason ?? ''));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
