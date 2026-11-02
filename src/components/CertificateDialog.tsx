'use client';

import { useL } from './LangProvider';
import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import Modal from './Modal';
import CertificateCapture, { type CertificateValue } from './CertificateCapture';
import { proposeKosherClaim } from '@/lib/places';
import { friendly } from '@/lib/errors';

interface Props {
  sb: SupabaseClient;
  place: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}

/** Add a new certificate to an existing place. It replaces the old one after three confirmations. */
export default function CertificateDialog({ sb, place, onClose, onDone }: Props) {
  const L = useL();
  const [value, setValue] = useState<CertificateValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!value) {
      setError(L('צלמו את התעודה ובדקו שכל השדות מלאים.', 'Photograph the certificate and check that every field is filled in.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await proposeKosherClaim(sb, { placeId: place.id, ...value });
      onDone();
    } catch (e) {
      setError(friendly(e, L.lang));
      setBusy(false);
    }
  };

  return (
    <Modal title={L('תעודת כשרות', 'Kosher certificate')} subtitle={L(`${place.name}. התעודה החדשה תחליף את הקודמת אחרי שלושה אישורים.`, `${place.name}. The new certificate replaces the old one after three confirmations.`)} onClose={onClose}>
      <CertificateCapture sb={sb} onChange={setValue} />
      {error && <div className="err" role="alert">{error}</div>}
      <p className="consent">{L('בשליחה אתם מאשרים שהמידע נכון למיטב ידיעתכם, ומסכימים ל', 'By sending you confirm the information is correct to the best of your knowledge, and agree to the ')}<a href="/terms" target="_blank" rel="noopener noreferrer">{L('תנאי השימוש', 'terms of use')}</a>.</p>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>{L('ביטול', 'Cancel')}</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>
          {busy ? L('שולח…', 'Sending…') : L('שליחה לאישור הקהילה', 'Send for the community to confirm')}
        </button>
      </div>
    </Modal>
  );
}
