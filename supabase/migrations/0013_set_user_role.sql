-- Okeat — site admins change roles from a person's profile page.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function set_user_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('user', 'trusted', 'admin') then raise exception 'Unknown role'; end if;
  if exists (select 1 from auth.users where id = p_user and coalesce(is_anonymous, false)) then
    raise exception 'Anonymous accounts cannot get a role';
  end if;
  update profiles set role = p_role where id = p_user;
end;
$$;

revoke execute on function set_user_role(uuid, text) from anon, public;
grant execute on function set_user_role(uuid, text) to authenticated;
notify pgrst, 'reload schema';
