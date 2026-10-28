'use client';

import { TRAVEL_MODES, arrowRotation, eta, type Directions, type NavStep, type TravelMode } from '@/lib/directions';
import { formatMeters, googleMapsUrl, wazeUrl, type LatLng } from '@/lib/geo';

const MODE_ICON: Record<TravelMode, React.ReactNode> = {
  walking: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4" r="2" /><path d="M10 21l2-6 3 3v3M9 12l2-4 3 1 2 4M12 8l-1 5" /></svg>
  ),
  cycling: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3.5" /><circle cx="18" cy="17" r="3.5" /><path d="M6 17l4-7h5l3 7M10 10l2 7M14 5h2" /></svg>
  ),
  driving: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2" /><circle cx="8" cy="13" r="1" /><circle cx="16" cy="13" r="1" /></svg>
  ),
};

export function TurnArrow({ step, size = 22 }: { step: Pick<NavStep, 'type' | 'modifier'>; size?: number }) {
  if (step.type === 'arrive') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="turn">
        <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="turn" style={{ transform: `rotate(${arrowRotation(step)}deg)` }}>
      <path d="M12 20V5M6 11l6-6 6 6" />
    </svg>
  );
}

interface Props {
  place: LatLng & { name: string };
  hasLocation: boolean;
  mode: TravelMode;
  directions: Directions | null;
  loading: boolean;
  navigating: boolean;
  stepIndex: number;
  /** meters to the next maneuver while navigating */
  toNext: number | null;
  onMode: (m: TravelMode) => void;
  onStart: () => void;
  onStop: () => void;
  /** open the "where am I" picker */
  onSetLocation?: () => void;
}

export default function NavPanel({ place, hasLocation, mode, directions, loading, navigating, stepIndex, toNext, onMode, onStart, onStop, onSetLocation }: Props) {
  const external = (
    <div className="nav-ext">
      <a href={wazeUrl(place)} target="_blank" rel="noopener noreferrer">Waze</a>
      <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Google Maps</a>
    </div>
  );

  if (!hasLocation) {
    return (
      <div className="nav">
        <p className="nav-note">כדי לנווט מכאן צריך לדעת איפה אתם: לאשר לאתר לראות את המיקום, או לבחור אותו בעצמכם.</p>
        {onSetLocation && (
          <button type="button" className="btn primary nav-setloc" onClick={onSetLocation}>📍 בחירת המיקום שלי</button>
        )}
        <p className="nav-note">או לפתוח באפליקציית ניווט:</p>
        {external}
      </div>
    );
  }

  return (
    <div className={`nav${navigating ? ' on' : ''}`}>
      <div className="modes" role="radiogroup" aria-label="איך מגיעים">
        {TRAVEL_MODES.map((m) => (
          <button key={m.mode} type="button" role="radio" aria-checked={mode === m.mode} className="mode" onClick={() => onMode(m.mode)} disabled={navigating && mode !== m.mode}>
            {MODE_ICON[m.mode]}
            {m.label}
          </button>
        ))}
      </div>

      <div className="nav-sum" aria-live="polite">
        {loading || !directions ? (
          <span className="nav-time">{loading ? 'מחשב מסלול…' : 'לא נמצא מסלול'}</span>
        ) : (
          <>
            <span className="nav-time">{directions.minutes}<small> דק׳</small></span>
            <span className="nav-meta">
              {formatMeters(directions.meters)}
              <br />
              הגעה ב-{eta(directions.minutes)}
            </span>
          </>
        )}
        {navigating ? (
          <button type="button" className="btn stop" onClick={onStop}>סיום</button>
        ) : (
          <button type="button" className="btn go-btn" onClick={onStart} disabled={!directions}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l14-7-5 15-2-6z" /></svg>
            יציאה לדרך
          </button>
        )}
      </div>

      {directions && directions.steps.length > 0 && (
        <details className="steps" open={navigating}>
          <summary>{directions.steps.length} שלבים בדרך</summary>
          <ol>
            {directions.steps.map((s, i) => (
              <li key={i} className={navigating && i === stepIndex ? 'cur' : navigating && i < stepIndex ? 'done' : undefined}>
                <TurnArrow step={s} />
                <span className="ins">{s.instruction}</span>
                <span className="d">
                  {navigating && i === stepIndex && toNext !== null ? formatMeters(toNext) : s.distance > 0 ? formatMeters(s.distance) : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {!navigating && external}
    </div>
  );
}

/** Big instruction card floating over the map while navigating. */
export function NavBanner({ step, toNext, onStop, voice, onVoice }: { step: NavStep; toNext: number | null; onStop: () => void; voice?: boolean; onVoice?: () => void }) {
  return (
    <div className="nav-banner" role="status" aria-live="polite">
      <span className="nb-arrow"><TurnArrow step={step} size={34} /></span>
      <span className="nb-text">
        {toNext !== null && <b>{formatMeters(toNext)}</b>}
        <span>{step.instruction}</span>
      </span>
      {onVoice && (
        <button type="button" onClick={onVoice} aria-pressed={voice} aria-label={voice ? 'השתקת ההנחיות הקוליות' : 'הפעלת הנחיות קוליות'}>
          {voice ? '🔊' : '🔇'}
        </button>
      )}
      <button type="button" onClick={onStop} aria-label="סיום ניווט">✕</button>
    </div>
  );
}
