-- Okeat: the admin can fix a place's details and food types, find any place, and bring back a hidden one.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_update_place(
  p_place uuid, p_name text, p_type text, p_cuisine text[], p_address text, p_phone text, p_website text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'A place needs a name'; end if;
  if p_type not in ('restaurant', 'cafe', 'bakery', 'pizza', 'ice_cream', 'hummus', 'sushi', 'grill', 'vegan_restaurant', 'stand', 'other') then
    raise exception 'Unknown place type';
  end if;
  update places
     set name = trim(p_name),
         place_type = p_type,
         cuisine = case when coalesce(array_length(p_cuisine, 1), 0) = 0 then null else p_cuisine end,
         cuisine_source = 'community',
         address = nullif(trim(coalesce(p_address, '')), ''),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         website = nullif(trim(coalesce(p_website, '')), '')
   where id = p_place;
  insert into admin_log (actor, action, detail) values (auth.uid(), 'place_edited', trim(p_name));
end; $$;

create or replace function admin_search_places(p_query text, p_hidden_only boolean default false)
returns table (id uuid, name text, place_type text, cuisine text[], address text, phone text, website text, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.place_type, p.cuisine, p.address, p.phone, p.website, p.removed
      from places p
     where p.merged_into is null
       and (not p_hidden_only or p.removed)
       and (coalesce(trim(p_query), '') = '' or p.name ilike '%' || trim(p_query) || '%')
     order by p.removed desc, p.name
     limit 50;
end; $$;

create or replace function admin_restore_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update places set removed = false where id = p_place;
end; $$;

revoke execute on function admin_update_place(uuid, text, text, text[], text, text, text) from anon, public;
revoke execute on function admin_search_places(text, boolean) from anon, public;
revoke execute on function admin_restore_place(uuid) from anon, public;
grant execute on function admin_update_place(uuid, text, text, text[], text, text, text) to authenticated;
grant execute on function admin_search_places(text, boolean) to authenticated;
grant execute on function admin_restore_place(uuid) to authenticated;

notify pgrst, 'reload schema';
