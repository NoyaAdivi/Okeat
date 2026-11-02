import type { ExtractedCertificate, KosherLevel } from './types';

// Free reading of a kosher certificate, in the visitor's own browser, with Tesseract OCR.
// Used when the server can't read it. Less exact than AI, so every field stays editable.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

type Tesseract = { recognize: (image: Blob, langs: string) => Promise<{ data: { text: string } }> };

function loadTesseract(): Promise<Tesseract> {
  const w = window as unknown as { Tesseract?: Tesseract };
  if (w.Tesseract) return Promise.resolve(w.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = () => (w.Tesseract ? resolve(w.Tesseract) : reject(new Error('OCR failed to load')));
    s.onerror = () => reject(new Error('OCR failed to load'));
    document.head.appendChild(s);
  });
}

const BODY = /רבנות|בד["״'׳]?ץ|צהר|מהדרין|השגחה/;

function levelOf(text: string): KosherLevel | 'unknown' {
  if (/בד["״'׳]?ץ/.test(text)) return 'badatz';
  if (/מהדרין/.test(text)) return 'mehadrin';
  if (/צהר/.test(text)) return 'tzohar';
  if (/רבנות/.test(text)) return 'rabanut';
  return 'unknown';
}

/** The latest real date printed, which on a certificate is the expiry date. */
function latestDate(text: string): string | null {
  let best: string | null = null;
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g)) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])));
    if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[1])) continue;
    const iso = d.toISOString().slice(0, 10);
    if (!best || iso > best) best = iso;
  }
  return best;
}

export function parseCertificateText(text: string): ExtractedCertificate {
  const line = text.split('\n').map((l) => l.trim()).find((l) => BODY.test(l)) ?? null;
  const validUntil = latestDate(text);
  return {
    isKosherCertificate: /כשר|רבנות|בד["״'׳]?ץ/.test(text),
    businessName: null,
    supervisingBody: line ? line.slice(0, 120) : null,
    level: levelOf(text),
    validUntil,
    confidence: 0.4,
    issues: validUntil ? ['הפרטים נקראו אוטומטית. בדקו שהם נכונים.'] : ['לא זוהה תאריך לועזי. מלאו את התוקף ידנית.'],
  };
}

export async function readCertificateLocally(file: Blob): Promise<ExtractedCertificate> {
  const tesseract = await loadTesseract();
  const { data } = await tesseract.recognize(file, 'heb+eng');
  return parseCertificateText(data.text);
}
