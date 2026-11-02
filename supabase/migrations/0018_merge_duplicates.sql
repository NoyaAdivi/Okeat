-- Okeat — find places that appear twice, and merge them after the admin looks
-- (run once in Supabase → SQL Editor → Run; safe to run again)
-- Nothing is merged by running this file. A merged place is hidden, not deleted, and remembers where it went.

alter table places add column if not exists merged_into uuid references places (id) on delete set null;

create table if not exists not_duplicates (
  a uuid not null references places (id) on delete cascade,
  b uuid not null references places (id) on delete cascade,
  primary key (a, b)
);
alter table not_duplicates enable row level security;

-- Reports must follow a review when it moves to the kept place.
alter table review_reports drop constraint if exists review_reports_place_id_review_user_fkey;
alter table review_reports add constraint review_reports_place_id_review_user_fkey
  foreign key (place_id, review_user) references reviews (place_id, user_id) on delete cascade on update cascade;

-- The consonants of a name, in Latin letters: "ארקפה" and "Arcaffe" both become "rkp".
create or replace function place_skeleton(t text)
returns text
language sql immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        replace(replace(replace(lower(t), 'sh', 's'), 'ch', 'h'), 'ph', 'p'),
        'בגדוזחטכךלמםנןספףצץקרשתfwcqאהיעaeiouy',
        'bgdvzhtkklmmnnsppzzkrstpvkk'
      ),
      '[^a-z0-9]', '', 'g'
    ),
    '(.)\1+', '\1', 'g'
  )
$$;

create or replace function duplicate_pairs()
returns table (a_id uuid, a_name text, a_address text, b_id uuid, b_name text, b_address text, meters int)
language plpgsql stable security definer set search_path = public, extensions
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.name, p.address, q.id, q.name, q.address, round(st_distance(p.location, q.location))::int
      from places p
      join places q on p.id < q.id and st_dwithin(p.location, q.location, 80)
     where not p.removed and not q.removed
       and place_skeleton(p.name) = place_skeleton(q.name)
       and length(place_skeleton(p.name)) >= 3
       and not exists (select 1 from not_duplicates n where n.a = p.id and n.b = q.id)
     order by 7
     limit 400;
end;
$$;

create or replace function dismiss_duplicate(p_a uuid, p_b uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into not_duplicates (a, b) values (least(p_a, p_b), greatest(p_a, p_b)) on conflict do nothing;
end;
$$;

-- How much people have put into a place. The one with more stays.
create or replace function place_weight(p_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select (select count(*)::int from claims where place_id = p_id and source = 'community' and status = 'verified') * 3
       + (select count(*)::int from claims where place_id = p_id and source = 'community')
       + (select count(*)::int from reviews where place_id = p_id)
       + (select count(*)::int from favorites where place_id = p_id)
       + (select count(*)::int from place_photos where place_id = p_id)
       + (select case when location_locked then 2 else 0 end + case when owner_id is not null then 5 else 0 end from places where id = p_id)
$$;

create or replace function admin_merge_pair(p_a uuid, p_b uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  a places;
  b places;
  keep places;
  gone places;
  c claims;
  k claims;
  v_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into a from places where id = p_a and not removed for update;
  if not found then return null; end if;
  select * into b from places where id = p_b and not removed for update;
  if not found then return null; end if;

  if place_weight(a.id) > place_weight(b.id)
     or (place_weight(a.id) = place_weight(b.id) and (a.name ~ '[א-ת]' or b.name !~ '[א-ת]')) then
    keep := a; gone := b;
  else
    keep := b; gone := a;
  end if;

  -- What is known about the place. When both know the same thing, the kept one wins,
  -- unless people confirmed the other and the kept one is only an import or a guess.
  for c in select * from claims where place_id = gone.id and status in ('verified', 'pending') order by status = 'verified' desc loop
    select * into k from claims where place_id = keep.id and need = c.need and status in ('verified', 'pending')
     order by status = 'verified' desc limit 1;
    if not found then
      update claims set place_id = keep.id where id = c.id;
    elsif c.status = 'verified' and (k.status = 'pending' or (c.source = 'community' and k.source <> 'community')) then
      update claims set status = 'superseded' where id = k.id;
      update claims set place_id = keep.id where id = c.id;
    end if;
  end loop;

  update reviews r set place_id = keep.id where r.place_id = gone.id
    and not exists (select 1 from reviews x where x.place_id = keep.id and x.user_id = r.user_id);
  update favorites f set place_id = keep.id where f.place_id = gone.id
    and not exists (select 1 from favorites x where x.place_id = keep.id and x.user_id = f.user_id);
  update place_photos set place_id = keep.id where place_id = gone.id;
  update owner_requests o set place_id = keep.id where o.place_id = gone.id
    and (o.status <> 'pending' or not exists (select 1 from owner_requests x where x.place_id = keep.id and x.user_id = o.user_id and x.status = 'pending'));

  -- Both spellings stay searchable: "ארקפה · Arcaffe".
  v_name := keep.name;
  if (keep.name ~ '[א-ת]') <> (gone.name ~ '[א-ת]') then
    v_name := left(keep.name || ' · ' || gone.name, 120);
  end if;

  update places set
    name = v_name,
    address = coalesce(address, gone.address),
    phone = coalesce(phone, gone.phone),
    website = coalesce(website, gone.website),
    hours = coalesce(hours, gone.hours),
    cuisine = coalesce(cuisine, gone.cuisine),
    owner_id = coalesce(owner_id, gone.owner_id),
    owner_verified_at = coalesce(owner_verified_at, gone.owner_verified_at)
  where id = keep.id;

  update places set removed = true, merged_into = keep.id where id = gone.id;
  return keep.id;
end;
$$;

revoke execute on function place_weight(uuid) from anon, authenticated, public;
revoke execute on function duplicate_pairs() from anon, public;
revoke execute on function dismiss_duplicate(uuid, uuid) from anon, public;
revoke execute on function admin_merge_pair(uuid, uuid) from anon, public;
grant execute on function duplicate_pairs() to authenticated;
grant execute on function dismiss_duplicate(uuid, uuid) to authenticated;
grant execute on function admin_merge_pair(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
