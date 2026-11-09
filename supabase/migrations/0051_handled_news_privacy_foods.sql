-- Okeat: reports that stay with a "handled" label, where the notification dot comes from,
-- a dashboard where today, week and month really differ, profile pictures, private lists,
-- taking back a type suggestion, the new kinds of food, and tidier names and addresses.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- ---------- 1. reports: handled or not, instead of disappearing ----------
alter table place_reports add column if not exists handled boolean not null default false;
alter table place_reports add column if not exists handled_at timestamptz;

-- Only reports nobody handled yet count toward sending a place to the moderators.
create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or new.reason like '[לא קשור לאוכל]%'
     or (select count(*) from place_reports where place_id = new.place_id and not handled) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;

-- "The place is fine" marks its reports as handled. They stay in the list, so nothing is lost.
create or replace function moderate_place(p_place uuid, p_remove boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  if p_remove then
    update places set removed = true, flagged = false where id = p_place;
  else
    update places set flagged = false where id = p_place;
  end if;
  update place_reports set handled = true, handled_at = now() where place_id = p_place and not handled;
end; $$;

create or replace function admin_mark_report(p_place uuid, p_user uuid, p_handled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  update place_reports
     set handled = coalesce(p_handled, true), handled_at = case when coalesce(p_handled, true) then now() end
   where place_id = p_place and user_id = p_user;
  -- a place whose reports are all handled leaves the "reported" list
  if coalesce(p_handled, true) and not exists (select 1 from place_reports where place_id = p_place and not handled) then
    update places set flagged = false where id = p_place;
  end if;
end; $$;

-- The moderators' list of reported places counts only open reports.
create or replace function moderation_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return jsonb_build_object(
    'reported', coalesce((select jsonb_agg(x order by x->>'reports' desc) from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address,
                 'reports', (select count(*) from place_reports r where r.place_id = p.id and not r.handled),
                 'reasons', (select jsonb_agg(r.reason) from place_reports r where r.place_id = p.id and r.reason is not null and not r.handled)) x
          from places p where p.flagged and not p.removed) q), '[]'::jsonb),
    'claims', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', c.id, 'placeId', p.id, 'placeName', p.name, 'need', c.need, 'level', c.level,
                 'status', c.status, 'source', c.source, 'confirm', c.confirm_count, 'reject', c.reject_count) x
          from claims c join places p on p.id = c.place_id
         where not p.removed and (c.status = 'disputed' or (c.source in ('auto', 'osm') and c.reject_count > 0 and c.status in ('verified', 'pending'))
                or (c.status = 'pending' and c.reject_count > 0))
         order by c.reject_count desc limit 100) q), '[]'::jsonb),
    'owners', case when is_admin() then coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', o.id, 'placeId', p.id, 'placeName', p.name, 'code', o.code,
                 'proofUrl', o.proof_url, 'note', o.note, 'user', pr.display_name, 'createdAt', o.created_at) x
          from owner_requests o join places p on p.id = o.place_id join profiles pr on pr.id = o.user_id
         where o.status = 'pending' and o.proof_url is not null order by o.created_at) q), '[]'::jsonb) else '[]'::jsonb end
  );
end; $$;

-- The same activity list, with a report's status saying whether it was handled.
create or replace function admin_feed(p_kind text default null, p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) into result from (
    select e.*, pr.display_name as user_name from (
      select 'user' as kind, u.id::text as id, u.created_at as at, u.id as user_id, null::uuid as place_id,
             null::text as title, null::text as need, null::text as level, null::int as rating, null::text as detail, null::text as path, null::text as status
        from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
      union all
      select 'place', p.id::text, p.created_at, p.created_by, p.id, p.name, null, null, null, p.address, null, null
        from places p where p.created_by is not null and not p.removed
      union all
      select 'claim', c.id::text, c.proposed_at, c.proposed_by, c.place_id, p.name, c.need::text, c.level, null, null, null, c.status::text
        from claims c join places p on p.id = c.place_id where c.proposed_by is not null and not p.removed
      union all
      select 'vote', v.claim_id::text || v.user_id::text, v.created_at, v.user_id, c.place_id, p.name, c.need::text, c.level, v.vote, null, null, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id where not p.removed
      union all
      select 'review', r.place_id::text || r.user_id::text, r.created_at, r.user_id, r.place_id, p.name, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id where not p.removed
      union all
      select 'photo', ph.id::text, ph.created_at, ph.user_id, ph.place_id, p.name, null, null, null, null, ph.path,
             case when ph.approved then 'approved' else 'pending' end
        from place_photos ph join places p on p.id = ph.place_id where not p.removed
      union all
      select 'report', rp.place_id::text || rp.user_id::text, rp.created_at, rp.user_id, rp.place_id, p.name, null, null, null, rp.reason, null,
             case when rp.handled then 'handled' else 'pending' end
        from place_reports rp join places p on p.id = rp.place_id
      union all
      select 'suggestion', s.id::text, s.created_at, s.user_id, s.place_id, p.name, null, s.place_type, null, array_to_string(s.cuisine, ', '), null, s.status
        from place_suggestions s join places p on p.id = s.place_id where not p.removed
      union all
      select 'list', l.id::text, l.created_at, l.owner_id, null, l.title, null, null, null, null, null, null
        from lists l
      union all
      select 'message', m.id::text, m.created_at, m.user_id, null, null, null, m.topic, null, m.message, null,
             case when m.handled then 'seen' else 'pending' end
        from feedback m where is_admin()
    ) e
    left join profiles pr on pr.id = e.user_id
    where p_kind is null or e.kind = p_kind
    order by e.at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300)
  ) f;
  return result;
end; $$;

-- A place shows how many open reports it has.
create or replace function place_meta(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'createdAt', p.created_at,
    'creator', case when c.id is null then null else jsonb_build_object(
                 'id', c.id, 'name', coalesce(nullif(c.display_name, ''), 'משתמש/ת Okeat'), 'avatar', c.avatar_url) end,
    'ownerVerified', p.owner_verified_at is not null,
    'flagged', p.flagged,
    'reports', (select count(*) from place_reports r where r.place_id = p.id and not r.handled),
    'iReported', exists (select 1 from place_reports r where r.place_id = p.id and r.user_id = auth.uid()),
    'iRequestedOwner', exists (select 1 from owner_requests o where o.place_id = p.id and o.user_id = auth.uid() and o.status = 'pending'),
    'canModerate', is_moderator(),
    'isAdmin', is_admin()
  )
    from places p
    left join profiles c on c.id = p.created_by
   where p.id = p_id
$$;

-- ---------- 2. where the red dot comes from ----------
create or replace function admin_new_breakdown(p_since timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_moderator() then return null; end if;
  select jsonb_build_object(
    'place', (select count(*) from places where created_by is not null and created_by <> auth.uid() and created_at > p_since and not removed),
    'claim', (select count(*) from claims where proposed_by is not null and proposed_by <> auth.uid() and proposed_at > p_since),
    'review', (select count(*) from reviews where user_id <> auth.uid() and created_at > p_since),
    'photo', (select count(*) from place_photos where user_id <> auth.uid() and created_at > p_since),
    'report', (select count(*) from place_reports where created_at > p_since and not handled),
    'suggestion', (select count(*) from place_suggestions where created_at > p_since and status = 'pending')
  ) into r;
  return r || jsonb_build_object('total', (select sum(value::int) from jsonb_each_text(r)));
end; $$;

-- ---------- 3. dashboard: everything counted inside the chosen range ----------
create or replace function admin_range_stats(p_days int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := case when coalesce(p_days, 0) <= 0 then '-infinity'::timestamptz
    else (((now() at time zone 'Asia/Jerusalem')::date - (least(p_days, 365) - 1))::timestamp at time zone 'Asia/Jerusalem') end;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'since', case when since = '-infinity'::timestamptz then null else since end,
    'kinds', jsonb_build_object(
      'user', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null and u.created_at >= since),
      'place', (select count(*) from places p where p.created_by is not null and not p.removed and p.created_at >= since),
      'claim', (select count(*) from claims c where c.proposed_by is not null and c.proposed_at >= since),
      'vote', (select count(*) from claim_votes v where v.created_at >= since),
      'review', (select count(*) from reviews r where r.created_at >= since),
      'photo', (select count(*) from place_photos h where h.created_at >= since),
      'report', (select count(*) from place_reports x where x.created_at >= since),
      'suggestion', (select count(*) from place_suggestions s where s.created_at >= since),
      'list', (select count(*) from lists l where l.created_at >= since)
    ),
    'topUsers', coalesce((select jsonb_agg(t) from (
      select pr.id, pr.display_name as name, count(*) as actions from (
        select proposed_by as who from claims where proposed_at >= since
        union all select user_id from claim_votes where created_at >= since
        union all select user_id from reviews where created_at >= since
        union all select created_by from places where created_at >= since
        union all select user_id from place_photos where created_at >= since
      ) a join profiles pr on pr.id = a.who group by pr.id, pr.display_name order by count(*) desc limit 5) t), '[]'::jsonb)
  );
end; $$;

-- ---------- 4. one place for the admin's edit form, from anywhere ----------
create or replace function admin_get_place(p_place uuid)
returns table (id uuid, name text, place_type text, cuisine text[], address text, phone text, website text, removed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query select p.id, p.name, p.place_type, p.cuisine, p.address, p.phone, p.website, p.removed from places p where p.id = p_place;
end; $$;

-- ---------- 5. taking back your own type suggestion before it is decided ----------
create or replace function withdraw_suggestion(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from place_suggestions where id = p_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'You can only change your own details'; end if;
end; $$;

-- ---------- 6. your own profile picture ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text and is_real_user());
drop policy if exists "remove own avatar" on storage.objects;
create policy "remove own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Only a picture from your own folder, or none.
create or replace function set_my_avatar(p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_real_user() then raise exception 'Sign in with an account'; end if;
  if p_url is not null and (p_url !~ '^https://' or length(p_url) > 500
      or position('/storage/v1/object/public/avatars/' || auth.uid()::text || '/' in p_url) = 0) then
    raise exception 'That picture cannot be used';
  end if;
  update profiles set avatar_url = p_url where id = auth.uid();
end; $$;

-- ---------- 7. lists are shared by their link, not downloadable as one big list ----------
drop policy if exists "lists readable" on lists;
create policy "lists readable" on lists for select using (owner_id = auth.uid() or is_admin());
drop policy if exists "list places readable" on list_places;
create policy "list places readable" on list_places for select
  using (exists (select 1 from lists l where l.id = list_places.list_id and (l.owner_id = auth.uid() or is_admin())));

revoke execute on function admin_mark_report(uuid, uuid, boolean) from anon, public;
revoke execute on function admin_new_breakdown(timestamptz) from anon, public;
revoke execute on function admin_range_stats(int) from anon, public;
revoke execute on function admin_get_place(uuid) from anon, public;
revoke execute on function withdraw_suggestion(uuid) from anon, public;
revoke execute on function set_my_avatar(text) from anon, public;
grant execute on function admin_mark_report(uuid, uuid, boolean) to authenticated;
grant execute on function admin_new_breakdown(timestamptz) to authenticated;
grant execute on function admin_range_stats(int) to authenticated;
grant execute on function admin_get_place(uuid) to authenticated;
grant execute on function withdraw_suggestion(uuid) to authenticated;
grant execute on function set_my_avatar(text) to authenticated;

-- ---------- 8. the new kinds of food, found by the place's name ----------
-- Only places whose food was not set by people. Nothing is removed, a kind is only added.
do $$
declare k record;
begin
  for k in select * from (values
    ('schnitzel', 'שניצל|schnitzel'),
    ('sabich', 'סביח|sabich'),
    ('skewers', 'שיפוד|shipud|skewer|קבב|kebab'),
    ('burekas', 'בורקס|burek'),
    ('shakshuka', 'שקשוק|shakshuk'),
    ('poke', 'פוקי|פוקה|(^|\s)poke($|\s)'),
    ('seafood', 'פירות ים|seafood|sea food|שרימפ|shrimp'),
    ('chocolate', 'שוקולד|chocolat'),
    ('waffle', 'וופל|waffle|crepe|crêpe|(^|\s)קרפ'),
    ('bar', 'פאב|(^|\s)pub($|\s)|בירה|(^|\s)beer'),
    ('moroccan', 'מרוקא|maroc|morocc'),
    ('iraqi', 'עיראק|iraq|קובה|kubbe|kubba'),
    ('kurdish', 'כורד|kurd'),
    ('persian', '(^|\s)[הו]?פרסי|persia|(^|\s)iran'),
    ('yemeni', 'תימנ|yemen|ג.?חנון|מלאווח|jachnun|malawach'),
    ('tripolitan', 'טריפול|tripol|libya|(^|\s)לובי'),
    ('tunisian', 'תוניס|tunis'),
    ('ethiopian', 'אתיופ|ethiop|אינג.?רה|injera'),
    ('georgian', 'גאורג|גרוזינ|georgia|חצ.?פורי|khachapuri|חינקלי|khinkali'),
    ('bukharan', 'בוכר|bukhar|(^|\s)פלוב|plov'),
    ('ashkenazi', 'אשכנז|ashkenaz'),
    ('balkan', 'בלקנ|בולגר|balkan|bulgar|romania|(^|\s)רומני'),
    ('russian', '(^|\s)רוסי|russia|פלמני|pelmeni'),
    ('spanish', 'spanish|español|espanol|tapas|טאפאס|paella|פאייה'),
    ('greek', 'יוונ|greek|gyro|souvlaki|סובלקי'),
    ('turkish', 'טורק|(^|\s)turk(?!ey)|kebap|lahmacun|לחמג.?ון'),
    ('argentinian', 'ארגנטינ|argentin|parrilla'),
    ('thai', 'תאילנד|(^|\s)thai'),
    ('vietnamese', 'וייטנאמ|vietnam|(^|\s)pho($|\s)|banh mi|באן מי'),
    ('korean', 'קוריא|korea'),
    ('healthy', 'בריא|healthy|organic|אורגני')
  ) as v(food, pattern)
  loop
    update places
       set cuisine = array_append(coalesce(cuisine, '{}'), k.food),
           cuisine_source = coalesce(cuisine_source, 'auto')
     where not removed
       and coalesce(cuisine_source, '') <> 'community'
       and name ~* k.pattern
       and not (coalesce(cuisine, '{}') @> array[k.food])
       and coalesce(array_length(cuisine, 1), 0) < 6;
  end loop;
end $$;

-- ---------- 9. tidier names and addresses ----------
-- Extra spaces, quotes around a name, the country and postal codes in an address, "unnamed road".
update places set name = btrim(regexp_replace(name, '\s+', ' ', 'g'), ' "''״׳')
 where name ~ '\s{2,}|^\s|\s$|^["''״׳]|["''״׳]$'
   and length(btrim(regexp_replace(name, '\s+', ' ', 'g'), ' "''״׳')) >= 2;

update places
   set address = nullif(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(address, '\s+', ' ', 'g'),
         '(^|,)\s*(ישראל|israel|إسرائيل)\s*(?=,|$)', '\1', 'gi'),
         '(^|,)\s*\d{5,7}\s*(?=,|$)', '\1', 'g'),
         '(^|\s)\d{7}($|\s)', '\1', 'g'),
         '(^|,)\s*(unnamed road|רחוב ללא שם|ללא שם)\s*(?=,|$)', '\1', 'gi'),
         '\s*,\s*', ', ', 'g'),
         '(, )+', ', ', 'g'),
         '^[\s,.;:-]+|[\s,.;:-]+$', '', 'g'), '')
 where address ~* '\s{2,}|(^|,)\s*(ישראל|israel|إسرائيل)\s*(,|$)|(^|,)\s*\d{5,7}\s*(,|$)|(^|\s)\d{7}($|\s)|unnamed road|ללא שם|^\s*,|,\s*$|\s,';

notify pgrst, 'reload schema';
