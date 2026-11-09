import Link from 'next/link';
import { MAIN_NEEDS, NEED_CLASS } from '@/lib/claims';
import { CUISINES } from '@/lib/cuisine';
import { NEED_EMOJI } from '@/lib/emoji';
import { needLabel, type Need } from '@/lib/types';
import type { Lang } from '@/lib/lang';

/** The kinds of food offered as quick filters on the city pages. */
export const LIST_FOODS = ['pizza', 'burger', 'sushi', 'coffee_shop', 'hummus', 'falafel', 'shawarma', 'schnitzel', 'meat', 'bakery', 'dessert', 'ice_cream', 'asian', 'italian', 'fish', 'breakfast'];

interface Props {
  /** where the links go, without the query */
  base: string;
  need: Need | null;
  food: string | null;
  lang: Lang;
  /** hide the need row, e.g. on a page that is about one need */
  needs?: boolean;
  /** query kept on every link, e.g. a level */
  keep?: Record<string, string>;
}

/** Filters as links, so they work on pages the server builds: a need row and a food row. */
export default function ListFilters({ base, need, food, lang, needs = true, keep = {} }: Props) {
  const href = (n: Need | null, f: string | null) => {
    const q = new URLSearchParams(keep);
    if (n) q.set('need', n);
    if (f) q.set('food', f);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const he = lang !== 'en';
  return (
    <nav className="list-filters" aria-label={he ? 'סינון' : 'Filters'}>
      {needs && (
        <div className="lf-needs">
          <Link href={href(null, food)} scroll={false} aria-current={need === null ? 'true' : undefined} className="lf-need all">
            <span aria-hidden="true">✨</span> {he ? 'הכול' : 'All'}
          </Link>
          {MAIN_NEEDS.map((n) => (
            <Link key={n} href={href(need === n ? null : n, food)} scroll={false} aria-current={need === n ? 'true' : undefined} className={`lf-need ${NEED_CLASS[n]}`}>
              <span aria-hidden="true">{NEED_EMOJI[n]}</span> {needLabel(n, lang)}
            </Link>
          ))}
        </div>
      )}
      <div className="lf-foods">
        {LIST_FOODS.map((c) => (
          <Link key={c} href={href(need, food === c ? null : c)} scroll={false} aria-current={food === c ? 'true' : undefined} className="lf-food">
            <span aria-hidden="true">{CUISINES[c].emoji}</span> {he ? CUISINES[c].label : CUISINES[c].en}
          </Link>
        ))}
      </div>
    </nav>
  );
}
