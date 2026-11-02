-- Okeat — the whole-country map must load even with many details.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
-- map_points() reads each place's details in one pass instead of one query per place,
-- and reading the map gets more time before the database gives up.

create or replace function map_points(
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_cuisine text default null,
  p_extra jsonb default null
)
returns table (id uuid, name text, place_type text, lat double precision, lng double precision,
               cuisine text[], seals jsonb, pending boolean)
language sql
stable
as $$
  with sealed as (
    select c.place_id,
           jsonb_agg(jsonb_build_object(
             'need', c.need, 'level', c.level,
             'imported', c.source in ('osm', 'auto') and c.confirm_count = 0,
             'expired', coalesce(k.valid_until < current_date, false)
           ) order by c.need) as list
      from claims c
      left join kosher_certificates k on k.claim_id = c.id
     where c.status = 'verified'
     group by c.place_id
  ),
  waiting as (
    select distinct c.place_id from claims c where c.status = 'pending'
  )
  select
    p.id, p.name, p.place_type,
    st_y(p.location::geometry), st_x(p.location::geometry),
    p.cuisine,
    coalesce(s.list, '[]'::jsonb),
    w.place_id is not null
  from places p
  left join sealed s on s.place_id = p.id
  left join waiting w on w.place_id = p.id
  where not p.removed
    and (p_query is null or p.name ilike '%' || p_query || '%')
    and (p_cuisine is null or p.cuisine @> array[p_cuisine] or p.place_type = p_cuisine)
    and (p_min_kosher is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'kosher' and e.rank >= p_min_kosher))
    and (p_min_vegan is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'vegan' and e.rank >= p_min_vegan))
    and (p_min_gluten_free is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'gluten_free' and e.rank >= p_min_gluten_free))
    and (p_extra is null or not exists (
          select 1 from jsonb_each_text(p_extra) f
           where not exists (select 1 from effective_claims e
                              where e.place_id = p.id and e.need::text = f.key and e.rank >= f.value::int)))
  order by p.id
$$;

alter role anon set statement_timeout = '20s';
alter role authenticated set statement_timeout = '20s';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
