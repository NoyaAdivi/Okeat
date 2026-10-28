/** Turn database and network errors into something a person can act on, in Hebrew. */
export function friendly(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : '';

  if (msg.toLowerCase().includes('anonymous sign-ins are disabled'))
    return 'הוספה בלי הרשמה עוד לא הופעלה. ב-Supabase צריך להפעיל Allow anonymous sign-ins.';
  if (msg.includes('certificate photo')) return 'כשרות נוספת רק עם צילום של התעודה.';
  if (msg.includes('claim you proposed')) return 'הוספת את זה בעצמך. אנשים אחרים צריכים לאשר.';
  if (msg.includes('claim is closed')) return 'ההצעה הזו כבר נסגרה.';
  if (msg.includes('already expired')) return 'התעודה כבר פגה. אפשר להוסיף רק תעודה בתוקף.';
  if (msg.includes('Sign in')) return 'צריך להתחבר.';
  if (msg.includes('Invalid image path')) return 'משהו השתבש בהעלאת התמונה. צלמו שוב.';
  if (msg.includes('row-level security')) return 'אין הרשאה לפעולה הזו. נסו להתחבר מחדש.';
  if (msg.includes('check constraint')) return 'אחד השדות לא תקין. בדקו את הפרטים.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'אין חיבור לרשת. נסו שוב.';
  if (/[֐-׿]/.test(msg)) return msg; // already Hebrew, from our own code
  return 'משהו השתבש. נסו שוב בעוד רגע.';
}
