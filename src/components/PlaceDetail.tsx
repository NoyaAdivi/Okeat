'use client';

import type { ReactNode } from 'react';
import { NEED_LABELS, levelInfo, placeTypeLabel, type Claim, type Place } from '@/lib/types';
import { NEED_CLASS, NEED_ORDER, isImported, isWeakKosher, pendingClaims, verifiedClaim } from '@/lib/claims';
import { openStatus } from '@/lib/hours';
import { ago, formatDate } from '@/lib/geo';
import CertificateCard from './CertificateCard';
import { NEED_EMOJI, placeEmoji } from '@/lib/emoji';
import { cuisineEmoji, cuisineLabel } from '@/lib/cuisine';
import HoursTable from './HoursTable';
import GoogleInfo from './GoogleInfo';
import { readableText, speak, speechSupported } from '@/lib/speech';
import { useRef } from 'react';

interface Props {
  place: Place;
  /** Navigation block (mode, time, start button). */
  goPanel: ReactNode;
  voted: ReadonlyMap<string, 1 | -1>;
  certificateUrl: (path: string) => string;
  onBack: () => void;
  backLabel?: string;
  onVote: (claimId: string, value: 1 | -1) => void;
  onAddCertificate: () => void;
  /** Propose vegan / gluten-free info. Omit to hide those buttons. */
  onAddInfo?: (need: 'vegan' | 'gluten_free') => void;
  onShare: () => void;
}

function Pips({ count }: { count: number }) {
  return (
    <span className="pips">
      {[0, 1, 2].map((i) => <span key={i} className={`p${i < count ? ' on' : ''}`} />)}
      <span>{Math.min(count, 3)} מתוך 3 אישורים</span>
    </span>
  );
}

function Seal({ cls, letter }: { cls: string; letter: string }) {
  return <div className={`seal ${cls}`} aria-hidden="true"><span>{letter}</span></div>;
}

export default function PlaceDetail({
  place, goPanel, voted, certificateUrl, onBack, backLabel = 'חזרה לרשימה', onVote, onAddCertificate, onAddInfo, onShare,
}: Props) {
  const st = openStatus(place.hours);
  const verified = NEED_ORDER.map((n) => verifiedClaim(place, n)).filter((c): c is Claim => c !== null);
  const pending = pendingClaims(place);
  const kosher = verifiedClaim(place, 'kosher');
  const kosherPending = pending.some((c) => c.need === 'kosher');
  const needsCertificate = !kosherPending && (!kosher || kosher.level === 'marked' || kosher.certificate?.expired);

  const root = useRef<HTMLDivElement>(null);
  const known = (n: 'vegan' | 'gluten_free') => place.claims.some((c) => c.need === n && (c.status === 'verified' || c.status === 'pending'));
  const canAdd = (['vegan', 'gluten_free'] as const).filter((n) => !known(n));

  return (
    <div className="detail" ref={root}>
      <div className="detail-head">
        <div className="detail-top">
          <button type="button" className="link" onClick={onBack}>{backLabel}</button>
          <span className="detail-tools">
            {speechSupported() && (
              <button type="button" className="link" onClick={() => root.current && speak(readableText(root.current))}>
                <span aria-hidden="true">🔊</span> הקראה
              </button>
            )}
            <button type="button" className="link" onClick={onShare}><span aria-hidden="true">🔗</span> העתקת קישור</button>
          </span>
        </div>
        <h2><span className="h-emoji" aria-hidden="true">{placeEmoji(place.place_type)}</span>{place.name}</h2>
        <div className="meta">
          <span className="tag">{placeTypeLabel(place.place_type)}</span>
          {place.address && <span>{place.address}</span>}
          <span className={st.open ? 'st-open' : undefined}>{st.text}</span>
        </div>
      </div>

      {place.cuisine && place.cuisine.length > 0 && (
        <section className="sec food" aria-labelledby="food-h">
          <h3 id="food-h">מה אוכלים כאן</h3>
          <div className="food-chips">
            {place.cuisine.map((c) => (
              <span key={c} className="food-chip"><span aria-hidden="true">{cuisineEmoji(c)}</span> {cuisineLabel(c)}</span>
            ))}
          </div>
          <p className="src-note">
            {place.cuisine_source === 'auto'
              ? 'סיווג אוטומטי לפי שם המקום. לא מאושר.'
              : place.cuisine_source === 'osm'
                ? 'לפי OpenStreetMap.'
                : place.cuisine_source === 'overture'
                  ? 'לפי Overture Maps. לא מאושר.'
                  : null}
          </p>
        </section>
      )}

      {goPanel}

      <section className="sec" aria-labelledby="hours-h">
        <h3 id="hours-h">שעות פתיחה</h3>
        <HoursTable hours={place.hours} />
      </section>

      <GoogleInfo key={place.id} name={place.name} lat={place.lat} lng={place.lng} />

      {(place.phone || place.website) && (
        <section className="sec contact" aria-labelledby="contact-h">
          <h3 id="contact-h">יצירת קשר</h3>
          <div className="contact-row">
            {place.phone && (
              <a className="btn small" href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>
                <span aria-hidden="true">📞</span> <span dir="ltr">{place.phone}</span>
              </a>
            )}
            {place.website && (
              <a className="btn small" href={place.website} target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">🌐</span> לאתר של המקום
              </a>
            )}
          </div>
        </section>
      )}

      {kosher?.certificate?.expired && (
        <div className="warnbox">
          <span>
            <b>תעודת הכשרות פגה ב-{formatDate(kosher.certificate.validUntil)}.</b> ייתכן שהמקום חידש אותה ועוד לא צילמו את החדשה.
          </span>
        </div>
      )}

      <section className="sec" aria-labelledby="verified-h">
        <h3 id="verified-h">מה ידוע על המקום</h3>
        {verified.length === 0 && (
          <div className="pendbox">{pending.length ? 'עוד אין כאן מידע מאושר. מה שהוצע מחכה לאישור של אנשים שהיו במקום.' : 'עוד אף אחד לא סיפר לנו על המקום הזה. הייתם שם? ספרו לכולם 👇'}</div>
        )}
        {verified.map((c) => {
          const info = levelInfo(c.need, c.level);
          const myVote = voted.get(c.id);
          const imported = isImported(c);
          return (
            <div key={c.id}>
              <div className="claim">
                <Seal cls={`${isWeakKosher(c) ? 'x' : NEED_CLASS[c.need]}${imported || c.level === 'marked' ? ' soft' : ''}`} letter={NEED_LABELS[c.need].letter} />
                <div>
                  <div className="lv">{info?.label}</div>
                  {info?.note && <div className="note">{info.note}</div>}
                  {c.note && <div className="note">{c.note}</div>}
                  <div className="trust">
                    {imported ? (
                      <span className="src">
                        {c.source === 'auto' ? 'סיווג אוטומטי לפי שם המקום. לא מאושר.' : 'מתוך OpenStreetMap, עוד לא אושר על ידי הקהילה'}
                      </span>
                    ) : (
                      <>
                        <span>אושר על ידי {c.confirmCount} אנשים</span>
                        <span>אישור אחרון {ago(c.lastConfirmedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="acts">
                  <button type="button" className={`btn small${myVote === 1 ? ' done' : ''}`} disabled={!!myVote} onClick={() => onVote(c.id, 1)}>
                    {myVote === 1 ? 'אישרת, תודה' : imported ? 'נכון, הייתי שם' : 'עדיין נכון'}
                  </button>
                  <button type="button" className="btn small ghost" disabled={!!myVote} onClick={() => onVote(c.id, -1)}>
                    {myVote === -1 ? 'הדיווח נשלח' : 'לא נכון'}
                  </button>
                </div>
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
          <h3 id="pending-h">ממתין לאישור</h3>
          {pending.map((c) => {
            const myVote = voted.get(c.id);
            return (
              <div key={c.id}>
                <div className="claim">
                  <Seal cls="x pending" letter={NEED_LABELS[c.need].letter} />
                  <div>
                    <div className="lv">{levelInfo(c.need, c.level)?.label}</div>
                    <Pips count={c.confirmCount} />
                  </div>
                  <div className="acts">
                    <button type="button" className={`btn small${myVote === 1 ? ' done' : ''}`} disabled={!!myVote} onClick={() => onVote(c.id, 1)}>
                      {myVote === 1 ? 'אישרת, תודה' : 'נכון, ראיתי בעצמי'}
                    </button>
                    <button type="button" className="btn small ghost" disabled={!!myVote} onClick={() => onVote(c.id, -1)}>לא נכון</button>
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

      {onAddInfo && (canAdd.length > 0 || needsCertificate) && (
        <section className="sec add-info" aria-labelledby="addinfo-h">
          <h3 id="addinfo-h">יודעים משהו על המקום?</h3>
          <div className="add-info-row">
            {canAdd.map((n) => (
              <button key={n} type="button" className={`info-chip ${NEED_CLASS[n]}`} onClick={() => onAddInfo(n)}>
                <span aria-hidden="true">{NEED_EMOJI[n]}</span> {NEED_LABELS[n].label}
              </button>
            ))}
            {needsCertificate && (
              <button type="button" className="info-chip k" onClick={onAddCertificate}>
                <span aria-hidden="true">📸</span> צילום תעודת כשרות
              </button>
            )}
          </div>
        </section>
      )}

      {!onAddInfo && needsCertificate && (
        <section className="sec cert-cta">
          <h3>{kosher ? 'יש לכם תמונה של התעודה?' : 'יש כאן תעודת כשרות?'}</h3>
          <p className="intro">צלמו אותה, והפרטים ייקראו אוטומטית מהתמונה.</p>
          <button type="button" className="btn" onClick={onAddCertificate}>צילום תעודת כשרות</button>
        </section>
      )}
    </div>
  );
}
