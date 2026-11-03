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
