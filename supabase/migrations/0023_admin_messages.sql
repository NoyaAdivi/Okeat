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
