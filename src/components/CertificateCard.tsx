import { levelInfo, type Claim } from '@/lib/types';
import { ago, formatDate } from '@/lib/geo';

interface Props {
  businessName: string;
  claim: Claim;
  imageUrl: string | null;
}

/** The certificate as a document: double border, rotated stamp, "פג תוקף" over expired ones. */
export default function CertificateCard({ businessName, claim, imageUrl }: Props) {
  const cert = claim.certificate;
  if (!cert) return null;
  const pik = claim.level === 'pikuach';

  return (
    <div className={`cert${cert.expired ? ' expired' : ''}${pik ? ' pik' : ''}`}>
      <div className="cert-top">
        <div className="ttl">
          {pik ? 'אישור פיקוח' : 'תעודת הכשר'}
          <small>מתוך צילום של משתמש</small>
        </div>
        <div className="stamp" aria-hidden="true">{pik ? 'פ' : 'כ'}</div>
      </div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="photo" src={imageUrl} alt={`צילום תעודת הכשרות של ${businessName}`} loading="lazy" />
      )}
      <dl>
        <dt>שם העסק</dt><dd>{businessName}</dd>
        <dt>גוף משגיח</dt><dd>{cert.supervisingBody}</dd>
        <dt>רמה</dt><dd>{levelInfo('kosher', claim.level)?.label}</dd>
        <dt>בתוקף עד</dt>
        <dd style={cert.expired ? { color: 'var(--warn)' } : undefined}>{formatDate(cert.validUntil)}</dd>
      </dl>
      <div className="foot">
        <span>צולם {ago(cert.photographedAt)}</span>
        <span>הפרטים חולצו אוטומטית מהתמונה</span>
      </div>
    </div>
  );
}
