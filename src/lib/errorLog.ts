import { createClient } from '@/lib/supabase/client';

let sent = 0;

/** Tells the site owner something broke: only the message and the page, never who it happened to. */
export function logClientError(message: string) {
  // Errors from the browser's own add-ons (Firefox on iPhone, extensions) are not the site's.
  if (sent >= 5 || !message || /ResizeObserver|Script error|AbortError|__firefox__|__gCrWeb|webkit\.messageHandlers|chrome-extension|moz-extension|safari-extension/.test(message)) return;
  sent += 1;
  createClient().rpc('log_client_error', { p_message: message, p_path: location.pathname }).then(() => undefined, () => undefined);
}

/**
 * After a new version goes live (or on a weak connection), the page may fail to load one of its code files.
 * Reload once to get the current version instead of leaving the page broken. Returns true if it reloaded.
 */
export function reloadIfStaleVersion(message: string) {
  if (!/Loading chunk|ChunkLoadError|Loading CSS chunk/i.test(message)) return false;
  try {
    if (sessionStorage.getItem('okeat-reloaded')) return false;
    sessionStorage.setItem('okeat-reloaded', '1');
  } catch { return false; }
  window.location.reload();
  return true;
}
