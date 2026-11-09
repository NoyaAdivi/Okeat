'use client';

import { googleUrl } from '@/lib/text';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dismissPair, fetchDuplicatePairs, mergePair, type DuplicatePair } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';

const pairKey = (p: DuplicatePair) => `${p.a_id}-${p.b_id}`;

/** For the admin: places that appear twice. Nothing is merged until she says so. */
export default function DuplicatesPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const lang = L.lang;
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  const find = async () => {
    setBusy(true);
    setError('');
    try { setPairs(await fetchDuplicatePairs(sb)); } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  useEffect(() => { find(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = async (pair: DuplicatePair, fn: (s: SupabaseClient, p: DuplicatePair) => Promise<void>) => {
    setBusy(true);
    try {
      await fn(sb, pair);
      setPairs((list) => list?.filter((p) => pairKey(p) !== pairKey(pair)) ?? null);
    } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  const mergeAll = async () => {
    setSure(false);
    setBusy(true);
    setDone(0);
    try {
      for (const pair of pairs ?? []) {
        await mergePair(sb, pair);
        setDone((n) => n + 1);
      }
      setPairs(await fetchDuplicatePairs(sb));
    } catch (e) { setError(friendly(e, lang)); }
    setBusy(false);
  };

  return (
    <>
      <h2>{L('מקומות כפולים', 'Duplicate places')}{pairs && ` (${pairs.length})`}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!pairs && !error && <p className="muted">{L('מחפש כפילויות…', 'Looking for duplicates…')}</p>}
      {pairs?.length === 0 && <p className="muted">{L('אין כרגע.', 'Nothing right now.')}</p>}
      {pairs && pairs.length > 0 && (
        <>
          <p className="muted small">{L('המקום עם יותר מידע מהאנשים נשאר, והשני נסתר. אישורים, ביקורות ותמונות עוברים למקום שנשאר. אם יש שתי שפות, שני השמות נשמרים.', 'The place with more input from people stays and the other is hidden. Confirmations, reviews and photos move to the one that stays. If the names are in two languages, both are kept.')}</p>
          {sure ? (
            <div className="acts">
              <button type="button" className="btn small" disabled={busy} onClick={mergeAll}>{L(`כן, לאחד ${pairs.length} זוגות`, `Yes, merge ${pairs.length} pairs`)}</button>
              <button type="button" className="btn small ghost" onClick={() => setSure(false)}>{L('ביטול', 'Cancel')}</button>
            </div>
          ) : (
            <button type="button" className="btn small" disabled={busy} onClick={() => setSure(true)}>{busy && done ? L(`מאחד… ${done}`, `Merging… ${done}`) : L('איחוד כל הרשימה', 'Merge the whole list')}</button>
          )}
          {pairs.map((p) => (
            <div key={pairKey(p)} className="admin-row">
              <div>
                <Link href={`/map?place=${p.a_id}`}><b>{p.a_name}</b></Link> ↔ <Link href={`/map?place=${p.b_id}`}><b>{p.b_name}</b></Link>
                <div className="muted small">{[p.a_address, p.b_address].filter(Boolean).join(' | ')} · {L(`${p.meters} מטר זה מזה`, `${p.meters} m apart`)}</div>
              </div>
              <div className="acts">
                <button type="button" className="btn small" disabled={busy} onClick={() => handle(p, mergePair)}>{L('איחוד', 'Merge')}</button>
                <button type="button" className="btn small ghost" disabled={busy} onClick={() => handle(p, dismissPair)}>{L('לא אותו מקום', 'Not the same')}</button>
                <a className="chip-act" href={googleUrl(p.a_name, p.a_address)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span> {L('גוגל', 'Google')}</a>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
