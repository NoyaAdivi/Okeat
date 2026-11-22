-- 0053: remove the "auth insert" policies.
-- The Security Advisor found a policy named "auth insert" (WITH CHECK true) on 24 tables.
-- It is not in any Okeat migration. Because policies add up, it let any signed-in user
-- insert rows directly into those tables, skipping Okeat's own rules (places, claims,
-- certificates, profiles, admin_log and more).
-- Okeat's real insert rules and its security definer functions keep working without it.

do $$
declare r record;
begin
  for r in
    select schemaname, tablename from pg_policies
    where schemaname = 'public' and policyname = 'auth insert'
  loop
    execute format('drop policy %I on %I.%I', 'auth insert', r.schemaname, r.tablename);
  end loop;
end $$;

-- Check: this should return 0 rows.
select tablename from pg_policies where schemaname = 'public' and policyname = 'auth insert';
