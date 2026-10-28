import type { WeeklyHours } from '@/lib/types';
import { isOpen } from '@/lib/hours';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function todayInIsrael(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** The week, Sunday to Saturday, with today highlighted. */
export default function HoursTable({ hours }: { hours: WeeklyHours | null }) {
  if (!hours) {
    return <p className="hours-none">עוד אין לנו את שעות הפתיחה של המקום. כדאי לבדוק לפני שמגיעים.</p>;
  }
  const today = todayInIsrael();
  const open = isOpen(hours);
  return (
    <table className="hours">
      <tbody>
        {DAYS.map((d, i) => {
          const r = hours[String(i) as keyof WeeklyHours];
          const text = r === undefined ? 'לא ידוע' : r.length === 0 ? 'סגור' : r.map(([a, b]) => `${a}–${b === '23:59' ? '24:00' : b}`).join(', ');
          return (
            <tr key={d} className={i === today ? 'today' : undefined} aria-current={i === today ? 'date' : undefined}>
              <th scope="row">{d}</th>
              <td dir="ltr">{text}</td>
              <td className="now">{i === today ? (open ? <span className="st-open">פתוח עכשיו</span> : <span className="closed">סגור עכשיו</span>) : null}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
