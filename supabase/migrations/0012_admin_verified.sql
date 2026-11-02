-- Okeat — what the site admin adds is confirmed right away (run once in Supabase → SQL Editor → Run; safe to run again)
-- Everyone else still needs 3 confirmations.

create or replace function auto_verify_admin_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and new.proposed_by is not null and is_admin(new.proposed_by) then
    update claims set status = 'superseded'
     where place_id = new.place_id and need = new.need and status = 'verified' and id <> new.id;
    update claims set status = 'verified', verified_at = now(), last_confirmed_at = now()
     where id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function auto_verify_admin_claim() from anon, authenticated, public;

drop trigger if exists claims_admin_verified on claims;
create trigger claims_admin_verified after insert on claims
  for each row execute function auto_verify_admin_claim();

-- What you already added and is still waiting for confirmation is confirmed now too.
do $$
declare c record;
begin
  for c in
    select cl.id, cl.place_id, cl.need
      from claims cl
     where cl.status = 'pending' and cl.proposed_by is not null and is_admin(cl.proposed_by)
  loop
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = now(), last_confirmed_at = now()
     where id = c.id;
  end loop;
end $$;

select count(*) as admins from profiles where role = 'admin';
