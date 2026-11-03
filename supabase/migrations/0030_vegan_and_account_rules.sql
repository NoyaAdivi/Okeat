-- Okeat: what is vegan is also vegetarian, and photos and the confirmation list need a real account.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- ---------- a vegan place counts as vegetarian ----------
create or replace function mark_vegetarian(
  p_place uuid, p_level text, p_source text, p_confirmed int, p_verified timestamptz, p_last timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- one verified claim per place and need, so an open proposal gives way
  update claims set status = 'superseded'
   where place_id = p_place and need = 'vegetarian' and status = 'pending';
  update claims set level = 'full'
   where place_id = p_place and need = 'vegetarian' and status = 'verified' and p_level = 'full' and level <> 'full';
  insert into claims (place_id, need, level, status, source, confirm_count, verified_at, last_confirmed_at)
  select p_place, 'vegetarian', p_level, 'verified', p_source, p_confirmed, p_verified, p_last
   where not exists (select 1 from claims where place_id = p_place and need = 'vegetarian' and status = 'verified');
end; $$;
revoke execute on function mark_vegetarian(uuid, text, text, int, timestamptz, timestamptz) from anon, authenticated, public;

create or replace function vegan_is_vegetarian() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform mark_vegetarian(new.place_id, new.level, new.source, new.confirm_count, new.verified_at, new.last_confirmed_at);
  return new;
end; $$;

drop trigger if exists vegan_is_vegetarian on claims;
create trigger vegan_is_vegetarian after insert or update of status, level on claims
  for each row when (new.need = 'vegan' and new.status = 'verified')
  execute function vegan_is_vegetarian();

-- the vegan places already on the map
do $$
declare c record;
begin
  for c in select * from claims where need = 'vegan' and status = 'verified' loop
    perform mark_vegetarian(c.place_id, c.level, c.source, c.confirm_count, c.verified_at, c.last_confirmed_at);
  end loop;
end $$;

-- ---------- certificate photos: a real account only, as with place photos ----------
drop policy if exists "upload certificate photos to own folder" on storage.objects;
create policy "upload certificate photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());

-- ---------- what waits for confirmation is for signed-in people ----------
revoke execute on function pending_claims_near(double precision, double precision, int) from anon, public;
grant execute on function pending_claims_near(double precision, double precision, int) to authenticated;

notify pgrst, 'reload schema';
