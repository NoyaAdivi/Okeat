-- Okeat: the "nice to meet you" window shows once per account, however you sign in.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

alter table profiles add column if not exists setup_done boolean not null default false;

-- Whoever already set a name or a favorite food, and every admin or moderator, is done.
update profiles p set setup_done = true
  from auth.users u
 where u.id = p.id
   and (p.favorite_food is not null
        or p.role <> 'user'
        or (nullif(trim(p.display_name), '') is not null and p.display_name <> split_part(u.email, '@', 1)));

grant select (setup_done) on profiles to authenticated;
grant update (setup_done) on profiles to authenticated;

notify pgrst, 'reload schema';
