-- =====================================================================
-- Okeat — whole-country map
-- * map_points(): every place in Israel that matches the filters, in a light
--   shape for the clustered map (details load when a place is opened).
-- * site_stats(): the numbers on the home page.
-- =====================================================================

create or replace function map_points(
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null
)
returns table (
  id uuid,
  name text,
  place_type text,
  lat double precision,
  lng double precision,
  seals jsonb,
  pending boolean
)
language sql
stable
as $$
  with effective as (
    select c.place_id, c.need, level_rank(c.need, c.level) as rank
      from claims c
      left join kosher_certificates k on k.claim_id = c.id
     where c.status = 'verified'
       and (c.need <> 'kosher' or k.valid_until >= current_date or (k.claim_id is null and c.source = 'osm'))
  )
  select
    p.id, p.name, p.place_type,
    st_y(p.location::geometry), st_x(p.location::geometry),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'need', c.need,
               'level', c.level,
               'imported', c.source = 'osm' and c.confirm_count = 0,
               'expired', coalesce(k.valid_until < current_date, false)
             ) order by c.need)
        from claims c
        left join kosher_certificates k on k.claim_id = c.id
       where c.place_id = p.id and c.status = 'verified'
    ), '[]'::jsonb),
    exists (select 1 from claims c where c.place_id = p.id and c.status = 'pending')
  from places p
  where (p_query is null or p.name ilike '%' || p_query || '%')
    and (p_min_kosher is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'kosher' and e.rank >= p_min_kosher))
    and (p_min_vegan is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'vegan' and e.rank >= p_min_vegan))
    and (p_min_gluten_free is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'gluten_free' and e.rank >= p_min_gluten_free))
  -- stable order so the app can load the rows in pages of 1000
  order by p.id
$$;

create or replace function site_stats()
returns table (places bigint, kosher bigint, vegan bigint, gluten_free bigint)
language sql
stable
as $$
  select
    (select count(*) from places),
    (select count(distinct place_id) from claims where status = 'verified' and need = 'kosher'),
    (select count(distinct place_id) from claims where status = 'verified' and need = 'vegan'),
    (select count(distinct place_id) from claims where status = 'verified' and need = 'gluten_free')
$$;

create index if not exists claims_place_status_idx on claims (place_id, status);

grant execute on function map_points(int, int, int, text) to anon, authenticated;
grant execute on function site_stats() to anon, authenticated;

-- make the API see the new functions right away
notify pgrst, 'reload schema';
