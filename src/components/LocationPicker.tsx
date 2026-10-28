'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';
import { MAPBOX_TOKEN } from '@/lib/mapboxToken';

interface Result { name: string; detail: string; point: LatLng }

interface Props {
  onGps: () => void;
  onPickOnMap: () => void;
  onChoose: (point: LatLng, label: string) => void;
  onClose: () => void;
  /** set when the person chose a location by hand */
  manualLabel: string | null;
}

/** "Where am I?" menu: GPS, pick on the map, or type an address / city. */
export default function LocationPicker({ onGps, onPickOnMap, onChoose, onClose, manualLabel }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => input.current?.focus(), []);

  // close on outside click / Esc
  useEffect(() => {
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true); };
  }, [onClose]);

  // address search (Mapbox, Israel only, Hebrew)
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}&country=il&language=he&limit=6&access_token=${MAPBOX_TOKEN}`;
        const json = await (await fetch(url, { signal: ctrl.signal })).json();
        setResults(
          (json.features ?? []).map((f: { properties: { name?: string; full_address?: string; place_formatted?: string }; geometry: { coordinates: [number, number] } }) => ({
            name: f.properties.name ?? text,
            detail: f.properties.place_formatted ?? f.properties.full_address ?? '',
            point: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
          })),
        );
      } catch { /* aborted or offline */ }
      setBusy(false);
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <div className="loc-pop" ref={box} role="dialog" aria-label="בחירת המיקום שלי">
      <div className="loc-head">
        <b>איפה אתם עכשיו?</b>
        <button type="button" className="loc-x" onClick={onClose} aria-label="סגירה">✕</button>
      </div>
      {manualLabel && <p className="loc-now">המיקום שבחרתם: {manualLabel}</p>}
      <div className="loc-acts">
        <button type="button" onClick={onGps}><span aria-hidden="true">📡</span> לפי ה-GPS</button>
        <button type="button" onClick={onPickOnMap}><span aria-hidden="true">🗺️</span> בחירה על המפה</button>
      </div>
      <label htmlFor="loc-q" className="loc-label">או חיפוש כתובת, עיר או מקום</label>
      <input id="loc-q" ref={input} type="search" dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="למשל: דיזנגוף 50 תל אביב" autoComplete="off" />
      {busy && <p className="loc-hint">מחפשים…</p>}
      {!busy && q.trim().length >= 2 && results.length === 0 && <p className="loc-hint">לא נמצא. נסו לכתוב אחרת.</p>}
      {results.length > 0 && (
        <ul className="loc-results">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => onChoose(r.point, r.name)}>
                <span aria-hidden="true">📍</span>
                <span><b>{r.name}</b>{r.detail && <small>{r.detail}</small>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
