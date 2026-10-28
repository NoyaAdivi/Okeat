import { NEED_LABELS, levelInfo, type Place } from '@/lib/types';
import { NEED_CLASS, NEED_ORDER, hasAnyVerified, isImported, verifiedClaim } from '@/lib/claims';

/** One small pill per verified claim, as in the prototype list. */
export default function Badges({ place }: { place: Place }) {
  return (
    <span className="badges">
      {NEED_ORDER.map((n) => {
        const c = verifiedClaim(place, n);
        if (!c) return null;
        if (c.certificate?.expired) {
          return (
            <span key={n} className="badge bad">
              <i>{NEED_LABELS[n].letter}</i>תעודה פגה
            </span>
          );
        }
        return (
          <span key={n} className={`badge ${c.level === 'pikuach' ? 'x' : NEED_CLASS[n]}${isImported(c) ? ' soft' : ''}`}>
            <i>{NEED_LABELS[n].letter}</i>
            {levelInfo(n, c.level)?.label}
          </span>
        );
      })}
      {!hasAnyVerified(place) && (
        <span className="badge pend">{place.claims.some((c) => c.status === 'pending') ? 'ממתין לאישור' : 'עוד אין מידע'}</span>
      )}
    </span>
  );
}
