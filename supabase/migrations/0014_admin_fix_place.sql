-- Okeat — site admins fix a place's location from the site.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function admin_fix_place(p_place uuid, p_lat double precision, p_lng double precision, p_address text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_lat not between 29.4 and 33.4 or p_lng not between 34.2 and 35.95 then
    raise exception 'That point is outside Israel';
  end if;
  -- unlock first: a locked place keeps its location on every other update
  update places set location_locked = false where id = p_place;
  update places
     set location = st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
         address = coalesce(nullif(trim(p_address), ''), address),
         location_locked = true
   where id = p_place;
end;
$$;

revoke execute on function admin_fix_place(uuid, double precision, double precision, text) from anon, public;
grant execute on function admin_fix_place(uuid, double precision, double precision, text) to authenticated;
notify pgrst, 'reload schema';
