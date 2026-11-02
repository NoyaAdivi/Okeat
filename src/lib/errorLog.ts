import { createClient } from '@/lib/supabase/client';

let sent = 0;

/** Tells the site owner something broke: only the message and the page, never who it happened to. */
export function logClientError(message: string) {
  if (sent >= 5 || !message || /ResizeObserver|Script error|AbortError/.test(message)) return;
  sent += 1;
  createClient().rpc('log_client_error', { p_message: message, p_path: location.pathname }).then(() => undefined, () => undefined);
}
