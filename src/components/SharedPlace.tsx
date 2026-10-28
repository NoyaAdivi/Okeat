'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { certificateUrl, fetchMyVotes, fetchPlace, vote } from '@/lib/places';
import type { Place } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { useUser } from '@/lib/useUser';
import { googleMapsUrl, wazeUrl } from '@/lib/geo';
import PlaceDetail from './PlaceDetail';
import Logo from './Logo';
import AccountButton from './AccountButton';
import AuthDialog from './AuthDialog';
import CertificateDialog from './CertificateDialog';

/** The standalone page behind a shared link: same place card, plus a way into the map. */
export default function SharedPlace({ place: initial }: { place: Place }) {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user, ready } = useUser(sb);
  const [place, setPlace] = useState(initial);
  const [voted, setVoted] = useState<Map<string, 1 | -1>>(new Map());
  const [auth, setAuth] = useState<{ reason?: string } | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((m: string) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3600);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMyVotes(sb, place.claims.map((c) => c.id)).then(setVoted).catch(() => {});
  }, [sb, user, place]);

  const reload = async () => {
    const fresh = await fetchPlace(sb, place.id).catch(() => null);
    if (fresh) setPlace(fresh);
  };

  const onVote = async (claimId: string, value: 1 | -1) => {
        try {
      await vote(sb, claimId, value);
      setVoted((m) => new Map(m).set(claimId, value));
      showToast(value === 1 ? 'תודה, האישור נרשם' : 'תודה. הדיווח נשלח לבדיקה של הקהילה');
      reload();
    } catch (e) {
      showToast(friendly(e));
    }
  };

  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head">
          <Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link>
          <AccountButton sb={sb} user={user} ready={ready} onSignIn={() => setAuth({})} onSignedOut={() => showToast('התנתקת')} />
        </div>
        <PlaceDetail
          place={place}
          goPanel={
            <div className="nav">
              <a className="btn primary" href={`/map?place=${place.id}`}>ניווט מהמפה</a>
              <div className="nav-ext">
                <a href={wazeUrl(place)} target="_blank" rel="noopener noreferrer">Waze</a>
                <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Google Maps</a>
              </div>
            </div>
          }
          voted={voted}
          certificateUrl={(p) => certificateUrl(sb, p)}
          onBack={() => router.push(`/map?place=${place.id}`)}
          backLabel="פתיחה במפה"
          onVote={onVote}
          onAddCertificate={() => setCertOpen(true)}
          onShare={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              showToast('הקישור הועתק');
            } catch {
              showToast(window.location.href);
            }
          }}
        />
      </div>

      {auth && <AuthDialog sb={sb} reason={auth.reason} onClose={() => setAuth(null)} />}
      {certOpen && (
        <CertificateDialog
          sb={sb}
          place={place}
          onClose={() => setCertOpen(false)}
          onDone={() => {
            setCertOpen(false);
            showToast('התעודה נשלחה לאישור הקהילה');
            reload();
          }}
        />
      )}
      <div className={`toast${toast ? ' show' : ''}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
