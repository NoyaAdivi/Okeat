-- Okeat: people can fix or delete what they added. A change goes back for confirmation.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- A changed detail starts over: old confirmations were for the old wording.
-- Kosher stays out: its level comes with a certificate, so it is deleted and added again.
create or replace function update_my_claim(p_claim uuid, p_level text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims
     set level = p_level, status = 'pending', confirm_count = 0, reject_count = 0,
         verified_at = null, last_confirmed_at = null
   where id = p_claim and proposed_by = auth.uid() and need <> 'kosher'
     and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
  delete from claim_votes where claim_id = p_claim;
end; $$;

create or replace function withdraw_claim(p_claim uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update claims set status = 'rejected'
   where id = p_claim and proposed_by = auth.uid() and status in ('pending', 'verified', 'disputed');
  if not found then raise exception 'You can only change your own details'; end if;
end; $$;

-- The change shows at once and waits in the admin's queue.
create or replace function update_my_place(p_place uuid, p_name text, p_address text, p_phone text, p_website text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'A place needs a name'; end if;
  if length(p_address) > 200 or length(p_phone) > 30 then raise exception 'That text is too long'; end if;
  if nullif(trim(p_website), '') is not null and (p_website !~* '^https?://' or length(p_website) > 300) then
    raise exception 'must start with https';
  end if;
  update places
     set name = trim(p_name), address = nullif(trim(p_address), ''), phone = nullif(trim(p_phone), ''),
         website = nullif(trim(p_website), ''), flagged = true
   where id = p_place and created_by = auth.uid() and not removed;
  if not found then raise exception 'You can only change your own details'; end if;
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
      select jsonb_agg(jsonb_build_object('placeId', c.place_id, 'place', p.name, 'need', c.need, 'level', c.level, 'vote', v.vote) order by v.created_at desc)
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('placeId', r.place_id, 'place', p.name, 'rating', r.rating, 'comment', r.comment) order by r.created_at desc)
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed), '[]'::jsonb)
  );
$$;

-- What was deleted stops counting on the profile.
create or replace function public_profile(p_id uuid)
returns table (id uuid, display_name text, avatar_url text, role text, joined_at timestamptz,
               places_added bigint, info_added bigint, confirmations bigint, favorite_food text, reviews bigint)
language sql stable security definer set search_path = public
as $$
  select p.id, coalesce(nullif(p.display_name, ''), 'משתמש/ת Okeat'), p.avatar_url, p.role, p.created_at,
         (select count(*) from places where created_by = p.id and not removed),
         (select count(*) from claims where proposed_by = p.id and status not in ('rejected', 'superseded')),
         (select count(*) from claim_votes where user_id = p.id and vote = 1),
         nullif(p.favorite_food, ''),
         (select count(*) from reviews r where r.user_id = p.id)
    from profiles p
   where p.id = p_id
$$;

revoke execute on function update_my_claim(uuid, text) from anon, public;
revoke execute on function update_my_place(uuid, text, text, text, text) from anon, public;
grant execute on function update_my_claim(uuid, text) to authenticated;
grant execute on function update_my_place(uuid, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
