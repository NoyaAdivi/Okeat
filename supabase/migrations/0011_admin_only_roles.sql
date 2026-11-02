-- Okeat — only the site admin gives moderator rights (run once in Supabase → SQL Editor → Run; safe to run again)
-- Before running: replace PASTE-YOUR-EMAIL with the e-mail you sign in to Okeat with.

-- 1. No more automatic promotion.
drop trigger if exists places_promote on places;
drop trigger if exists votes_promote on claim_votes;
drop function if exists promote_after_place();
drop function if exists promote_after_vote();
drop function if exists maybe_promote(uuid);

-- 2. Anyone who got the role automatically goes back to a regular user.
update profiles set role = 'user' where role = 'trusted';

-- 3. You are the admin. Stops with an error if this e-mail has no account yet.
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower('PASTE-YOUR-EMAIL');
  if owner_id is null then
    raise exception 'No account with this e-mail. Sign in to Okeat with it first, then run this file again.';
  end if;
  update profiles set role = 'admin' where id = owner_id;
end $$;

-- To make someone a moderator later, copy their user id from Authentication → Users and run:
--   update profiles set role = 'trusted' where id = 'THEIR-USER-ID';

select p.display_name, p.role, u.email
  from profiles p join auth.users u on u.id = p.id
 where p.role <> 'user';
