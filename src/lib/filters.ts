import { TWO_LEVEL_NEEDS } from './claims';
import type { Need } from './types';

// Minimum-rank options per need. Ranks mirror level_rank() in SQL.
export const FILTER_OPTIONS = {
  kosher: [
    { label: 'כל השגחה', en: 'Any supervision', min: 0 },
    { label: 'רבנות ומעלה', en: 'Rabbinate and up', min: 1 },
    { label: 'מהדרין ומעלה', en: 'Mehadrin and up', min: 2 },
    { label: 'בד״ץ', en: 'Badatz', min: 3 },
  ],
  vegan: [
    { label: 'יש מנות', en: 'Has vegan dishes', min: 1 },
    { label: 'טבעוני לגמרי', en: 'Fully vegan', min: 2 },
  ],
  gluten_free: [
    { label: 'יש תפריט', en: 'Has a menu', min: 1 },
    { label: 'מטבח נפרד', en: 'Separate kitchen', min: 2 },
  ],
  ...Object.fromEntries(TWO_LEVEL_NEEDS.map((n) => [n, [
    { label: 'יש מנות', en: 'Has dishes', min: 1 },
    { label: 'כל המקום', en: 'The whole place', min: 2 },
  ]])),
} as Record<Need, { label: string; en: string; min: number }[]>;
