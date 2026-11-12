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
