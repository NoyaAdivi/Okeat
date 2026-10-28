-- =====================================================================
-- Okeat — place details and food categories
-- * places.cuisine (e.g. {pizza,italian}), cuisine_source ('osm' | 'auto'),
--   phone, website.
-- * claims.source may also be 'auto': guessed from the place's name,
--   shown as unconfirmed until people confirm it.
-- * Cuisine filter in map_points() and nearby_places(); the new fields in
--   nearby_places() and place_by_id().
-- Run this once in the Supabase SQL Editor (it includes 0004).
-- =====================================================================

alter table places add column if not exists cuisine text[];
alter table places add column if not exists cuisine_source text check (cuisine_source in ('osm', 'auto', 'community'));
alter table places add column if not exists phone text;
alter table places add column if not exists website text;
create index if not exists places_cuisine_idx on places using gin (cuisine);
create index if not exists claims_place_status_idx on claims (place_id, status);

alter table claims drop constraint if exists claims_source_check;
alter table claims add constraint claims_source_check check (source in ('community', 'osm', 'auto'));

-- Imported or guessed kosher ('marked') is fine; people need a certificate.
create or replace function block_marked_kosher()
returns trigger language plpgsql as $$
begin
  if new.need = 'kosher' and new.level = 'marked' and new.source not in ('osm', 'auto') then
    raise exception 'Kosher claims need a certificate photo';
  end if;
  return new;
end;
$$;

-- A verified claim that counts for filtering.
create or replace view effective_claims with (security_invoker = true) as
  select c.place_id, c.need, level_rank(c.need, c.level) as rank
    from claims c
    left join kosher_certificates k on k.claim_id = c.id
   where c.status = 'verified'
     and (c.need <> 'kosher' or k.valid_until >= current_date or (k.claim_id is null and c.source in ('osm', 'auto')));

-- Claims JSON: "imported" also covers automatic guesses.
create or replace function place_claims(p_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'need', c.need,
           'level', c.level,
           'status', c.status,
           'source', c.source,
           'note', c.note,
           'confirmCount', c.confirm_count,
           'lastConfirmedAt', c.last_confirmed_at,
           'proposedAt', c.proposed_at,
           'certificate', case when k.claim_id is null then null else jsonb_build_object(
             'imagePath', k.image_path,
             'supervisingBody', k.supervising_body,
             'validUntil', k.valid_until,
             'photographedAt', k.photographed_at,
             'expired', k.valid_until < current_date
           ) end
         ) order by c.need), '[]'::jsonb)
    from claims c
    left join kosher_certificates k on k.claim_id = c.id
   where c.place_id = p_id and c.status in ('verified', 'pending', 'disputed')
$$;

-- ---------------------------------------------------------------------
-- Return shapes change, so the old versions are dropped first.
-- ---------------------------------------------------------------------
drop function if exists map_points(int, int, int, text);
drop function if exists map_points(int, int, int, text, text);
drop function if exists nearby_places(double precision, double precision, int, int, int, int, text, int);
drop function if exists nearby_places(double precision, double precision, int, int, int, int, text, int, text);
drop function if exists place_by_id(uuid, double precision, double precision);

create function map_points(
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_cuisine text default null
)
returns table (
  id uuid,
  name text,
  place_type text,
  lat double precision,
  lng double precision,
  cuisine text[],
  seals jsonb,
  pending boolean
)
language sql
stable
as $$
  select
    p.id, p.name, p.place_type,
    st_y(p.location::geometry), st_x(p.location::geometry),
    p.cuisine,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'need', c.need,
               'level', c.level,
               'imported', c.source in ('osm', 'auto') and c.confirm_count = 0,
               'expired', coalesce(k.valid_until < current_date, false)
             ) order by c.need)
        from claims c
        left join kosher_certificates k on k.claim_id = c.id
       where c.place_id = p.id and c.status = 'verified'
    ), '[]'::jsonb),
    exists (select 1 from claims c where c.place_id = p.id and c.status = 'pending')
  from places p
  where (p_query is null or p.name ilike '%' || p_query || '%')
    and (p_cuisine is null or p.cuisine @> array[p_cuisine] or p.place_type = p_cuisine)
    and (p_min_kosher is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'kosher' and e.rank >= p_min_kosher))
    and (p_min_vegan is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'vegan' and e.rank >= p_min_vegan))
    and (p_min_gluten_free is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'gluten_free' and e.rank >= p_min_gluten_free))
  order by p.id
$$;

create function nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 1500,
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_limit int default 150,
  p_cuisine text default null
)
returns table (
  id uuid,
  name text,
  place_type text,
  address text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  hours jsonb,
  cuisine text[],
  cuisine_source text,
  phone text,
  website text,
  claims jsonb
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select
    p.id, p.name, p.place_type, p.address,
    st_y(p.location::geometry), st_x(p.location::geometry),
    st_distance(p.location, o.g),
    p.hours, p.cuisine, p.cuisine_source, p.phone, p.website,
    place_claims(p.id)
  from places p, origin o
  where st_dwithin(p.location, o.g, p_radius_m)
    and (p_query is null or p.name ilike '%' || p_query || '%')
    and (p_cuisine is null or p.cuisine @> array[p_cuisine] or p.place_type = p_cuisine)
    and (p_min_kosher is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'kosher' and e.rank >= p_min_kosher))
    and (p_min_vegan is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'vegan' and e.rank >= p_min_vegan))
    and (p_min_gluten_free is null or exists (
          select 1 from effective_claims e where e.place_id = p.id and e.need = 'gluten_free' and e.rank >= p_min_gluten_free))
  order by st_distance(p.location, o.g)
  limit p_limit
$$;

create function place_by_id(
  p_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (
  id uuid,
  name text,
  place_type text,
  address text,
  lat double precision,
  lng double precision,
  distance_m double precision,
  hours jsonb,
  cuisine text[],
  cuisine_source text,
  phone text,
  website text,
  claims jsonb
)
language sql
stable
as $$
  select p.id, p.name, p.place_type, p.address,
         st_y(p.location::geometry), st_x(p.location::geometry),
         case when p_lat is null or p_lng is null then null
              else st_distance(p.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) end,
         p.hours, p.cuisine, p.cuisine_source, p.phone, p.website,
         place_claims(p.id)
    from places p
   where p.id = p_id
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

grant select on effective_claims to anon, authenticated;
grant execute on function map_points(int, int, int, text, text) to anon, authenticated;
grant execute on function nearby_places(double precision, double precision, int, int, int, int, text, int, text) to anon, authenticated;
grant execute on function place_by_id(uuid, double precision, double precision) to anon, authenticated;
grant execute on function site_stats() to anon, authenticated;

notify pgrst, 'reload schema';
