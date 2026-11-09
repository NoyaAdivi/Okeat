'use client';

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminGetPlace, moderatePlace, type AdminPlace } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { googleUrl } from '@/lib/text';
import { useL } from './LangProvider';
import AdminPlaceDialog from './AdminPlaceDialog';

interface Props {
  sb: SupabaseClient;
  id: string;
  name: string;
  address?: string | null;
  /** something changed: reload the list */
  onChanged?: () => void;
  onError?: (text: string) => void;
}

/** The admin's tools for one place, wherever it shows up: look it up on Google, edit it, hide it. */
export default function AdminPlaceTools({ sb, id, name, address, onChanged, onError }: Props) {
  const L = useL();
  const [editing, setEditing] = useState<AdminPlace | null>(null);
  const [sure, setSure] = useState(false);
  const fail = (e: unknown) => onError?.(friendly(e, L.lang));

  return (
    <>
      <a className="chip-act" href={googleUrl(name, address)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span> {L('גוגל', 'Google')}</a>
      <button type="button" className="chip-act" onClick={() => adminGetPlace(sb, id).then(setEditing).catch(fail)}><span aria-hidden="true">✏️</span> {L('עריכה', 'Edit')}</button>
      {sure
        ? <button type="button" className="btn small ghost danger" onClick={() => moderatePlace(sb, id, true).then(() => { setSure(false); onChanged?.(); }).catch(fail)}>{L('להסתיר מהמפה?', 'Hide from the map?')}</button>
        : <button type="button" className="chip-act danger" onClick={() => setSure(true)}><span aria-hidden="true">🙈</span> {L('הסתרה', 'Hide')}</button>}
      {editing && <AdminPlaceDialog sb={sb} place={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged?.(); }} />}
    </>
  );
}
