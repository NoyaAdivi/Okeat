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
