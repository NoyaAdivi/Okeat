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
