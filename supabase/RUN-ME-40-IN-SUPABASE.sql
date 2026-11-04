-- Okeat: places that look wrong reach the admin by themselves. A place shows up by its name, by
-- being new, or by sitting on the same spot as many others. "It's fine" is remembered.
-- Hidden places can now be deleted for good.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists place_checks (
  place_id uuid primary key references places (id) on delete cascade,
  by_hand boolean not null default false,  -- put on the list on purpose
  ok boolean not null default false,       -- the admin looked and it is fine
  checked_at timestamptz
);
alter table place_checks enable row level security;

create or replace function place_suspect_reason(t text) returns text
language sql immutable as $$
  select case
    when t ~* 'אטליז|קצביי?[הת]|קצבייה|butcher' then 'butcher'
    when t ~* 'קייטרינג|catering' then 'catering'
    when t ~* 'אולם|אירועים|\yevents?\y' then 'hall'
    when t ~* 'פיצ|pizza|קפה|cafe|café|coffee|מסעד|restaurant|בורגר|burger|שווארמ|shawarma|חומוס|hummus|פלאפל|falafel|סושי|sushi|מאפ|baker|גליד|ice ?cream|gelato|ביסטרו|bistro|grill|גריל|kitchen|מטבח|אוכל|food|שף|chef|קונדיטור|patisserie|שניצל|טאבון|שיפוד|בשר|דגים|fish|שוקולד|chocolate|ממתק|candy|sweet|עוג|cake|בורקס|לחם|bread|מעדני|\ydeli|\ybar\y|\ypub\y|פאב|\ywine|בירה|beer|מזנון' then null
    when t ~* 'בגדים|אופנה|fashion|נעליים|shoes|תכשיט|jewel|רהיטים|furniture|יד שני|שמלות|וינטג|בושם|perfume|טבק|tobacco|מכבסה|laundry|פרחים|florist|מתנות|gift|צעצועים|חיות מחמד|סופרמרקט|supermarket|מינימרקט|מכולת|grocery|סיטונא|wholesale|מחשבים|סלולר' then 'shop'
    when t ~* 'מספרה|מספרת|barber|מכון יופי|beauty|ציפורניים|\ynails\y|קוסמטי|ספא |\yspa\y|עיסוי|massage|מוסך|צמיגים|car center|motors|מרכז רכב|שטיפת רכב|ביטוח|insurance|עורך דין|עו"ד|רואה חשבון|נדל"ן|real estate|שיווק|פרסום|marketing|ייעוץ|תיירות|\ytravel|השכרה|rental|הסעות|הובלות|ניקיון|cleaning|\ydj\y|תקליטן|מופעים|הפקות|production|סטודיו|studio|בע"מ|\yltd\y|\ygroup\y|קבוצת|יבוא|יצוא|import|export' then 'service'
    when t ~* 'מרפא|clinic|רופא|רפואה|שיניים|dental|וטרינר|בית מרקחת|pharm|קופת חולים|health|טיפול|therapy|פיזיותרפ|אופטיק|optic|hospital' then 'health'
    when t ~* 'בית ספר|school|גן ילדים|בית כנסת|synagogue|כנסיי?ה|\ychurch|מסגד|mosque|חדר כושר|\ygym\y|fitness|כושר|מוזיאון|museum|אוניברסיט|university|מכללה|college|מרכז אקדמי|המרכז האקדמי|עירייה|עיריית|municipal|משרד|\yoffice|חניון|parking|שגרירות|embassy|סיעת|הסתדרות|נעמת|ויצו|אגודת|עמותה|מתנ"ס|קאנטרי|מלון|\yhotel|hostel|צימר|גלריה|gallery' then 'other'
  end
$$;

create or replace function admin_suspects() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  with crowded as (
    select location::text as spot from places where not removed group by 1 having count(*) >= 4
  ), found as (
    select p.*, case
      when c.by_hand then 'hand'
      when p.created_by is not null and p.created_at > now() - interval '30 days' then 'new'
      else coalesce(place_suspect_reason(p.name), case when s.spot is not null then 'spot' end)
    end as reason
    from places p
    left join place_checks c on c.place_id = p.id
    left join crowded s on s.spot = p.location::text
    where not p.removed and coalesce(c.ok, false) = false
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'place_type', place_type, 'cuisine', cuisine, 'address', address,
    'phone', phone, 'website', website, 'reason', reason) order by reason, name), '[]'::jsonb)
  into result from found where reason is not null;
  return result;
end; $$;

create or replace function admin_places_ok(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  insert into place_checks (place_id, ok, checked_at) select unnest(p_ids), true, now()
  on conflict (place_id) do update set ok = true, checked_at = now();
end; $$;

create or replace function admin_hide_places(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update places set removed = true, flagged = false where id = any (p_ids);
  insert into admin_log (actor, action, detail)
    values (auth.uid(), 'place_hidden', cardinality(p_ids)::text || ' מקומות');
end; $$;

-- Only a place that is already hidden can go for good, so it always takes two decisions.
create or replace function admin_delete_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  delete from places where id = p_place and removed returning name into v_name;
  if v_name is not null then
    insert into admin_log (actor, action, detail) values (auth.uid(), 'place_deleted', v_name);
  end if;
end; $$;

-- The visit numbers now say when counting began.
create or replace function admin_visits_began() returns timestamptz
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return (select min(started) from site_visits);
end; $$;

-- The ones already found by hand.
insert into place_checks (place_id, by_hand)
select id, true from places where id in (
  '430f5801-1b32-45ec-9d11-d2612ffb78d7','3e8f5b5e-549e-4839-9cd9-68cfcaaa84f0','56aade61-596a-476a-8ea9-803ff23b8b9b',
  '9dd43a4e-e448-46f5-a2fd-dc51c3282aee','5892e977-19bc-4574-a9b3-38ab6be49a5a','7604ee4c-fd58-4a44-b68b-d0690d5b50db',
  'c1d82659-c925-426c-8c39-cdeadc930593','7479cbd7-b6da-4d2e-a224-883447d63604','ca20bafd-056e-4c06-9d6e-7d5813ac2c2a',
  'e8fbb503-13dc-498c-9628-8e104426b17a','19d69a05-d6e7-485f-86e7-529d82e79f75','87d2ee1e-937a-40fe-afd0-0014cffb9806',
  '80657460-d4a9-4edd-9a23-beea6ca6ce70','e7487eda-c0ff-488e-bbff-fc4f335a8efd','7c906594-1c81-41ae-bb23-76fa4e940875',
  '3d81e467-07f8-4124-a9b2-eb9611dd4a55','30838f9b-6fe5-43b4-9401-fec5c7a713cd','34284b85-3174-4a2f-9371-f7ddcc1b1a57',
  'c8cf8ec4-c522-4248-9f77-8edc672d766b','edbb4dfe-c9c9-41b6-a7b9-aaf0d8603139','02da7da2-558e-4c16-bb31-7e0d7caa44aa',
  '3a6608e1-d3e0-42ac-ac2d-89628c58460d'
) on conflict do nothing;

revoke execute on function admin_suspects() from anon, public;
revoke execute on function admin_places_ok(uuid[]) from anon, public;
revoke execute on function admin_hide_places(uuid[]) from anon, public;
revoke execute on function admin_delete_place(uuid) from anon, public;
revoke execute on function admin_visits_began() from anon, public;
grant execute on function admin_suspects() to authenticated;
grant execute on function admin_places_ok(uuid[]) to authenticated;
grant execute on function admin_hide_places(uuid[]) to authenticated;
grant execute on function admin_delete_place(uuid) to authenticated;
grant execute on function admin_visits_began() to authenticated;

notify pgrst, 'reload schema';
