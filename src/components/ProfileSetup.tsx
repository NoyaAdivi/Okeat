'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';
import Modal from './Modal';
import Avatar from './Avatar';
import { announceProfile } from './AccountButton';
import { removeAvatar, uploadAvatar } from '@/lib/places';

const EVENT = 'okeat-edit-profile';

/** Opens the same form from the profile page. */
export const openProfileForm = (food: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: food }));

/** The first sign-in of an account asks for a name and a favorite food. It is remembered on the account, so no later sign-in asks again. */
export default function ProfileSetup() {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const { user } = useUser(sb);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [food, setFood] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const metaName = (user?.user_metadata?.name ?? user?.user_metadata?.full_name ?? '') as string;

  useEffect(() => {
    if (!user || user.is_anonymous) return;
    sb.from('profiles').select('setup_done').eq('id', user.id).maybeSingle().then(({ data, error: readError }) => {
      if (readError || !data || data.setup_done) return;
      setName(metaName);
      setOpen(true);
    });
  }, [sb, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !user) return;
    sb.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setAvatar(data.avatar_url ?? null);
      if (data.display_name) setName((n) => n || data.display_name);
    });
  }, [open, sb, user]);

  const pickPhoto = async (f: File) => {
    if (!user) return;
    setPhotoBusy(true);
    setError('');
    try {
      const url = await uploadAvatar(sb, user.id, f);
      setAvatar(url);
      announceProfile({ avatar: url });
    } catch (err) { setError(friendly(err, L.lang)); }
    setPhotoBusy(false);
  };

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
    setOpen(false);
    if (user) sb.from('profiles').update({ setup_done: true }).eq('id', user.id).then(() => undefined, () => undefined);
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
    const { error: saveError } = await sb.from('profiles').update({ display_name: clean, favorite_food: food.trim() || null, setup_done: true }).eq('id', user!.id);
    const { error: nameError } = saveError ? { error: null } : await sb.auth.updateUser({ data: { name: clean } });
    setBusy(false);
    if (saveError || nameError) setError(friendly(saveError ?? nameError, L.lang));
    else {
      // the header and the profile show the new name right away
      announceProfile({ name: clean, food: food.trim() || null });
      setOpen(false);
    }
  };

  if (!open || !user) return null;
  return (
    <Modal title={L('נעים להכיר! 👋', 'Nice to meet you! 👋')} subtitle={L('השם והאוכל האהוב יופיעו בפרופיל שלך, וגם ליד ביקורות שתכתבו.', 'Your name and favorite food appear on your profile. Your name also appears on your reviews.')} onClose={later}>
      <form onSubmit={save} className="field" noValidate>
        <div className="avatar-pick">
          <span className="seal k avatar-pick-seal"><Avatar name={name || 'O'} url={avatar} size={72} /></span>
          <div className="avatar-pick-acts">
            <button type="button" className="btn small" disabled={photoBusy} onClick={() => file.current?.click()}>
              📷 {photoBusy ? L('מעלה…', 'Uploading…') : avatar ? L('החלפת תמונה', 'Change photo') : L('הוספת תמונה', 'Add a photo')}
            </button>
            {avatar && (
              <button type="button" className="link" disabled={photoBusy} onClick={async () => {
                try { await removeAvatar(sb); setAvatar(null); announceProfile({ avatar: null }); } catch (err) { setError(friendly(err, L.lang)); }
              }}>{L('הסרת התמונה', 'Remove photo')}</button>
            )}
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickPhoto(f); }} />
        </div>
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
