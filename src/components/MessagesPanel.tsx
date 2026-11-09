'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminDeleteItem, fetchAdminMessages, markMessage, type AdminEvent, type AdminMessage } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { formatDate } from '@/lib/geo';
import { useL } from './LangProvider';

const looksLikeEmail = (text: string | null) => !!text && /^\S+@\S+\.\S+$/.test(text.trim());

/** For the admin: messages from the contact form. A reply opens in her own email app. */
export default function MessagesPanel({ sb, onChange }: { sb: SupabaseClient; onChange: (open: number) => void }) {
  const L = useL();
  const lang = L.lang;
  const [messages, setMessages] = useState<AdminMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState<'open' | 'done' | 'all'>('open');
  const [sure, setSure] = useState<number | null>(null);
  const remove = async (m: AdminMessage) => {
    setBusy(true);
    try {
      await adminDeleteItem(sb, { kind: 'message', id: String(m.id), place_id: null, user_id: null } as AdminEvent);
      setMessages((list) => list?.filter((x) => x.id !== m.id) ?? null);
      setSure(null);
    } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  const load = async () => {
    setBusy(true);
    setError('');
    try { setMessages(await fetchAdminMessages(sb)); } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (messages) onChange(messages.filter((m) => !m.handled).length); }, [messages, onChange]);

  const toggle = async (m: AdminMessage) => {
    setBusy(true);
    try {
      await markMessage(sb, m.id, !m.handled);
      setMessages((list) => list?.map((x) => (x.id === m.id ? { ...x, handled: !m.handled } : x)) ?? null);
    } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  const topics: Record<string, string> = {
    general: L('כללי', 'General'), accessibility: L('נגישות', 'Accessibility'), privacy: L('פרטיות', 'Privacy'),
    report: L('דיווח', 'Report'), business: L('בית עסק', 'Business'), other: L('אחר', 'Other'),
  };
  const open = messages?.filter((m) => !m.handled).length ?? 0;

  return (
    <>
      <h2>{L('הודעות מהאתר', 'Messages')}{messages && ` (${open})`}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!messages && !error && <p className="muted">{L('טוען…', 'Loading…')}</p>}
      {messages?.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
      {messages && messages.length > 0 && (
        <div className="handled-filter" role="group" aria-label={L('סינון לפי טיפול', 'Filter by handled')}>
          <button type="button" className="open" aria-pressed={show === 'open'} onClick={() => setShow('open')}><span aria-hidden="true">●</span> {L('לא טופל', 'Open')} <b>{open}</b></button>
          <button type="button" className="done" aria-pressed={show === 'done'} onClick={() => setShow('done')}><span aria-hidden="true">✓</span> {L('טופל', 'Handled')} <b>{messages.length - open}</b></button>
          <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>{L('הכול', 'All')} <b>{messages.length}</b></button>
        </div>
      )}
      {messages && messages.length > 0 && show === 'open' && open === 0 && <p className="muted">{L('הכול טופל 🎉', 'Everything is handled 🎉')}</p>}
      {messages?.filter((m) => show === 'all' || m.handled === (show === 'done')).map((m) => {
        const email = looksLikeEmail(m.reply_to) ? m.reply_to!.trim() : m.account_email;
        const mail = email && `mailto:${email}?subject=${encodeURIComponent(L('תשובה מ-Okeat', 'A reply from Okeat'))}&body=${encodeURIComponent(`\n\n---\n${m.message}`)}`;
        return (
          <div key={m.id} className={`admin-row${m.handled ? ' handled' : ''}`}>
            <div>
              <b>{topics[m.topic] ?? m.topic}</b> <span className="muted small">{formatDate(m.created_at.slice(0, 10))}</span>
              <span className={`handled-tag ${m.handled ? 'done' : 'open'}`}>{m.handled ? L('✓ טופל', '✓ Handled') : L('● לא טופל', '● Open')}</span>
              <p className="message-text">{m.message}</p>
              <div className="muted small" dir="auto">
                {m.reply_to || m.account_email || L('לא השאירו דרך לחזור', 'No way to reply was left')}
              </div>
            </div>
            <div className="acts">
              {mail && <a className="btn small" href={mail}>{L('מענה במייל', 'Reply by email')}</a>}
              <button type="button" className="btn small ghost" disabled={busy} onClick={() => toggle(m)}>{m.handled ? L('↩︎ החזרה ללא טופל', '↩︎ Mark open') : L('✓ סימון כטופל', '✓ Mark handled')}</button>
              {sure === m.id
                ? <button type="button" className="btn small ghost danger" disabled={busy} onClick={() => remove(m)}>{L('למחוק?', 'Delete?')}</button>
                : <button type="button" className="chip-act danger" onClick={() => setSure(m.id)}><span aria-hidden="true">🗑️</span> {L('מחיקה', 'Delete')}</button>}
            </div>
          </div>
        );
      })}
    </>
  );
}
