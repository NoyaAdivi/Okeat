'use client';

import { levelInfo, levelText, needLetter, type Place } from '@/lib/types';
import { useL } from './LangProvider';
import { NEED_CLASS, NEED_ORDER, hasAnyVerified, isImported, verifiedClaim } from '@/lib/claims';

/** One small pill per verified claim, as in the prototype list. */
export default function Badges({ place }: { place: Place }) {
  const L = useL();
  const lang = L.lang;
  return (
    <span className="badges">
      {NEED_ORDER.map((n) => {
        const c = verifiedClaim(place, n);
        if (!c) return null;
        if (c.certificate?.expired) {
          return (
            <span key={n} className="badge bad">
              <i>{needLetter(n, lang)}</i>{L('תעודה פגה', 'Certificate expired')}
            </span>
          );
        }
        return (
          <span key={n} className={`badge ${c.level === 'pikuach' ? 'x' : NEED_CLASS[n]}${isImported(c) ? ' soft' : ''}`}>
            <i>{needLetter(n, lang)}</i>
            {(() => { const i = levelInfo(n, c.level); return i ? levelText(i, lang) : null; })()}
          </span>
        );
      })}
      {!hasAnyVerified(place) && (
        <span className="badge pend">{place.claims.some((c) => c.status === 'pending') ? L('ממתין לאישור', 'Waiting for confirmation') : L('עוד אין מידע', 'No info yet')}</span>
      )}
    </span>
  );
}
