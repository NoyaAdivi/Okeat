'use client';

import type { WeeklyHours } from '@/lib/types';
import { useL } from './LangProvider';
import { isOpen } from '@/lib/hours';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function todayInIsrael(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** The week, Sunday to Saturday, with today highlighted. */
export default function HoursTable({ hours }: { hours: WeeklyHours | null }) {
  const L = useL();
  if (!hours) {
    return <p className="hours-none">{L('עוד אין לנו את שעות הפתיחה של המקום. כדאי לבדוק לפני שמגיעים.', "We don't have this place's opening hours yet. It's worth checking before you go.")}</p>;
  }
  const today = todayInIsrael();
  const open = isOpen(hours);
  return (
    <table className="hours">
      <tbody>
        {(L.lang === 'en' ? DAYS_EN : DAYS).map((d, i) => {
          const r = hours[String(i) as keyof WeeklyHours];
          const text = r === undefined ? L('לא ידוע', 'Unknown') : r.length === 0 ? L('סגור', 'Closed') : r.map(([a, b]) => `${a}–${b === '23:59' ? '24:00' : b}`).join(', ');
          return (
            <tr key={d} className={i === today ? 'today' : undefined} aria-current={i === today ? 'date' : undefined}>
              <th scope="row">{d}</th>
              <td dir="ltr">{text}</td>
              <td className="now">{i === today ? (open ? <span className="st-open">{L('פתוח עכשיו', 'Open now')}</span> : <span className="closed">{L('סגור עכשיו', 'Closed now')}</span>) : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
