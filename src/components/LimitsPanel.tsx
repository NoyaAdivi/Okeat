'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchLimits, type Limits } from '@/lib/places';
import { friendly } from '@/lib/errors';
import { useL } from './LangProvider';

const MB = 1024 * 1024;

interface Gauge { name: string; used: number; limit: number; unit?: string; note?: string }

/** One row: how much was used, how much is left, in a bar that warms up as it fills. */
function Meter({ name, used, limit, unit = '', note }: Gauge) {
  const L = useL();
  const share = Math.min(1, used / limit);
  const tone = share > 0.9 ? 'full' : share > 0.7 ? 'warm' : 'calm';
  const left = Math.max(0, limit - used);
  return (
    <li className={`meter ${tone}`}>
      <div className="meter-head">
        <b>{name}</b>
        <span>{L(`נשארו ${left.toLocaleString()}${unit}`, `${left.toLocaleString()}${unit} left`)}</span>
      </div>
      <div className="meter-bar" role="img" aria-label={L(`${used} מתוך ${limit}`, `${used} of ${limit}`)}><i style={{ inlineSize: `${Math.max(2, share * 100)}%` }} /></div>
      <small>{L(`${used.toLocaleString()}${unit} מתוך ${limit.toLocaleString()}${unit}`, `${used.toLocaleString()}${unit} of ${limit.toLocaleString()}${unit}`)}{note && ` ${note}`}</small>
    </li>
  );
}

/** For the admin: every limit of the free services, and how close the site is to it. */
export default function LimitsPanel({ sb }: { sb: SupabaseClient }) {
  const L = useL();
  const [data, setData] = useState<Limits | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchLimits(sb).then(setData).catch((e) => setError(friendly(e, L.lang))); }, [sb]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h2>{L('מכסות ושימוש', 'Limits and usage')}</h2>
      {error && <p className="warnbox">{error}</p>}
      {!data && !error && <p className="muted">{L('טוען…', 'Loading…')}</p>}
      {data && (
        <>
          <ul className="profile-stats dash-stats">
            <li><b>{data.signInsToday}</b><span>{L('התחברו היום', 'signed in today')}</span></li>
            <li><b>{data.signUpsToday}</b><span>{L('נרשמו היום', 'signed up today')}</span></li>
            <li><b>{data.signInsWeek}</b><span>{L('התחברו ב-7 ימים', 'signed in, 7 days')}</span></li>
          </ul>

          <h3>{L('מיילי התחברות', 'Sign-in emails')}</h3>
          <p className="muted small">{L('כניסה עם Google לא נספרת כאן, ואין לה מכסה כזו.', "Signing in with Google isn't counted here and has no such limit.")}</p>
          <ul className="meters">
            <Meter name={L('בשעה הזו', 'This hour')} used={data.mailHour} limit={100} note={L('(הגדרה שלך ב-Supabase)', '(your Supabase setting)')} />
            <Meter name={L('היום', 'Today')} used={data.mailDay} limit={500} note={L('(בערך, לפי Gmail)', '(about, set by Gmail)')} />
          </ul>
          <p className="muted small">{L(`השבוע נשלחו ${data.mailWeek} מיילים, וב-30 הימים האחרונים ${data.mailMonth}.`, `${data.mailWeek} emails this week and ${data.mailMonth} in the last 30 days.`)}</p>

          <h3>{L('מסד נתונים ומשתמשים', 'Database and users')}</h3>
          <ul className="meters">
            <Meter name={L('נפח מסד הנתונים', 'Database size')} used={Math.round(data.dbBytes / MB)} limit={500} unit=" MB" />
            <Meter name={L('נפח התמונות', 'Photo storage')} used={Math.round(data.storageBytes / MB)} limit={1024} unit=" MB" />
            <Meter name={L('משתמשים פעילים בחודש', 'Monthly active users')} used={data.activeMonth} limit={50000} />
          </ul>

          <h3>{L('מכסות שרואים רק באתרים עצמם', 'Limits you can only see on their own sites')}</h3>
          <ul className="limit-links">
            <li><a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer"><b>Supabase</b> {L('תעבורה: 5 GB בחודש', 'Traffic: 5 GB a month')}</a></li>
            <li><a href="https://console.mapbox.com" target="_blank" rel="noopener noreferrer"><b>Mapbox</b> {L('טעינות מפה ומסלולים: לפי המכסה בחשבון', 'Map loads and routes: as shown in your account')}</a></li>
            <li><a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"><b>Vercel</b> {L('תעבורה ובנייה: לפי תוכנית Hobby', 'Traffic and builds: per the Hobby plan')}</a></li>
          </ul>
          <p className="muted small">{L('ספירת המיילים מתחילה מהיום שהעמוד הזה עלה לאתר. אם פרויקט ב-Supabase לא נפתח שבוע, הוא עלול להיעצר, אז כדאי להיכנס מדי פעם.', "Email counting starts from the day this page went live. A Supabase project with no activity for a week may pause, so visit it now and then.")}</p>
        </>
      )}
    </>
  );
}
