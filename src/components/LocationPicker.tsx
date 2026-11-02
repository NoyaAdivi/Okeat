'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';
import { searchPlaces, type GeoResult } from '@/lib/geocode';
import { useL } from './LangProvider';

interface Props {
  onGps: () => void;
  onPickOnMap: () => void;
  onChoose: (point: LatLng, label: string) => void;
  onClose: () => void;
  /** set when the person chose a location by hand */
  manualLabel: string | null;
  /** results close to this point come first */
  near: LatLng;
}

/** "Where am I?" menu: GPS, pick on the map, or type an address / city / place. */
export default function LocationPicker({ onGps, onPickOnMap, onChoose, onClose, manualLabel, near }: Props) {
  const L = useL();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => input.current?.focus(), []);

  // close on outside click / Esc
  useEffect(() => {
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true); };
  }, [onClose]);

  // address search: OpenStreetMap (Photon) first, Mapbox as a fallback, biased to where the map is
  useEffect(() => {
    const text = q.trim();
    setActive(-1);
    if (text.length < 2) { setResults([]); setBusy(false); return; }
    const ctrl = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchPlaces(text, nearRef.current, L.lang, ctrl.signal);
        if (!ctrl.signal.aborted) setResults(found);
      } catch { /* aborted or offline */ }
      if (!ctrl.signal.aborted) setBusy(false);
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, L.lang]);

  const choose = (r: GeoResult) => onChoose(r.point, r.detail ? `${r.name}, ${r.detail}` : r.name);

  return (
    <div className="loc-pop" ref={box} role="dialog" aria-label={L('בחירת המיקום שלי', 'Choose my location')}>
      <div className="loc-head">
        <b>{L('איפה אתם עכשיו?', 'Where are you now?')}</b>
        <button type="button" className="loc-x" onClick={onClose} aria-label={L('סגירה', 'Close')}>✕</button>
      </div>
      {manualLabel && <p className="loc-now">{L('המיקום שבחרתם:', 'Your chosen location:')} {manualLabel}</p>}
      <div className="loc-acts">
        <button type="button" onClick={onGps}><span aria-hidden="true">📡</span> {L('לפי ה-GPS', 'Use GPS')}</button>
        <button type="button" onClick={onPickOnMap}><span aria-hidden="true">🗺️</span> {L('בחירה על המפה', 'Pick on the map')}</button>
      </div>
      <label htmlFor="loc-q" className="loc-label">{L('או חיפוש כתובת, עיר או מקום', 'Or search for an address, city or place')}</label>
      <input
        id="loc-q"
        ref={input}
        type="search"
        dir="auto"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter' && results.length) { e.preventDefault(); choose(results[Math.max(0, active)]); }
        }}
        placeholder={L('למשל: דיזנגוף 50 תל אביב', 'e.g. Dizengoff 50 Tel Aviv')}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="loc-results"
        aria-activedescendant={active >= 0 ? `loc-r-${active}` : undefined}
      />
      {busy && <p className="loc-hint">{L('מחפשים…', 'Searching…')}</p>}
      {!busy && q.trim().length >= 2 && results.length === 0 && <p className="loc-hint">{L('לא נמצא. נסו לכתוב אחרת, למשל רחוב, מספר ועיר.', 'Nothing found. Try writing it differently, e.g. street, number and city.')}</p>}
      {results.length > 0 && (
        <ul className="loc-results" id="loc-results" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.point.lat},${r.point.lng}`} id={`loc-r-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'active' : undefined} onClick={() => choose(r)}>
                <span aria-hidden="true">📍</span>
                <span><b>{r.name}</b>{r.detail && <small>{r.detail}</small>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="loc-credit">{L('חיפוש כתובות:', 'Address search:')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a></p>
    </div>
  );
}
