-- Okeat: anyone signed in can suggest what kind of place this is. A moderator approves it.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists place_suggestions (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references places (id) on delete cascade,
  user_id    uuid references profiles (id) on delete set null,
  place_type text not null,
  cuisine    text[] not null default '{}',
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists place_suggestions_pending on place_suggestions (created_at) where status = 'pending';
alter table place_suggestions enable row level security;
-- no direct access: everything goes through the functions below

create or replace function suggest_place_type(p_place uuid, p_type text, p_cuisine text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_real_user() then raise exception 'Sign in with an account'; end if;
  if p_type not in ('restaurant', 'cafe', 'bakery', 'pizza', 'ice_cream', 'hummus', 'sushi', 'grill', 'vegan_restaurant', 'stand', 'other') then
    raise exception 'Unknown place type';
  end if;
  if coalesce(array_length(p_cuisine, 1), 0) > 6 then raise exception 'That text is too long'; end if;
  if (select count(*) from place_suggestions where user_id = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many requests';
  end if;
  if not exists (select 1 from places where id = p_place and not removed) then raise exception 'You can only change your own details'; end if;
  delete from place_suggestions where place_id = p_place and user_id = auth.uid() and status = 'pending';
  insert into place_suggestions (place_id, user_id, place_type, cuisine)
  values (p_place, auth.uid(), p_type, coalesce(p_cuisine, '{}'));
end; $$;

create or replace function pending_suggestions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return coalesce((select jsonb_agg(x order by x->>'at') from (
    select jsonb_build_object('id', s.id, 'placeId', p.id, 'name', p.name, 'oldType', p.place_type, 'oldCuisine', p.cuisine,
                              'newType', s.place_type, 'newCuisine', s.cuisine, 'by', pr.display_name, 'at', s.created_at) x
      from place_suggestions s join places p on p.id = s.place_id left join profiles pr on pr.id = s.user_id
     where s.status = 'pending' and not p.removed limit 100) q), '[]'::jsonb);
end; $$;

create or replace function decide_suggestion(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare s place_suggestions;
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  update place_suggestions set status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and status = 'pending' returning * into s;
  if not found then return; end if;
  if p_approve then
    update places
       set place_type = s.place_type,
           cuisine = case when coalesce(array_length(s.cuisine, 1), 0) = 0 then cuisine else s.cuisine end,
           cuisine_source = 'community'
     where id = s.place_id;
    -- one decision per place: the other waiting suggestions are closed with it
    update place_suggestions set status = 'rejected' where place_id = s.place_id and status = 'pending';
  end if;
end; $$;

create or replace function my_feed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(f order by f.at desc), '[]'::jsonb) from (
    select *, row_number() over (order by at desc) as n from (
      select 'place' as kind, p.id::text as id, p.id as place_id, p.name as title, p.created_at as at,
             null::text as status, null::text as need, null::text as level, null::int as rating,
             null::text as comment, null::int as vote, null::text as path
        from places p where p.created_by = auth.uid() and not p.removed
      union all
      select 'claim', c.id::text, c.place_id, p.name, c.proposed_at, c.status::text, c.need::text, c.level, null, null, null, null
        from claims c join places p on p.id = c.place_id
       where c.proposed_by = auth.uid() and not p.removed and c.status not in ('rejected', 'superseded')
      union all
      select 'vote', v.claim_id::text, c.place_id, p.name, v.created_at, null, c.need::text, c.level, null, null, v.vote, null
        from claim_votes v join claims c on c.id = v.claim_id join places p on p.id = c.place_id
       where v.user_id = auth.uid() and not p.removed
      union all
      select 'review', r.place_id::text, r.place_id, p.name, r.created_at, null, null, null, r.rating, r.comment, null, null
        from reviews r join places p on p.id = r.place_id
       where r.user_id = auth.uid() and not p.removed
      union all
      select 'photo', ph.id::text, ph.place_id, p.name, ph.created_at,
             case when ph.approved then 'approved' else 'pending' end, null, null, null, null, null, ph.path
        from place_photos ph join places p on p.id = ph.place_id
       where ph.user_id = auth.uid() and not p.removed
      union all
      select 'list', l.id::text, null, l.title, l.created_at, null, null, null, null, null, null, null
        from lists l where l.owner_id = auth.uid()
      union all
      select 'suggestion', sg.id::text, sg.place_id, p.name, sg.created_at, sg.status, null, sg.place_type, null, null, null, null
        from place_suggestions sg join places p on p.id = sg.place_id
       where sg.user_id = auth.uid() and not p.removed
      union all
      select 'saved', fv.place_id::text, fv.place_id, p.name, fv.created_at, null, null, null, null, null, null, null
        from favorites fv join places p on p.id = fv.place_id
       where fv.user_id = auth.uid() and not p.removed
    ) everything
  ) f where f.n <= 300;
$$;

revoke execute on function suggest_place_type(uuid, text, text[]) from anon, public;
revoke execute on function pending_suggestions() from anon, public;
revoke execute on function decide_suggestion(uuid, boolean) from anon, public;
grant execute on function suggest_place_type(uuid, text, text[]) to authenticated;
grant execute on function pending_suggestions() to authenticated;
grant execute on function decide_suggestion(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
