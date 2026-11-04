const KEY = 'okeat-admin-seen';

/** When this admin last opened the site's activity. The first time counts the last day. */
export function adminSeen(): string {
  try { return localStorage.getItem(KEY) ?? new Date(Date.now() - 86400000).toISOString(); } catch { return new Date().toISOString(); }
}

export function markAdminSeen() {
  try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* private window */ }
}
