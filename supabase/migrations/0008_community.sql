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
