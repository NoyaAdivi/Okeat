'use client';

import type { ReactNode } from 'react';
import { levelInfo, levelNote, levelText, needLabel, needLetter, placeTypeLabel, type Claim, type Need, type Place } from '@/lib/types';
import { useL } from './LangProvider';
import { EXTRA_NEEDS, MAIN_NEEDS, NEED_CLASS, NEED_ORDER, isImported, isWeakKosher, pendingClaims, verifiedClaim } from '@/lib/claims';
import { openStatus } from '@/lib/hours';
import { ago, formatDate } from '@/lib/geo';
import { expiresSoon, isStale } from '@/lib/checks';
import CertificateCard from './CertificateCard';
import { NEED_EMOJI, placeIcon } from '@/lib/emoji';
import { cuisineEmoji, cuisineLabel, placeFoods } from '@/lib/cuisine';
import HoursTable from './HoursTable';
import GoogleInfo from './GoogleInfo';
import { useEffect, useRef, useState } from 'react';
import { hebrewAddressAt } from '@/lib/geocode';
import Link from 'next/link';
import { cleanAddress, cleanName, googleUrl, hasHebrew, isForeign } from '@/lib/text';

interface Props {
  place: Place;
  /** Signed in with a real account. Without one, a place can be read but not changed. */
  signedIn: boolean;
  onSignIn: () => void;
  /** Navigation block (mode, time, start button). */
  goPanel: ReactNode;
  voted: ReadonlyMap<string, 1 | -1>;
  certificateUrl: (path: string) => string;
  onBack: () => void;
  backLabel?: string;
  onVote: (claimId: string, value: 1 | -1) => void;
  onAddCertificate: () => void;
  /** Propose info about a need (kosher too, with an optional photo). Omit to hide those buttons. */
  onAddInfo?: (need: Need) => void;
  onShare: () => void;
  /** Admins: fix where this place is. */
  onFixLocation?: () => void;
  /** Shown at the end: who added the place, owner, reports. */
  extra?: ReactNode;
  /** On the map: a kind of food or a need opens the list filtered by it. Elsewhere they are links to the map. */
  onFood?: (cuisine: string) => void;
  onNeed?: (need: Need) => void;
  /** Admins: one approval is enough, instead of waiting for three people. */
  onAdminApprove?: (claimId: string) => void;
}

function Pips({ count }: { count: number }) {
  const L = useL();
  return (
    <span className="pips">
      {[0, 1, 2].map((i) => <span key={i} className={`p${i < count ? ' on' : ''}`} />)}
      <span>{L(`${Math.min(count, 3)} מתוך 3 אישורים`, `${Math.min(count, 3)} of 3 confirmations`)}</span>
    </span>
  );
}

function Seal({ cls, letter }: { cls: string; letter: string }) {
  return <div className={`seal ${cls}`} aria-hidden="true"><span>{letter}</span></div>;
}

export default function PlaceDetail({
  place, signedIn, onSignIn, goPanel, voted, certificateUrl, onBack, backLabel, onVote, onAddCertificate, onAddInfo, onShare, onFixLocation, extra,
  onFood, onNeed, onAdminApprove,
}: Props) {
  const L = useL();
  const address = cleanAddress(place.address);
  const name = cleanName(place.name);
  // An address without a street number, or not in Hebrew: the nearest street in Hebrew, marked as approximate.
  // The town is also used to say in Hebrew what a place with a foreign name is.
  const [nearby, setNearby] = useState<string | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const needsLookup = !address || !/\d/.test(address) || isForeign(address) || isForeign(name);
  useEffect(() => {
    setNearby(null);
    setTown(null);
    if (!needsLookup) return;
    let live = true;
    hebrewAddressAt(place).then((a) => {
      if (!live) return;
      setTown(a.city);
      if (!a.address) return;
      // a Hebrew address in place of a foreign one, or a street where there was none
      if ((!address || !/\d/.test(address)) || (isForeign(address) && hasHebrew(a.address))) setNearby(a.address);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [place.id, place.lat, place.lng, place.address, place.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const lang = L.lang;
  const foods = placeFoods(place);
  // known only in the browser, so the page the server sends matches the first render
  const back = backLabel ?? L('חזרה לרשימה', 'Back to the list');
  const st = openStatus(place.hours, lang);
  const verified = NEED_ORDER.map((n) => verifiedClaim(place, n)).filter((c): c is Claim => c !== null);
  const pending = signedIn ? pendingClaims(place) : [];
  const kosher = verifiedClaim(place, 'kosher');
  const kosherPending = pending.some((c) => c.need === 'kosher');
  // a photo strengthens kosher that is known but has no (valid) certificate
  const needsCertificate = !kosherPending && !!kosher && (!kosher.certificate || kosher.certificate.expired);

  const root = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<'info' | 'details' | 'reviews'>('info');
  useEffect(() => { setSection('info'); }, [place.id]);
  const known = (n: Need) => place.claims.some((c) => c.need === n && (c.status === 'verified' || c.status === 'pending'));
  const canAddMain = MAIN_NEEDS.filter((n) => !known(n));
  const canAddExtra = EXTRA_NEEDS.filter((n) => !known(n));
  const canAdd = [...canAddMain, ...canAddExtra];

  return (
    <div className="detail" ref={root}>
      <div className="detail-top">
        <button type="button" className="back-pill" onClick={onBack}><span aria-hidden="true">{lang === 'en' ? '←' : '→'}</span> {back}</button>
        <span className="detail-tools">
          <a className="link" href={googleUrl(place.name, place.address ?? town)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span> {L('בגוגל', 'On Google')}</a>
          <button type="button" className="link" onClick={onShare}><span aria-hidden="true">🔗</span> {L('העתקת קישור', 'Copy link')}</button>
        </span>
      </div>
      <div className="detail-head">
        <h2><span className="h-emoji" aria-hidden="true">{placeIcon(place)}</span><span dir="auto">{name}</span></h2>
        {isForeign(name) && lang === 'he' && (
          <p className="he-line">{foods.length ? cuisineLabel(foods[0], 'he') : placeTypeLabel(place.place_type, 'he')}{town ? ` ב${town}` : ''}</p>
        )}
        {foods.length > 0 && (
          <ul className="head-foods" aria-label={L('מה אוכלים כאן', 'What they serve')}>
            {foods.map((c) => (
              <li key={c}>
                {onFood
                  ? <button type="button" onClick={() => onFood(c)} title={L(`עוד מקומות של ${cuisineLabel(c, lang)}`, `More ${cuisineLabel(c, lang)} places`)}><span aria-hidden="true">{cuisineEmoji(c)}</span> {cuisineLabel(c, lang)}</button>
                  : <Link href={`/map?food=${c}`} title={L(`עוד מקומות של ${cuisineLabel(c, lang)}`, `More ${cuisineLabel(c, lang)} places`)}><span aria-hidden="true">{cuisineEmoji(c)}</span> {cuisineLabel(c, lang)}</Link>}
              </li>
            ))}
            {place.cuisine_source !== 'community' && <li className="foods-guess">{L('לא מאושר', 'Not confirmed')}</li>}
          </ul>
        )}
        <div className="meta">
          {foods.length === 0 && <span className="tag">{placeTypeLabel(place.place_type, lang)}</span>}
          {nearby && isForeign(address) ? null : address && <span dir="auto">{address}</span>}
          {nearby && <span>{L(`בערך: ${nearby}`, `About: ${nearby}`)}</span>}
          {st.text && <span className={st.open ? 'st-open' : undefined}>{st.text}</span>}
        </div>
      </div>

      {goPanel}
      <div id="place-actions" className="place-actions" />
      <div id="place-photos" className="place-photos-slot" />
      <p className="place-tabs-hint">{L('לחצו על חלק כדי לראות את הפרטים', 'Tap a part to see its details')}</p>
      <div className="place-tabs" role="tablist" aria-label={L('החלקים של המקום', 'About this place')}>
        {([['info', '🍽️', L('מה יש כאן', "What's here")], ['details', '🕐', L('שעות וקשר', 'Hours & contact')], ['reviews', '💬', L('ביקורות וקהילה', 'Reviews & community')]] as const).map(([value, icon, label]) => (
          <button key={value} type="button" role="tab" aria-selected={section === value} onClick={() => setSection(value)}>
            <span className="pt-icon" aria-hidden="true">{icon}</span>
            <span className="pt-label">{label}</span>
            <span className="pt-chev" aria-hidden="true">⌄</span>
          </button>
        ))}
      </div>
      {section === 'info' && (<div className="place-part">

      {onFixLocation && (
        <section className="sec">
          <button type="button" className="btn" onClick={onFixLocation}>📍 {L('תיקון מיקום המקום', 'Fix this place\'s location')}</button>
        </section>
      )}

      {kosher?.certificate?.expired && (
        <div className="warnbox">
          <span>
            <b>{L(`תעודת הכשרות פגה ב-${formatDate(kosher.certificate.validUntil)}.`, `The kosher certificate expired on ${formatDate(kosher.certificate.validUntil)}.`)}</b> {L('ייתכן שהמקום חידש אותה ועוד לא צילמו את החדשה.', "The place may have renewed it and nobody has photographed the new one yet.")}
          </span>
        </div>
      )}

      {kosher?.certificate && !kosher.certificate.expired && expiresSoon(kosher.certificate.validUntil) && (
        <div className="warnbox">
          <span><b>{L(`תעודת הכשרות בתוקף עד ${formatDate(kosher.certificate.validUntil)}.`, `The kosher certificate is valid until ${formatDate(kosher.certificate.validUntil)}.`)}</b> {L('אם התחדשה, אפשר לצלם את החדשה.', 'If it was renewed, you can add a photo of the new one.')}</span>
        </div>
      )}

      <section className="sec" aria-labelledby="verified-h">
        <h3 id="verified-h">{L('מה ידוע על המקום', 'What we know about this place')}</h3>
        {verified.length === 0 && (
          <div className="pendbox">{pending.length ? L('עוד אין כאן מידע מאושר. מה שהוצע מחכה לאישור של אנשים שהיו במקום.', 'Nothing is confirmed here yet. What was suggested is waiting for people who were there to confirm it.') : L('עוד אף אחד לא סיפר לנו על המקום הזה. הייתם שם? ספרו לכולם 👇', 'Nobody has told us about this place yet. Have you been there? Tell everyone 👇')}</div>
        )}
        {verified.map((c) => {
          const info = levelInfo(c.need, c.level);
          const myVote = voted.get(c.id);
          const imported = isImported(c);
          return (
            <div key={c.id}>
              <div className="claim">
                <Seal cls={`${isWeakKosher(c) ? 'x' : NEED_CLASS[c.need]}${imported || c.level === 'marked' ? ' soft' : ''}`} letter={needLetter(c.need, lang)} />
                <div>
                  <div className="lv">
                    {onNeed
                      ? <button type="button" className="need-link" onClick={() => onNeed(c.need)} title={L(`עוד מקומות: ${needLabel(c.need, lang)}`, `More places: ${needLabel(c.need, lang)}`)}>{info ? levelText(info, lang) : needLabel(c.need, lang)}</button>
                      : <Link className="need-link" href={`/map?need=${c.need}`} title={L(`עוד מקומות: ${needLabel(c.need, lang)}`, `More places: ${needLabel(c.need, lang)}`)}>{info ? levelText(info, lang) : needLabel(c.need, lang)}</Link>}
                  </div>
                  {info && levelNote(info, lang) && <div className="note">{levelNote(info, lang)}</div>}
                  {c.note && <div className="note">{c.note}</div>}
                  <div className="trust">
                    {imported ? (
                      <span className="src">
                        {c.source === 'auto' ? L('סיווג אוטומטי לפי שם המקום. לא מאושר.', "Guessed from the place's name. Not confirmed.") : L('עוד לא אושר על ידי הקהילה', 'Not confirmed by the community yet')}
                      </span>
                    ) : (
                      <>
                        {c.confirmCount > 0 && <span>{c.confirmCount === 1 ? L('אושר על ידי אדם אחד', 'Confirmed by one person') : L(`אושר על ידי ${c.confirmCount} אנשים`, `Confirmed by ${c.confirmCount} people`)}</span>}
                        <span>{L('אישור אחרון', 'Last confirmed')} {ago(c.lastConfirmedAt, lang)}</span>
                        {isStale(c.lastConfirmedAt) && <span className="stale-note">{L('אושר לפני יותר משנה, כדאי לוודא', 'Confirmed over a year ago, worth checking')}</span>}
                      </>
                    )}
                  </div>
                </div>
                {signedIn && <div className="acts">
                  <button type="button" className={`btn small${myVote === 1 ? ' done' : ''}`} disabled={!!myVote} onClick={() => onVote(c.id, 1)}>
                    {myVote === 1 ? L('אישרת, תודה', 'Confirmed, thanks') : imported ? L('נכון, הייתי שם', "True, I've been there") : L('עדיין נכון', 'Still true')}
                  </button>
                  <button type="button" className="btn small ghost" disabled={!!myVote} onClick={() => onVote(c.id, -1)}>
                    {myVote === -1 ? L('הדיווח נשלח', 'Report sent') : L('לא נכון', 'Not true')}
                  </button>
                  {onAddInfo && imported && (
                    <button type="button" className="btn small ghost" onClick={() => onAddInfo(c.need)}>
                      <span aria-hidden="true">✏️</span> {L('תיקון', 'Fix it')}
                    </button>
                  )}
                </div>}
              </div>
              {c.certificate && (
                <CertificateCard businessName={place.name} claim={c} imageUrl={certificateUrl(c.certificate.imagePath)} />
              )}
            </div>
          );
        })}
      </section>

      {pending.length > 0 && (
        <section className="sec" aria-labelledby="pending-h">
          <h3 id="pending-h">{L('ממתין לאישור', 'Waiting for confirmation')}</h3>
          {pending.map((c) => {
            const myVote = voted.get(c.id);
            return (
              <div key={c.id}>
                <div className="claim">
                  <Seal cls="x pending" letter={needLetter(c.need, lang)} />
                  <div>
                    <div className="lv">{(() => { const i = levelInfo(c.need, c.level); return i ? levelText(i, lang) : null; })()}</div>
                    <Pips count={c.confirmCount} />
                  </div>
                  <div className="acts">
                    <button type="button" className={`btn small${myVote === 1 ? ' done' : ''}`} disabled={!!myVote} onClick={() => onVote(c.id, 1)}>
                      {myVote === 1 ? L('אישרת, תודה', 'Confirmed, thanks') : L('נכון, ראיתי בעצמי', 'True, I saw it myself')}
                    </button>
                    <button type="button" className="btn small ghost" disabled={!!myVote} onClick={() => onVote(c.id, -1)}>{L('לא נכון', 'Not true')}</button>
                    {onAdminApprove && (
                      <button type="button" className="btn small admin-ok" onClick={() => onAdminApprove(c.id)} title={L('אישור מנהל מספיק, בלי לחכות לשלושה אישורים', 'An admin approval is enough, no need to wait for three')}>
                        <span aria-hidden="true">🛡️</span> {L('אישור מנהל', 'Admin approve')}
                      </button>
                    )}
                  </div>
                </div>
                {c.certificate && (
                  <CertificateCard businessName={place.name} claim={c} imageUrl={certificateUrl(c.certificate.imagePath)} />
                )}
              </div>
            );
          })}
        </section>
      )}

      {!signedIn && (
        <section className="sec signin-cta">
          <p>{L('הייתם כאן? התחברו כדי לאשר, לתקן או להוסיף מידע ותעודת כשרות.', 'Been here? Sign in to confirm, fix or add information and a kosher certificate.')}</p>
          <button type="button" className="btn primary" onClick={onSignIn}>{L('התחברות', 'Sign in')}</button>
        </section>
      )}

      {signedIn && onAddInfo && (canAdd.length > 0 || needsCertificate) && (
        <section className="sec add-info" aria-labelledby="addinfo-h">
          <h3 id="addinfo-h">{L('יודעים משהו על המקום?', 'Know something about this place?')}</h3>
          <div className="add-info-row">
            {canAddMain.map((n) => (
              <button key={n} type="button" className={`info-chip ${NEED_CLASS[n]}`} onClick={() => onAddInfo(n)}>
                <span aria-hidden="true">{NEED_EMOJI[n]}</span> {needLabel(n, lang)}
              </button>
            ))}
            {needsCertificate && (
              <button type="button" className="info-chip k" onClick={onAddCertificate}>
                <span aria-hidden="true">📸</span> {L('צילום תעודת כשרות', 'Photograph a kosher certificate')}
              </button>
            )}
          </div>
          {canAddExtra.length > 0 && (
            <div className="more-info">
              <p className="more-info-title">{L('אלרגיות', 'Allergies')}</p>
              <div className="add-info-row">
                {canAddExtra.map((n) => (
                  <button key={n} type="button" className={`info-chip ${NEED_CLASS[n]}`} onClick={() => onAddInfo(n)}>
                    <span aria-hidden="true">{NEED_EMOJI[n]}</span> {needLabel(n, lang)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {signedIn && !onAddInfo && needsCertificate && (
        <section className="sec cert-cta">
          <h3>{kosher ? L('יש לכם תמונה של התעודה?', 'Do you have a photo of the certificate?') : L('יש כאן תעודת כשרות?', 'Is there a kosher certificate here?')}</h3>
          <p className="intro">{L('צלמו אותה, והפרטים ייקראו אוטומטית מהתמונה.', 'Take a photo and the details are read from it automatically.')}</p>
          <button type="button" className="btn" onClick={onAddCertificate}>{L('צילום תעודת כשרות', 'Photograph a kosher certificate')}</button>
        </section>
      )}
      </div>)}
      {section === 'details' && (<div className="place-part">
      <section className="sec" aria-labelledby="hours-h">
        <h3 id="hours-h">{L('שעות פתיחה', 'Opening hours')}</h3>
        <HoursTable hours={place.hours} />
      </section>

      <GoogleInfo key={place.id} name={place.name} lat={place.lat} lng={place.lng} />

      {(place.phone || place.website) && (
        <section className="sec contact" aria-labelledby="contact-h">
          <h3 id="contact-h">{L('יצירת קשר', 'Contact')}</h3>
          <div className="contact-row">
            {place.phone && (
              <a className="btn small" href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>
                <span aria-hidden="true">📞</span> <span dir="ltr">{place.phone}</span>
              </a>
            )}
            {place.website && (
              <a className="btn small" href={place.website} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">🌐</span> {L('לאתר של המקום', "The place's website")}
              </a>
            )}
          </div>
        </section>
      )}

      </div>)}
      <div className="place-part" hidden={section !== 'reviews'}>{extra}</div>
    </div>
  );
}
