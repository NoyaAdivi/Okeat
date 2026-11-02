-- Okeat — closing small gaps found in the pre-launch security check
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- 1. Personal food needs are not shown anywhere on the site, so they should not be readable or kept.
update profiles set own_needs = '{}' where own_needs <> '{}';
revoke select on profiles from anon, authenticated;
grant select (id, display_name, avatar_url, created_at, role) on profiles to anon, authenticated;
revoke update on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

-- Profile pages open through public_profile(). Nobody can download the whole list of users.
drop policy if exists "profiles readable" on profiles;
drop policy if exists "own profile readable" on profiles;
create policy "own profile readable" on profiles for select using (id = auth.uid() or is_moderator());

-- 2. A new place from the site starts clean: nobody can mark themselves as the verified owner this way.
create or replace function places_clean_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.owner_id := null;
    new.owner_verified_at := null;
    new.removed := false;
    new.flagged := false;
    new.location_locked := false;
    new.merged_into := null;
    new.osm_id := null;
    new.ext_id := null;
    if new.website is not null and new.website !~* '^https?://' then
      new.website := null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists places_clean on places;
create trigger places_clean before insert on places for each row execute function places_clean_insert();
revoke execute on function places_clean_insert() from anon, authenticated, public;

-- 3. Photos stay viewable by their link, but nobody can list the folders,
--    and certificates get the same size and type limits as place photos.
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'certificates';

drop policy if exists "certificate photos readable" on storage.objects;
drop policy if exists "own certificate files visible" on storage.objects;
create policy "own certificate files visible" on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and ((storage.foldername(name))[1] = auth.uid()::text or is_moderator()));

drop policy if exists "place photos readable" on storage.objects;
drop policy if exists "own place photo files visible" on storage.objects;
create policy "own place photo files visible" on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and ((storage.foldername(name))[1] = auth.uid()::text or is_moderator()));

notify pgrst, 'reload schema';
