-- Okeat — numbers on the home page (run once in Supabase → SQL Editor → Run; safe to run again)
-- One number per need, always live: a new place or a confirmation counts on the next read.
create or replace function site_stats_full()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object('places', (select count(*) from places where not removed))
    || coalesce((
      select jsonb_object_agg(n.need, n.total)
        from (
          select c.need::text as need, count(distinct c.place_id) as total
            from claims c
            join places p on p.id = c.place_id
           where c.status = 'verified' and not p.removed
           group by c.need
        ) n
    ), '{}'::jsonb)
    -- every need appears, with 0 until someone adds it
    || coalesce((select jsonb_object_agg(e.need, 0) from unnest(enum_range(null::need)) as e(need)
         where not exists (select 1 from claims c where c.need = e.need and c.status = 'verified')), '{}'::jsonb)
$$;

grant execute on function site_stats_full() to anon, authenticated;
notify pgrst, 'reload schema';
