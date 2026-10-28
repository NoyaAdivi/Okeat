-- =====================================================================
-- Meushar — app support
-- * place_by_id(): one place in the same shape as nearby_places(),
--   for the shareable /place/[id] page and deep links.
-- * Rate limit for the certificate reader (it calls a paid API).
-- =====================================================================

-- Claims of one place as JSON, same shape nearby_places() returns.
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

-- distance_m is null unless a point is given.
create or replace function place_by_id(
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
  claims jsonb
)
language sql
stable
as $$
  select p.id, p.name, p.place_type, p.address,
         st_y(p.location::geometry),
         st_x(p.location::geometry),
         case when p_lat is null or p_lng is null then null
              else st_distance(p.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) end,
         p.hours,
         place_claims(p.id)
    from places p
   where p.id = p_id
$$;

grant execute on function place_claims(uuid) to anon, authenticated;
grant execute on function place_by_id(uuid, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Certificate reader rate limit: 20 reads per user per hour.
-- The table has RLS on and no policies, so it's only reachable through
-- log_extraction(), which runs as the table owner.
-- ---------------------------------------------------------------------
create table extraction_log (
  id          bigserial primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index extraction_log_user_time on extraction_log (user_id, created_at desc);
alter table extraction_log enable row level security;

create or replace function extraction_limit() returns int language sql immutable as $$ select 20 $$;

-- Returns true and records the read if the caller is under the limit.
create or replace function log_extraction()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return false;
  end if;
  select count(*) into n
    from extraction_log
   where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if n >= extraction_limit() then
    return false;
  end if;
  insert into extraction_log (user_id) values (auth.uid());
  return true;
end;
$$;

grant execute on function log_extraction() to authenticated;
