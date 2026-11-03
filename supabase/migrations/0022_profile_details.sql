-- Okeat — a name and a favorite food on the profile (run once in Supabase → SQL Editor → Run; safe to run again)

alter table profiles add column if not exists favorite_food text;
alter table profiles drop constraint if exists profiles_favorite_food_length;
alter table profiles add constraint profiles_favorite_food_length check (length(favorite_food) <= 60) not valid;
alter table profiles drop constraint if exists profiles_display_name_length;
alter table profiles add constraint profiles_display_name_length check (length(display_name) <= 40) not valid;

grant update (display_name, favorite_food) on profiles to authenticated;
grant select (favorite_food) on profiles to authenticated;

-- The result changes, so the function is replaced.
drop function if exists public_profile(uuid);
create function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint, favorite_food text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id),
         (select count(*) from claims where proposed_by = p.id),
         (select count(*) from claim_votes where user_id = p.id and vote = 1),
         nullif(p.favorite_food, '')
    from profiles p
   where p.id = p_id
$$;
grant execute on function public_profile(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
