'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendly } from '@/lib/errors';

const TOPICS = [
  { v: 'general', label: 'שאלה או הצעה', emoji: '💬' },
  { v: 'report', label: 'דיווח על מידע שגוי', emoji: '🚩' },
  { v: 'business', label: 'אני בעל/ת עסק', emoji: '🏪' },
  { v: 'accessibility', label: 'נגישות', emoji: '♿' },
  { v: 'privacy', label: 'פרטיות ומחיקת מידע', emoji: '🔒' },
] as const;

export default function ContactForm({ initialTopic = 'general' }: { initialTopic?: string }) {
  const sb = useMemo(() => createClient(), []);
  const [topic, setTopic] = useState(TOPICS.some((t) => t.v === initialTopic) ? initialTopic : 'general');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (message.trim().length < 5) return setError('כתבו כמה מילים, כדי שנבין במה מדובר.');
    setState('sending');
    const { data } = await sb.auth.getUser();
    const { error } = await sb.from('feedback').insert({
      topic,
      message: message.trim().slice(0, 3000),
      reply_to: replyTo.trim() || null,
      page: typeof document !== 'undefined' ? document.referrer.slice(0, 300) || null : null,
      user_id: data.user?.id ?? null,
    });
    if (error) {
      setState('idle');
      setError(error.message.includes('Too many') ? 'שלחתם כמה הודעות ברצף. נסו שוב בעוד שעה.' : friendly(error));
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <div className="sent-box" role="status">
        <span aria-hidden="true">💌</span>
        <h2>תודה! ההודעה נשלחה</h2>
        <p>{replyTo.trim() ? 'נחזור אליכם לכתובת שהשארתם.' : 'קראנו אותה, ואם צריך נטפל בה.'}</p>
        <button type="button" className="btn" onClick={() => { setMessage(''); setState('idle'); }}>שליחת הודעה נוספת</button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={send} noValidate>
      <fieldset className="topics">
        <legend>במה מדובר?</legend>
        {TOPICS.map((t) => (
          <label key={t.v} className={`topic${topic === t.v ? ' on' : ''}`}>
            <input type="radio" name="topic" value={t.v} checked={topic === t.v} onChange={() => setTopic(t.v)} />
            <span aria-hidden="true">{t.emoji}</span> {t.label}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="cf-msg">ההודעה</label>
        <textarea id="cf-msg" rows={6} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder={topic === 'report' ? 'איזה מקום, ומה לא נכון בו?' : topic === 'privacy' ? 'מה תרצו שנעשה עם המידע שלכם?' : 'כתבו לנו…'} />
      </div>
      <div className="field">
        <label htmlFor="cf-reply">איך לחזור אליכם (לא חובה)</label>
        <input id="cf-reply" type="text" dir="auto" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="מייל או טלפון" />
        <span className="hint">משמש רק כדי לענות לכם.</span>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button type="submit" className="btn primary" disabled={state === 'sending'}>
        {state === 'sending' ? 'שולח…' : 'שליחה'}
      </button>
    </form>
  );
}
