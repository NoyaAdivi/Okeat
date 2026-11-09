'use client';

import { LEVELS, levelText, needLetter, type PendingClaim } from '@/lib/types';
import { useL } from './LangProvider';
import { NEED_CLASS } from '@/lib/claims';
import { ago, formatMeters } from '@/lib/geo';

interface Props {
  signedIn: boolean;
  items: PendingClaim[];
  loading: boolean;
  onSignIn: () => void;
  onVote: (claimId: string, value: 1 | -1) => void;
  onShow: (placeId: string) => void;
  onAdd: () => void;
  /** Admins: approve at once, without waiting for three people. */
  onAdminApprove?: (claimId: string) => void;
}

export default function CommunityQueue({ signedIn, items, loading, onSignIn, onVote, onShow, onAdd, onAdminApprove }: Props) {
  const L = useL();
  const lang = L.lang;
  const intro = (
    <p className="intro">{L('מידע חדש מופיע במפה אחרי שלושה אישורים של אנשים שהיו במקום. ראיתם בעצמכם? אשרו.', 'New information appears on the map after three people who were there confirm it. Seen it yourself? Confirm it.')}</p>
  );

  if (!signedIn) {
    return (
      <>
        {intro}
        <div className="empty">
          <p>{L('כדי לאשר צריך להתחבר. כך כל אדם מאשר פעם אחת.', 'Sign in to confirm. That way each person confirms only once.')}</p>
          <button type="button" className="btn primary" onClick={onSignIn}>{L('התחברות', 'Sign in')}</button>
        </div>
      </>
    );
  }

  if (loading && items.length === 0) {
    return <>{intro}<div className="skeleton" /><div className="skeleton" /></>;
  }

  if (items.length === 0) {
    return (
      <>
        {intro}
        <div className="empty">
          <p>{L('אין כרגע מה לאשר באזור. מכירים מקום שחסר במפה?', 'Nothing to confirm in this area right now. Know a place that is missing from the map?')}</p>
          <button type="button" className="btn" onClick={onAdd}>{L('הוספת מקום', 'Add a place')}</button>
        </div>
      </>
    );
  }

  return (
    <>
      {intro}
      <ul className="list">
        {items.map((q) => {
          const info = LEVELS[q.need].find((l) => l.value === q.level);
          const level = info ? levelText(info, lang) : q.level;
          return (
            <li key={q.claim_id} className="qitem">
              <div className={`seal pending ${NEED_CLASS[q.need]}`} aria-hidden="true"><span>{needLetter(q.need, lang)}</span></div>
              <div>
                <div className="nm">{q.place_name}</div>
                <div>{level}{q.has_certificate ? L(', עם צילום תעודה', ', with a certificate photo') : ''}</div>
                <div className="pips">
                  {[0, 1, 2].map((i) => <span key={i} className={`p${i < q.confirm_count ? ' on' : ''}`} />)}
                  <span>{L(`${q.confirm_count} מתוך 3, הוצע ${ago(q.proposed_at)}, ${formatMeters(q.distance_m)} ממך`, `${q.confirm_count} of 3, suggested ${ago(q.proposed_at, 'en')}, ${formatMeters(q.distance_m, 'en')} from you`)}</span>
                </div>
              </div>
              <div className="acts">
                <button type="button" className="btn small" onClick={() => onVote(q.claim_id, 1)}>{L('נכון, ראיתי בעצמי', 'True, I saw it myself')}</button>
                <button type="button" className="btn small" onClick={() => onVote(q.claim_id, -1)}>{L('לא נכון', 'Not true')}</button>
                {onAdminApprove && (
                  <button type="button" className="btn small admin-ok" onClick={() => onAdminApprove(q.claim_id)}><span aria-hidden="true">🛡️</span> {L('אישור מנהל', 'Admin approve')}</button>
                )}
                <button type="button" className="link" onClick={() => onShow(q.place_id)}>{L('הצגה במפה', 'Show on the map')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
