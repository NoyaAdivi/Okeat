-- Okeat: the list of hidden places stopped at 50, so most of them could not be seen.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

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
     limit case when p_hidden_only then 2000 else 50 end;
end; $$;

notify pgrst, 'reload schema';
