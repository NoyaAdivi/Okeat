'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import Modal from './Modal';

const EVENT = 'okeat-edit-profile';
const LATER = 'okeat-profile-later';

/** Opens the same form from the profile page. */
export const openProfileForm = (food: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: food }));

/** Email accounts come without a name, so the first visit asks for one, and for a favorite food. */
export default function ProfileSetup() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const { user } = useUser(sb);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [food, setFood] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const metaName = (user?.user_metadata?.name ?? user?.user_metadata?.full_name ?? '') as string;

  useEffect(() => {
    if (!user || user.is_anonymous || metaName) return;
    let later = false;
    try { later = !!sessionStorage.getItem(LATER); } catch { /* private window */ }
    if (!later) setOpen(true);
  }, [user, metaName]);

  useEffect(() => {
    const edit = (e: Event) => {
      setName(metaName);
      setFood((e as CustomEvent<string>).detail ?? '');
      setOpen(true);
    };
    window.addEventListener(EVENT, edit);
    return () => window.removeEventListener(EVENT, edit);
  }, [metaName]);

  const later = () => {
    try { sessionStorage.setItem(LATER, '1'); } catch { /* private window */ }
    setOpen(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) {
      setError(L('כתבו שם של לפחות 2 תווים.', 'Please enter at least 2 characters.'));
      return;
    }
    setBusy(true);
    setError('');
    const { error: saveError } = await sb.from('profiles').update({ display_name: clean, favorite_food: food.trim() || null }).eq('id', user!.id);
    const { error: nameError } = saveError ? { error: null } : await sb.auth.updateUser({ data: { name: clean } });
    setBusy(false);
    if (saveError || nameError) setError(friendly(saveError ?? nameError, L.lang));
    else setOpen(false);
  };

  if (!open || !user) return null;
  return (
    <Modal title={L('נעים להכיר! 👋', 'Nice to meet you! 👋')} subtitle={L('השם והאוכל האהוב יופיעו בפרופיל שלך, וגם ליד ביקורות שתכתבו.', 'Your name and favorite food appear on your profile. Your name also appears on your reviews.')} onClose={later}>
      <form onSubmit={save} className="field" noValidate>
        <label htmlFor="setup-name">{L('שם משתמש', 'Username')}</label>
        <input id="setup-name" maxLength={40} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
        {error && <div className="err" role="alert">{error}</div>}
        <label htmlFor="setup-food">{L('מה האוכל האהוב עליך? (לא חובה)', "What's your favorite food? (optional)")}</label>
        <input id="setup-food" maxLength={60} value={food} onChange={(e) => setFood(e.target.value)} placeholder={L('למשל: פיצה, סושי, שקשוקה', 'For example: pizza, sushi, shakshuka')} />
        <div className="modal-acts">
          <button type="button" className="btn" onClick={later}>{L('אחר כך', 'Later')}</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? L('שומר…', 'Saving…') : L('שמירה', 'Save')}</button>
        </div>
      </form>
    </Modal>
  );
}
