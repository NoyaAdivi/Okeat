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
