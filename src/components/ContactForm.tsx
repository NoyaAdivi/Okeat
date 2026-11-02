'use client';

import { useL } from './LangProvider';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendly } from '@/lib/errors';

const TOPICS = [
  { v: 'general', label: 'שאלה או הצעה', en: 'Question or idea', emoji: '💬' },
  { v: 'report', label: 'דיווח על מידע שגוי', en: 'Report wrong information', emoji: '🚩' },
  { v: 'business', label: 'אני בעל/ת עסק', en: 'I own a business', emoji: '🏪' },
  { v: 'accessibility', label: 'נגישות', en: 'Accessibility', emoji: '♿' },
  { v: 'privacy', label: 'פרטיות ומחיקת מידע', en: 'Privacy and deleting data', emoji: '🔒' },
] as const;

export default function ContactForm({ initialTopic = 'general' }: { initialTopic?: string }) {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const [topic, setTopic] = useState(TOPICS.some((t) => t.v === initialTopic) ? initialTopic : 'general');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (message.trim().length < 5) return setError(L('כתבו כמה מילים, כדי שנבין במה מדובר.', 'Write a few words so we understand what this is about.'));
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
      setError(error.message.includes('Too many') ? L('שלחתם כמה הודעות ברצף. נסו שוב בעוד שעה.', 'You sent several messages in a row. Try again in an hour.') : friendly(error, L.lang));
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <div className="sent-box" role="status">
        <span aria-hidden="true">💌</span>
        <h2>{L('תודה! ההודעה נשלחה', 'Thanks! Your message was sent')}</h2>
        <p>{replyTo.trim() ? L('נחזור אליכם לכתובת שהשארתם.', "We'll get back to you at the address you left.") : L('קראנו אותה, ואם צריך נטפל בה.', "We've read it and will take care of it if needed.")}</p>
        <button type="button" className="btn" onClick={() => { setMessage(''); setState('idle'); }}>{L('שליחת הודעה נוספת', 'Send another message')}</button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={send} noValidate>
      <fieldset className="topics">
        <legend>{L('במה מדובר?', 'What is it about?')}</legend>
        {TOPICS.map((t) => (
          <label key={t.v} className={`topic${topic === t.v ? ' on' : ''}`}>
            <input type="radio" name="topic" value={t.v} checked={topic === t.v} onChange={() => setTopic(t.v)} />
            <span aria-hidden="true">{t.emoji}</span> {L(t.label, t.en)}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="cf-msg">{L('ההודעה', 'Message')}</label>
        <textarea id="cf-msg" rows={6} maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder={topic === 'report' ? L('איזה מקום, ומה לא נכון בו?', "Which place, and what's wrong?") : topic === 'privacy' ? L('מה תרצו שנעשה עם המידע שלכם?', 'What would you like us to do with your data?') : L('כתבו לנו…', 'Write to us…')} />
      </div>
      <div className="field">
        <label htmlFor="cf-reply">{L('איך לחזור אליכם (לא חובה)', 'How to reply to you (optional)')}</label>
        <input id="cf-reply" type="text" dir="auto" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder={L('מייל או טלפון', 'Email or phone')} />
        <span className="hint">{L('משמש רק כדי לענות לכם.', 'Only used to reply to you.')}</span>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <button type="submit" className="btn primary" disabled={state === 'sending'}>
        {state === 'sending' ? L('שולח…', 'Sending…') : L('שליחה', 'Send')}
      </button>
    </form>
  );
}
