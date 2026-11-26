import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// The whole map in one answer. The server keeps it for half an hour, so opening the map
// takes one quick download instead of twenty requests to the database.
// Filters (kosher, vegan...) come as ?k=2&v=1&g=1&x={"dairy":1}, and each filter mix is kept
// on its own, so a crowd of visitors asks the database once every half hour, not once each.
export const dynamic = 'force-dynamic';

const PAGE = 1000;
const EXTRA = new Set(['vegetarian', 'dairy_free', 'egg_free', 'peanut_free', 'nut_free', 'sesame_free', 'soy_free']);
const PARALLEL = 5;

const level = (v: string | null) => {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 9 ? n : undefined;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const k = level(q.get('k'));
  const v = level(q.get('v'));
  const g = level(q.get('g'));
  if (k === undefined || v === undefined || g === undefined) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  let extra: Record<string, number> | null = null;
  const x = q.get('x');
  if (x) {
    try {
      const parsed = JSON.parse(x) as Record<string, unknown>;
      // only the real filters, so made-up keys can't skip the cache and load the database
      const entries = Object.entries(parsed).filter(([key, val]) => EXTRA.has(key) && Number.isInteger(val) && (val as number) >= 0 && (val as number) <= 9);
      if (entries.length !== Object.keys(parsed).length || entries.length > 10) throw new Error('bad');
      extra = entries.length ? Object.fromEntries(entries) as Record<string, number> : null;
    } catch {
      return NextResponse.json({ error: 'bad request' }, { status: 400 });
    }
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const page = async (from: number) => {
    const { data, error } = await sb
      .rpc('map_points', {
        p_min_kosher: k,
        p_min_vegan: v,
        p_min_gluten_free: g,
        p_query: null,
        ...(extra ? { p_extra: extra } : {}),
      })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    return data ?? [];
  };
  try {
    const all: unknown[] = [];
    for (let from = 0; from < 100_000; from += PAGE * PARALLEL) {
      const batch = await Promise.all(Array.from({ length: PARALLEL }, (_, i) => page(from + i * PAGE)));
      for (const rows of batch) all.push(...rows);
      if (batch.some((rows) => rows.length < PAGE)) break;
    }
    // Keep the answer small: the host refuses answers over 4.5 MB, and 20,000 places came close.
    // Coordinates to 5 decimals (about one metre), and "false"/empty fields left out (the map reads them as false).
    const slim = (all as Array<Record<string, unknown>>).map((p) => {
      const o: Record<string, unknown> = {
        id: p.id, name: p.name, place_type: p.place_type,
        lat: Math.round((p.lat as number) * 1e5) / 1e5,
        lng: Math.round((p.lng as number) * 1e5) / 1e5,
        seals: ((p.seals as Array<Record<string, unknown>>) ?? []).map((s) => {
          const c: Record<string, unknown> = { need: s.need, level: s.level };
          if (s.imported) c.imported = true;
          if (s.expired) c.expired = true;
          return c;
        }),
      };
      if (Array.isArray(p.cuisine) && p.cuisine.length) o.cuisine = p.cuisine;
      if (p.pending) o.pending = true;
      return o;
    });
    return NextResponse.json(slim, { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
