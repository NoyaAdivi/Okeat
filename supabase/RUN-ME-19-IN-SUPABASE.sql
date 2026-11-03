-- Okeat — only real accounts can change information, and a moderator's decision closes a report
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- Looking stays open to everyone. Adding, confirming, reporting and fixing need an account.
create or replace function require_real_account()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not is_real_user() then
    raise exception 'Sign in with an account';
  end if;
  return new;
end;
$$;

drop trigger if exists a_real_account on places;
create trigger a_real_account before insert on places for each row execute function require_real_account();
drop trigger if exists a_real_account on claims;
create trigger a_real_account before insert on claims for each row execute function require_real_account();
drop trigger if exists a_real_account on claim_votes;
create trigger a_real_account before insert on claim_votes for each row execute function require_real_account();
drop trigger if exists a_real_account on place_reports;
create trigger a_real_account before insert on place_reports for each row execute function require_real_account();

-- A moderator's "correct" clears the reports, and "not correct" takes the item off the list.
create or replace function moderate_claim(p_claim uuid, p_verify boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c claims%rowtype;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  select * into c from claims where id = p_claim for update;
  if p_verify then
    update claims set status = 'superseded'
     where place_id = c.place_id and need = c.need and status = 'verified' and id <> c.id;
    update claims set status = 'verified', verified_at = coalesce(verified_at, now()), last_confirmed_at = now(),
                      source = 'community', reject_count = 0
     where id = c.id;
  else
    update claims set status = 'rejected' where id = c.id;
  end if;
end;
$$;

-- Only open items are shown, so a decided one leaves the list.
create or replace function moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return jsonb_build_object(
    'reported', coalesce((select jsonb_agg(x order by x->>'reports' desc) from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'address', p.address,
                 'reports', (select count(*) from place_reports r where r.place_id = p.id),
                 'reasons', (select jsonb_agg(r.reason) from place_reports r where r.place_id = p.id and r.reason is not null)) x
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
end;
$$;

notify pgrst, 'reload schema';
