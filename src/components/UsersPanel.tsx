'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteUser, fetchAdminUsers, setUserRole, type AdminUser, type PublicProfile } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';

/** For the admin: everyone who signed up, with their role. Emails are shown only here. */
export default function UsersPanel({ sb, meId }: { sb: SupabaseClient; meId: string }) {
  const L = useL();
  const lang = L.lang;
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    setError('');
    try { setUsers(await fetchAdminUsers(sb)); } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  const changeRole = async (user: AdminUser, role: PublicProfile['role']) => {
    setBusy(true);
    setError('');
    try {
      await setUserRole(sb, user.id, role);
      setUsers((list) => list?.map((u) => (u.id === user.id ? { ...u, role } : u)) ?? null);
    } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  const remove = async (user: AdminUser) => {
    setBusy(true);
    setError('');
    try {
      await deleteUser(sb, user.id);
      setUsers((list) => list?.filter((u) => u.id !== user.id) ?? null);
    } catch (e) { setError(friendly(e, lang)); }
    setDeleting(null);
    setBusy(false);
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <>
      <h2>{L('משתמשים רשומים', 'Registered users')}{users && ` (${users.length})`}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!users && <button type="button" className="btn small" disabled={busy} onClick={load}>{busy ? L('טוען…', 'Loading…') : L('הצגת המשתמשים', 'Show users')}</button>}
      {users && (
        <div className="mini-form">
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L('חיפוש לפי שם או מייל', 'Search by name or email')} aria-label={L('חיפוש משתמשים', 'Search users')} />
        </div>
      )}
      {shown.map((u) => (
        <div key={u.id} className="admin-row">
          <div>
            <Link href={`/u/${u.id}`}><b>{u.name ?? L('בלי שם', 'No name')}</b></Link>
            <div className="muted small" dir="ltr">{u.email}</div>
            <div className="muted small">{L('הצטרפות', 'Joined')}: {formatDate(u.joined.slice(0, 10))}</div>
          </div>
          <div className="acts">
            {u.id === meId ? <span className="muted small">{L('זו את', "That's you")}</span> : (
              <select value={u.role} disabled={busy} aria-label={L(`תפקיד של ${u.name ?? u.email}`, `Role of ${u.name ?? u.email}`)} onChange={(e) => changeRole(u, e.target.value as PublicProfile['role'])}>
                <option value="user">{L('משתמש/ת רגיל/ה', 'Regular user')}</option>
                <option value="trusted">{L('מאשר/ת קהילה', 'Community moderator')}</option>
                <option value="admin">{L('מנהל/ת', 'Admin')}</option>
              </select>
            )}
            {u.id !== meId && u.role !== 'admin' && (deleting === u.id ? (
              <>
                <button type="button" className="btn small ghost danger" disabled={busy} onClick={() => remove(u)}>{L('כן, למחוק סופית', 'Yes, delete for good')}</button>
                <button type="button" className="btn small" disabled={busy} onClick={() => setDeleting(null)}>{L('ביטול', 'Cancel')}</button>
              </>
            ) : (
              <button type="button" className="btn small ghost danger" disabled={busy} onClick={() => setDeleting(u.id)}>{L('מחיקה', 'Delete')}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
