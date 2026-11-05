import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// The whole map in one answer. The server keeps it for a few minutes, so opening the map
// takes one quick download instead of twenty requests to the database.
export const dynamic = 'force-dynamic';

const PAGE = 1000;
const PARALLEL = 5;

export async function GET() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const page = async (from: number) => {
    const { data, error } = await sb
      .rpc('map_points', { p_min_kosher: null, p_min_vegan: null, p_min_gluten_free: null, p_query: null })
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
    return NextResponse.json(all, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
