'use client';

import { useL } from './LangProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { certificateUrl, fetchMyVotes, fetchPlace, fetchProfile, moderateClaim, vote } from '@/lib/places';
import type { Place } from '@/lib/types';
import { friendly } from '@/lib/errors';
import { useUser } from '@/lib/useUser';
import { googleMapsUrl, wazeUrl } from '@/lib/geo';
import PlaceDetail from './PlaceDetail';
import PlaceExtras from './PlaceExtras';
import PlaceCommunity from './PlaceCommunity';
import Logo from './Logo';
import Toast from './Toast';
import AccountButton from './AccountButton';
import DisplayToggles from './DisplayToggles';
import AuthDialog from './AuthDialog';
import CertificateDialog from './CertificateDialog';

/** The standalone page behind a shared link: same place card, plus a way into the map. */
export default function SharedPlace({ place: initial }: { place: Place }) {
  const L = useL();
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const { user, ready } = useUser(sb);
  const [place, setPlace] = useState(initial);
  const [isAdmin, setIsAdmin] = useState(false);
  const signedIn = !!user && !user.is_anonymous;
  const askSignIn = (reason?: string) => setAuth({ reason: reason ?? L('כדי להוסיף, לאשר או לתקן מידע צריך להתחבר. כך המידע באתר נשאר אמין.', 'To add, confirm or fix information, please sign in. It keeps the site reliable.') });
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
    if (!signedIn || !user) { setIsAdmin(false); return; }
    fetchProfile(sb, user.id).then((p) => setIsAdmin(p?.role === 'admin')).catch(() => setIsAdmin(false));
  }, [sb, user, signedIn]);

  useEffect(() => {
    if (!user) return;
    fetchMyVotes(sb, place.claims.map((c) => c.id)).then(setVoted).catch(() => {});
  }, [sb, user, place]);

  const reload = async () => {
    const fresh = await fetchPlace(sb, place.id).catch(() => null);
    if (fresh) setPlace(fresh);
  };

  const onVote = async (claimId: string, value: 1 | -1) => {
    if (!signedIn) { askSignIn(); return; }
    try {
      await vote(sb, claimId, value);
      setVoted((m) => new Map(m).set(claimId, value));
      showToast(value === 1 ? L('תודה, האישור נרשם', 'Thanks, your confirmation was saved') : L('תודה. הדיווח נשלח לבדיקה של הקהילה', 'Thanks. Your report was sent for the community to check'));
      reload();
    } catch (e) {
      showToast(friendly(e, L.lang));
    }
  };

  return (
    <div className="shared">
      <div className="shared-inner">
        <div className="shared-head">
          <Link href="/" className="brand-link"><Logo size={36} /><span>okeat</span></Link>
          <span className="shared-tools"><DisplayToggles compact /><AccountButton sb={sb} user={user} ready={ready} onSignIn={() => setAuth({})} onSignedOut={() => showToast(L('התנתקת', 'You signed out'))} /></span>
        </div>
        <PlaceDetail
          place={place}
          signedIn={signedIn}
          onSignIn={() => askSignIn()}
          goPanel={
            <div className="nav">
              <a className="btn primary" href={`/map?place=${place.id}`}>{L('ניווט מהמפה', 'Navigate from the map')}</a>
              <div className="nav-ext">
                <a href={wazeUrl(place)} target="_blank" rel="noopener noreferrer">Waze</a>
                <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Google Maps</a>
              </div>
            </div>
          }
          voted={voted}
          certificateUrl={(p) => certificateUrl(sb, p)}
          onBack={() => router.push(`/map?place=${place.id}`)}
          backLabel={L('פתיחה במפה', 'Open on the map')}
          onVote={onVote}
          onAdminApprove={isAdmin ? async (id) => {
            try { await moderateClaim(sb, id, true); showToast(L('אושר באישור מנהל ✓', 'Approved by an admin ✓')); reload(); } catch (e) { showToast(friendly(e, L.lang)); }
          } : undefined}
          onAddCertificate={() => { if (signedIn) setCertOpen(true); else askSignIn(); }}
          extra={
            <>
              <PlaceExtras key={`extras-${place.id}`} sb={sb} place={place} userId={signedIn && user ? user.id : null} isAdmin={isAdmin} onSignIn={askSignIn} onToast={showToast} onChanged={reload} />
              <PlaceCommunity key={place.id} sb={sb} place={place} isAdmin={isAdmin} signedIn={signedIn} onSignIn={askSignIn} onToast={showToast} onChanged={reload} />
              <div id="place-similar" />
            </>
          }
          onShare={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              showToast(L('הקישור הועתק', 'Link copied'));
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
            showToast(L('התעודה נשלחה לאישור הקהילה', 'The certificate was sent for the community to confirm'));
            reload();
          }}
        />
      )}
      <Toast text={toast} />
    </div>
  );
}
