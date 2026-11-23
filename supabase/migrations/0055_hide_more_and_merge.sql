-- 0055: five more places that are not food, and three places that appear twice.
-- (run once in Supabase -> SQL Editor -> Run; safe to run again)

-- Not places to eat. Hidden, not deleted, so any can come back.
update places set removed = true
where not removed and id in (
  '7a670b05-ce57-470c-8150-290a70019580', -- וינטר-גז Winter-gas
  '70a071fd-0da3-4794-8081-c99105e53fca', -- גז עבודי Abode gaz
  '7bfa17e7-4684-4ca5-8c3c-3a6119012bf8', -- Hod Hamahat Record Store
  '3dbb4fb7-5389-46e2-b2ab-b276ea2ecc91', -- קבוצת כינור דוד
  '741d041f-6510-4bd9-b4fe-4ea4497b4d23'  -- כלבו נחשונים
);

-- The same place twice at the same spot: merged with the site's own merge tool,
-- which keeps the richer one and moves reviews, photos, favorites and kosher info over.
do $$
declare who uuid;
begin
  select id into who from profiles where role = 'admin' limit 1;
  if who is null then raise notice 'no admin account found, nothing merged'; return; end if;
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  perform admin_merge_pair('8e2f401a-f4f6-4633-a865-ac435dac28de', 'e814f189-abdf-4f69-b2d3-b01d7ac745c0'); -- Joe&Go
  perform admin_merge_pair('41f8845d-035a-4180-b666-a6ef5f6207e9', '8f19712d-629b-436a-883c-6ca8f73cb6b6'); -- דדה
  perform admin_merge_pair('1eb801fe-7039-481e-badb-54c17d67d522', 'd773f56f-7d4a-434a-a1b7-556b39f26a5a'); -- Mama Mia
end $$;

notify pgrst, 'reload schema';

-- Check: in each pair, one row stays on the map (removed = false) and the other points to it (merged_into).
select name, removed, merged_into from places
where id in ('8e2f401a-f4f6-4633-a865-ac435dac28de','e814f189-abdf-4f69-b2d3-b01d7ac745c0',
             '41f8845d-035a-4180-b666-a6ef5f6207e9','8f19712d-629b-436a-883c-6ca8f73cb6b6',
             '1eb801fe-7039-481e-badb-54c17d67d522','d773f56f-7d4a-434a-a1b7-556b39f26a5a')
order by name;
