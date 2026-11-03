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
