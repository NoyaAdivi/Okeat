-- Okeat: on your profile you can see what you added and confirmed, and take back what nobody relied on yet.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function my_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level,
                                          'status', c.status, 'confirmCount', c.confirm_count) order by c.proposed_at desc)
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status <> 'superseded'), '[]'::jsonb),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

-- what you proposed can be taken back until someone confirmed it
create or replace function withdraw_claim(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims set status = 'rejected'
   where id = p_claim and proposed_by = auth.uid() and status = 'pending' and confirm_count = 0;
  if not found then raise exception 'Others already rely on this'; end if;
end; $$;

-- a place you added can be taken down while no one else added anything to it
create or replace function withdraw_place(p_place uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from claims c where c.place_id = p_place and (c.confirm_count > 0 or c.proposed_by is distinct from auth.uid()))
     or exists (select 1 from reviews r where r.place_id = p_place and r.user_id <> auth.uid()) then
    raise exception 'Others already rely on this';
  end if;
  update places set removed = true where id = p_place and created_by = auth.uid();
  if not found then raise exception 'Others already rely on this'; end if;
end; $$;

revoke execute on function my_activity() from anon, public;
revoke execute on function withdraw_claim(uuid) from anon, public;
revoke execute on function withdraw_place(uuid) from anon, public;
grant execute on function my_activity() to authenticated;
grant execute on function withdraw_claim(uuid) to authenticated;
grant execute on function withdraw_place(uuid) to authenticated;

notify pgrst, 'reload schema';
