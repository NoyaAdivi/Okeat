'use client';

import { LEVELS, NEED_LABELS, type PendingClaim } from '@/lib/types';
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
}

export default function CommunityQueue({ signedIn, items, loading, onSignIn, onVote, onShow, onAdd }: Props) {
  const intro = (
    <p className="intro">מידע חדש מופיע במפה אחרי שלושה אישורים של אנשים שהיו במקום. ראיתם בעצמכם? אשרו.</p>
  );

  if (!signedIn) {
    return (
      <>
        {intro}
        <div className="empty">
          <p>כדי לאשר צריך להתחבר. כך כל אדם מאשר פעם אחת.</p>
          <button type="button" className="btn primary" onClick={onSignIn}>התחברות</button>
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
          <p>אין כרגע מה לאשר באזור. מכירים מקום שחסר במפה?</p>
          <button type="button" className="btn" onClick={onAdd}>הוספת מקום</button>
        </div>
      </>
    );
  }

  return (
    <>
      {intro}
      <ul className="list">
        {items.map((q) => {
          const level = LEVELS[q.need].find((l) => l.value === q.level)?.label ?? q.level;
          return (
            <li key={q.claim_id} className="qitem">
              <div className={`seal pending ${NEED_CLASS[q.need]}`} aria-hidden="true">{NEED_LABELS[q.need].letter}</div>
              <div>
                <div className="nm">{q.place_name}</div>
                <div>{level}{q.has_certificate ? ', עם צילום תעודה' : ''}</div>
                <div className="pips">
                  {[0, 1, 2].map((i) => <span key={i} className={`p${i < q.confirm_count ? ' on' : ''}`} />)}
                  <span>{q.confirm_count} מתוך 3, הוצע {ago(q.proposed_at)}, {formatMeters(q.distance_m)} ממך</span>
                </div>
              </div>
              <div className="acts">
                <button type="button" className="btn small" onClick={() => onVote(q.claim_id, 1)}>נכון, ראיתי בעצמי</button>
                <button type="button" className="btn small" onClick={() => onVote(q.claim_id, -1)}>לא נכון</button>
                <button type="button" className="link" onClick={() => onShow(q.place_id)}>הצגה במפה</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
