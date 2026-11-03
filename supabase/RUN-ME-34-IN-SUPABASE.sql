-- Okeat: kosher details can be edited too, and a confirmation can be taken back.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function update_my_claim(p_claim uuid, p_level text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_level = 'marked' then raise exception 'You can only change your own details'; end if;
  update claims
     set level = p_level, status = 'pending', confirm_count = 0, reject_count = 0,
         verified_at = null, last_confirmed_at = null
   where id = p_claim and proposed_by = auth.uid()
     and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
  delete from claim_votes where claim_id = p_claim;
end; $$;

-- A confirmation taken back stops counting. If that leaves too few, the detail waits for confirmation again.
create or replace function withdraw_vote(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
declare was int;
begin
  delete from claim_votes where claim_id = p_claim and user_id = auth.uid() returning vote into was;
  if not found then raise exception 'You can only change your own details'; end if;
  update claims
     set confirm_count = greatest(0, confirm_count - case when was = 1 then 1 else 0 end),
         reject_count = greatest(0, reject_count - case when was = 1 then 0 else 1 end)
   where id = p_claim;
  update claims set status = 'pending', verified_at = null
   where id = p_claim and status = 'verified' and source = 'community' and confirm_count < verify_threshold();
end; $$;

create or replace function my_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('superseded', 'rejected')), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('claimId', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

revoke execute on function withdraw_vote(uuid) from anon, public;
grant execute on function withdraw_vote(uuid) to authenticated;

notify pgrst, 'reload schema';
