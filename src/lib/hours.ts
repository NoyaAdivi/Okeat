import type { WeeklyHours } from './types';

const TZ = 'Asia/Jerusalem';
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Current weekday (0 = Sunday) and minutes since midnight in Israel time. */
function israelNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { day: WEEKDAY[get('weekday')], minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const rangesFor = (hours: WeeklyHours, day: number) => hours[String(day) as keyof WeeklyHours];

export function isOpen(hours: WeeklyHours | null, now = new Date()): boolean {
  if (!hours) return false;
  const { day, minutes } = israelNow(now);
  return (rangesFor(hours, day) ?? []).some(([a, b]) => minutes >= toMin(a) && minutes < toMin(b));
}

/** "פתוח עד 22:00", "סגור, נפתח מחר ב-08:00", "סגור, נפתח במוצאי שבת ב-19:30" */
export function openStatus(hours: WeeklyHours | null, now = new Date()): { open: boolean; text: string } {
  if (!hours) return { open: false, text: 'שעות פתיחה עוד לא נוספו' };
  const { day, minutes } = israelNow(now);

  const current = (rangesFor(hours, day) ?? []).find(([a, b]) => minutes >= toMin(a) && minutes < toMin(b));
  if (current) return { open: true, text: `פתוח עד ${current[1]}` };

  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    const next = (rangesFor(hours, d) ?? []).find(([a]) => i > 0 || toMin(a) > minutes);
    if (!next) continue;
    let when = i === 0 ? 'היום' : i === 1 ? 'מחר' : `ביום ${DAYS[d]}`;
    if (d === 6 && toMin(next[0]) >= 18 * 60) when = 'במוצאי שבת';
    return { open: false, text: `סגור, נפתח ${when} ב-${next[0]}` };
  }
  return { open: false, text: 'סגור' };
}
