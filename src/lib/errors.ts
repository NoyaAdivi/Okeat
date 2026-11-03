import type { Lang } from './lang';

/** Turn database and network errors into something a person can act on, in the page language. */
export function friendly(e: unknown, lang: Lang = 'he'): string {
  if (lang === 'en') return friendlyEn(e);
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : '';

  if (msg.toLowerCase().includes('anonymous sign-ins are disabled'))
    return 'צריך להתחבר עם חשבון (Google או מייל).';
  if (msg.includes('certificate photo')) return 'בחרו מי נותן את ההשגחה (אפשר גם "לא ידוע").';
  if (msg.includes('Too many new places')) return 'הוספת הרבה מקומות היום. אפשר להמשיך מחר.';
  if (msg.includes('Too many requests')) return 'יותר מדי בקשות היום. נסו שוב מחר.';
  if (msg.includes('Moderators only') || msg.includes('Admins only')) return 'הפעולה הזו רק למאשרי קהילה ולמנהלים.';
  if (msg.includes('must start with https')) return 'הקישור צריך להתחיל ב-https://';
  if (msg.includes('duplicate key') && msg.includes('place_reports')) return 'כבר דיווחת על המקום הזה. תודה!';
  if (msg.includes('A place needs a name')) return 'צריך שם למקום.';
  if (msg.includes('Others already rely')) return 'אחרים כבר אישרו את זה, אז אי אפשר למחוק. אפשר לכתוב לנו ביצירת קשר.';
  if (msg.includes('Sign in with an account')) return 'צריך להתחבר עם חשבון (Google או מייל).';
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

const HE_TO_EN: [string, string][] = [
  ['לא הצלחנו לקרוא את התעודה', "We couldn't read the certificate."],
  ['כבר הצבעת על זה', 'You already voted on this.'],
  ['התמונה גדולה מ-5MB', 'The photo is larger than 5MB. Please take it again.'],
];

function friendlyEn(e: unknown): string {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === 'object' && e !== null && 'message' in e
        ? String((e as { message: unknown }).message)
        : '';
  if (msg.toLowerCase().includes('anonymous sign-ins are disabled')) return 'Please sign in with an account (Google or email).';
  if (msg.includes('certificate photo')) return 'Choose who supervises the place (or "unknown").';
  if (msg.includes('Too many new places')) return 'You added a lot of places today. You can continue tomorrow.';
  if (msg.includes('Too many requests')) return 'Too many requests today. Try again tomorrow.';
  if (msg.includes('Moderators only') || msg.includes('Admins only')) return 'Only community moderators and admins can do this.';
  if (msg.includes('A place needs a name')) return 'A place needs a name.';
  if (msg.includes('Others already rely')) return 'Others already confirmed this, so it cannot be deleted. You can write to us on the contact page.';
  if (msg.includes('must start with https')) return 'The link must start with https://';
  if (msg.includes('duplicate key') && msg.includes('place_reports')) return 'You already reported this place. Thanks!';
  if (msg.includes('A place needs a name')) return 'צריך שם למקום.';
  if (msg.includes('Others already rely')) return 'אחרים כבר אישרו את זה, אז אי אפשר למחוק. אפשר לכתוב לנו ביצירת קשר.';
  if (msg.includes('Sign in with an account')) return 'Sign in with an account (Google or e-mail).';
  if (msg.includes('claim you proposed')) return 'You added this yourself. Other people need to confirm it.';
  if (msg.includes('claim is closed')) return 'This suggestion is already closed.';
  if (msg.includes('already expired')) return 'The certificate has expired. Only a valid certificate can be added.';
  if (msg.includes('Sign in')) return 'Please sign in.';
  if (msg.includes('Invalid image path')) return 'Something went wrong uploading the photo. Please take it again.';
  if (msg.includes('row-level security')) return "You don't have permission to do this. Try signing in again.";
  if (msg.includes('check constraint')) return 'One of the fields is not valid. Please check the details.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'No connection. Please try again.';
  const known = HE_TO_EN.find(([he]) => msg.includes(he));
  if (known) return known[1];
  if (msg && !/[\u0590-\u05FF]/.test(msg) && msg.length < 160) return msg;
  return 'Something went wrong. Please try again in a moment.';
}
