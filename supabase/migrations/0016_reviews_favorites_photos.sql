-- Okeat — reviews, saved places and place photos (run once in Supabase → SQL Editor → Run; safe to run again)
-- Reviews and saved places need a signed-in account. Photos appear only after a moderator approves them.

create table if not exists reviews (
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  comment    text check (length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
alter table reviews enable row level security;
drop policy if exists "reviews readable" on reviews;
create policy "reviews readable" on reviews for select using (true);
drop policy if exists "write own review" on reviews;
create policy "write own review" on reviews for insert to authenticated with check (user_id = auth.uid() and is_real_user());
drop policy if exists "edit own review" on reviews;
create policy "edit own review" on reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "remove own or moderated review" on reviews;
create policy "remove own or moderated review" on reviews for delete to authenticated using (user_id = auth.uid() or is_moderator());

create or replace function place_reviews(p_id uuid)
returns table (user_id uuid, name text, avatar_url text, rating int, comment text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.user_id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, r.rating, r.comment, r.created_at
    from reviews r join profiles p on p.id = r.user_id
   where r.place_id = p_id
   order by r.created_at desc
   limit 50
$$;

create table if not exists favorites (
  user_id    uuid not null references profiles (id) on delete cascade,
  place_id   uuid not null references places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table favorites enable row level security;
drop policy if exists "own favorites" on favorites;
create policy "own favorites" on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_real_user());

create or replace function my_favorites()
returns table (id uuid, name text, place_type text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.place_type
    from favorites f join places p on p.id = f.place_id
   where f.user_id = auth.uid() and not p.removed
   order by f.created_at desc
$$;

create table if not exists place_photos (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  path       text not null check (length(path) <= 200),
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_place on place_photos (place_id);
alter table place_photos enable row level security;
drop policy if exists "approved photos readable" on place_photos;
create policy "approved photos readable" on place_photos for select
  using (approved or user_id = auth.uid() or is_moderator());
drop policy if exists "add own photo" on place_photos;
create policy "add own photo" on place_photos for insert to authenticated
  with check (user_id = auth.uid() and approved = false and is_real_user()
              and split_part(path, '/', 1) = auth.uid()::text);
drop policy if exists "remove moderated photo" on place_photos;
create policy "remove moderated photo" on place_photos for delete to authenticated using (user_id = auth.uid() or is_moderator());

-- At most 10 photos a day per person.
create or replace function photos_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from place_photos where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many photos today';
  end if;
  return new;
end; $$;
drop trigger if exists place_photos_limit on place_photos;
create trigger place_photos_limit before insert on place_photos for each row execute function photos_rate_limit();

-- At most 30 new reviews a day per person.
create or replace function reviews_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reviews where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many reviews today';
  end if;
  return new;
end; $$;
drop trigger if exists reviews_limit on reviews;
create trigger reviews_limit before insert on reviews for each row execute function reviews_rate_limit();

create or replace function pending_photos()
returns table (id uuid, place_id uuid, place_name text, path text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return query select ph.id, ph.place_id, p.name, ph.path
    from place_photos ph join places p on p.id = ph.place_id
   where not ph.approved order by ph.created_at limit 100;
end;
$$;

create or replace function moderate_photo(p_photo uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  if p_approve then update place_photos set approved = true where id = p_photo;
  else delete from place_photos where id = p_photo;
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-photos', 'place-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "place photos readable" on storage.objects;
create policy "place photos readable" on storage.objects for select using (bucket_id = 'place-photos');
drop policy if exists "upload place photos to own folder" on storage.objects;
create policy "upload place photos to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());
drop policy if exists "moderators remove place photos" on storage.objects;
create policy "moderators remove place photos" on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (is_moderator() or (storage.foldername(name))[1] = auth.uid()::text));

grant select, insert, update, delete on reviews, favorites, place_photos to authenticated;
grant select on reviews, place_photos to anon;
grant execute on function place_reviews(uuid) to anon, authenticated;
grant execute on function my_favorites() to authenticated;
grant execute on function pending_photos() to authenticated;
grant execute on function moderate_photo(uuid, boolean) to authenticated;
revoke execute on function photos_rate_limit() from anon, authenticated, public;
revoke execute on function reviews_rate_limit() from anon, authenticated, public;
notify pgrst, 'reload schema';
