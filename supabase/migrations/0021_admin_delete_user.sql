-- Okeat — the admin can delete a user from the site (run once in Supabase → SQL Editor → Run; safe to run again)
-- This is final. Their profile, reviews and saved places go. Places they added stay, without their name.
-- Another admin can't be deleted here: change their role first.

create or replace function admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_user = auth.uid() then raise exception 'You cannot delete your own account here'; end if;
  if is_admin(p_user) then raise exception 'Change this admin to a regular user first'; end if;
  delete from auth.users where id = p_user;
end;
$$;

revoke execute on function admin_delete_user(uuid) from anon, public;
grant execute on function admin_delete_user(uuid) to authenticated;
notify pgrst, 'reload schema';
