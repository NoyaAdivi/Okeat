-- Okeat: a place put on the list by hand says why.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table place_checks add column if not exists note text;

create or replace function admin_suspects() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  with crowded as (
    select location::text as spot from places where not removed group by 1 having count(*) >= 4
  ), found as (
    select p.*, c.note, case
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
    'phone', phone, 'website', website, 'reason', reason, 'note', note) order by reason, name), '[]'::jsonb)
  into result from found where reason is not null;
  return result;
end; $$;

update place_checks c set note = v.note
from (values
  ('430f5801-1b32-45ec-9d11-d2612ffb78d7'::uuid, 'נשמע כמו חנות בגדים'),
  ('3e8f5b5e-549e-4839-9cd9-68cfcaaa84f0'::uuid, 'נשמע כמו משרד'),
  ('56aade61-596a-476a-8ea9-803ff23b8b9b'::uuid, 'נשמע כמו עסק של מוזיקה'),
  ('9dd43a4e-e448-46f5-a2fd-dc51c3282aee'::uuid, 'מכללה. אולי קפיטריה, ואולי לא מקום אוכל'),
  ('5892e977-19bc-4574-a9b3-38ab6be49a5a'::uuid, 'נשמע כמו חברת טיולים'),
  ('7604ee4c-fd58-4a44-b68b-d0690d5b50db'::uuid, 'נשמע כמו חברת מסחר, בלי מקום לאכול'),
  ('c1d82659-c925-426c-8c39-cdeadc930593'::uuid, 'נשמע כמו יבואן, לא מקום אוכל'),
  ('7479cbd7-b6da-4d2e-a224-883447d63604'::uuid, 'נשמע כמו עסק של מיתוג ועיצוב'),
  ('ca20bafd-056e-4c06-9d6e-7d5813ac2c2a'::uuid, 'סטודיו. לא ברור מה יש בו'),
  ('e8fbb503-13dc-498c-9628-8e104426b17a'::uuid, 'סטודיו. לא ברור מה יש בו'),
  ('19d69a05-d6e7-485f-86e7-529d82e79f75'::uuid, 'נשמע כמו מפעל או חברה'),
  ('87d2ee1e-937a-40fe-afd0-0014cffb9806'::uuid, 'נשמע כמו חברה ולא מקום אוכל'),
  ('80657460-d4a9-4edd-9a23-beea6ca6ce70'::uuid, 'שם כללי, אולי חברת אירועים'),
  ('e7487eda-c0ff-488e-bbff-fc4f335a8efd'::uuid, 'נשמע כמו ספא'),
  ('7c906594-1c81-41ae-bb23-76fa4e940875'::uuid, 'קאנטרי קלאב. אולי יש בו מזנון'),
  ('3d81e467-07f8-4124-a9b2-eb9611dd4a55'::uuid, 'נשמע כמו גלריה'),
  ('30838f9b-6fe5-43b4-9401-fec5c7a713cd'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('34284b85-3174-4a2f-9371-f7ddcc1b1a57'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('c8cf8ec4-c522-4248-9f77-8edc672d766b'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('edbb4dfe-c9c9-41b6-a7b9-aaf0d8603139'::uuid, 'נשמע כמו בוטיק בגדים'),
  ('02da7da2-558e-4c16-bb31-7e0d7caa44aa'::uuid, 'נשמע כמו עמותה'),
  ('3a6608e1-d3e0-42ac-ac2d-89628c58460d'::uuid, 'לא ברור מהשם מה זה')
) v (id, note)
where c.place_id = v.id;

notify pgrst, 'reload schema';
