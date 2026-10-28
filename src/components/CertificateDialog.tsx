'use client';

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
  const [value, setValue] = useState<CertificateValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!value) {
      setError('צלמו את התעודה ובדקו שכל השדות מלאים.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await proposeKosherClaim(sb, { placeId: place.id, ...value });
      onDone();
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  };

  return (
    <Modal title="תעודת כשרות" subtitle={`${place.name}. התעודה החדשה תחליף את הקודמת אחרי שלושה אישורים.`} onClose={onClose}>
      <CertificateCapture sb={sb} onChange={setValue} />
      {error && <div className="err" role="alert">{error}</div>}
      <p className="consent">בשליחה אתם מאשרים שהמידע נכון למיטב ידיעתכם, ומסכימים ל<a href="/terms" target="_blank" rel="noopener noreferrer">תנאי השימוש</a>.</p>
      <div className="modal-acts">
        <button type="button" className="btn" onClick={onClose}>ביטול</button>
        <button type="button" className="btn primary" onClick={submit} disabled={busy}>
          {busy ? 'שולח…' : 'שליחה לאישור הקהילה'}
        </button>
      </div>
    </Modal>
  );
}
