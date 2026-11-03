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
