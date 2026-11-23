-- 0054: close private tables to visitors, and hide places that don't serve food.
-- (run once in Supabase -> SQL Editor -> Run; safe to run again)
--
-- A security check (Nov 2026) found that anyone with the public site key could READ tables that
-- are meant for admins only: contact messages, owner verification codes, the admin log, reports,
-- visit stats and more. The policies in Okeat's own migrations are strict, so the leak comes from
-- an extra "read everything" policy that was added outside them (like the "auth insert" one in 0053).
--
-- 1. On each private table, every policy that is not one of Okeat's own is removed.
-- 2. Visitors who aren't signed in lose direct read access to those tables altogether.
--    Okeat reads them only through its own functions, which keep working.

do $$
declare
  r record;
  keep text[] := array[
    'client_errors:moderators read errors', 'client_errors:moderators clear errors',
    'feedback:anyone can send feedback',
    'owner_requests:own owner requests readable',
    'place_reports:own reports readable', 'place_reports:signed-in users report',
    'review_reports:report a review', 'review_reports:own reports readable', 'review_reports:moderators clear reports',
    'claim_votes:own votes readable', 'claim_votes:signed-in users vote',
    'favorites:own favorites',
    'lists:own lists added', 'lists:own lists edited', 'lists:own or moderated lists removed', 'lists:lists readable',
    'list_places:own list places added', 'list_places:own list places removed', 'list_places:list places readable'
  ];
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('admin_log', 'client_errors', 'extraction_log', 'feedback', 'mail_counts', 'not_duplicates',
                        'owner_requests', 'place_checks', 'place_reports', 'place_suggestions', 'review_reports',
                        'search_cities', 'search_terms', 'site_visits', 'claim_votes', 'favorites', 'lists', 'list_places')
      and not (tablename || ':' || policyname) = any (keep)
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    raise notice 'removed policy "%" on %', r.policyname, r.tablename;
  end loop;
end $$;

-- the same tables, with row level security switched on (in case it was switched off)
alter table admin_log enable row level security;
alter table client_errors enable row level security;
alter table extraction_log enable row level security;
alter table feedback enable row level security;
alter table mail_counts enable row level security;
alter table not_duplicates enable row level security;
alter table owner_requests enable row level security;
alter table place_checks enable row level security;
alter table place_reports enable row level security;
alter table place_suggestions enable row level security;
alter table review_reports enable row level security;
alter table search_cities enable row level security;
alter table search_terms enable row level security;
alter table site_visits enable row level security;
alter table claim_votes enable row level security;
alter table favorites enable row level security;
alter table lists enable row level security;
alter table list_places enable row level security;

-- Visitors who aren't signed in never need to read these directly.
-- (The contact form still works: sending a message is an insert, not a read.)
revoke select, update, delete on admin_log, client_errors, extraction_log, feedback, mail_counts, not_duplicates,
  owner_requests, place_checks, place_reports, place_suggestions, review_reports, search_cities, search_terms,
  site_visits, claim_votes, favorites from anon;

-- Places on the map that are not places to eat: shops for coffee machines, outdoor kitchens and gas,
-- wholesalers, food factories, baking courses, a baby store. Hidden, not deleted, so any can come back.
update places set removed = true
where not removed and id in (
  '0759d701-7809-49fc-9e1e-b705849b95f5','7d7d8944-3a26-409e-b876-8c39bce4c167', -- Shilav (baby store), twice
  'b2309957-d294-4466-b1d4-d7d1297240b7', -- סופרגז, gas bottles
  '0cd79eff-8a55-4836-991c-c0c270e872fa','89671044-65b5-457e-8324-e287baefb973','c7aa09b6-4e52-4958-a4f0-53dd729ec2dc', -- outdoor kitchens
  '47cb3453-6d6b-4b2b-8ce3-2502e5a30918','7da444f2-a6de-4639-af92-140d1765035f','759e2d88-1f96-4a2f-9912-90bd710b1852',
  'b60f7d66-bb11-453a-b7c4-76ae7953f203','dcc800c4-4b65-4872-937a-9b33aa02ceee', -- coffee machine shops
  '53f7704f-d668-4f8c-902e-674c60d7693e', -- coffee importer
  'f5e502bd-4394-46ba-9e70-3e84b46194ca', -- institutional food supplier
  '57ba1b9c-9492-4422-b576-2228c4a36f8d','07bb9e84-5bfe-4c43-b8d4-0855279c6606', -- baking supplies, frozen dough
  '0bf15169-c1ed-4263-b443-5023b25da274', -- tobacco and candy wholesaler
  '88d1d2cf-6f20-492c-9a92-ae33c33cf809', -- food industries
  '2e4093b6-1535-45e0-ab0c-351c4460a0b3', -- meat marketing
  '87e10203-8ec1-45e5-a356-7c65c63baad8','644a7f7a-00b8-48d6-b095-15cfb956b642', -- baking courses
  '1d5c2088-5a30-4fa4-9594-fef49b5f95e4', -- produce delivery
  '03533ccf-a914-49ae-969a-b4e8e48673b1', -- fruit baskets
  '91b8bd18-c30f-4343-b67c-f6363c9d5e9b','acacca86-973b-47eb-8e23-e504ce15bf9f', -- factories
  '7b2b3f00-7341-46f5-9195-4102ba376bd4','bb7c8b16-74a2-4589-a41c-e3884f6bde8b' -- ice cream wholesalers
);

notify pgrst, 'reload schema';

-- Check 1: policies left on the private tables (only Okeat's own names should appear).
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('admin_log', 'feedback', 'owner_requests', 'site_visits', 'place_reports', 'search_terms')
order by tablename;
