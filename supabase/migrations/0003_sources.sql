-- =====================================================================
-- Okeat — where information came from
-- * claims.source: 'community' (people added it) or 'osm' (imported from
--   OpenStreetMap). Imported claims are shown, and labelled as imported,
--   until the community confirms them.
-- * New kosher level 'marked' (rank 0): "marked as kosher, no certificate
--   photo yet". Only used for imported places.
-- * Claims JSON now includes `source`.
-- =====================================================================

alter table claims add column if not exists source text not null default 'community'
  check (source in ('community', 'osm'));

create or replace function level_rank(n need, l text)
returns int
language sql
immutable
as $$
  select case n
    when 'kosher' then case l
      when 'marked' then 0 when 'pikuach' then 0
      when 'rabanut' then 1 when 'mehadrin' then 2 when 'badatz' then 3 end
    when 'vegan' then case l when 'options' then 1 when 'full' then 2 end
    when 'gluten_free' then case l when 'menu' then 1 when 'kitchen' then 2 end
  end
$$;

-- People can't propose 'marked' kosher themselves: kosher from people needs a certificate.
create or replace function block_marked_kosher()
returns trigger language plpgsql as $$
begin
  if new.need = 'kosher' and new.level = 'marked' and new.source <> 'osm' then
    raise exception 'Kosher claims need a certificate photo';
  end if;
  return new;
end;
$$;
drop trigger if exists claims_block_marked on claims;
create trigger claims_block_marked before insert on claims
  for each row execute function block_marked_kosher();

-- RLS: people insert community claims only.
drop policy if exists "signed-in users propose non-kosher claims" on claims;
create policy "signed-in users propose non-kosher claims" on claims for insert
  to authenticated with check (
    proposed_by = auth.uid()
    and status = 'pending'
    and source = 'community'
    and confirm_count = 0 and reject_count = 0
    and need <> 'kosher'
  );

-- A kosher claim counts for filtering if its certificate is valid, or if it
-- was imported (no certificate, level 'marked', rank 0).
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

create or replace function nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 1500,
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_limit int default 150
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
  claims jsonb
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  ),
  effective as (
    select c.place_id, c.need, level_rank(c.need, c.level) as rank
      from claims c
      left join kosher_certificates k on k.claim_id = c.id
     where c.status = 'verified'
       and (c.need <> 'kosher' or k.valid_until >= current_date or (k.claim_id is null and c.source = 'osm'))
  )
  select
    p.id, p.name, p.place_type, p.address,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    st_distance(p.location, o.g) as distance_m,
    p.hours,
    place_claims(p.id) as claims
  from places p, origin o
  where st_dwithin(p.location, o.g, p_radius_m)
    and (p_query is null or p.name ilike '%' || p_query || '%' or p.place_type ilike '%' || p_query || '%')
    and (p_min_kosher is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'kosher' and e.rank >= p_min_kosher))
    and (p_min_vegan is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'vegan' and e.rank >= p_min_vegan))
    and (p_min_gluten_free is null or exists (
          select 1 from effective e where e.place_id = p.id and e.need = 'gluten_free' and e.rank >= p_min_gluten_free))
  order by distance_m
  limit p_limit
$$;

grant execute on function nearby_places(double precision, double precision, int, int, int, int, text, int) to anon, authenticated;

-- Anyone can see the community queue. Contributions use Supabase anonymous
-- sign-in, so every visitor still has their own id and votes once per claim.
grant execute on function pending_claims_near(double precision, double precision, int) to anon, authenticated;
