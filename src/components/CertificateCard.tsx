'use client';

import { levelInfo, levelText, type Claim } from '@/lib/types';
import { useL } from './LangProvider';
import { ago, formatDate } from '@/lib/geo';

interface Props {
  businessName: string;
  claim: Claim;
  imageUrl: string | null;
}

/** The certificate as a document: double border, rotated stamp, "פג תוקף" over expired ones. */
export default function CertificateCard({ businessName, claim, imageUrl }: Props) {
  const L = useL();
  const cert = claim.certificate;
  if (!cert) return null;
  const pik = claim.level === 'pikuach';

  return (
    <div className={`cert${cert.expired ? ' expired' : ''}${pik ? ' pik' : ''}`}>
      <div className="cert-top">
        <div className="ttl">
          {pik ? L('אישור פיקוח', 'Supervision approval') : L('תעודת הכשר', 'Kosher certificate')}
          <small>{L('מתוך צילום של משתמש', "From a user's photo")}</small>
        </div>
        <div className="stamp" aria-hidden="true">{pik ? L('פ', 'S') : L('כ', 'K')}</div>
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo" src={imageUrl} alt={L(`צילום תעודת הכשרות של ${businessName}`, `Photo of the kosher certificate of ${businessName}`)} loading="lazy" />
      )}
      <dl>
        <dt>{L('שם העסק', 'Business name')}</dt><dd>{businessName}</dd>
        <dt>{L('גוף משגיח', 'Supervising body')}</dt><dd>{cert.supervisingBody}</dd>
        <dt>{L('רמה', 'Level')}</dt><dd>{(() => { const i = levelInfo('kosher', claim.level); return i ? levelText(i, L.lang) : null; })()}</dd>
        <dt>{L('בתוקף עד', 'Valid until')}</dt>
        <dd style={cert.expired ? { color: 'var(--warn)' } : undefined}>{formatDate(cert.validUntil)}</dd>
      </dl>
      <div className="foot">
        <span>{L('צולם', 'Photographed')} {ago(cert.photographedAt, L.lang)}</span>
        <span>{L('הפרטים חולצו אוטומטית מהתמונה', 'The details were read from the photo automatically')}</span>
      </div>
    </div>
  );
}
