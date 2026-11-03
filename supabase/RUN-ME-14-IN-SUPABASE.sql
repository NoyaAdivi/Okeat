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
