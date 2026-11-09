'use client';

import { TRAVEL_MODES, arrowRotation, eta, type Directions, type NavStep, type TravelMode } from '@/lib/directions';
import { formatDuration, formatMeters, googleMapsUrl, wazeUrl, type LatLng } from '@/lib/geo';
import { useL } from './LangProvider';

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
  const L = useL();
  const lang = L.lang;
  const external = (
    <div className="nav-ext">
      <a href={wazeUrl(place)} target="_blank" rel="noopener noreferrer">Waze</a>
      <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Google Maps</a>
    </div>
  );

  if (!hasLocation) {
    return (
      <div className="nav">
        <p className="nav-note">{L('כדי לנווט צריך לדעת איפה אתם.', 'To navigate from here we need to know where you are: allow the site to see your location, or choose it yourself.')}</p>
        {onSetLocation && (
          <button type="button" className="btn primary nav-setloc" onClick={onSetLocation}>📍 {L('בחירת המיקום שלי', 'Choose my location')}</button>
        )}
        {external}
      </div>
    );
  }

  return (
    <div className={`nav${navigating ? ' on' : ''}`}>
      <div className="modes" role="radiogroup" aria-label={L('איך מגיעים', 'How to get there')}>
        {TRAVEL_MODES.map((m) => (
          <button key={m.mode} type="button" role="radio" aria-checked={mode === m.mode} className="mode" onClick={() => onMode(m.mode)} disabled={navigating && mode !== m.mode}>
            {MODE_ICON[m.mode]}
            {lang === 'en' ? m.en : m.label}
          </button>
        ))}
      </div>

      <div className="nav-sum" aria-live="polite">
        {loading || !directions ? (
          loading ? <span className="nav-time">{L('מחשב מסלול…', 'Finding a route…')}</span> : (
            <span className="nav-noroute">
              {mode === 'driving' ? L('לא מצאנו מסלול מהמיקום שלך. אפשר לפתוח באפליקציית ניווט.', "We couldn't find a route from your location. Try a navigation app.") : L('אין מסלול מתאים בדרך הזו, אולי המקום רחוק מדי.', 'No suitable route this way. The place may be too far.')}
              {mode !== 'driving' && <button type="button" className="link" onClick={() => onMode('driving')}>{L('לחישוב ברכב', 'Try by car')}</button>}
            </span>
          )
        ) : (
          <>
            {directions.minutes < 60
              ? <span className="nav-time">{directions.minutes}<small> {L('דק׳', 'min')}</small></span>
              : <span className="nav-time long">{formatDuration(directions.minutes, lang)}</span>}
            <span className="nav-meta">
              {formatMeters(directions.meters, lang)}
              <br />
              {L('הגעה ב־', 'Arrive at ')}{eta(directions.minutes)}
            </span>
          </>
        )}
        {navigating ? (
          <button type="button" className="btn stop" onClick={onStop}>{L('סיום', 'Stop')}</button>
        ) : (
          <button type="button" className="btn go-btn" onClick={onStart} disabled={!directions}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l14-7-5 15-2-6z" /></svg>
            {L('יציאה לדרך', 'Start')}
          </button>
        )}
      </div>

      {directions && directions.steps.length > 0 && (
        <details className="steps" open={navigating}>
          <summary>{L(`${directions.steps.length} שלבים בדרך`, `${directions.steps.length} steps on the way`)}</summary>
          <ol>
            {directions.steps.map((s, i) => (
              <li key={i} className={navigating && i === stepIndex ? 'cur' : navigating && i < stepIndex ? 'done' : undefined}>
                <TurnArrow step={s} />
                <span className="ins">{s.instruction}</span>
                <span className="d">
                  {navigating && i === stepIndex && toNext !== null ? formatMeters(toNext, lang) : s.distance > 0 ? formatMeters(s.distance, lang) : ''}
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
export function NavBanner({ step, toNext, onStop, onPrev, onNext, voice, onVoice }: { step: NavStep; toNext: number | null; onStop: () => void; onPrev?: () => void; onNext?: () => void; voice?: boolean; onVoice?: () => void }) {
  const L = useL();
  return (
    <div className="nav-banner" role="status" aria-live="polite">
      <span className="nb-arrow"><TurnArrow step={step} size={34} /></span>
      <span className="nb-text">
        {toNext !== null && <b>{formatMeters(toNext, L.lang)}</b>}
        <span>{step.instruction}</span>
      </span>
      {onPrev && <button type="button" className="nb-step" onClick={onPrev}>{L('הקודם', 'Back')}</button>}
      {onNext && <button type="button" className="nb-step" onClick={onNext}>{L('הבא', 'Next')}</button>}
      {onVoice && (
        <button type="button" onClick={onVoice} aria-pressed={voice} aria-label={voice ? L('השתקת ההנחיות הקוליות', 'Mute voice directions') : L('הפעלת הנחיות קוליות', 'Turn on voice directions')}>
          {voice ? '🔊' : '🔇'}
        </button>
      )}
      <button type="button" onClick={onStop} aria-label={L('סיום ניווט', 'Stop navigation')}>✕</button>
    </div>
  );
}
