-- Okeat test environment: builds the whole database in a NEW, EMPTY Supabase project.
-- Never run this on the live project.

-- ===== 0001_init.sql =====
-- =====================================================================
-- Meushar (מאושר) — initial schema
-- Places, community-verified dietary claims, kosher certificates, votes.
-- Requires: Supabase (auth schema) + PostGIS.
-- =====================================================================

create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type need as enum ('kosher', 'vegan', 'gluten_free');

-- pending    -> waiting for community confirmations
-- verified   -> shown on the map
-- rejected   -> enough people said it's wrong while pending
-- disputed   -> was verified, then enough people reported it's no longer true
-- superseded -> replaced by a newer verified claim for the same place + need
create type claim_status as enum ('pending', 'verified', 'rejected', 'disputed', 'superseded');

-- ---------------------------------------------------------------------
-- Levels per need, as a rank (higher = stricter / safer).
-- kosher:      pikuach(0, private supervision, not "kosher" by law) < rabanut(1) < mehadrin(2) < badatz(3)
-- vegan:       options(1) < full(2)
-- gluten_free: menu(1, shared kitchen) < kitchen(2, separate kitchen, celiac-safe)
-- ---------------------------------------------------------------------
create or replace function level_rank(n need, l text)
returns int
language sql
immutable
as $$
  select case n
    when 'kosher' then case l when 'pikuach' then 0 when 'rabanut' then 1 when 'mehadrin' then 2 when 'badatz' then 3 end
    when 'vegan' then case l when 'options' then 1 when 'full' then 2 end
    when 'gluten_free' then case l when 'menu' then 1 when 'kitchen' then 2 end
  end
$$;

-- Tunable: confirmations needed to verify, rejections needed to reject/dispute.
create or replace function verify_threshold() returns int language sql immutable as $$ select 3 $$;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  -- needs the user personally has; later used to weight their votes
  -- (a celiac confirming "separate kitchen" is worth more)
  own_needs     need[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- auto-create a profile on sign-up
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------
create table places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 120),
  place_type  text not null default 'restaurant',
  address     text,
  location    geography(point, 4326) not null,
  -- weekly hours: {"0": [["08:00","17:00"]], "5": [["07:30","14:00"]], "6": []}
  -- keys are JS getDay() (0 = Sunday). Missing key = unknown, [] = closed.
  hours       jsonb,
  osm_id      bigint unique,           -- set when imported from OpenStreetMap
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index places_location_idx on places using gist (location);
create index places_name_idx on places using gin (to_tsvector('simple', name));

-- ---------------------------------------------------------------------
-- Claims: "place X is <need> at <level>"
-- ---------------------------------------------------------------------
create table claims (
  id                 uuid primary key default gen_random_uuid(),
  place_id           uuid not null references places (id) on delete cascade,
  need               need not null,
  level              text not null,
  status             claim_status not null default 'pending',
  note               text check (length(note) <= 300),
  confirm_count      int not null default 0,
  reject_count       int not null default 0,
  proposed_by        uuid references profiles (id) on delete set null,
  proposed_at        timestamptz not null default now(),
  verified_at        timestamptz,
  last_confirmed_at  timestamptz,
  constraint level_valid check (level_rank(need, level) is not null)
);

create index claims_place_idx on claims (place_id);
create index claims_status_idx on claims (status);
-- at most one verified claim per place + need
create unique index claims_one_verified on claims (place_id, need) where status = 'verified';

-- ---------------------------------------------------------------------
-- Kosher certificates (exactly one per kosher claim)
-- ---------------------------------------------------------------------
create table kosher_certificates (
  claim_id               uuid primary key references claims (id) on delete cascade,
  image_path             text not null,          -- path in the 'certificates' storage bucket
  supervising_body       text not null,
  business_name_on_cert  text,
  valid_until            date not null,
  extracted              jsonb,                  -- raw model output, for auditing
  extraction_confidence  numeric check (extraction_confidence between 0 and 1),
  photographed_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Votes: +1 = "true / still true", -1 = "wrong / no longer true"
-- ---------------------------------------------------------------------
create table claim_votes (
  claim_id    uuid not null references claims (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  vote        smallint not null check (vote in (1, -1)),
  created_at  timestamptz not null default now(),
  primary key (claim_id, user_id)
);

-- Apply a vote: update counters and move the claim through its states.
create or replace function apply_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c claims%rowtype;
begin
  select * into c from claims where id = new.claim_id for update;

  if c.proposed_by = new.user_id then
    raise exception 'You cannot vote on a claim you proposed';
  end if;
  if c.status in ('rejected', 'superseded') then
    raise exception 'This claim is closed';
  end if;

  if new.vote = 1 then
    update claims
       set confirm_count = confirm_count + 1,
           last_confirmed_at = now()
     where id = c.id
     returning * into c;
  else
    update claims set reject_count = reject_count + 1 where id = c.id returning * into c;
  end if;

  -- pending -> verified
  if c.status = 'pending' and c.confirm_count >= verify_threshold() then
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = now() where id = c.id;

  -- pending -> rejected
  elsif c.status = 'pending' and c.reject_count >= verify_threshold() then
    update claims set status = 'rejected' where id = c.id;

  -- verified -> disputed: enough "no longer true" votes since it was last confirmed
  elsif c.status = 'verified' and new.vote = -1 then
    if (select count(*) from claim_votes v
         where v.claim_id = c.id and v.vote = -1
           and v.created_at > coalesce(c.last_confirmed_at, c.verified_at)) >= verify_threshold() then
      update claims set status = 'disputed' where id = c.id;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_vote
  after insert on claim_votes
  for each row execute function apply_vote();

-- ---------------------------------------------------------------------
-- Proposing claims
-- Kosher claims must come with a certificate, so they go through an RPC
-- that inserts both rows atomically. Direct inserts of kosher claims are
-- blocked by RLS below.
-- ---------------------------------------------------------------------
create or replace function propose_kosher_claim(
  p_place_id uuid,
  p_level text,
  p_image_path text,
  p_supervising_body text,
  p_valid_until date,
  p_business_name text default null,
  p_extracted jsonb default null,
  p_confidence numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to add a certificate';
  end if;
  if p_valid_until < current_date then
    raise exception 'This certificate has already expired';
  end if;
  -- the image must be in the caller's own folder: certificates/<uid>/...
  if split_part(p_image_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid image path';
  end if;

  insert into claims (place_id, need, level, proposed_by)
  values (p_place_id, 'kosher', p_level, auth.uid())
  returning id into v_claim;

  insert into kosher_certificates
    (claim_id, image_path, supervising_body, business_name_on_cert, valid_until, extracted, extraction_confidence)
  values
    (v_claim, p_image_path, p_supervising_body, p_business_name, p_valid_until, p_extracted, p_confidence);

  return v_claim;
end;
$$;

-- ---------------------------------------------------------------------
-- Reading: places near a point, filtered by minimum level per need.
-- A kosher claim with an expired certificate does not count as kosher.
-- Pass null for a need you don't filter on.
-- ---------------------------------------------------------------------
create or replace function nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 1500,
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_limit int default 100
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
    -- verified claims that currently count
    select c.place_id, c.need, level_rank(c.need, c.level) as rank
      from claims c
      left join kosher_certificates k on k.claim_id = c.id
     where c.status = 'verified'
       and (c.need <> 'kosher' or k.valid_until >= current_date)
  )
  select
    p.id, p.name, p.place_type, p.address,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    st_distance(p.location, o.g) as distance_m,
    p.hours,
    coalesce((
      select jsonb_agg(jsonb_build_object(
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
             ) order by c.need)
        from claims c
        left join kosher_certificates k on k.claim_id = c.id
       where c.place_id = p.id and c.status in ('verified', 'pending', 'disputed')
    ), '[]'::jsonb) as claims
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

-- The community queue: pending claims near a point that the caller
-- didn't propose and hasn't voted on yet.
create or replace function pending_claims_near(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 3000
)
returns table (
  claim_id uuid,
  place_id uuid,
  place_name text,
  need need,
  level text,
  confirm_count int,
  proposed_at timestamptz,
  has_certificate boolean,
  distance_m double precision
)
language sql
stable
as $$
  select c.id, p.id, p.name, c.need, c.level, c.confirm_count, c.proposed_at,
         exists (select 1 from kosher_certificates k where k.claim_id = c.id),
         st_distance(p.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
    from claims c
    join places p on p.id = c.place_id
   where c.status = 'pending'
     and st_dwithin(p.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m)
     and c.proposed_by is distinct from auth.uid()
     and not exists (select 1 from claim_votes v where v.claim_id = c.id and v.user_id = auth.uid())
   order by c.confirm_count desc, c.proposed_at
$$;

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger places_touch before update on places
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Row level security
-- Everyone can read. Signed-in users can add places, propose non-kosher
-- claims, and vote. Status changes only happen inside the vote trigger.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table places enable row level security;
alter table claims enable row level security;
alter table kosher_certificates enable row level security;
alter table claim_votes enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "own profile editable" on profiles for update using (id = auth.uid());

create policy "places readable" on places for select using (true);
create policy "signed-in users add places" on places for insert
  to authenticated with check (created_by = auth.uid());

create policy "claims readable" on claims for select using (true);
create policy "signed-in users propose non-kosher claims" on claims for insert
  to authenticated with check (
    proposed_by = auth.uid()
    and status = 'pending'
    and confirm_count = 0 and reject_count = 0
    and need <> 'kosher'
  );

create policy "certificates readable" on kosher_certificates for select using (true);

create policy "own votes readable" on claim_votes for select using (user_id = auth.uid());
create policy "signed-in users vote" on claim_votes for insert
  to authenticated with check (user_id = auth.uid());

grant execute on function propose_kosher_claim(uuid, text, text, text, date, text, jsonb, numeric) to authenticated;
grant execute on function nearby_places(double precision, double precision, int, int, int, int, text, int) to anon, authenticated;
grant execute on function pending_claims_near(double precision, double precision, int) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: certificate photos. Public read, upload into your own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

create policy "certificate photos readable" on storage.objects for select
  using (bucket_id = 'certificates');

create policy "upload certificate photos to own folder" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ===== 0002_app.sql =====
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


-- ===== 0003_sources.sql =====
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


-- ===== 0004_map_points.sql =====
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


-- ===== 0005_details.sql =====
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


-- ===== 0006_feedback.sql =====
-- =====================================================================
-- Okeat — contact form
-- Messages from the "contact us" page (questions, accessibility issues,
-- privacy requests, reports). Anyone can send; only the site owner reads
-- them, in the Supabase dashboard: Table Editor -> feedback.
-- =====================================================================

create table if not exists feedback (
  id          bigserial primary key,
  topic       text not null check (topic in ('general', 'accessibility', 'privacy', 'report', 'business')),
  message     text not null check (length(trim(message)) between 5 and 3000),
  reply_to    text check (reply_to is null or length(reply_to) <= 200),
  page        text check (page is null or length(page) <= 300),
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false
);

alter table feedback enable row level security;

-- Anyone (also without an account) can send a message. Nobody can read them through the API.
drop policy if exists "anyone can send feedback" on feedback;
create policy "anyone can send feedback" on feedback for insert
  to anon, authenticated
  with check (handled = false);

grant insert on feedback to anon, authenticated;
grant usage, select on sequence feedback_id_seq to anon, authenticated;

-- Simple flood protection: at most 5 messages per user per hour.
create or replace function feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid(); -- never trust the id sent by the browser
  if new.user_id is not null and (
    select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Too many messages, try again later';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_limit on feedback;
create trigger feedback_limit before insert on feedback for each row execute function feedback_rate_limit();

notify pgrst, 'reload schema';


-- ===== 0007_more_sources.sql =====
-- =====================================================================
-- Okeat — places from more open sources
-- Adds a general "where did this place come from" id, so places can be
-- imported from Overture Maps (open data from Meta, Microsoft, Foursquare
-- and others) next to OpenStreetMap, and re-imported safely.
-- Run after 0005_details.sql. Safe to run twice.
-- =====================================================================

alter table places add column if not exists ext_id text;       -- e.g. 'overture:08f2...'
alter table places add column if not exists data_source text;  -- 'osm' | 'overture' | null (added on the site)

-- food category can now also come from Overture
alter table places drop constraint if exists places_cuisine_source_check;
alter table places add constraint places_cuisine_source_check
  check (cuisine_source in ('osm', 'auto', 'community', 'overture'));

create unique index if not exists places_ext_id_key on places (ext_id);

update places set data_source = 'osm' where osm_id is not null and data_source is null;

notify pgrst, 'reload schema';


-- ===== 0008_community.sql =====
-- =====================================================================
-- Okeat — community tools (run once in Supabase → SQL Editor → Run; safe to run again)
-- * More needs: vegetarian and allergies (dairy, egg, peanut, nuts, sesame, soy).
-- * Kosher without a photo: choose the kosher authority (incl. Tzohar, or "unknown");
--   a certificate photo is optional and only strengthens the claim.
-- * Public profiles (name, picture, when they joined, what they added). E-mail is never shown.
-- * Roles: 'user' → 'trusted' (automatically, after adding more than 5 places or confirming
--   more than 10 things) → 'admin' (set by hand). Trusted people and admins can fix
--   automatic guesses and decide on reported places.
-- * Reporting a place: 3 reports put it in the moderators' queue; a moderator decides.
-- * Business owners: a verification request with a code; an admin approves it.
-- * Map functions skip removed places and can filter on the new needs.
-- =====================================================================

-- ---------- 1. new needs ----------
alter type need add value if not exists 'vegetarian';
alter type need add value if not exists 'dairy_free';
alter type need add value if not exists 'egg_free';
alter type need add value if not exists 'peanut_free';
alter type need add value if not exists 'nut_free';
alter type need add value if not exists 'sesame_free';
alter type need add value if not exists 'soy_free';

-- Compares as text, so it works in the same run that adds the new values.
create or replace function level_rank(n need, l text)
returns int
language sql
immutable
as $$
  select case n::text
    when 'kosher' then case l
      when 'marked' then 0 when 'pikuach' then 0 when 'tzohar' then 0 when 'unknown' then 0
      when 'rabanut' then 1 when 'mehadrin' then 2 when 'badatz' then 3 end
    when 'vegan' then case l when 'options' then 1 when 'full' then 2 end
    when 'gluten_free' then case l when 'menu' then 1 when 'kitchen' then 2 end
    else case l when 'options' then 1 when 'full' then 2 end
  end
$$;

-- ---------- 2. kosher without a photo ----------
-- People may add kosher themselves (any level except the imported 'marked').
drop policy if exists "signed-in users propose non-kosher claims" on claims;
drop policy if exists "signed-in users propose claims" on claims;
create policy "signed-in users propose claims" on claims for insert
  to authenticated with check (
    proposed_by = auth.uid()
    and status = 'pending'
    and source = 'community'
    and confirm_count = 0 and reject_count = 0
    and level <> 'marked'
  );

-- A verified kosher claim counts whether or not it has a photo; a photo only must not be expired.
create or replace view effective_claims with (security_invoker = true) as
  select c.place_id, c.need, level_rank(c.need, c.level) as rank
    from claims c
    left join kosher_certificates k on k.claim_id = c.id
   where c.status = 'verified'
     and (c.need <> 'kosher' or k.claim_id is null or k.valid_until >= current_date);

-- ---------- 3. profiles: picture, role, no self-promotion ----------
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists role text not null default 'user';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('user', 'trusted', 'admin'));

-- People may only change their own name and needs, never their role.
revoke update on profiles from anon, authenticated;
grant update (display_name, own_needs) on profiles to authenticated;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name, avatar_url)
  values (new.id,
          -- never the e-mail (not even the part before @): profiles are public
          coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Pictures and names for people who signed in before this change; a name that was made
-- from the e-mail address is replaced (profiles are public, the e-mail must never show).
update profiles p
   set avatar_url = coalesce(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url'),
       display_name = case
         when p.display_name is null or p.display_name = '' or p.display_name = split_part(u.email, '@', 1)
           then coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name')
         else p.display_name end
  from auth.users u
 where u.id = p.id;

create or replace function is_moderator(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role in ('trusted', 'admin'))
$$;

create or replace function is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin')
$$;

create or replace function is_real_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

-- Promote to 'trusted' after more than 5 places or more than 10 confirmations (signed-in accounts only).
create or replace function maybe_promote(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if uid is null then return; end if;
  if exists (select 1 from auth.users where id = uid and coalesce(is_anonymous, false)) then return; end if;
  if (select count(*) from places where created_by = uid) > 5
     or (select count(*) from claim_votes where user_id = uid and vote = 1) > 10 then
    update profiles set role = 'trusted' where id = uid and role = 'user';
  end if;
end;
$$;

create or replace function promote_after_place() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform maybe_promote(new.created_by); return new; end; $$;
drop trigger if exists places_promote on places;
create trigger places_promote after insert on places for each row execute function promote_after_place();

create or replace function promote_after_vote() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform maybe_promote(new.user_id); return new; end; $$;
drop trigger if exists votes_promote on claim_votes;
create trigger votes_promote after insert on claim_votes for each row execute function promote_after_vote();

-- No more than 15 new places a day per person (stops spam).
create or replace function places_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and (
       select count(*) from places where created_by = new.created_by and created_at > now() - interval '1 day') >= 15 then
    raise exception 'Too many new places today. Try again tomorrow.';
  end if;
  return new;
end; $$;
drop trigger if exists places_limit on places;
create trigger places_limit before insert on places for each row execute function places_rate_limit();

-- ---------- 4. places: removed, reported, owner ----------
alter table places add column if not exists removed boolean not null default false;
alter table places add column if not exists flagged boolean not null default false;
alter table places add column if not exists owner_id uuid references profiles (id) on delete set null;
alter table places add column if not exists owner_verified_at timestamptz;

create table if not exists place_reports (
  place_id    uuid not null references places (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  reason      text check (length(reason) <= 300),
  created_at  timestamptz not null default now(),
  primary key (place_id, user_id)
);
alter table place_reports enable row level security;
drop policy if exists "own reports readable" on place_reports;
create policy "own reports readable" on place_reports for select using (user_id = auth.uid() or is_moderator());
drop policy if exists "signed-in users report" on place_reports;
create policy "signed-in users report" on place_reports for insert to authenticated
  with check (user_id = auth.uid() and is_real_user());

-- 3 reports → the place goes to the moderators (it stays on the map, marked "being checked").
create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from place_reports where place_id = new.place_id) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;
drop trigger if exists reports_flag on place_reports;
create trigger reports_flag after insert on place_reports for each row execute function after_report();

-- ---------- 5. business owners ----------
create table if not exists owner_requests (
  id          uuid primary key default gen_random_uuid(),
  place_id    uuid not null references places (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  code        text not null,
  proof_url   text check (length(proof_url) <= 500),
  note        text check (length(note) <= 500),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references profiles (id) on delete set null
);
create unique index if not exists owner_requests_one_pending on owner_requests (place_id, user_id) where status = 'pending';
alter table owner_requests enable row level security;
drop policy if exists "own owner requests readable" on owner_requests;
create policy "own owner requests readable" on owner_requests for select using (user_id = auth.uid() or is_admin());

-- A public profile: no e-mail, only what is fine to show.
create or replace function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id),
         (select count(*) from claims where proposed_by = p.id),
         (select count(*) from claim_votes where user_id = p.id and vote = 1)
    from profiles p
   where p.id = p_id
$$;

-- The places someone added (for their profile page).
create or replace function places_added_by(p_id uuid)
returns table (id uuid, name text, place_type text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, place_type, created_at from places
   where created_by = p_id and not removed
   order by created_at desc
   limit 50
$$;

-- Who added a place, whether the owner confirmed it, and what the viewer may do.
create or replace function place_meta(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'createdAt', p.created_at,
    'creator', case when c.id is null then null else jsonb_build_object(
                 'id', c.id, 'name', coalesce(nullif(c.display_name, ''), 'משתמש/ת Okeat'), 'avatar', c.avatar_url) end,
    'ownerVerified', p.owner_verified_at is not null,
    'flagged', p.flagged,
    'reports', (select count(*) from place_reports r where r.place_id = p.id),
    'iReported', exists (select 1 from place_reports r where r.place_id = p.id and r.user_id = auth.uid()),
    'iRequestedOwner', exists (select 1 from owner_requests o where o.place_id = p.id and o.user_id = auth.uid() and o.status = 'pending'),
    'canModerate', is_moderator(),
    'isAdmin', is_admin()
  )
    from places p
    left join profiles c on c.id = p.created_by
   where p.id = p_id
$$;

-- Starts a request and returns the code the owner puts on the business's own website or social page.
create or replace function request_ownership(p_place uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text;
begin
  if not is_real_user() then
    raise exception 'Sign in with an account to verify a business';
  end if;
  select code into v_code from owner_requests where place_id = p_place and user_id = auth.uid() and status = 'pending';
  if v_code is not null then return v_code; end if;
  if (select count(*) from owner_requests where user_id = auth.uid() and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many requests today. Try again tomorrow.';
  end if;
  v_code := 'OKEAT-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  insert into owner_requests (place_id, user_id, code) values (p_place, auth.uid(), v_code);
  return v_code;
end;
$$;

-- The owner says where the code can be seen (a link to the business's website, Instagram or Facebook).
create or replace function submit_ownership_proof(p_place uuid, p_url text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_url !~* '^https://' then
    raise exception 'The link must start with https://';
  end if;
  update owner_requests set proof_url = left(p_url, 500), note = left(p_note, 500)
   where place_id = p_place and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No open request for this place'; end if;
end;
$$;

-- ---------- 6. moderators ----------
create or replace function moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return jsonb_build_object(
    'reported', coalesce((select jsonb_agg(x order by x->>'reports' desc) from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address,
                 'reports', (select count(*) from place_reports r where r.place_id = p.id),
                 'reasons', (select jsonb_agg(r.reason) from place_reports r where r.place_id = p.id and r.reason is not null)) x
          from places p where p.flagged and not p.removed) q), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', c.id, 'placeId', p.id, 'placeName', p.name, 'need', c.need, 'level', c.level,
                 'status', c.status, 'source', c.source, 'confirm', c.confirm_count, 'reject', c.reject_count) x
          from claims c join places p on p.id = c.place_id
         where not p.removed and (c.status = 'disputed' or (c.source in ('auto', 'osm') and c.reject_count > 0)
                or (c.status = 'pending' and c.reject_count > 0))
         order by c.reject_count desc limit 100) q), '[]'::jsonb),
    'owners', case when is_admin() then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', o.id, 'placeId', p.id, 'placeName', p.name, 'code', o.code,
                 'proofUrl', o.proof_url, 'note', o.note, 'user', pr.display_name, 'createdAt', o.created_at) x
          from owner_requests o join places p on p.id = o.place_id join profiles pr on pr.id = o.user_id
         where o.status = 'pending' and o.proof_url is not null order by o.created_at) q), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- Keep or remove a reported place.
create or replace function moderate_place(p_place uuid, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  if p_remove then
    update places set removed = true, flagged = false where id = p_place;
  else
    update places set flagged = false where id = p_place;
    delete from place_reports where place_id = p_place;
  end if;
end;
$$;

-- Fix a claim: confirm it, or reject it (e.g. a wrong automatic guess).
create or replace function moderate_claim(p_claim uuid, p_verify boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c claims%rowtype;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select * into c from claims where id = p_claim for update;
  if p_verify then
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = coalesce(verified_at, now()), last_confirmed_at = now(),
                      source = 'community'
     where id = c.id;
  else
    update claims set status = 'rejected' where id = c.id;
  end if;
end;
$$;

-- Approve or reject a business owner.
create or replace function decide_ownership(p_request uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r owner_requests%rowtype;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into r from owner_requests where id = p_request for update;
  update owner_requests set status = case when p_approve then 'approved' else 'rejected' end,
                            decided_at = now(), decided_by = auth.uid()
   where id = p_request;
  if p_approve then
    update places set owner_id = r.user_id, owner_verified_at = now() where id = r.place_id;
  end if;
end;
$$;

-- Wrong automatic guesses go away faster: 2 "not true" from people, or 1 from a moderator.
create or replace function auto_claim_rejects() returns trigger
language plpgsql security definer set search_path = public as $$
declare c claims%rowtype;
begin
  if new.vote <> -1 then return new; end if;
  select * into c from claims where id = new.claim_id;
  if c.source in ('auto', 'osm') and c.confirm_count = 0 and c.status in ('verified', 'pending')
     and (c.reject_count >= 2 or is_moderator(new.user_id)) then
    update claims set status = 'rejected' where id = c.id;
  end if;
  return new;
end; $$;
drop trigger if exists votes_auto_reject on claim_votes;
create trigger votes_auto_reject after insert on claim_votes for each row execute function auto_claim_rejects();

-- ---------- 7. map functions: skip removed places, filter on the new needs ----------
-- p_extra: {"dairy_free": 1, "vegetarian": 2} = needs that must be confirmed at least at that rank.
drop function if exists map_points(int, int, int, text, text);
drop function if exists map_points(int, int, int, text, text, jsonb);
create function map_points(
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
  select
    p.id, p.name, p.place_type,
    st_y(p.location::geometry), st_x(p.location::geometry),
    p.cuisine,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'need', c.need, 'level', c.level,
               'imported', c.source in ('osm', 'auto') and c.confirm_count = 0,
               'expired', coalesce(k.valid_until < current_date, false)
             ) order by c.need)
        from claims c
        left join kosher_certificates k on k.claim_id = c.id
       where c.place_id = p.id and c.status = 'verified'
    ), '[]'::jsonb),
    exists (select 1 from claims c where c.place_id = p.id and c.status = 'pending')
  from places p
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

drop function if exists nearby_places(double precision, double precision, int, int, int, int, text, int, text);
drop function if exists nearby_places(double precision, double precision, int, int, int, int, text, int, text, jsonb);
create function nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 1500,
  p_min_kosher int default null,
  p_min_vegan int default null,
  p_min_gluten_free int default null,
  p_query text default null,
  p_limit int default 150,
  p_cuisine text default null,
  p_extra jsonb default null
)
returns table (id uuid, name text, place_type text, address text, lat double precision, lng double precision,
               distance_m double precision, hours jsonb, cuisine text[], cuisine_source text,
               phone text, website text, claims jsonb)
language sql
stable
as $$
  with origin as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select
    p.id, p.name, p.place_type, p.address,
    st_y(p.location::geometry), st_x(p.location::geometry),
    st_distance(p.location, o.g),
    p.hours, p.cuisine, p.cuisine_source, p.phone, p.website,
    place_claims(p.id)
  from places p, origin o
  where not p.removed
    and st_dwithin(p.location, o.g, p_radius_m)
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
  order by st_distance(p.location, o.g)
  limit least(p_limit, 50000)
$$;

-- A removed place no longer opens from a shared link.
create or replace function place_by_id(
  p_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (id uuid, name text, place_type text, address text, lat double precision, lng double precision,
               distance_m double precision, hours jsonb, cuisine text[], cuisine_source text,
               phone text, website text, claims jsonb)
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
   where p.id = p_id and not p.removed
$$;

grant select on effective_claims to anon, authenticated;
grant execute on function map_points(int, int, int, text, text, jsonb) to anon, authenticated;
grant execute on function nearby_places(double precision, double precision, int, int, int, int, text, int, text, jsonb) to anon, authenticated;
grant execute on function place_by_id(uuid, double precision, double precision) to anon, authenticated;
grant execute on function public_profile(uuid) to anon, authenticated;
grant execute on function places_added_by(uuid) to anon, authenticated;
grant execute on function place_meta(uuid) to anon, authenticated;
grant execute on function request_ownership(uuid) to authenticated;
grant execute on function submit_ownership_proof(uuid, text, text) to authenticated;
grant execute on function moderation_queue() to authenticated;
grant execute on function moderate_place(uuid, boolean) to authenticated;
grant execute on function moderate_claim(uuid, boolean) to authenticated;
grant execute on function decide_ownership(uuid, boolean) to authenticated;
revoke execute on function maybe_promote(uuid) from anon, authenticated, public;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Make yourself the admin (once): put the e-mail you sign in to Okeat with.
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR-EMAIL@gmail.com');
-- ---------------------------------------------------------------------


-- ===== 0009_stats.sql =====
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


-- ===== 0010_map_speed.sql =====
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


-- ===== 0011_admin_only_roles.sql =====
-- Okeat — only the site admin gives moderator rights (run once in Supabase → SQL Editor → Run; safe to run again)
-- Before running: replace PASTE-YOUR-EMAIL with the e-mail you sign in to Okeat with.

-- 1. No more automatic promotion.
drop trigger if exists places_promote on places;
drop trigger if exists votes_promote on claim_votes;
drop function if exists promote_after_place();
drop function if exists promote_after_vote();
drop function if exists maybe_promote(uuid);

-- 2. Anyone who got the role automatically goes back to a regular user.
update profiles set role = 'user' where role = 'trusted';



-- To make someone a moderator later, copy their user id from Authentication → Users and run:
--   update profiles set role = 'trusted' where id = 'THEIR-USER-ID';



-- ===== 0012_admin_verified.sql =====
-- Okeat — what the site admin adds is confirmed right away (run once in Supabase → SQL Editor → Run; safe to run again)
-- Everyone else still needs 3 confirmations.

create or replace function auto_verify_admin_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and new.proposed_by is not null and is_admin(new.proposed_by) then
    update claims set status = 'superseded'
     where place_id = new.place_id and need = new.need and status = 'verified' and id <> new.id;
    update claims set status = 'verified', verified_at = now(), last_confirmed_at = now()
     where id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function auto_verify_admin_claim() from anon, authenticated, public;

drop trigger if exists claims_admin_verified on claims;
create trigger claims_admin_verified after insert on claims
  for each row execute function auto_verify_admin_claim();

-- What you already added and is still waiting for confirmation is confirmed now too.
do $$
declare c record;
begin
  for c in
    select cl.id, cl.place_id, cl.need
      from claims cl
     where cl.status = 'pending' and cl.proposed_by is not null and is_admin(cl.proposed_by)
  loop
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = now(), last_confirmed_at = now()
     where id = c.id;
  end loop;
end $$;

select count(*) as admins from profiles where role = 'admin';


-- ===== 0013_set_user_role.sql =====
-- Okeat — site admins change roles from a person's profile page.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('user', 'trusted', 'admin') then raise exception 'Unknown role'; end if;
  if exists (select 1 from auth.users where id = p_user and coalesce(is_anonymous, false)) then
    raise exception 'Anonymous accounts cannot get a role';
  end if;
  update profiles set role = p_role where id = p_user;
end;
$$;

revoke execute on function set_user_role(uuid, text) from anon, public;
grant execute on function set_user_role(uuid, text) to authenticated;
notify pgrst, 'reload schema';


-- ===== 0014_admin_fix_place.sql =====
alter table places add column if not exists location_locked boolean not null default false;
-- Okeat — site admins fix a place's location from the site.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function admin_fix_place(p_place uuid, p_lat double precision, p_lng double precision, p_address text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_lat not between 29.4 and 33.4 or p_lng not between 34.2 and 35.95 then
    raise exception 'That point is outside Israel';
  end if;
  -- unlock first: a locked place keeps its location on every other update
  update places set location_locked = false where id = p_place;
  update places
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         address = coalesce(nullif(trim(p_address), ''), address),
         location_locked = true
   where id = p_place;
end;
$$;

revoke execute on function admin_fix_place(uuid, double precision, double precision, text) from anon, public;
grant execute on function admin_fix_place(uuid, double precision, double precision, text) to authenticated;
notify pgrst, 'reload schema';


-- ===== 0015_typed_reports.sql =====
-- Okeat — a typed report (closed, doesn't exist, wrong address) goes straight to the moderators.
-- Other reports still need 3 people. (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or (select count(*) from place_reports where place_id = new.place_id) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;
notify pgrst, 'reload schema';


-- ===== 0016_reviews_favorites_photos.sql =====
-- Okeat — reviews, saved places and place photos (run once in Supabase → SQL Editor → Run; safe to run again)
-- Reviews and saved places need a signed-in account. Photos appear only after a moderator approves them.

create table if not exists reviews (
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  comment    text check (length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
alter table reviews enable row level security;
drop policy if exists "reviews readable" on reviews;
create policy "reviews readable" on reviews for select using (true);
drop policy if exists "write own review" on reviews;
create policy "write own review" on reviews for insert to authenticated with check (user_id = auth.uid() and is_real_user());
drop policy if exists "edit own review" on reviews;
create policy "edit own review" on reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "remove own or moderated review" on reviews;
create policy "remove own or moderated review" on reviews for delete to authenticated using (user_id = auth.uid() or is_moderator());

create or replace function place_reviews(p_id uuid)
returns table (user_id uuid, name text, avatar_url text, rating int, comment text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.user_id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, r.rating, r.comment, r.created_at
    from reviews r join profiles p on p.id = r.user_id
   where r.place_id = p_id
   order by r.created_at desc
   limit 50
$$;

create table if not exists favorites (
  user_id    uuid not null references profiles (id) on delete cascade,
  place_id   uuid not null references places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table favorites enable row level security;
drop policy if exists "own favorites" on favorites;
create policy "own favorites" on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_real_user());

create or replace function my_favorites()
returns table (id uuid, name text, place_type text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.place_type
    from favorites f join places p on p.id = f.place_id
   where f.user_id = auth.uid() and not p.removed
   order by f.created_at desc
$$;

create table if not exists place_photos (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  path       text not null check (length(path) <= 200),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_place on place_photos (place_id);
alter table place_photos enable row level security;
drop policy if exists "approved photos readable" on place_photos;
create policy "approved photos readable" on place_photos for select
  using (approved or user_id = auth.uid() or is_moderator());
drop policy if exists "add own photo" on place_photos;
create policy "add own photo" on place_photos for insert to authenticated
  with check (user_id = auth.uid() and approved = false and is_real_user()
              and split_part(path, '/', 1) = auth.uid()::text);
drop policy if exists "remove moderated photo" on place_photos;
create policy "remove moderated photo" on place_photos for delete to authenticated using (user_id = auth.uid() or is_moderator());

-- At most 10 photos a day per person.
create or replace function photos_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from place_photos where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many photos today';
  end if;
  return new;
end; $$;
drop trigger if exists place_photos_limit on place_photos;
create trigger place_photos_limit before insert on place_photos for each row execute function photos_rate_limit();

-- At most 30 new reviews a day per person.
create or replace function reviews_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reviews where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many reviews today';
  end if;
  return new;
end; $$;
drop trigger if exists reviews_limit on reviews;
create trigger reviews_limit before insert on reviews for each row execute function reviews_rate_limit();

create or replace function pending_photos()
returns table (id uuid, place_id uuid, place_name text, path text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return query select ph.id, ph.place_id, p.name, ph.path
    from place_photos ph join places p on p.id = ph.place_id
   where not ph.approved order by ph.created_at limit 100;
end;
$$;

create or replace function moderate_photo(p_photo uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  if p_approve then update place_photos set approved = true where id = p_photo;
  else delete from place_photos where id = p_photo;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "place photos readable" on storage.objects;
create policy "place photos readable" on storage.objects for select using (bucket_id = 'place-photos');
drop policy if exists "upload place photos to own folder" on storage.objects;
create policy "upload place photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());
drop policy if exists "moderators remove place photos" on storage.objects;
create policy "moderators remove place photos" on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (is_moderator() or (storage.foldername(name))[1] = auth.uid()::text));

grant select, insert, update, delete on reviews, favorites, place_photos to authenticated;
grant select on reviews, place_photos to anon;
grant execute on function place_reviews(uuid) to anon, authenticated;
grant execute on function my_favorites() to authenticated;
grant execute on function pending_photos() to authenticated;
grant execute on function moderate_photo(uuid, boolean) to authenticated;
revoke execute on function photos_rate_limit() from anon, authenticated, public;
revoke execute on function reviews_rate_limit() from anon, authenticated, public;
notify pgrst, 'reload schema';


-- ===== 0017_review_reports_errors.sql =====
-- Okeat — reporting reviews, and a private list of errors people ran into
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists review_reports (
  place_id    uuid not null,
  review_user uuid not null,
  reporter    uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (place_id, review_user, reporter),
  foreign key (place_id, review_user) references reviews (place_id, user_id) on delete cascade
);
alter table review_reports enable row level security;
drop policy if exists "report a review" on review_reports;
create policy "report a review" on review_reports for insert to authenticated
  with check (reporter = auth.uid() and review_user <> auth.uid() and is_real_user());
drop policy if exists "own reports readable" on review_reports;
create policy "own reports readable" on review_reports for select to authenticated
  using (reporter = auth.uid() or is_moderator());
drop policy if exists "moderators clear reports" on review_reports;
create policy "moderators clear reports" on review_reports for delete to authenticated using (is_moderator());

create or replace function reported_reviews()
returns table (place_id uuid, place_name text, user_id uuid, author text, rating int, comment text, reports bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return query
    select r.place_id, pl.name, r.user_id, coalesce(nullif(pr.display_name, ''), 'משתמש/ת Okeat'), r.rating, r.comment, count(*)
      from review_reports rr
      join reviews r on r.place_id = rr.place_id and r.user_id = rr.review_user
      join places pl on pl.id = r.place_id
      join profiles pr on pr.id = r.user_id
     group by r.place_id, pl.name, r.user_id, pr.display_name, r.rating, r.comment
     order by count(*) desc
     limit 100;
end;
$$;

-- Errors from people's browsers: only the message and the page, no details about the person.
create table if not exists client_errors (
  message   text primary key,
  path      text,
  times     int not null default 1,
  last_seen timestamptz not null default now()
);
alter table client_errors enable row level security;
drop policy if exists "moderators read errors" on client_errors;
create policy "moderators read errors" on client_errors for select to authenticated using (is_moderator());
drop policy if exists "moderators clear errors" on client_errors;
create policy "moderators clear errors" on client_errors for delete to authenticated using (is_moderator());

-- Anyone may report an error, but only through here: short text, and at most 200 different errors.
create or replace function log_client_error(p_message text, p_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_message text := left(trim(p_message), 300);
begin
  if v_message = '' then return; end if;
  update client_errors set times = times + 1, last_seen = now(), path = left(p_path, 120) where message = v_message;
  if not found and (select count(*) from client_errors) < 200 then
    insert into client_errors (message, path) values (v_message, left(p_path, 120)) on conflict do nothing;
  end if;
end;
$$;

grant select, insert, delete on review_reports to authenticated;
grant select, delete on client_errors to authenticated;
grant execute on function reported_reviews() to authenticated;
grant execute on function log_client_error(text, text) to anon, authenticated;
notify pgrst, 'reload schema';


-- ===== 0018_merge_duplicates.sql =====
-- Okeat — find places that appear twice, and merge them after the admin looks
-- (run once in Supabase → SQL Editor → Run; safe to run again)
-- Nothing is merged by running this file. A merged place is hidden, not deleted, and remembers where it went.

alter table places add column if not exists merged_into uuid references places (id) on delete set null;

create table if not exists not_duplicates (
  a uuid not null references places (id) on delete cascade,
  b uuid not null references places (id) on delete cascade,
  primary key (a, b)
);
alter table not_duplicates enable row level security;

-- Reports must follow a review when it moves to the kept place.
alter table review_reports drop constraint if exists review_reports_place_id_review_user_fkey;
alter table review_reports add constraint review_reports_place_id_review_user_fkey
  foreign key (place_id, review_user) references reviews (place_id, user_id) on delete cascade on update cascade;

-- The consonants of a name, in Latin letters: "ארקפה" and "Arcaffe" both become "rkp".
create or replace function place_skeleton(t text)
returns text
language sql immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        replace(replace(replace(lower(t), 'sh', 's'), 'ch', 'h'), 'ph', 'p'),
        'בגדוזחטכךלמםנןספףצץקרשתfwcqאהיעaeiouy',
        'bgdvzhtkklmmnnsppzzkrstpvkk'
      ),
      '[^a-z0-9]', '', 'g'
    ),
    '(.)\1+', '\1', 'g'
  )
$$;

create or replace function duplicate_pairs()
returns table (a_id uuid, a_name text, a_address text, b_id uuid, b_name text, b_address text, meters int)
language plpgsql stable security definer set search_path = public, extensions
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.address, q.id, q.name, q.address, round(st_distance(p.location, q.location))::int
      from places p
      join places q on p.id < q.id and st_dwithin(p.location, q.location, 80)
     where not p.removed and not q.removed
       and place_skeleton(p.name) = place_skeleton(q.name)
       and length(place_skeleton(p.name)) >= 3
       and not exists (select 1 from not_duplicates n where n.a = p.id and n.b = q.id)
     order by 7
     limit 400;
end;
$$;

create or replace function dismiss_duplicate(p_a uuid, p_b uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into not_duplicates (a, b) values (least(p_a, p_b), greatest(p_a, p_b)) on conflict do nothing;
end;
$$;

-- How much people have put into a place. The one with more stays.
create or replace function place_weight(p_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select (select count(*)::int from claims where place_id = p_id and source = 'community' and status = 'verified') * 3
       + (select count(*)::int from claims where place_id = p_id and source = 'community')
       + (select count(*)::int from reviews where place_id = p_id)
       + (select count(*)::int from favorites where place_id = p_id)
       + (select count(*)::int from place_photos where place_id = p_id)
       + (select case when location_locked then 2 else 0 end + case when owner_id is not null then 5 else 0 end from places where id = p_id)
$$;

create or replace function admin_merge_pair(p_a uuid, p_b uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  a places;
  b places;
  keep places;
  gone places;
  c claims;
  k claims;
  v_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into a from places where id = p_a and not removed for update;
  if not found then return null; end if;
  select * into b from places where id = p_b and not removed for update;
  if not found then return null; end if;

  if place_weight(a.id) > place_weight(b.id)
     or (place_weight(a.id) = place_weight(b.id) and (a.name ~ '[א-ת]' or b.name !~ '[א-ת]')) then
    keep := a; gone := b;
  else
    keep := b; gone := a;
  end if;

  -- What is known about the place. When both know the same thing, the kept one wins,
  -- unless people confirmed the other and the kept one is only an import or a guess.
  for c in select * from claims where place_id = gone.id and status in ('verified', 'pending') order by status = 'verified' desc loop
    select * into k from claims where place_id = keep.id and need = c.need and status in ('verified', 'pending')
     order by status = 'verified' desc limit 1;
    if not found then
      update claims set place_id = keep.id where id = c.id;
    elsif c.status = 'verified' and (k.status = 'pending' or (c.source = 'community' and k.source <> 'community')) then
      update claims set status = 'superseded' where id = k.id;
      update claims set place_id = keep.id where id = c.id;
    end if;
  end loop;

  update reviews r set place_id = keep.id where r.place_id = gone.id
    and not exists (select 1 from reviews x where x.place_id = keep.id and x.user_id = r.user_id);
  update favorites f set place_id = keep.id where f.place_id = gone.id
    and not exists (select 1 from favorites x where x.place_id = keep.id and x.user_id = f.user_id);
  update place_photos set place_id = keep.id where place_id = gone.id;
  update owner_requests o set place_id = keep.id where o.place_id = gone.id
    and (o.status <> 'pending' or not exists (select 1 from owner_requests x where x.place_id = keep.id and x.user_id = o.user_id and x.status = 'pending'));

  -- Both spellings stay searchable: "ארקפה · Arcaffe".
  v_name := keep.name;
  if (keep.name ~ '[א-ת]') <> (gone.name ~ '[א-ת]') then
    v_name := left(keep.name || ' · ' || gone.name, 120);
  end if;

  update places set
    name = v_name,
    address = coalesce(address, gone.address),
    phone = coalesce(phone, gone.phone),
    website = coalesce(website, gone.website),
    hours = coalesce(hours, gone.hours),
    cuisine = coalesce(cuisine, gone.cuisine),
    owner_id = coalesce(owner_id, gone.owner_id),
    owner_verified_at = coalesce(owner_verified_at, gone.owner_verified_at)
  where id = keep.id;

  update places set removed = true, merged_into = keep.id where id = gone.id;
  return keep.id;
end;
$$;

revoke execute on function place_weight(uuid) from anon, authenticated, public;
revoke execute on function duplicate_pairs() from anon, public;
revoke execute on function dismiss_duplicate(uuid, uuid) from anon, public;
revoke execute on function admin_merge_pair(uuid, uuid) from anon, public;
grant execute on function duplicate_pairs() to authenticated;
grant execute on function dismiss_duplicate(uuid, uuid) to authenticated;
grant execute on function admin_merge_pair(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';


-- ===== 0019_tighten_access.sql =====
-- Okeat — closing small gaps found in the pre-launch security check
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- 1. Personal food needs are not shown anywhere on the site, so they should not be readable or kept.
update profiles set own_needs = '{}' where own_needs <> '{}';
revoke select on profiles from anon, authenticated;
grant select (id, display_name, avatar_url, created_at, role) on profiles to anon, authenticated;
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

-- Profile pages open through public_profile(). Nobody can download the whole list of users.
drop policy if exists "profiles readable" on profiles;
drop policy if exists "own profile readable" on profiles;
create policy "own profile readable" on profiles for select using (id = auth.uid() or is_moderator());

-- 2. A new place from the site starts clean: nobody can mark themselves as the verified owner this way.
create or replace function places_clean_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.owner_id := null;
    new.owner_verified_at := null;
    new.removed := false;
    new.flagged := false;
    new.location_locked := false;
    new.merged_into := null;
    new.osm_id := null;
    new.ext_id := null;
    if new.website is not null and new.website !~* '^https?://' then
      new.website := null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists places_clean on places;
create trigger places_clean before insert on places for each row execute function places_clean_insert();
revoke execute on function places_clean_insert() from anon, authenticated, public;

-- 3. Photos stay viewable by their link, but nobody can list the folders,
--    and certificates get the same size and type limits as place photos.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'certificates';

drop policy if exists "certificate photos readable" on storage.objects;
drop policy if exists "own certificate files visible" on storage.objects;
create policy "own certificate files visible" on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and ((storage.foldername(name))[1] = auth.uid()::text or is_moderator()));

drop policy if exists "place photos readable" on storage.objects;
drop policy if exists "own place photo files visible" on storage.objects;
create policy "own place photo files visible" on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_moderator()));

notify pgrst, 'reload schema';


-- ===== 0020_admin_users.sql =====
-- Okeat — the admin's list of registered users (run once in Supabase → SQL Editor → Run; safe to run again)
-- Only the admin can read it. Temporary anonymous accounts are left out.

create or replace function admin_users()
returns table (id uuid, name text, email text, role text, joined timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select u.id, nullif(p.display_name, ''), u.email::text, p.role, u.created_at, u.last_sign_in_at
      from auth.users u
      join profiles p on p.id = u.id
     where not coalesce(u.is_anonymous, false)
     order by u.created_at desc
     limit 1000;
end;
$$;

revoke execute on function admin_users() from anon, public;
grant execute on function admin_users() to authenticated;
notify pgrst, 'reload schema';


-- ===== 0021_admin_delete_user.sql =====
-- Okeat — the admin can delete a user from the site (run once in Supabase → SQL Editor → Run; safe to run again)
-- This is final. Their profile, reviews and saved places go. Places they added stay, without their name.
-- Another admin can't be deleted here: change their role first.

create or replace function admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot delete your own account here'; end if;
  if is_admin(p_user) then raise exception 'Change this admin to a regular user first'; end if;
  delete from auth.users where id = p_user;
end;
$$;

revoke execute on function admin_delete_user(uuid) from anon, public;
grant execute on function admin_delete_user(uuid) to authenticated;
notify pgrst, 'reload schema';


-- ===== 0022_profile_details.sql =====
-- Okeat — a name and a favorite food on the profile (run once in Supabase → SQL Editor → Run; safe to run again)

alter table profiles add column if not exists favorite_food text;
alter table profiles drop constraint if exists profiles_favorite_food_length;
alter table profiles add constraint profiles_favorite_food_length check (length(favorite_food) <= 60) not valid;
alter table profiles drop constraint if exists profiles_display_name_length;
alter table profiles add constraint profiles_display_name_length check (length(display_name) <= 40) not valid;

grant update (display_name, favorite_food) on profiles to authenticated;
grant select (favorite_food) on profiles to authenticated;

-- The result changes, so the function is replaced.
drop function if exists public_profile(uuid);
create function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint, favorite_food text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id),
         (select count(*) from claims where proposed_by = p.id),
         (select count(*) from claim_votes where user_id = p.id and vote = 1),
         nullif(p.favorite_food, '')
    from profiles p
   where p.id = p_id
$$;
grant execute on function public_profile(uuid) to anon, authenticated;
notify pgrst, 'reload schema';


-- ===== 0023_admin_messages.sql =====
-- Okeat — the admin reads contact messages on the site (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_messages()
returns table (id bigint, topic text, message text, reply_to text, account_email text, created_at timestamptz, handled boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select f.id, f.topic, f.message, f.reply_to, u.email::text, f.created_at, f.handled
      from feedback f
      left join auth.users u on u.id = f.user_id
     order by f.handled, f.created_at desc
     limit 300;
end;
$$;

create or replace function admin_mark_message(p_id bigint, p_handled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update feedback set handled = p_handled where id = p_id;
end;
$$;

-- People without any session have no per-person limit, so the form also has a limit for all of them together.
create or replace function feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid(); -- never trust the id sent by the browser
  if new.user_id is not null and (
    select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Too many messages, try again later';
  end if;
  if new.user_id is null and (
    select count(*) from feedback where user_id is null and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Too many messages, try again later';
  end if;
  return new;
end;
$$;

revoke execute on function admin_messages() from anon, public;
revoke execute on function admin_mark_message(bigint, boolean) from anon, public;
grant execute on function admin_messages() to authenticated;
grant execute on function admin_mark_message(bigint, boolean) to authenticated;
notify pgrst, 'reload schema';


-- ===== 0024_community_growth.sql =====
-- Okeat — notifications, shared lists, similar places, business updates, search insights and the admin dashboard
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- ---------- notifications ----------
alter table profiles add column if not exists notifications_seen_at timestamptz not null default now();

create or replace function my_notifications()
returns table (kind text, place_id uuid, place_name text, need text, happened_at timestamptz, is_new boolean)
language sql stable security definer set search_path = public
as $$
  with mine as (select notifications_seen_at as seen from profiles where id = auth.uid()),
  events as (
    select 'approved'::text as kind, p.id as place_id, p.name as place_name, c.need::text as need, c.verified_at as happened_at
      from claims c join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status = 'verified' and c.source = 'community'
       and c.verified_at > now() - interval '30 days' and not p.removed
    union all
    select 'expiring', p.id, p.name, 'kosher', (k.valid_until - 30)::timestamptz
      from kosher_certificates k
      join claims c on c.id = k.claim_id
      join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status in ('verified', 'pending')
       and k.valid_until between current_date and current_date + 30 and not p.removed
  )
  select e.kind, e.place_id, e.place_name, e.need, e.happened_at, e.happened_at > m.seen
    from events e cross join mine m
   order by e.happened_at desc
   limit 50
$$;

create or replace function mark_notifications_seen()
returns void
language sql security definer set search_path = public
as $$
  update profiles set notifications_seen_at = now() where id = auth.uid()
$$;

-- ---------- lists anyone can open by link ----------
create table if not exists lists (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles (id) on delete cascade,
  title      text not null check (length(trim(title)) between 2 and 60),
  created_at timestamptz not null default now()
);
create table if not exists list_places (
  list_id  uuid not null references lists (id) on delete cascade,
  place_id uuid not null references places (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, place_id)
);
alter table lists enable row level security;
alter table list_places enable row level security;

drop policy if exists "lists readable" on lists;
create policy "lists readable" on lists for select using (true);
drop policy if exists "own lists added" on lists;
create policy "own lists added" on lists for insert to authenticated with check (owner_id = auth.uid() and is_real_user());
drop policy if exists "own lists edited" on lists;
create policy "own lists edited" on lists for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "own or moderated lists removed" on lists;
create policy "own or moderated lists removed" on lists for delete to authenticated using (owner_id = auth.uid() or is_moderator());

drop policy if exists "list places readable" on list_places;
create policy "list places readable" on list_places for select using (true);
drop policy if exists "own list places added" on list_places;
create policy "own list places added" on list_places for insert to authenticated
  with check (exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid()));
drop policy if exists "own list places removed" on list_places;
create policy "own list places removed" on list_places for delete to authenticated
  using (exists (select 1 from lists l where l.id = list_id and l.owner_id = auth.uid()));

create or replace function lists_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'lists' then
    if (select count(*) from lists where owner_id = new.owner_id) >= 20 then raise exception 'Too many lists'; end if;
  elsif (select count(*) from list_places where list_id = new.list_id) >= 100 then
    raise exception 'This list is full';
  end if;
  return new;
end; $$;
drop trigger if exists lists_limit on lists;
create trigger lists_limit before insert on lists for each row execute function lists_limit();
drop trigger if exists list_places_limit on list_places;
create trigger list_places_limit before insert on list_places for each row execute function lists_limit();

create or replace function list_view(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', l.id, 'title', l.title, 'ownerId', l.owner_id,
    'ownerName', coalesce(nullif(o.display_name, ''), 'משתמש/ת Okeat'),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'placeType', p.place_type, 'address', p.address) order by lp.added_at desc)
        from list_places lp join places p on p.id = lp.place_id
       where lp.list_id = l.id and not p.removed), '[]'::jsonb))
    from lists l join profiles o on o.id = l.owner_id
   where l.id = p_id
$$;

-- ---------- similar places ----------
create or replace function similar_places(p_id uuid)
returns table (id uuid, name text, place_type text, meters int)
language sql stable security definer set search_path = public, extensions
as $$
  select q.id, q.name, q.place_type, round(st_distance(q.location, p.location))::int
    from places p
    join places q on q.id <> p.id and not q.removed and st_dwithin(q.location, p.location, 3000)
   where p.id = p_id
     and (q.place_type = p.place_type or q.cuisine && p.cuisine)
     and exists (
       select 1 from claims a join claims b on a.need = b.need
        where a.place_id = p.id and b.place_id = q.id and a.status = 'verified' and b.status = 'verified')
   order by (q.cuisine && p.cuisine) desc nulls last, st_distance(q.location, p.location)
   limit 4
$$;

-- ---------- what a verified owner can update ----------
alter table places add column if not exists menu_url text;

create or replace function place_business(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'menuUrl', p.menu_url,
    'isOwner', p.owner_id = auth.uid() and p.owner_verified_at is not null)
    from places p where p.id = p_id
$$;

create or replace function owner_update_place(p_id uuid, p_hours jsonb, p_phone text, p_website text, p_menu_url text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from places where id = p_id and owner_id = auth.uid() and owner_verified_at is not null) then
    raise exception 'Verified owners only';
  end if;
  if p_hours is not null and jsonb_typeof(p_hours) <> 'object' then raise exception 'Bad hours'; end if;
  if p_website is not null and (p_website !~* '^https?://' or length(p_website) > 300) then raise exception 'Bad link'; end if;
  if p_menu_url is not null and (p_menu_url !~* '^https?://' or length(p_menu_url) > 300) then raise exception 'Bad link'; end if;
  if length(p_phone) > 30 then raise exception 'Bad phone'; end if;
  update places set hours = p_hours, phone = p_phone, website = p_website, menu_url = p_menu_url where id = p_id;
end;
$$;

-- ---------- search insights: words and cities only, never who searched ----------
create table if not exists search_terms (
  term text primary key, times int not null default 1, last_seen timestamptz not null default now());
create table if not exists search_cities (
  name text primary key, lat double precision not null, lng double precision not null,
  times int not null default 1, last_seen timestamptz not null default now());
alter table search_terms enable row level security;
alter table search_cities enable row level security;

create or replace function log_search(p_term text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v text := lower(trim(p_term));
begin
  if length(v) not between 2 and 40 or v ~ '[0-9@]' then return; end if;
  update search_terms set times = times + 1, last_seen = now() where term = v;
  if not found and (select count(*) from search_terms) < 5000 then
    insert into search_terms (term) values (v) on conflict do nothing;
  end if;
end;
$$;

create or replace function log_city(p_name text, p_lat double precision, p_lng double precision)
returns void
language plpgsql security definer set search_path = public
as $$
declare v text := left(trim(p_name), 60);
begin
  if v = '' or p_lat not between 29.4 and 33.4 or p_lng not between 34.2 and 35.95 then return; end if;
  update search_cities set times = times + 1, last_seen = now() where name = v;
  if not found and (select count(*) from search_cities) < 1000 then
    insert into search_cities (name, lat, lng) values (v, p_lat, p_lng) on conflict do nothing;
  end if;
end;
$$;

-- ---------- the admin dashboard ----------
create or replace function admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public, extensions
as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    'newUsers', (select count(*) from auth.users where not coalesce(is_anonymous, false) and created_at > now() - interval '7 days'),
    'places', (select count(*) from places where not removed),
    'verified', (select count(*) from claims where status = 'verified' and source = 'community'),
    'reviews', (select count(*) from reviews),
    'lists', (select count(*) from lists),
    'searches', coalesce((select jsonb_agg(jsonb_build_object('term', t.term, 'times', t.times))
       from (select term, times from search_terms order by times desc limit 12) t), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'times', c.times, 'places', c.places))
       from (select s.name, s.times,
                    (select count(*) from places p where not p.removed
                      and st_dwithin(p.location, st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography, 3000)) as places
               from search_cities s order by s.times desc limit 12) c), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- ---------- reviews on the profile, for the badges ----------
drop function if exists public_profile(uuid);
create function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint, favorite_food text, reviews bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id),
         (select count(*) from claims where proposed_by = p.id),
         (select count(*) from claim_votes where user_id = p.id and vote = 1),
         nullif(p.favorite_food, ''),
         (select count(*) from reviews r where r.user_id = p.id)
    from profiles p
   where p.id = p_id
$$;

grant select on lists, list_places to anon, authenticated;
grant insert, update, delete on lists, list_places to authenticated;
grant execute on function public_profile(uuid) to anon, authenticated;
grant execute on function list_view(uuid) to anon, authenticated;
grant execute on function similar_places(uuid) to anon, authenticated;
grant execute on function place_business(uuid) to anon, authenticated;
grant execute on function log_search(text) to anon, authenticated;
grant execute on function log_city(text, double precision, double precision) to anon, authenticated;
revoke execute on function my_notifications() from anon, public;
revoke execute on function mark_notifications_seen() from anon, public;
revoke execute on function owner_update_place(uuid, jsonb, text, text, text) from anon, public;
revoke execute on function admin_dashboard() from anon, public;
revoke execute on function lists_limit() from anon, authenticated, public;
grant execute on function my_notifications() to authenticated;
grant execute on function mark_notifications_seen() to authenticated;
grant execute on function owner_update_place(uuid, jsonb, text, text, text) to authenticated;
grant execute on function admin_dashboard() to authenticated;
notify pgrst, 'reload schema';


-- ===== 0025_real_accounts_only.sql =====
-- Okeat — only real accounts can change information, and a moderator's decision closes a report
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- Looking stays open to everyone. Adding, confirming, reporting and fixing need an account.
create or replace function require_real_account()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not is_real_user() then
    raise exception 'Sign in with an account';
  end if;
  return new;
end;
$$;

drop trigger if exists a_real_account on places;
create trigger a_real_account before insert on places for each row execute function require_real_account();
drop trigger if exists a_real_account on claims;
create trigger a_real_account before insert on claims for each row execute function require_real_account();
drop trigger if exists a_real_account on claim_votes;
create trigger a_real_account before insert on claim_votes for each row execute function require_real_account();
drop trigger if exists a_real_account on place_reports;
create trigger a_real_account before insert on place_reports for each row execute function require_real_account();

-- A moderator's "correct" clears the reports, and "not correct" takes the item off the list.
create or replace function moderate_claim(p_claim uuid, p_verify boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c claims%rowtype;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select * into c from claims where id = p_claim for update;
  if p_verify then
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = coalesce(verified_at, now()), last_confirmed_at = now(),
                      source = 'community', reject_count = 0
     where id = c.id;
  else
    update claims set status = 'rejected' where id = c.id;
  end if;
end;
$$;

-- Only open items are shown, so a decided one leaves the list.
create or replace function moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return jsonb_build_object(
    'reported', coalesce((select jsonb_agg(x order by x->>'reports' desc) from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address,
                 'reports', (select count(*) from place_reports r where r.place_id = p.id),
                 'reasons', (select jsonb_agg(r.reason) from place_reports r where r.place_id = p.id and r.reason is not null)) x
          from places p where p.flagged and not p.removed) q), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', c.id, 'placeId', p.id, 'placeName', p.name, 'need', c.need, 'level', c.level,
                 'status', c.status, 'source', c.source, 'confirm', c.confirm_count, 'reject', c.reject_count) x
          from claims c join places p on p.id = c.place_id
         where not p.removed and (c.status = 'disputed' or (c.source in ('auto', 'osm') and c.reject_count > 0 and c.status in ('verified', 'pending'))
                or (c.status = 'pending' and c.reject_count > 0))
         order by c.reject_count desc limit 100) q), '[]'::jsonb),
    'owners', case when is_admin() then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', o.id, 'placeId', p.id, 'placeName', p.name, 'code', o.code,
                 'proofUrl', o.proof_url, 'note', o.note, 'user', pr.display_name, 'createdAt', o.created_at) x
          from owner_requests o join places p on p.id = o.place_id join profiles pr on pr.id = o.user_id
         where o.status = 'pending' and o.proof_url is not null order by o.created_at) q), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

notify pgrst, 'reload schema';


-- ===== 0026_confirmed_users_only.sql =====
-- Okeat — people who haven't finished signing in are not counted as registered users
-- (run once in Supabase → SQL Editor → Run; safe to run again)
-- Asking for a sign-in email creates an unconfirmed account. It becomes real only after the link or code is used.

create or replace function admin_users()
returns table (id uuid, name text, email text, role text, joined timestamptz, last_seen timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select u.id, nullif(p.display_name, ''), u.email::text, p.role, u.created_at, u.last_sign_in_at
      from auth.users u
      join profiles p on p.id = u.id
     where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
     order by u.created_at desc
     limit 1000;
end;
$$;

create or replace function admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public, extensions
as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users where not coalesce(is_anonymous, false) and email_confirmed_at is not null),
    'newUsers', (select count(*) from auth.users where not coalesce(is_anonymous, false) and email_confirmed_at is not null and created_at > now() - interval '7 days'),
    'places', (select count(*) from places where not removed),
    'verified', (select count(*) from claims where status = 'verified' and source = 'community'),
    'reviews', (select count(*) from reviews),
    'lists', (select count(*) from lists),
    'searches', coalesce((select jsonb_agg(jsonb_build_object('term', t.term, 'times', t.times))
       from (select term, times from search_terms order by times desc limit 12) t), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'times', c.times, 'places', c.places))
       from (select s.name, s.times,
                    (select count(*) from places p where not p.removed
                      and st_dwithin(p.location, st_setsrid(st_makepoint(s.lng, s.lat), 4326)::geography, 3000)) as places
               from search_cities s order by s.times desc limit 12) c), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

notify pgrst, 'reload schema';


-- ===== 0027_usage_limits.sql =====
-- Okeat — usage numbers for the admin's limits page (run once in Supabase → SQL Editor → Run; safe to run again)

-- How many sign-in emails left the site each hour. Only a count, never an address.
create table if not exists mail_counts (
  hour timestamptz primary key,
  sent int not null default 0
);
alter table mail_counts enable row level security;

create or replace function log_mail_sent()
returns void
language sql security definer set search_path = public
as $$
  insert into mail_counts (hour, sent) values (date_trunc('hour', now()), 1)
  on conflict (hour) do update set sent = mail_counts.sent + 1
$$;

create or replace function admin_limits()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'mailHour', coalesce((select sum(sent) from mail_counts where hour >= date_trunc('hour', now())), 0),
    'mailDay', coalesce((select sum(sent) from mail_counts where hour >= today), 0),
    'mailWeek', coalesce((select sum(sent) from mail_counts where hour >= now() - interval '7 days'), 0),
    'mailMonth', coalesce((select sum(sent) from mail_counts where hour >= now() - interval '30 days'), 0),
    'signInsToday', (select count(*) from auth.users where not coalesce(is_anonymous, false) and last_sign_in_at >= today),
    'signInsWeek', (select count(*) from auth.users where not coalesce(is_anonymous, false) and last_sign_in_at >= now() - interval '7 days'),
    'signUpsToday', (select count(*) from auth.users where not coalesce(is_anonymous, false) and email_confirmed_at >= today),
    'activeMonth', (select count(*) from auth.users where not coalesce(is_anonymous, false) and last_sign_in_at >= now() - interval '30 days'),
    'dbBytes', pg_database_size(current_database()),
    'storageBytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0)
  ) into result;
  return result;
end;
$$;

revoke execute on function admin_limits() from anon, public;
grant execute on function admin_limits() to authenticated;
grant execute on function log_mail_sent() to anon, authenticated;
notify pgrst, 'reload schema';


-- ===== 0028_ratings_activity_log.sql =====
-- Okeat — ratings in the list, more notifications and a log of admin actions
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function place_ratings(p_ids uuid[])
returns table (place_id uuid, average numeric, total bigint)
language sql stable security definer set search_path = public
as $$
  select r.place_id, round(avg(r.rating), 1), count(*)
    from reviews r where r.place_id = any (p_ids) group by r.place_id
$$;
grant execute on function place_ratings(uuid[]) to anon, authenticated;

-- ---------- notifications: someone confirmed what you added ----------
create or replace function my_notifications()
returns table (kind text, place_id uuid, place_name text, need text, happened_at timestamptz, is_new boolean)
language sql stable security definer set search_path = public
as $$
  with mine as (select notifications_seen_at as seen from profiles where id = auth.uid()),
  events as (
    select 'approved'::text as kind, p.id as place_id, p.name as place_name, c.need::text as need, c.verified_at as happened_at
      from claims c join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status = 'verified' and c.source = 'community'
       and c.verified_at > now() - interval '30 days' and not p.removed
    union all
    select 'expiring', p.id, p.name, 'kosher', (k.valid_until - 30)::timestamptz
      from kosher_certificates k
      join claims c on c.id = k.claim_id
      join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status in ('verified', 'pending')
       and k.valid_until between current_date and current_date + 30 and not p.removed
    union all
    select 'confirmed', p.id, p.name, c.need::text, max(v.created_at)
      from claim_votes v
      join claims c on c.id = v.claim_id
      join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and v.vote = 1 and v.user_id <> auth.uid()
       and c.status = 'pending' and v.created_at > now() - interval '30 days' and not p.removed
     group by p.id, p.name, c.need
  )
  select e.kind, e.place_id, e.place_name, e.need, e.happened_at, e.happened_at > m.seen
    from events e cross join mine m
   order by e.happened_at desc
   limit 50
$$;

-- ---------- what moderators and admins did ----------
create table if not exists admin_log (
  id     bigserial primary key,
  actor  uuid references profiles (id) on delete set null,
  action text not null,
  detail text,
  at     timestamptz not null default now()
);
alter table admin_log enable row level security;

create or replace function log_admin_action() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_detail text;
begin
  if auth.uid() is null or not is_moderator() then return coalesce(new, old); end if;
  if tg_table_name = 'claims' and new.status is distinct from old.status then
    v_action := 'claim_' || new.status::text;
    select name into v_detail from places where id = new.place_id;
    v_detail := v_detail || ': ' || new.need::text;
  elsif tg_table_name = 'places' and new.removed is distinct from old.removed then
    v_action := case when new.removed then 'place_removed' else 'place_restored' end;
    v_detail := new.name;
  elsif tg_table_name = 'profiles' and new.role is distinct from old.role then
    v_action := 'role_' || new.role;
    v_detail := coalesce(new.display_name, new.id::text);
  elsif tg_table_name = 'reviews' and old.user_id <> auth.uid() then
    v_action := 'review_deleted';
    select name into v_detail from places where id = old.place_id;
  end if;
  if v_action is not null then
    insert into admin_log (actor, action, detail) values (auth.uid(), v_action, v_detail);
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists log_claims on claims;
create trigger log_claims after update on claims for each row execute function log_admin_action();
drop trigger if exists log_places on places;
create trigger log_places after update on places for each row execute function log_admin_action();
drop trigger if exists log_profiles on profiles;
create trigger log_profiles after update on profiles for each row execute function log_admin_action();
drop trigger if exists log_reviews on reviews;
create trigger log_reviews after delete on reviews for each row execute function log_admin_action();

create or replace function admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot delete your own account here'; end if;
  if is_admin(p_user) then raise exception 'Change this admin to a regular user first'; end if;
  select coalesce(display_name, 'משתמש/ת') into v_name from profiles where id = p_user;
  delete from auth.users where id = p_user;
  insert into admin_log (actor, action, detail) values (auth.uid(), 'user_deleted', v_name);
end;
$$;

create or replace function admin_activity()
returns table (id bigint, actor text, action text, detail text, at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select l.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), l.action, l.detail, l.at
      from admin_log l left join profiles p on p.id = l.actor
     order by l.at desc limit 200;
end;
$$;

revoke execute on function log_admin_action() from anon, authenticated, public;
revoke execute on function admin_activity() from anon, public;
grant execute on function admin_activity() to authenticated;
notify pgrst, 'reload schema';


-- ===== 0029_fix_activity_log.sql =====
-- Okeat: the activity log broke moderator updates. One trigger serves four tables,
-- and it read fields that only some of them have. Each table now has its own branch.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function log_admin_action() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_detail text;
begin
  if auth.uid() is null or not is_moderator() then return coalesce(new, old); end if;

  if tg_table_name = 'claims' then
    if new.status is distinct from old.status then
      v_action := 'claim_' || new.status::text;
      select name into v_detail from places where id = new.place_id;
      v_detail := v_detail || ': ' || new.need::text;
    end if;
  elsif tg_table_name = 'places' then
    if new.removed is distinct from old.removed then
      v_action := case when new.removed then 'place_removed' else 'place_restored' end;
      v_detail := new.name;
    end if;
  elsif tg_table_name = 'profiles' then
    if new.role is distinct from old.role then
      v_action := 'role_' || new.role;
      v_detail := coalesce(new.display_name, new.id::text);
    end if;
  elsif tg_table_name = 'reviews' then
    if old.user_id <> auth.uid() then
      v_action := 'review_deleted';
      select name into v_detail from places where id = old.place_id;
    end if;
  end if;

  if v_action is not null then
    insert into admin_log (actor, action, detail) values (auth.uid(), v_action, v_detail);
  end if;
  return coalesce(new, old);
end; $$;

notify pgrst, 'reload schema';


-- ===== 0030_vegan_and_account_rules.sql =====
-- Okeat: what is vegan is also vegetarian, and photos and the confirmation list need a real account.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- ---------- a vegan place counts as vegetarian ----------
create or replace function mark_vegetarian(
  p_place uuid, p_level text, p_source text, p_confirmed int, p_verified timestamptz, p_last timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- one verified claim per place and need, so an open proposal gives way
  update claims set status = 'superseded'
   where place_id = p_place and need = 'vegetarian' and status = 'pending';
  update claims set level = 'full'
   where place_id = p_place and need = 'vegetarian' and status = 'verified' and p_level = 'full' and level <> 'full';
  insert into claims (place_id, need, level, status, source, confirm_count, verified_at, last_confirmed_at)
  select p_place, 'vegetarian', p_level, 'verified', p_source, p_confirmed, p_verified, p_last
   where not exists (select 1 from claims where place_id = p_place and need = 'vegetarian' and status = 'verified');
end; $$;
revoke execute on function mark_vegetarian(uuid, text, text, int, timestamptz, timestamptz) from anon, authenticated, public;

create or replace function vegan_is_vegetarian() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform mark_vegetarian(new.place_id, new.level, new.source, new.confirm_count, new.verified_at, new.last_confirmed_at);
  return new;
end; $$;

drop trigger if exists vegan_is_vegetarian on claims;
create trigger vegan_is_vegetarian after insert or update of status, level on claims
  for each row when (new.need = 'vegan' and new.status = 'verified')
  execute function vegan_is_vegetarian();

-- the vegan places already on the map
do $$
declare c record;
begin
  for c in select * from claims where need = 'vegan' and status = 'verified' loop
    perform mark_vegetarian(c.place_id, c.level, c.source, c.confirm_count, c.verified_at, c.last_confirmed_at);
  end loop;
end $$;

-- ---------- certificate photos: a real account only, as with place photos ----------
drop policy if exists "upload certificate photos to own folder" on storage.objects;
create policy "upload certificate photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());

-- ---------- what waits for confirmation is for signed-in people ----------
revoke execute on function pending_claims_near(double precision, double precision, int) from anon, public;
grant execute on function pending_claims_near(double precision, double precision, int) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0031_food_type_fixes.sql =====
-- Okeat: places that got the wrong food type because a word only looked like food.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- kiosks and nut shops were read as pizzerias, because of the letters in their name
update claims set status = 'rejected'
 where source = 'auto' and confirm_count = 0 and status = 'verified'
   and place_id in (select id from places where place_type = 'pizza' and name ~ 'פיצוח|פיצוצ' and name !~ 'פיצה|פיצרי');

update places
   set place_type = 'stand', cuisine = nullif(array_remove(cuisine, 'pizza'), '{}')
 where place_type = 'pizza' and name ~ 'פיצוח|פיצוצ' and name !~ 'פיצה|פיצרי';

-- cafes that were stored as something else
update places
   set place_type = 'cafe', cuisine = array['coffee_shop']
 where name in ('קפה פיצי', 'קפה נטו', 'Coffee-Chino  קופיצ''ינו') and place_type in ('pizza', 'hummus');

-- names that only contain the letters of a food word
update places set cuisine = nullif(array_remove(cuisine, 'indian'), '{}')
 where cuisine_source = 'auto' and cuisine @> array['indian'] and name ~* 'יהודית|הודיה|סנדיאנה|sindiana';

update places set cuisine = nullif(array_remove(cuisine, 'italian'), '{}')
 where cuisine_source = 'auto' and cuisine @> array['italian'] and name ~* 'meital|lital|digital|ital" fish';


-- ===== 0032_remove_non_food_places.sql =====
-- Okeat: businesses that are not places to eat, such as offices, clinics and garages.
-- They are hidden from the map, not deleted, so any of them can be brought back.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
update places set removed = true where id in (
  '98511bf6-c343-41e1-b024-c83abe1c0b22',  -- בית ספר נזאמיה/דרך בית חנינא
  '588dcb73-830a-438c-8aec-9ba1a352b75e',  -- טויז4פאן חנות למבוגרים ומוצרי אהבה באשקלון
  '5385e09e-2f51-4ad5-af1c-6a6c55579bf6',  -- טויז4פאן - חנות למבוגרים ומוצרי אהבה באשדוד
  'd86b5a93-74ea-4d6f-b9a7-bb59b8bc96e0',  -- חומרי גלם לאפיה הכי איכותי,הכי זול
  '2d19d0af-83c2-4222-8f80-3b2b11288619',  -- גסטרו לוי - ציוד מטבח תעשייתי למסעדות, בתי קפה, מזון מהיר, פ
  '44bdf2cf-137c-43c1-a671-6ee3caf70b80',  -- וילונור - וילונות לסלון, לבית ולמשרד
  '08c71f7c-4b56-4dcc-aad0-9f5b10ebf909',  -- יוזוק מלכין ושות': משרד עו"ד מקרקעין מתמחה פינוי בינוי התחדש
  '36af5d29-9684-4c13-8593-c6ec5fee3f28',  -- freesbe - ציוד מכני הנדסי
  'd4b231bb-fa5c-4b3a-b1d3-4853d731dfab',  -- משרד עורכי דין מקרקעין אמיר שטיינהרץ ושות' - נדל"ן, תמ"א 38,
  'ba19690c-0588-40fb-b9de-142295924745',  -- טכנו-אייס היבואן הרשמי - מכונות ברד , גלידה ואייס קפה
  '79cbb5c2-ae63-450d-a1a3-2fb671b9c0b6',  -- אלגמיש ד.ק - ציוד למאפיות וקונדיטוריות
  '24560809-7e72-4dc7-ade7-19f612a43b81',  -- לירון בראשית- ייצור ושיווק אריזות וציוד לאופה
  'cc8035f7-1cfc-40c0-99b8-6a76a332278e',  -- לירון בראשית- ייצור ושיווק אריזות וציוד לאופה
  'e407db4c-2081-4a7c-a639-421461512f34',  -- פינוקים - חומרי גלם לאפייה גבעת ברנר
  '62b0e45b-cc53-49c9-a5a9-23cc0d89e2bf',  -- אמריליס בוטיק פרחים
  '4cbbba67-7017-40ba-9cd6-ebd3ab7207a6',  -- סטודיו וידה - הדמיות ואנימציה בתלת מימד
  '7cde369d-9efc-412a-a920-cfa418873f69',  -- רונבי - הכל לבית ולמשרד
  '1f346e12-71c8-4ecc-8dbf-96c43a932d43',  -- פופה טבקו-רמת גן
  '51dfecf0-f715-4ecc-8e28-56e1e6232719',  -- קליניקה Dao
  'b80b0650-994a-40b3-a94c-53a971860b8c',  -- BP
  '906b1b22-a658-46f4-af27-bc79e7a84d5e',  -- BP
  '301dc413-01ca-4e9a-9b56-fc7dc4aa7fa9',  -- תחנת דלק זכרון יעקב
  '692a9729-4641-4b46-8ea5-a0313ed8cc6b',  -- נעמה דבורה- רפואה סינית מסורתית באהבה
  '2287434c-4de6-4909-87b6-bd121cbd3bed',  -- J. Gottlieb Bakery Equipment  - י. גוטליב ציוד למאפיות וקונד
  '157de930-ed95-41b3-b7fb-27810273a6f8',  -- אייל מדיקל - ציוד רפואי ווטרינרי
  'a706e7fd-af81-469f-b345-b35658a78282',  -- הבראה - קליניקה לרפואה סינית בצפון
  '4a8bb3db-17da-44e1-a1f1-1f92132f6c9c',  -- פאי - תחנת דלק
  'e26c48d4-7b40-4218-96a0-efced5cc90e0',  -- יבוא ושיווק ציוד לגלידריות Shlomi kooper
  '5c0feb26-4b4e-42d7-a8a2-1c9dab509dae',  -- ״אקיטה״ מזון וציוד לחיות מחמד
  '1120aaf2-5993-4db0-9868-6891046259d0',  -- Empira Gym Pilates
  'efbba089-231a-4eb0-acad-00a2e7e9da53',  -- מרכז הטבק ג'ורג'
  'c3d4a2ec-a323-4aff-8142-9d3e67806101',  -- מוסקט - גלריה לעיצוב הבית
  'bc9f65e6-86b0-4fd5-b136-4a791be63a0f',  -- אבירם דהן, ייעוץ ותיווך נדל״ן
  'e613286d-5b12-4778-be3d-de6909a491ba',  -- שליו אדרי נדל״ן באר שבע
  '1a68210f-5654-463e-9f00-dd194f3f730b',  -- מחסני מיזוג האומן 27
  '5cce3d54-c9dc-482a-8029-23754e0d4884',  -- Christian Quarter Jewelry
  'abae6fc7-0f83-41fe-87a5-1e09439105df',  -- BIG Fashion Glilot  ביג פאשן גלילות
  'e6afa6ca-4cf2-4f96-b29a-cba1ff711f71',  -- BIG Fashion Glilot  ביג פאשן גלילות
  'df227dd9-5dae-4f05-ad82-b8f27ebd8f64',  -- ערן חיון - רפואה סינית לפריון והריון
  'fc89e1c9-785b-4adf-b39c-09e90084d8fb',  -- טלי בוכסווילר - עו"ד מגשרת משפחה וגירושין
  '75ccf1b6-fd57-429f-8b4e-3785a9e79464',  -- Hair by Nelly
  'f9db9669-71b0-415e-b38e-380b2f6d3299',  -- Academy karate Shinkyokushin in Petach-tikva
  'b9a24588-044c-4ca1-84c6-d48c13317384',  -- The Barbers - Est 2009
  '5ee42921-e1c7-4a4e-b549-12c1237f8fc0',  -- טרמוס - אומנות, עיצוב, טרריומים, אדריכלות נוף
  '841b8573-0a61-4e44-b22b-45402388eba3',  -- המרכז לרפואה סינית בכפר סבא
  '79b67cf3-34b0-435b-8fa9-9e2a6c130f84',  -- Omar tours & عمر تورز
  '536cc48b-1e7e-4611-8373-310356fc1232',  -- S.c hair desing
  'fb5dcfba-548b-4005-a997-7c15cdfa511d',  -- שטיפת רכב הבנים
  'c417d513-0113-4109-92e7-dcc0aa4c5315',  -- As פתרונות שיווק ופרסום לעסקים
  '4cffa7cf-1d6d-420d-893e-4b1c8de08348',  -- קובי חמו יועץ נדל"ן
  '3f560ace-9f6d-4b64-8d5e-e9ba0b78042a',  -- שטיפת רכב יוקרה פאדי
  'b8c1c2c3-266f-4443-ab6c-5d8ac9c92e3e',  -- Landmax - לאנדמקס נדל"ן
  '0d9e1b93-5981-4370-8779-ce1151258356',  -- שרף עסקי רכב
  'e6e61e05-a503-4922-a5ff-1b26572776da',  -- מועצה מקומית מגדל
  '05f766c5-1006-44ce-a708-794bc0918143',  -- מוסך מוניר - אמירקאן מוטרס
  '089d74da-2f40-481c-b0e4-689998d4d05e',  -- דיקור יפני ורפואה הוליסטית
  'd6f0b7b0-57c6-463d-a3c0-82b58eddc7dc',  -- דיקור יפני ורפואה הוליסטית
  'c9b9c79e-3d42-458a-aa7a-dcf6a11cb756',  -- My spa
  '6856854f-e132-40ab-9518-cb6d3bcef358',  -- צומת ספרים - דיזינגוף 163
  'fa716883-eff5-4ca6-aab5-cd66877c7f00',  -- תאיר - חומרי בניין בע"מ
  '559432e4-5c82-4a6a-96b9-23c809572e98'  -- בניין לימודים
);


-- ===== 0033_hide_event_halls.sql =====
-- Okeat: event halls are not places to go out and eat. Hidden, not deleted.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
update places set removed = true where id in (
  '0e8e0b46-35ac-452f-b73f-870246e843f3',  -- אולמי כינור דוד
  '953e45a5-6c88-49a6-8ca9-229a54073472',  -- אולמי נאמן אופקים
  '575071b2-1941-4eba-a388-c70b86bf8fb9',  -- אולמי רויאל
  '808425ac-ac42-42be-8b0b-72f1273a11ea',  -- אולמי נאות ירושלים
  '0929d204-6175-41c3-9ea7-ef75178515b5',  -- אולמי קונקורד
  '7369ef28-3a29-4fa0-924b-1910f5b16f0c',  -- אולמי מונדיאל
  '2a772803-ce39-4409-a5c3-4ed7a07e1e4d',  -- אולמי פביליון
  '93654123-0e7a-4d92-83ec-1e2e7e601476',  -- אולמי הוד והדר
  'de3e938e-32da-4a6f-8473-66cf56d9a4dc',  -- אולמי יוניברס
  '7c94ff8a-52df-489b-9b9b-4c6dfb12f156',  -- אולמי נאות ירושלים
  '984e57d4-23d8-49a9-a46a-237699e100fa',  -- אולמי קונקורד
  'a8bfa1f0-3700-4f9b-bf29-830f87dbaa5a',  -- אולמי התמר
  'ac7a9ab0-cdd9-43d7-9513-5dcbb91ac286',  -- Leonardo Hall - Зал Торжеств
  '827e5c50-7009-40d4-a224-9e761eefc643',  -- אולמי ארמונות וואלף
  'dfa62eb3-365e-492d-9a38-c41585c40f9c',  -- אולם אירועים עדן
  '150696d2-97ab-4b69-9ff1-384785074bf0',  -- אולמי קאלה
  'a9af70d5-24db-41a3-b08f-91e681d7e942',  -- אולמי היהלום שבכתר
  '90479f87-4036-43ef-8c50-cc57c3ed8d53',  -- אולמי ארמונות אור
  '3ad93ee6-484f-4bca-abd8-f9b2eb3ebf76',  -- אולמי גוטניק
  '1c05e43d-2c4b-4630-a62b-49df854dfd07',  -- אולמי שירת הים
  'c93723c2-709d-4e19-bb03-dd3611335e7c',  -- אולמי זוויעל
  '23b2f862-cab8-45ee-b21a-f19bae76dc24',  -- אולמי תמיר
  '0197b569-4d95-4f65-8a34-11c92602e8a1',  -- אולמי סאטמר
  '0ecf74d1-6c55-45c4-880e-c6c28c75180d',  -- אולמי סוכת דוד
  '78719217-1ae4-4eac-9009-5fdcc5a82cf5',  -- אולמי בית ישראל
  '5599926c-fa57-4e75-a5fe-6600a9225161',  -- אולמי גרוזאלם פלאם
  '36ed4b7d-e134-47e1-b3f1-3575e70e0808',  -- אולמי היכל דוד
  '255c8035-e1df-4d81-b013-432db19f0172',  -- אולמי סדיגורא
  '10178253-cf37-436a-8c11-a433bf652eb0',  -- אולמי היזדים
  '1c4fcd41-2e76-4fc5-9cc7-22fa17b7bcd9',  -- אולמי סאטמר
  '28de8470-3af6-4421-9e75-e3ddcc35c9b2',  -- אולמי בית יעקב הישן
  'b63c03f5-1198-40f1-b01a-a497f2f1b1bd',  -- אולמי בערגער
  'e584ea53-5449-474f-b5c6-7367226fea79',  -- אולמי בנות ירושלים
  'a12c1cec-1429-4c29-a7a1-8bd3a3e9820b',  -- אולמי דרכי דוד
  '0127af3a-d036-426a-815e-68fea8949e84',  -- אולמי דרכי דוד
  '05ff2d30-05cd-4ae1-b47b-3df0a7eb258d',  -- אולמי קונטיננטל
  'a5932002-0d88-4e10-8dd6-4063f69a0179',  -- אולמי ויזניץ - צציפרי קלאס
  '58acd9ec-07b3-45c9-8c55-9d38384f2c53',  -- אולמי היכלי מלכות
  '67e6516f-abb8-48c6-b335-32039eaa43fd',  -- אולמי סגנון
  '01aa7149-bbcd-433d-8879-b72988f5cbcd',  -- אולמי אורה
  '7e81a680-3cbd-4e0a-b4a7-0381833fe016',  -- אולמי ווין WIN
  '9306e6bd-9721-44a1-91de-604085d3e89e',  -- אולמי פרידמאן
  '4c219712-adc3-4eef-9ef3-866ad3481cd5',  -- אולמי פלמר
  '4bded841-f490-47ae-a9ae-cfdb146ee038',  -- אולם שמחות  אצל אליק
  '5ef11bf7-a582-436e-911d-213e54992f32',  -- אולמי פאלאס
  '8e3b40b3-bd97-4b9e-96c2-515fc600d966',  -- אולמי פארהאנד
  '210a51e0-cb60-4dc9-8d21-85238613797e'  -- אולמי אהבת תורה
);


-- ===== 0034_admin_place_tools.sql =====
-- Okeat: the admin can fix a place's details and food types, find any place, and bring back a hidden one.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_update_place(
  p_place uuid, p_name text, p_type text, p_cuisine text[], p_address text, p_phone text, p_website text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'A place needs a name'; end if;
  if p_type not in ('restaurant', 'cafe', 'bakery', 'pizza', 'ice_cream', 'hummus', 'sushi', 'grill', 'vegan_restaurant', 'stand', 'other') then
    raise exception 'Unknown place type';
  end if;
  update places
     set name = trim(p_name),
         place_type = p_type,
         cuisine = case when coalesce(array_length(p_cuisine, 1), 0) = 0 then null else p_cuisine end,
         cuisine_source = 'community',
         address = nullif(trim(coalesce(p_address, '')), ''),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         website = nullif(trim(coalesce(p_website, '')), '')
   where id = p_place;
  insert into admin_log (actor, action, detail) values (auth.uid(), 'place_edited', trim(p_name));
end; $$;

create or replace function admin_search_places(p_query text, p_hidden_only boolean default false)
returns table (id uuid, name text, place_type text, cuisine text[], address text, phone text, website text, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.place_type, p.cuisine, p.address, p.phone, p.website, p.removed
      from places p
     where p.merged_into is null
       and (not p_hidden_only or p.removed)
       and (coalesce(trim(p_query), '') = '' or p.name ilike '%' || trim(p_query) || '%')
     order by p.removed desc, p.name
     limit 50;
end; $$;

create or replace function admin_restore_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update places set removed = false where id = p_place;
end; $$;

revoke execute on function admin_update_place(uuid, text, text, text[], text, text, text) from anon, public;
revoke execute on function admin_search_places(text, boolean) from anon, public;
revoke execute on function admin_restore_place(uuid) from anon, public;
grant execute on function admin_update_place(uuid, text, text, text[], text, text, text) to authenticated;
grant execute on function admin_search_places(text, boolean) to authenticated;
grant execute on function admin_restore_place(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0035_my_activity.sql =====
-- Okeat: on your profile you can see what you added and confirmed, and take back what nobody relied on yet.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function my_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status <> 'superseded'), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

-- what you proposed can be taken back until someone confirmed it
create or replace function withdraw_claim(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims set status = 'rejected'
   where id = p_claim and proposed_by = auth.uid() and status = 'pending' and confirm_count = 0;
  if not found then raise exception 'Others already rely on this'; end if;
end; $$;

-- a place you added can be taken down while no one else added anything to it
create or replace function withdraw_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from claims c where c.place_id = p_place and (c.confirm_count > 0 or c.proposed_by is distinct from auth.uid()))
     or exists (select 1 from reviews r where r.place_id = p_place and r.user_id <> auth.uid()) then
    raise exception 'Others already rely on this';
  end if;
  update places set removed = true where id = p_place and created_by = auth.uid();
  if not found then raise exception 'Others already rely on this'; end if;
end; $$;

revoke execute on function my_activity() from anon, public;
revoke execute on function withdraw_claim(uuid) from anon, public;
revoke execute on function withdraw_place(uuid) from anon, public;
grant execute on function my_activity() to authenticated;
grant execute on function withdraw_claim(uuid) to authenticated;
grant execute on function withdraw_place(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0036_admin_stat_details.sql =====
-- Okeat: in the admin dashboard, the numbers open into the people and items behind them.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_stat_details(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;

  if p_kind in ('users', 'newUsers') then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'sub', x.email, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select u.id, coalesce(p.display_name, u.email) as title, u.email, u.created_at
              from auth.users u left join profiles p on p.id = u.id
             where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
               and (p_kind = 'users' or u.created_at > now() - interval '7 days')
             order by u.created_at desc limit 200) x;

  elsif p_kind = 'verified' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.name, 'placeId', x.place_id, 'need', x.need, 'level', x.level,
                                                 'count', x.confirm_count, 'at', x.verified_at) order by x.verified_at desc nulls last), '[]'::jsonb)
      into result
      from (select c.id, p.name, c.place_id, c.need, c.level, c.confirm_count, c.verified_at
              from claims c join places p on p.id = c.place_id
             where c.status = 'verified' and c.source = 'community'
             order by c.verified_at desc nulls last limit 200) x;

  elsif p_kind = 'reviews' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.user_id::text || x.place_id::text, 'title', x.name, 'placeId', x.place_id, 'rating', x.rating,
                                                 'sub', x.comment, 'by', x.author, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select r.user_id, r.place_id, p.name, r.rating, r.comment, pr.display_name as author, r.created_at
              from reviews r join places p on p.id = r.place_id
              left join profiles pr on pr.id = r.user_id
             order by r.created_at desc limit 200) x;

  elsif p_kind = 'lists' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'by', x.author, 'count', x.places, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select l.id, l.title, pr.display_name as author, l.created_at,
                   (select count(*) from list_places lp where lp.list_id = l.id) as places
              from lists l left join profiles pr on pr.id = l.owner_id
             order by l.created_at desc limit 200) x;

  else
    raise exception 'Unknown kind';
  end if;

  return result;
end;
$$;

revoke all on function admin_stat_details(text) from public, anon;
grant execute on function admin_stat_details(text) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0037_edit_my_contributions.sql =====
-- Okeat: people can fix or delete what they added. A change goes back for confirmation.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- A changed detail starts over: old confirmations were for the old wording.
-- Kosher stays out: its level comes with a certificate, so it is deleted and added again.
create or replace function update_my_claim(p_claim uuid, p_level text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims
     set level = p_level, status = 'pending', confirm_count = 0, reject_count = 0,
         verified_at = null, last_confirmed_at = null
   where id = p_claim and proposed_by = auth.uid() and need <> 'kosher'
     and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
  delete from claim_votes where claim_id = p_claim;
end; $$;

create or replace function withdraw_claim(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims set status = 'rejected'
   where id = p_claim and proposed_by = auth.uid() and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
end; $$;

-- The change shows at once and waits in the admin's queue.
create or replace function update_my_place(p_place uuid, p_name text, p_address text, p_phone text, p_website text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'A place needs a name'; end if;
  if length(p_address) > 200 or length(p_phone) > 30 then raise exception 'That text is too long'; end if;
  if nullif(trim(p_website), '') is not null and (p_website !~* '^https?://' or length(p_website) > 300) then
    raise exception 'must start with https';
  end if;
  update places
     set name = trim(p_name), address = nullif(trim(p_address), ''), phone = nullif(trim(p_phone), ''),
         website = nullif(trim(p_website), ''), flagged = true
   where id = p_place and created_by = auth.uid() and not removed;
  if not found then raise exception 'You can only change your own details'; end if;
end; $$;

create or replace function my_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('superseded', 'rejected')), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

-- What was deleted stops counting on the profile.
create or replace function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint, favorite_food text, reviews bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id and not removed),
         (select count(*) from claims where proposed_by = p.id and status not in ('rejected', 'superseded')),
         (select count(*) from claim_votes where user_id = p.id and vote = 1),
         nullif(p.favorite_food, ''),
         (select count(*) from reviews r where r.user_id = p.id)
    from profiles p
   where p.id = p_id
$$;

revoke execute on function update_my_claim(uuid, text) from anon, public;
revoke execute on function update_my_place(uuid, text, text, text, text) from anon, public;
grant execute on function update_my_claim(uuid, text) to authenticated;
grant execute on function update_my_place(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0038_my_feed.sql =====
-- Okeat: your account shows everything you added, newest first, photos included.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function my_feed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) from (
    select *, row_number() over (order by at desc) as n from (
      select 'place' as kind, p.id::text as id, p.id as place_id, p.name as title, p.created_at as at,
             null::text as status, null::text as need, null::text as level, null::int as rating,
             null::text as comment, null::int as vote, null::text as path
        from places p where p.created_by = auth.uid() and not p.removed
      union all
      select 'claim', c.id::text, c.place_id, p.name, c.proposed_at, c.status::text, c.need::text, c.level, null, null, null, null
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('rejected', 'superseded')
      union all
      select 'vote', v.claim_id::text, c.place_id, p.name, v.created_at, null, c.need::text, c.level, null, null, v.vote, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed
      union all
      select 'review', r.place_id::text, r.place_id, p.name, r.created_at, null, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed
      union all
      select 'photo', ph.id::text, ph.place_id, p.name, ph.created_at,
             case when ph.approved then 'approved' else 'pending' end, null, null, null, null, null, ph.path
        from place_photos ph join places p on p.id = ph.place_id
       where ph.user_id = auth.uid() and not p.removed
      union all
      select 'list', l.id::text, null, l.title, l.created_at, null, null, null, null, null, null, null
        from lists l where l.owner_id = auth.uid()
      union all
      select 'saved', fv.place_id::text, fv.place_id, p.name, fv.created_at, null, null, null, null, null, null, null
        from favorites fv join places p on p.id = fv.place_id
       where fv.user_id = auth.uid() and not p.removed
    ) everything
  ) f where f.n <= 300;
$$;

revoke execute on function my_feed() from anon, public;
grant execute on function my_feed() to authenticated;

-- people can take down their own photos
drop policy if exists "remove own photo" on place_photos;
create policy "remove own photo" on place_photos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "remove own place photo files" on storage.objects;
create policy "remove own place photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';


-- ===== 0039_profile_setup_once.sql =====
-- Okeat: the "nice to meet you" window shows once per account, however you sign in.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table profiles add column if not exists setup_done boolean not null default false;

-- Whoever already set a name or a favorite food, and every admin or moderator, is done.
update profiles p set setup_done = true
  from auth.users u
 where u.id = p.id
   and (p.favorite_food is not null
        or p.role <> 'user'
        or (nullif(trim(p.display_name), '') is not null and p.display_name <> split_part(u.email, '@', 1)));

grant select (setup_done) on profiles to authenticated;
grant update (setup_done) on profiles to authenticated;

notify pgrst, 'reload schema';

-- ===== 0040_place_suggestions.sql =====
-- Okeat: anyone signed in can suggest what kind of place this is. A moderator approves it.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists place_suggestions (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid references profiles (id) on delete set null,
  place_type text not null,
  cuisine    text[] not null default '{}',
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists place_suggestions_pending on place_suggestions (created_at) where status = 'pending';
alter table place_suggestions enable row level security;
-- no direct access: everything goes through the functions below

create or replace function suggest_place_type(p_place uuid, p_type text, p_cuisine text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_real_user() then raise exception 'Sign in with an account'; end if;
  if p_type not in ('restaurant', 'cafe', 'bakery', 'pizza', 'ice_cream', 'hummus', 'sushi', 'grill', 'vegan_restaurant', 'stand', 'other') then
    raise exception 'Unknown place type';
  end if;
  if coalesce(array_length(p_cuisine, 1), 0) > 6 then raise exception 'That text is too long'; end if;
  if (select count(*) from place_suggestions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many requests';
  end if;
  if not exists (select 1 from places where id = p_place and not removed) then raise exception 'You can only change your own details'; end if;
  delete from place_suggestions where place_id = p_place and user_id = auth.uid() and status = 'pending';
  insert into place_suggestions (place_id, user_id, place_type, cuisine)
  values (p_place, auth.uid(), p_type, coalesce(p_cuisine, '{}'));
end; $$;

create or replace function pending_suggestions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return coalesce((select jsonb_agg(x order by x->>'at') from (
    select jsonb_build_object('id', s.id, 'placeId', p.id, 'name', p.name, 'oldType', p.place_type, 'oldCuisine', p.cuisine,
                              'newType', s.place_type, 'newCuisine', s.cuisine, 'by', pr.display_name, 'at', s.created_at) x
      from place_suggestions s join places p on p.id = s.place_id left join profiles pr on pr.id = s.user_id
     where s.status = 'pending' and not p.removed limit 100) q), '[]'::jsonb);
end; $$;

create or replace function decide_suggestion(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s place_suggestions;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  update place_suggestions set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and status = 'pending' returning * into s;
  if not found then return; end if;
  if p_approve then
    update places
       set place_type = s.place_type,
           cuisine = case when coalesce(array_length(s.cuisine, 1), 0) = 0 then cuisine else s.cuisine end,
           cuisine_source = 'community'
     where id = s.place_id;
    -- one decision per place: the other waiting suggestions are closed with it
    update place_suggestions set status = 'rejected' where place_id = s.place_id and status = 'pending';
  end if;
end; $$;

create or replace function my_feed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) from (
    select *, row_number() over (order by at desc) as n from (
      select 'place' as kind, p.id::text as id, p.id as place_id, p.name as title, p.created_at as at,
             null::text as status, null::text as need, null::text as level, null::int as rating,
             null::text as comment, null::int as vote, null::text as path
        from places p where p.created_by = auth.uid() and not p.removed
      union all
      select 'claim', c.id::text, c.place_id, p.name, c.proposed_at, c.status::text, c.need::text, c.level, null, null, null, null
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('rejected', 'superseded')
      union all
      select 'vote', v.claim_id::text, c.place_id, p.name, v.created_at, null, c.need::text, c.level, null, null, v.vote, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed
      union all
      select 'review', r.place_id::text, r.place_id, p.name, r.created_at, null, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed
      union all
      select 'photo', ph.id::text, ph.place_id, p.name, ph.created_at,
             case when ph.approved then 'approved' else 'pending' end, null, null, null, null, null, ph.path
        from place_photos ph join places p on p.id = ph.place_id
       where ph.user_id = auth.uid() and not p.removed
      union all
      select 'list', l.id::text, null, l.title, l.created_at, null, null, null, null, null, null, null
        from lists l where l.owner_id = auth.uid()
      union all
      select 'suggestion', sg.id::text, sg.place_id, p.name, sg.created_at, sg.status, null, sg.place_type, null, null, null, null
        from place_suggestions sg join places p on p.id = sg.place_id
       where sg.user_id = auth.uid() and not p.removed
      union all
      select 'saved', fv.place_id::text, fv.place_id, p.name, fv.created_at, null, null, null, null, null, null, null
        from favorites fv join places p on p.id = fv.place_id
       where fv.user_id = auth.uid() and not p.removed
    ) everything
  ) f where f.n <= 300;
$$;

revoke execute on function suggest_place_type(uuid, text, text[]) from anon, public;
revoke execute on function pending_suggestions() from anon, public;
revoke execute on function decide_suggestion(uuid, boolean) from anon, public;
grant execute on function suggest_place_type(uuid, text, text[]) to authenticated;
grant execute on function pending_suggestions() to authenticated;
grant execute on function decide_suggestion(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0041_edit_kosher_and_votes.sql =====
-- Okeat: kosher details can be edited too, and a confirmation can be taken back.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function update_my_claim(p_claim uuid, p_level text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_level = 'marked' then raise exception 'You can only change your own details'; end if;
  update claims
     set level = p_level, status = 'pending', confirm_count = 0, reject_count = 0,
         verified_at = null, last_confirmed_at = null
   where id = p_claim and proposed_by = auth.uid()
     and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
  delete from claim_votes where claim_id = p_claim;
end; $$;

-- A confirmation taken back stops counting. If that leaves too few, the detail waits for confirmation again.
create or replace function withdraw_vote(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
declare was int;
begin
  delete from claim_votes where claim_id = p_claim and user_id = auth.uid() returning vote into was;
  if not found then raise exception 'You can only change your own details'; end if;
  update claims
     set confirm_count = greatest(0, confirm_count - case when was = 1 then 1 else 0 end),
         reject_count = greatest(0, reject_count - case when was = 1 then 0 else 1 end)
   where id = p_claim;
  update claims set status = 'pending', verified_at = null
   where id = p_claim and status = 'verified' and source = 'community' and confirm_count < verify_threshold();
end; $$;

create or replace function my_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('superseded', 'rejected')), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('claimId', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

revoke execute on function withdraw_vote(uuid) from anon, public;
grant execute on function withdraw_vote(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ===== 0042_report_not_food.sql =====
-- Okeat: "not a food place" is a report of its own and goes straight to the moderators.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or new.reason like '[לא קשור לאוכל]%'
     or (select count(*) from place_reports where place_id = new.place_id) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;

notify pgrst, 'reload schema';


-- ===== 0043_admin_hub.sql =====
-- Okeat: what happens on the site, for the admin. A feed of everything people add, a list of what
-- needs attention, anonymous visit counts, and public activity on every profile.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_feed(p_kind text default null, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) into result from (
    select e.*, pr.display_name as user_name from (
      select 'user' as kind, u.id::text as id, u.created_at as at, u.id as user_id, null::uuid as place_id,
             null::text as title, null::text as need, null::text as level, null::int as rating, null::text as detail, null::text as path, null::text as status
        from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
      union all
      select 'place', p.id::text, p.created_at, p.created_by, p.id, p.name, null, null, null, p.address, null, null
        from places p where p.created_by is not null and not p.removed
      union all
      select 'claim', c.id::text, c.proposed_at, c.proposed_by, c.place_id, p.name, c.need::text, c.level, null, null, null, c.status::text
        from claims c join places p on p.id = c.place_id where c.proposed_by is not null and not p.removed
      union all
      select 'vote', v.claim_id::text || v.user_id::text, v.created_at, v.user_id, c.place_id, p.name, c.need::text, c.level, v.vote, null, null, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id where not p.removed
      union all
      select 'review', r.place_id::text || r.user_id::text, r.created_at, r.user_id, r.place_id, p.name, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id where not p.removed
      union all
      select 'photo', ph.id::text, ph.created_at, ph.user_id, ph.place_id, p.name, null, null, null, null, ph.path,
             case when ph.approved then 'approved' else 'pending' end
        from place_photos ph join places p on p.id = ph.place_id where not p.removed
      union all
      select 'report', rp.place_id::text || rp.user_id::text, rp.created_at, rp.user_id, rp.place_id, p.name, null, null, null, rp.reason, null,
             case when p.flagged then 'pending' else 'seen' end
        from place_reports rp join places p on p.id = rp.place_id where not p.removed
      union all
      select 'suggestion', s.id::text, s.created_at, s.user_id, s.place_id, p.name, null, s.place_type, null, array_to_string(s.cuisine, ', '), null, s.status
        from place_suggestions s join places p on p.id = s.place_id where not p.removed
      union all
      select 'list', l.id::text, l.created_at, l.owner_id, null, l.title, null, null, null, null, null, null
        from lists l
      union all
      select 'message', m.id::text, m.created_at, m.user_id, null, null, null, m.topic, null, m.message, null,
             case when m.handled then 'seen' else 'pending' end
        from feedback m where is_admin()
    ) e
    left join profiles pr on pr.id = e.user_id
    where p_kind is null or e.kind = p_kind
    order by e.at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) f;
  return result;
end; $$;

create or replace function admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  week timestamptz := now() - interval '7 days';
  result jsonb;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select jsonb_build_object(
    'kinds', jsonb_build_object(
      'user', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where u.created_at > week), 'today', count(*) filter (where u.created_at > today))
                 from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null),
      'place', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where p.created_at > week), 'today', count(*) filter (where p.created_at > today))
                  from places p where p.created_by is not null and not p.removed),
      'claim', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where c.proposed_at > week), 'today', count(*) filter (where c.proposed_at > today))
                  from claims c where c.proposed_by is not null),
      'vote', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where v.created_at > week), 'today', count(*) filter (where v.created_at > today)) from claim_votes v),
      'review', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where r.created_at > week), 'today', count(*) filter (where r.created_at > today)) from reviews r),
      'photo', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where h.created_at > week), 'today', count(*) filter (where h.created_at > today)) from place_photos h),
      'report', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where x.created_at > week), 'today', count(*) filter (where x.created_at > today)) from place_reports x),
      'suggestion', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where s.created_at > week), 'today', count(*) filter (where s.created_at > today)) from place_suggestions s),
      'list', (select jsonb_build_object('all', count(*), 'week', count(*) filter (where l.created_at > week), 'today', count(*) filter (where l.created_at > today)) from lists l)
    ),
    'attention', jsonb_build_object(
      'reports', (select count(*) from places where flagged and not removed),
      'photos', (select count(*) from place_photos where not approved),
      'suggestions', (select count(*) from place_suggestions where status = 'pending'),
      'waiting', (select count(*) from claims where status = 'pending' and source = 'community'),
      'disputed', (select count(*) from claims where status = 'disputed'),
      'expiring', (select count(*) from kosher_certificates where valid_until between current_date and current_date + 30)
    ),
    'topUsers', coalesce((select jsonb_agg(t) from (
      select pr.id, pr.display_name as name, count(*) as actions from (
        select proposed_by as who from claims where proposed_at > now() - interval '30 days'
        union all select user_id from claim_votes where created_at > now() - interval '30 days'
        union all select user_id from reviews where created_at > now() - interval '30 days'
        union all select created_by from places where created_at > now() - interval '30 days'
        union all select user_id from place_photos where created_at > now() - interval '30 days'
      ) a join profiles pr on pr.id = a.who group by pr.id, pr.display_name order by count(*) desc limit 5) t), '[]'::jsonb),
    'topPlaces', coalesce((select jsonb_agg(t) from (
      select p.id, p.name, count(*) as reviews, round(avg(r.rating), 1) as rating
        from reviews r join places p on p.id = r.place_id where not p.removed
       group by p.id, p.name order by count(*) desc limit 5) t), '[]'::jsonb)
  ) into result;
  return result;
end; $$;

-- Everything newer than this moment, for the dot on the admin's account.
create or replace function admin_new_count(p_since timestamptz) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then return 0; end if;
  return (select count(*) from places where created_by is not null and created_at > p_since)
       + (select count(*) from claims where proposed_by is not null and proposed_at > p_since)
       + (select count(*) from reviews where created_at > p_since)
       + (select count(*) from place_photos where created_at > p_since)
       + (select count(*) from place_reports where created_at > p_since)
       + (select count(*) from place_suggestions where created_at > p_since);
end; $$;

-- ---------- visits: a random number per browser tab, never who it was ----------
create table if not exists site_visits (
  sid       text primary key check (length(sid) between 8 and 40),
  started   timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  seconds   int not null default 0,
  pages     int not null default 1,
  signed_in boolean not null default false
);
create index if not exists site_visits_started on site_visits (started);
alter table site_visits enable row level security;
-- no direct access: only the two functions below touch it

create or replace function log_visit(p_sid text, p_seconds int, p_pages int, p_signed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_sid, '')) not between 8 and 40 then return; end if;
  insert into site_visits (sid, seconds, pages, signed_in)
  values (p_sid, least(greatest(coalesce(p_seconds, 0), 0), 120), greatest(least(coalesce(p_pages, 1), 20), 1), coalesce(p_signed, false))
  on conflict (sid) do update
     set seconds = site_visits.seconds + least(greatest(coalesce(p_seconds, 0), 0), 120),
         pages = site_visits.pages + least(greatest(coalesce(p_pages, 0), 0), 20),
         signed_in = site_visits.signed_in or coalesce(p_signed, false),
         last_seen = now();
  if random() < 0.002 then delete from site_visits where started < now() - interval '180 days'; end if;
end; $$;

create or replace function admin_visits(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  from_day date := (now() at time zone 'Asia/Jerusalem')::date - (least(greatest(coalesce(p_days, 7), 1), 90) - 1);
  since timestamptz := from_day::timestamp at time zone 'Asia/Jerusalem';
  result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'visits', count(*),
    'avgSeconds', coalesce(round(avg(seconds)), 0),
    'totalSeconds', coalesce(sum(seconds), 0),
    'avgPages', coalesce(round(avg(pages), 1), 0),
    'signedIn', count(*) filter (where signed_in),
    'signups', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null and u.created_at >= since),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'visits', d.visits, 'avgSeconds', d.avg_s) order by d.day) from (
        select g::date as day, count(v.sid) as visits, coalesce(round(avg(v.seconds)), 0) as avg_s
          from generate_series(from_day, (now() at time zone 'Asia/Jerusalem')::date, interval '1 day') g
          left join site_visits v on (v.started at time zone 'Asia/Jerusalem')::date = g::date
         group by g) d), '[]'::jsonb)
  ) into result
  from site_visits where started >= since;
  return result;
end; $$;

-- ---------- what anyone can see on a profile: never the email, saved places or anything private ----------
create or replace function public_activity(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = p_id and not p.removed and c.status not in ('superseded', 'rejected')), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('claimId', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = p_id and v.vote = 1 and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = p_id and not p.removed), '[]'::jsonb)
  );
$$;

revoke execute on function admin_feed(text, int) from anon, public;
revoke execute on function admin_overview() from anon, public;
revoke execute on function admin_new_count(timestamptz) from anon, public;
revoke execute on function admin_visits(int) from anon, public;
grant execute on function admin_feed(text, int) to authenticated;
grant execute on function admin_overview() to authenticated;
grant execute on function admin_new_count(timestamptz) to authenticated;
grant execute on function admin_visits(int) to authenticated;
grant execute on function log_visit(text, int, int, boolean) to anon, authenticated;
grant execute on function public_activity(uuid) to anon, authenticated;

notify pgrst, 'reload schema';


-- Okeat: the same place in Hebrew and in English ("רולדין" and "Roladin") was not seen as a pair,
-- because the Hebrew vav counted as a letter while the English "o" did not. It no longer counts.
-- This file also merges the pairs. A merged place is hidden, keeps a pointer to the one that stays,
-- and everything people added to it moves over.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function place_skeleton(t text)
returns text
language sql immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        replace(replace(replace(lower(t), 'sh', 's'), 'ch', 'h'), 'ph', 'p'),
        'בגדזחטכךלמםנןספףצץקרשתfwcqואהיעaeiouy',
        'bgdzhtkklmmnnsppzzkrstpvkk'
      ),
      '[^a-z0-9]', '', 'g'
    ),
    '(.)\1+', '\1', 'g'
  )
$$;


-- Okeat: the list of hidden places stopped at 50, so most of them could not be seen.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_search_places(p_query text, p_hidden_only boolean default false)
returns table (id uuid, name text, place_type text, cuisine text[], address text, phone text, website text, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.place_type, p.cuisine, p.address, p.phone, p.website, p.removed
      from places p
     where p.merged_into is null
       and (not p_hidden_only or p.removed)
       and (coalesce(trim(p_query), '') = '' or p.name ilike '%' || trim(p_query) || '%')
     order by p.removed desc, p.name
     limit case when p_hidden_only then 2000 else 50 end;
end; $$;

notify pgrst, 'reload schema';

-- Okeat: places that look wrong reach the admin by themselves. A place shows up by its name, by
-- being new, or by sitting on the same spot as many others. "It's fine" is remembered.
-- Hidden places can now be deleted for good.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists place_checks (
  place_id uuid primary key references places (id) on delete cascade,
  by_hand boolean not null default false,  -- put on the list on purpose
  ok boolean not null default false,       -- the admin looked and it is fine
  checked_at timestamptz
);
alter table place_checks enable row level security;

create or replace function place_suspect_reason(t text) returns text
language sql immutable as $$
  select case
    when t ~* 'אטליז|קצביי?[הת]|קצבייה|butcher' then 'butcher'
    when t ~* 'קייטרינג|catering' then 'catering'
    when t ~* 'אולם|אירועים|\yevents?\y' then 'hall'
    when t ~* 'פיצ|pizza|קפה|cafe|café|coffee|מסעד|restaurant|בורגר|burger|שווארמ|shawarma|חומוס|hummus|פלאפל|falafel|סושי|sushi|מאפ|baker|גליד|ice ?cream|gelato|ביסטרו|bistro|grill|גריל|kitchen|מטבח|אוכל|food|שף|chef|קונדיטור|patisserie|שניצל|טאבון|שיפוד|בשר|דגים|fish|שוקולד|chocolate|ממתק|candy|sweet|עוג|cake|בורקס|לחם|bread|מעדני|\ydeli|\ybar\y|\ypub\y|פאב|\ywine|בירה|beer|מזנון' then null
    when t ~* 'בגדים|אופנה|fashion|נעליים|shoes|תכשיט|jewel|רהיטים|furniture|יד שני|שמלות|וינטג|בושם|perfume|טבק|tobacco|מכבסה|laundry|פרחים|florist|מתנות|gift|צעצועים|חיות מחמד|סופרמרקט|supermarket|מינימרקט|מכולת|grocery|סיטונא|wholesale|מחשבים|סלולר' then 'shop'
    when t ~* 'מספרה|מספרת|barber|מכון יופי|beauty|ציפורניים|\ynails\y|קוסמטי|ספא |\yspa\y|עיסוי|massage|מוסך|צמיגים|car center|motors|מרכז רכב|שטיפת רכב|ביטוח|insurance|עורך דין|עו"ד|רואה חשבון|נדל"ן|real estate|שיווק|פרסום|marketing|ייעוץ|תיירות|\ytravel|השכרה|rental|הסעות|הובלות|ניקיון|cleaning|\ydj\y|תקליטן|מופעים|הפקות|production|סטודיו|studio|בע"מ|\yltd\y|\ygroup\y|קבוצת|יבוא|יצוא|import|export' then 'service'
    when t ~* 'מרפא|clinic|רופא|רפואה|שיניים|dental|וטרינר|בית מרקחת|pharm|קופת חולים|health|טיפול|therapy|פיזיותרפ|אופטיק|optic|hospital' then 'health'
    when t ~* 'בית ספר|school|גן ילדים|בית כנסת|synagogue|כנסיי?ה|\ychurch|מסגד|mosque|חדר כושר|\ygym\y|fitness|כושר|מוזיאון|museum|אוניברסיט|university|מכללה|college|מרכז אקדמי|המרכז האקדמי|עירייה|עיריית|municipal|משרד|\yoffice|חניון|parking|שגרירות|embassy|סיעת|הסתדרות|נעמת|ויצו|אגודת|עמותה|מתנ"ס|קאנטרי|מלון|\yhotel|hostel|צימר|גלריה|gallery' then 'other'
  end
$$;

create or replace function admin_suspects() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  with crowded as (
    select location::text as spot from places where not removed group by 1 having count(*) >= 4
  ), found as (
    select p.*, case
      when c.by_hand then 'hand'
      when p.created_by is not null and p.created_at > now() - interval '30 days' then 'new'
      else coalesce(place_suspect_reason(p.name), case when s.spot is not null then 'spot' end)
    end as reason
    from places p
    left join place_checks c on c.place_id = p.id
    left join crowded s on s.spot = p.location::text
    where not p.removed and coalesce(c.ok, false) = false
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'place_type', place_type, 'cuisine', cuisine, 'address', address,
    'phone', phone, 'website', website, 'reason', reason) order by reason, name), '[]'::jsonb)
  into result from found where reason is not null;
  return result;
end; $$;

create or replace function admin_places_ok(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into place_checks (place_id, ok, checked_at) select unnest(p_ids), true, now()
  on conflict (place_id) do update set ok = true, checked_at = now();
end; $$;

create or replace function admin_hide_places(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update places set removed = true, flagged = false where id = any (p_ids);
  insert into admin_log (actor, action, detail)
    values (auth.uid(), 'place_hidden', cardinality(p_ids)::text || ' מקומות');
end; $$;

-- Only a place that is already hidden can go for good, so it always takes two decisions.
create or replace function admin_delete_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  delete from places where id = p_place and removed returning name into v_name;
  if v_name is not null then
    insert into admin_log (actor, action, detail) values (auth.uid(), 'place_deleted', v_name);
  end if;
end; $$;

-- The visit numbers now say when counting began.
create or replace function admin_visits_began() returns timestamptz
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return (select min(started) from site_visits);
end; $$;

-- The ones already found by hand.
insert into place_checks (place_id, by_hand)
select id, true from places where id in (
  '430f5801-1b32-45ec-9d11-d2612ffb78d7','3e8f5b5e-549e-4839-9cd9-68cfcaaa84f0','56aade61-596a-476a-8ea9-803ff23b8b9b',
  '9dd43a4e-e448-46f5-a2fd-dc51c3282aee','5892e977-19bc-4574-a9b3-38ab6be49a5a','7604ee4c-fd58-4a44-b68b-d0690d5b50db',
  'c1d82659-c925-426c-8c39-cdeadc930593','7479cbd7-b6da-4d2e-a224-883447d63604','ca20bafd-056e-4c06-9d6e-7d5813ac2c2a',
  'e8fbb503-13dc-498c-9628-8e104426b17a','19d69a05-d6e7-485f-86e7-529d82e79f75','87d2ee1e-937a-40fe-afd0-0014cffb9806',
  '80657460-d4a9-4edd-9a23-beea6ca6ce70','e7487eda-c0ff-488e-bbff-fc4f335a8efd','7c906594-1c81-41ae-bb23-76fa4e940875',
  '3d81e467-07f8-4124-a9b2-eb9611dd4a55','30838f9b-6fe5-43b4-9401-fec5c7a713cd','34284b85-3174-4a2f-9371-f7ddcc1b1a57',
  'c8cf8ec4-c522-4248-9f77-8edc672d766b','edbb4dfe-c9c9-41b6-a7b9-aaf0d8603139','02da7da2-558e-4c16-bb31-7e0d7caa44aa',
  '3a6608e1-d3e0-42ac-ac2d-89628c58460d'
) on conflict do nothing;

revoke execute on function admin_suspects() from anon, public;
revoke execute on function admin_places_ok(uuid[]) from anon, public;
revoke execute on function admin_hide_places(uuid[]) from anon, public;
revoke execute on function admin_delete_place(uuid) from anon, public;
revoke execute on function admin_visits_began() from anon, public;
grant execute on function admin_suspects() to authenticated;
grant execute on function admin_places_ok(uuid[]) to authenticated;
grant execute on function admin_hide_places(uuid[]) to authenticated;
grant execute on function admin_delete_place(uuid) to authenticated;
grant execute on function admin_visits_began() to authenticated;

notify pgrst, 'reload schema';

-- Okeat: a place put on the list by hand says why.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table place_checks add column if not exists note text;

create or replace function admin_suspects() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  with crowded as (
    select location::text as spot from places where not removed group by 1 having count(*) >= 4
  ), found as (
    select p.*, c.note, case
      when c.by_hand then 'hand'
      when p.created_by is not null and p.created_at > now() - interval '30 days' then 'new'
      else coalesce(place_suspect_reason(p.name), case when s.spot is not null then 'spot' end)
    end as reason
    from places p
    left join place_checks c on c.place_id = p.id
    left join crowded s on s.spot = p.location::text
    where not p.removed and coalesce(c.ok, false) = false
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'place_type', place_type, 'cuisine', cuisine, 'address', address,
    'phone', phone, 'website', website, 'reason', reason, 'note', note) order by reason, name), '[]'::jsonb)
  into result from found where reason is not null;
  return result;
end; $$;

update place_checks c set note = v.note
from (values
  ('430f5801-1b32-45ec-9d11-d2612ffb78d7'::uuid, 'נשמע כמו חנות בגדים'),
  ('3e8f5b5e-549e-4839-9cd9-68cfcaaa84f0'::uuid, 'נשמע כמו משרד'),
  ('56aade61-596a-476a-8ea9-803ff23b8b9b'::uuid, 'נשמע כמו עסק של מוזיקה'),
  ('9dd43a4e-e448-46f5-a2fd-dc51c3282aee'::uuid, 'מכללה. אולי קפיטריה, ואולי לא מקום אוכל'),
  ('5892e977-19bc-4574-a9b3-38ab6be49a5a'::uuid, 'נשמע כמו חברת טיולים'),
  ('7604ee4c-fd58-4a44-b68b-d0690d5b50db'::uuid, 'נשמע כמו חברת מסחר, בלי מקום לאכול'),
  ('c1d82659-c925-426c-8c39-cdeadc930593'::uuid, 'נשמע כמו יבואן, לא מקום אוכל'),
  ('7479cbd7-b6da-4d2e-a224-883447d63604'::uuid, 'נשמע כמו עסק של מיתוג ועיצוב'),
  ('ca20bafd-056e-4c06-9d6e-7d5813ac2c2a'::uuid, 'סטודיו. לא ברור מה יש בו'),
  ('e8fbb503-13dc-498c-9628-8e104426b17a'::uuid, 'סטודיו. לא ברור מה יש בו'),
  ('19d69a05-d6e7-485f-86e7-529d82e79f75'::uuid, 'נשמע כמו מפעל או חברה'),
  ('87d2ee1e-937a-40fe-afd0-0014cffb9806'::uuid, 'נשמע כמו חברה ולא מקום אוכל'),
  ('80657460-d4a9-4edd-9a23-beea6ca6ce70'::uuid, 'שם כללי, אולי חברת אירועים'),
  ('e7487eda-c0ff-488e-bbff-fc4f335a8efd'::uuid, 'נשמע כמו ספא'),
  ('7c906594-1c81-41ae-bb23-76fa4e940875'::uuid, 'קאנטרי קלאב. אולי יש בו מזנון'),
  ('3d81e467-07f8-4124-a9b2-eb9611dd4a55'::uuid, 'נשמע כמו גלריה'),
  ('30838f9b-6fe5-43b4-9401-fec5c7a713cd'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('34284b85-3174-4a2f-9371-f7ddcc1b1a57'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('c8cf8ec4-c522-4248-9f77-8edc672d766b'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('edbb4dfe-c9c9-41b6-a7b9-aaf0d8603139'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('02da7da2-558e-4c16-bb31-7e0d7caa44aa'::uuid, 'נשמע כמו עמותה'),
  ('3a6608e1-d3e0-42ac-ac2d-89628c58460d'::uuid, 'לא ברור מהשם מה זה')
) v (id, note)
where c.place_id = v.id;

notify pgrst, 'reload schema';

-- Okeat: whatever is vegan is also vegetarian, so saying a place is vegan says both.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function vegan_is_vegetarian() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.need = 'vegan' and new.status in ('pending', 'verified') then
    insert into claims (place_id, need, level, status, source, proposed_by, verified_at)
    select new.place_id, 'vegetarian', new.level, new.status, new.source, new.proposed_by, new.verified_at
    where not exists (select 1 from claims c where c.place_id = new.place_id and c.need = 'vegetarian'
                      and c.status in ('pending', 'verified'));
  end if;
  return new;
end; $$;

drop trigger if exists claims_vegan_is_vegetarian on claims;
create trigger claims_vegan_is_vegetarian after insert on claims
  for each row execute function vegan_is_vegetarian();

-- Okeat: the admin can remove anything a user added, straight from the list of what happened.
-- Also lets the contact form use its "something else" topic, which the table was refusing.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table feedback drop constraint if exists feedback_topic_check;
alter table feedback add constraint feedback_topic_check
  check (topic in ('general', 'accessibility', 'privacy', 'report', 'business', 'other'));

create or replace function admin_delete_item(p_kind text, p_id text, p_place uuid default null, p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare was int; v_claim uuid;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  case p_kind
    when 'review' then delete from reviews where place_id = p_place and user_id = p_user;
    when 'report' then delete from place_reports where place_id = p_place and user_id = p_user;
    when 'photo' then delete from place_photos where id::text = p_id;
    when 'claim' then delete from claims where id::text = p_id;
    when 'suggestion' then delete from place_suggestions where id::text = p_id;
    when 'list' then delete from lists where id::text = p_id;
    when 'message' then delete from feedback where id::text = p_id;
    when 'place' then update places set removed = true, flagged = false where id = p_place;
    when 'vote' then
      v_claim := left(p_id, 36)::uuid;
      delete from claim_votes where claim_id = v_claim and user_id = p_user returning vote into was;
      if found then
        update claims
           set confirm_count = greatest(0, confirm_count - case when was = 1 then 1 else 0 end),
               reject_count = greatest(0, reject_count - case when was = 1 then 0 else 1 end)
         where id = v_claim;
        update claims set status = 'pending', verified_at = null
         where id = v_claim and status = 'verified' and source = 'community' and confirm_count < verify_threshold();
      end if;
    else raise exception 'Unknown item';
  end case;
  insert into admin_log (actor, action, detail) values (auth.uid(), 'item_deleted', p_kind);
end; $$;

revoke execute on function admin_delete_item(text, text, uuid, uuid) from anon, public;
grant execute on function admin_delete_item(text, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ===== 0051_handled_news_privacy_foods.sql =====
-- Okeat: reports that stay with a "handled" label, where the notification dot comes from,
-- a dashboard where today, week and month really differ, profile pictures, private lists,
-- taking back a type suggestion, the new kinds of food, and tidier names and addresses.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- ---------- 1. reports: handled or not, instead of disappearing ----------
alter table place_reports add column if not exists handled boolean not null default false;
alter table place_reports add column if not exists handled_at timestamptz;

-- Only reports nobody handled yet count toward sending a place to the moderators.
create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or new.reason like '[לא קשור לאוכל]%'
     or (select count(*) from place_reports where place_id = new.place_id and not handled) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;

-- "The place is fine" marks its reports as handled. They stay in the list, so nothing is lost.
create or replace function moderate_place(p_place uuid, p_remove boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  if p_remove then
    update places set removed = true, flagged = false where id = p_place;
  else
    update places set flagged = false where id = p_place;
  end if;
  update place_reports set handled = true, handled_at = now() where place_id = p_place and not handled;
end; $$;

create or replace function admin_mark_report(p_place uuid, p_user uuid, p_handled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  update place_reports
     set handled = coalesce(p_handled, true), handled_at = case when coalesce(p_handled, true) then now() end
   where place_id = p_place and user_id = p_user;
  -- a place whose reports are all handled leaves the "reported" list
  if coalesce(p_handled, true) and not exists (select 1 from place_reports where place_id = p_place and not handled) then
    update places set flagged = false where id = p_place;
  end if;
end; $$;

-- The moderators' list of reported places counts only open reports.
create or replace function moderation_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return jsonb_build_object(
    'reported', coalesce((select jsonb_agg(x order by x->>'reports' desc) from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address,
                 'reports', (select count(*) from place_reports r where r.place_id = p.id and not r.handled),
                 'reasons', (select jsonb_agg(r.reason) from place_reports r where r.place_id = p.id and r.reason is not null and not r.handled)) x
          from places p where p.flagged and not p.removed) q), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', c.id, 'placeId', p.id, 'placeName', p.name, 'need', c.need, 'level', c.level,
                 'status', c.status, 'source', c.source, 'confirm', c.confirm_count, 'reject', c.reject_count) x
          from claims c join places p on p.id = c.place_id
         where not p.removed and (c.status = 'disputed' or (c.source in ('auto', 'osm') and c.reject_count > 0 and c.status in ('verified', 'pending'))
                or (c.status = 'pending' and c.reject_count > 0))
         order by c.reject_count desc limit 100) q), '[]'::jsonb),
    'owners', case when is_admin() then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', o.id, 'placeId', p.id, 'placeName', p.name, 'code', o.code,
                 'proofUrl', o.proof_url, 'note', o.note, 'user', pr.display_name, 'createdAt', o.created_at) x
          from owner_requests o join places p on p.id = o.place_id join profiles pr on pr.id = o.user_id
         where o.status = 'pending' and o.proof_url is not null order by o.created_at) q), '[]'::jsonb) else '[]'::jsonb end
  );
end; $$;

-- The same activity list, with a report's status saying whether it was handled.
create or replace function admin_feed(p_kind text default null, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) into result from (
    select e.*, pr.display_name as user_name from (
      select 'user' as kind, u.id::text as id, u.created_at as at, u.id as user_id, null::uuid as place_id,
             null::text as title, null::text as need, null::text as level, null::int as rating, null::text as detail, null::text as path, null::text as status
        from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
      union all
      select 'place', p.id::text, p.created_at, p.created_by, p.id, p.name, null, null, null, p.address, null, null
        from places p where p.created_by is not null and not p.removed
      union all
      select 'claim', c.id::text, c.proposed_at, c.proposed_by, c.place_id, p.name, c.need::text, c.level, null, null, null, c.status::text
        from claims c join places p on p.id = c.place_id where c.proposed_by is not null and not p.removed
      union all
      select 'vote', v.claim_id::text || v.user_id::text, v.created_at, v.user_id, c.place_id, p.name, c.need::text, c.level, v.vote, null, null, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id where not p.removed
      union all
      select 'review', r.place_id::text || r.user_id::text, r.created_at, r.user_id, r.place_id, p.name, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id where not p.removed
      union all
      select 'photo', ph.id::text, ph.created_at, ph.user_id, ph.place_id, p.name, null, null, null, null, ph.path,
             case when ph.approved then 'approved' else 'pending' end
        from place_photos ph join places p on p.id = ph.place_id where not p.removed
      union all
      select 'report', rp.place_id::text || rp.user_id::text, rp.created_at, rp.user_id, rp.place_id, p.name, null, null, null, rp.reason, null,
             case when rp.handled then 'handled' else 'pending' end
        from place_reports rp join places p on p.id = rp.place_id
      union all
      select 'suggestion', s.id::text, s.created_at, s.user_id, s.place_id, p.name, null, s.place_type, null, array_to_string(s.cuisine, ', '), null, s.status
        from place_suggestions s join places p on p.id = s.place_id where not p.removed
      union all
      select 'list', l.id::text, l.created_at, l.owner_id, null, l.title, null, null, null, null, null, null
        from lists l
      union all
      select 'message', m.id::text, m.created_at, m.user_id, null, null, null, m.topic, null, m.message, null,
             case when m.handled then 'seen' else 'pending' end
        from feedback m where is_admin()
    ) e
    left join profiles pr on pr.id = e.user_id
    where p_kind is null or e.kind = p_kind
    order by e.at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) f;
  return result;
end; $$;

-- A place shows how many open reports it has.
create or replace function place_meta(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'createdAt', p.created_at,
    'creator', case when c.id is null then null else jsonb_build_object(
                 'id', c.id, 'name', coalesce(nullif(c.display_name, ''), 'משתמש/ת Okeat'), 'avatar', c.avatar_url) end,
    'ownerVerified', p.owner_verified_at is not null,
    'flagged', p.flagged,
    'reports', (select count(*) from place_reports r where r.place_id = p.id and not r.handled),
    'iReported', exists (select 1 from place_reports r where r.place_id = p.id and r.user_id = auth.uid()),
    'iRequestedOwner', exists (select 1 from owner_requests o where o.place_id = p.id and o.user_id = auth.uid() and o.status = 'pending'),
    'canModerate', is_moderator(),
    'isAdmin', is_admin()
  )
    from places p
    left join profiles c on c.id = p.created_by
   where p.id = p_id
$$;

-- ---------- 2. where the red dot comes from ----------
create or replace function admin_new_breakdown(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_moderator() then return null; end if;
  select jsonb_build_object(
    'place', (select count(*) from places where created_by is not null and created_by <> auth.uid() and created_at > p_since and not removed),
    'claim', (select count(*) from claims where proposed_by is not null and proposed_by <> auth.uid() and proposed_at > p_since),
    'review', (select count(*) from reviews where user_id <> auth.uid() and created_at > p_since),
    'photo', (select count(*) from place_photos where user_id <> auth.uid() and created_at > p_since),
    'report', (select count(*) from place_reports where created_at > p_since and not handled),
    'suggestion', (select count(*) from place_suggestions where created_at > p_since and status = 'pending')
  ) into r;
  return r || jsonb_build_object('total', (select sum(value::int) from jsonb_each_text(r)));
end; $$;

-- ---------- 3. dashboard: everything counted inside the chosen range ----------
create or replace function admin_range_stats(p_days int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := case when coalesce(p_days, 0) <= 0 then '-infinity'::timestamptz
    else (((now() at time zone 'Asia/Jerusalem')::date - (least(p_days, 365) - 1))::timestamp at time zone 'Asia/Jerusalem') end;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'since', case when since = '-infinity'::timestamptz then null else since end,
    'kinds', jsonb_build_object(
      'user', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null and u.created_at >= since),
      'place', (select count(*) from places p where p.created_by is not null and not p.removed and p.created_at >= since),
      'claim', (select count(*) from claims c where c.proposed_by is not null and c.proposed_at >= since),
      'vote', (select count(*) from claim_votes v where v.created_at >= since),
      'review', (select count(*) from reviews r where r.created_at >= since),
      'photo', (select count(*) from place_photos h where h.created_at >= since),
      'report', (select count(*) from place_reports x where x.created_at >= since),
      'suggestion', (select count(*) from place_suggestions s where s.created_at >= since),
      'list', (select count(*) from lists l where l.created_at >= since)
    ),
    'topUsers', coalesce((select jsonb_agg(t) from (
      select pr.id, pr.display_name as name, count(*) as actions from (
        select proposed_by as who from claims where proposed_at >= since
        union all select user_id from claim_votes where created_at >= since
        union all select user_id from reviews where created_at >= since
        union all select created_by from places where created_at >= since
        union all select user_id from place_photos where created_at >= since
      ) a join profiles pr on pr.id = a.who group by pr.id, pr.display_name order by count(*) desc limit 5) t), '[]'::jsonb)
  );
end; $$;

-- ---------- 4. one place for the admin's edit form, from anywhere ----------
create or replace function admin_get_place(p_place uuid)
returns table (id uuid, name text, place_type text, cuisine text[], address text, phone text, website text, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query select p.id, p.name, p.place_type, p.cuisine, p.address, p.phone, p.website, p.removed from places p where p.id = p_place;
end; $$;

-- ---------- 5. taking back your own type suggestion before it is decided ----------
create or replace function withdraw_suggestion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from place_suggestions where id = p_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'You can only change your own details'; end if;
end; $$;

-- ---------- 6. your own profile picture ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());
drop policy if exists "remove own avatar" on storage.objects;
create policy "remove own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only a picture from your own folder, or none.
create or replace function set_my_avatar(p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_real_user() then raise exception 'Sign in with an account'; end if;
  if p_url is not null and (p_url !~ '^https://' or length(p_url) > 500
      or position('/storage/v1/object/public/avatars/' || auth.uid()::text || '/' in p_url) = 0) then
    raise exception 'That picture cannot be used';
  end if;
  update profiles set avatar_url = p_url where id = auth.uid();
end; $$;

-- ---------- 7. lists are shared by their link, not downloadable as one big list ----------
drop policy if exists "lists readable" on lists;
create policy "lists readable" on lists for select using (owner_id = auth.uid() or is_admin());
drop policy if exists "list places readable" on list_places;
create policy "list places readable" on list_places for select
  using (exists (select 1 from lists l where l.id = list_places.list_id and (l.owner_id = auth.uid() or is_admin())));

revoke execute on function admin_mark_report(uuid, uuid, boolean) from anon, public;
revoke execute on function admin_new_breakdown(timestamptz) from anon, public;
revoke execute on function admin_range_stats(int) from anon, public;
revoke execute on function admin_get_place(uuid) from anon, public;
revoke execute on function withdraw_suggestion(uuid) from anon, public;
revoke execute on function set_my_avatar(text) from anon, public;
grant execute on function admin_mark_report(uuid, uuid, boolean) to authenticated;
grant execute on function admin_new_breakdown(timestamptz) to authenticated;
grant execute on function admin_range_stats(int) to authenticated;
grant execute on function admin_get_place(uuid) to authenticated;
grant execute on function withdraw_suggestion(uuid) to authenticated;
grant execute on function set_my_avatar(text) to authenticated;

-- ---------- 8. the new kinds of food, found by the place's name ----------
-- Only places whose food was not set by people. Nothing is removed, a kind is only added.
do $$
declare k record;
begin
  for k in select * from (values
    ('schnitzel', 'שניצל|schnitzel'),
    ('sabich', 'סביח|sabich'),
    ('skewers', 'שיפוד|shipud|skewer|קבב|kebab'),
    ('burekas', 'בורקס|burek'),
    ('shakshuka', 'שקשוק|shakshuk'),
    ('poke', 'פוקי|פוקה|(^|\s)poke($|\s)'),
    ('seafood', 'פירות ים|seafood|sea food|שרימפ|shrimp'),
    ('chocolate', 'שוקולד|chocolat'),
    ('waffle', 'וופל|waffle|crepe|crêpe|(^|\s)קרפ'),
    ('bar', 'פאב|(^|\s)pub($|\s)|בירה|(^|\s)beer'),
    ('moroccan', 'מרוקא|maroc|morocc'),
    ('iraqi', 'עיראק|iraq|קובה|kubbe|kubba'),
    ('kurdish', 'כורד|kurd'),
    ('persian', '(^|\s)[הו]?פרסי|persia|(^|\s)iran'),
    ('yemeni', 'תימנ|yemen|ג.?חנון|מלאווח|jachnun|malawach'),
    ('tripolitan', 'טריפול|tripol|libya|(^|\s)לובי'),
    ('tunisian', 'תוניס|tunis'),
    ('ethiopian', 'אתיופ|ethiop|אינג.?רה|injera'),
    ('georgian', 'גאורג|גרוזינ|georgia|חצ.?פורי|khachapuri|חינקלי|khinkali'),
    ('bukharan', 'בוכר|bukhar|(^|\s)פלוב|plov'),
    ('ashkenazi', 'אשכנז|ashkenaz'),
    ('balkan', 'בלקנ|בולגר|balkan|bulgar|romania|(^|\s)רומני'),
    ('russian', '(^|\s)רוסי|russia|פלמני|pelmeni'),
    ('spanish', 'spanish|español|espanol|tapas|טאפאס|paella|פאייה'),
    ('greek', 'יוונ|greek|gyro|souvlaki|סובלקי'),
    ('turkish', 'טורק|(^|\s)turk(?!ey)|kebap|lahmacun|לחמג.?ון'),
    ('argentinian', 'ארגנטינ|argentin|parrilla'),
    ('thai', 'תאילנד|(^|\s)thai'),
    ('vietnamese', 'וייטנאמ|vietnam|(^|\s)pho($|\s)|banh mi|באן מי'),
    ('korean', 'קוריא|korea'),
    ('healthy', 'בריא|healthy|organic|אורגני')
  ) as v(food, pattern)
  loop
    update places
       set cuisine = array_append(coalesce(cuisine, '{}'), k.food),
           cuisine_source = coalesce(cuisine_source, 'auto')
     where not removed
       and coalesce(cuisine_source, '') <> 'community'
       and name ~* k.pattern
       and not (coalesce(cuisine, '{}') @> array[k.food])
       and coalesce(array_length(cuisine, 1), 0) < 6;
  end loop;
end $$;

-- ---------- 9. tidier names and addresses ----------
-- Extra spaces, quotes around a name, the country and postal codes in an address, "unnamed road".
update places set name = btrim(regexp_replace(name, '\s+', ' ', 'g'), ' "''״׳')
 where name ~ '\s{2,}|^\s|\s$|^["''״׳]|["''״׳]$'
   and length(btrim(regexp_replace(name, '\s+', ' ', 'g'), ' "''״׳')) >= 2;

update places
   set address = nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(address, '\s+', ' ', 'g'),
         '(^|,)\s*(ישראל|israel|إسرائيل)\s*(?=,|$)', '\1', 'gi'),
         '(^|,)\s*\d{5,7}\s*(?=,|$)', '\1', 'g'),
         '(^|\s)\d{7}($|\s)', '\1', 'g'),
         '(^|,)\s*(unnamed road|רחוב ללא שם|ללא שם)\s*(?=,|$)', '\1', 'gi'),
         '\s*,\s*', ', ', 'g'),
         '(, )+', ', ', 'g'),
         '^[\s,.;:-]+|[\s,.;:-]+$', '', 'g'), '')
 where address ~* '\s{2,}|(^|,)\s*(ישראל|israel|إسرائيل)\s*(,|$)|(^|,)\s*\d{5,7}\s*(,|$)|(^|\s)\d{7}($|\s)|unnamed road|ללא שם|^\s*,|,\s*$|\s,';

notify pgrst, 'reload schema';

-- ===== sample places =====
alter table places disable trigger user;
alter table claims disable trigger user;
alter table kosher_certificates disable trigger user;

-- Development fixtures only. Invented places near Ramat Gan for local testing.
-- Runs as the postgres role (supabase db reset), so it bypasses RLS and the vote trigger.

insert into places (id, name, place_type, address, location, hours) values
  ('00000000-0000-0000-0000-000000000001', 'חומוס הבוקר (דוגמה)', 'hummus', 'דוגמה 1, רמת גן',
   st_setsrid(st_makepoint(34.8105, 32.0820), 4326)::geography,
   '{"0":[["08:00","17:00"]],"1":[["08:00","17:00"]],"2":[["08:00","17:00"]],"3":[["08:00","17:00"]],"4":[["08:00","17:00"]],"5":[["07:30","14:00"]],"6":[]}'),
  ('00000000-0000-0000-0000-000000000002', 'גרעין (דוגמה)', 'vegan_restaurant', 'דוגמה 2, רמת גן',
   st_setsrid(st_makepoint(34.8140, 32.0795), 4326)::geography,
   '{"0":[["12:00","23:00"]],"1":[["12:00","23:00"]],"2":[["12:00","23:00"]],"3":[["12:00","23:00"]],"4":[["12:00","23:00"]],"5":[["11:00","23:00"]],"6":[["11:00","23:00"]]}'),
  ('00000000-0000-0000-0000-000000000003', 'בייקרי אלמה (דוגמה)', 'bakery', 'דוגמה 3, רמת גן',
   st_setsrid(st_makepoint(34.8070, 32.0808), 4326)::geography, null);

insert into claims (id, place_id, need, level, status, confirm_count, verified_at, last_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'kosher', 'rabanut', 'verified', 23, now() - interval '30 days', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'vegan', 'options', 'verified', 9, now() - interval '20 days', now() - interval '6 days'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'vegan', 'full', 'verified', 41, now() - interval '60 days', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'gluten_free', 'menu', 'verified', 12, now() - interval '40 days', now() - interval '9 days'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'gluten_free', 'kitchen', 'verified', 31, now() - interval '50 days', now() - interval '3 days'),
  -- expired certificate: should NOT match a kosher filter
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'kosher', 'mehadrin', 'verified', 17, now() - interval '200 days', now() - interval '40 days');

insert into kosher_certificates (claim_id, image_path, supervising_body, valid_until) values
  ('10000000-0000-0000-0000-000000000001', 'seed/hummus.jpg', 'הרבנות הראשית רמת גן', current_date + 150),
  ('10000000-0000-0000-0000-000000000006', 'seed/alma.jpg', 'הרבנות הראשית רמת גן', current_date - 26);

alter table places enable trigger user;
alter table claims enable trigger user;
alter table kosher_certificates enable trigger user;

-- ===== 0052_clear_notifications.sql =====
-- Okeat: "Clear all notifications" is saved on the account, so it works on every device.
-- Old notifications stay hidden after clearing; anything that happens later shows again.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table profiles add column if not exists notifications_cleared_at timestamptz;

create or replace function my_notifications()
returns table (kind text, place_id uuid, place_name text, need text, happened_at timestamptz, is_new boolean)
language sql stable security definer set search_path = public
as $$
  with mine as (
    select notifications_seen_at as seen,
           coalesce(notifications_cleared_at, '-infinity'::timestamptz) as cleared
      from profiles where id = auth.uid()
  ),
  events as (
    select 'approved'::text as kind, p.id as place_id, p.name as place_name, c.need::text as need, c.verified_at as happened_at
      from claims c join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status = 'verified' and c.source = 'community'
       and c.verified_at > now() - interval '30 days' and not p.removed
    union all
    select 'expiring', p.id, p.name, 'kosher', (k.valid_until - 30)::timestamptz
      from kosher_certificates k
      join claims c on c.id = k.claim_id
      join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and c.status in ('verified', 'pending')
       and k.valid_until between current_date and current_date + 30 and not p.removed
    union all
    select 'confirmed', p.id, p.name, c.need::text, max(v.created_at)
      from claim_votes v
      join claims c on c.id = v.claim_id
      join places p on p.id = c.place_id
     where c.proposed_by = auth.uid() and v.vote = 1 and v.user_id <> auth.uid()
       and c.status = 'pending' and v.created_at > now() - interval '30 days' and not p.removed
     group by p.id, p.name, c.need
  )
  select e.kind, e.place_id, e.place_name, e.need, e.happened_at, e.happened_at > m.seen
    from events e cross join mine m
   where e.happened_at > m.cleared
   order by e.happened_at desc
   limit 50
$$;

create or replace function clear_notifications()
returns void
language sql security definer set search_path = public
as $$
  update profiles
     set notifications_cleared_at = now(), notifications_seen_at = now()
   where id = auth.uid()
$$;

revoke execute on function clear_notifications() from anon, public;
grant execute on function clear_notifications() to authenticated;
revoke execute on function my_notifications() from anon, public;
grant execute on function my_notifications() to authenticated;

select 'ready' as status, (select count(*) from places) as sample_places;
