-- Okeat: in the admin dashboard, the numbers open into the people and items behind them.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function admin_stat_details(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;

  if p_kind in ('users', 'newUsers') then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'sub', x.email, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select u.id, coalesce(p.display_name, u.email) as title, u.email, u.created_at
              from auth.users u left join profiles p on p.id = u.id
             where not coalesce(u.is_anonymous, false) and u.email_confirmed_at is not null
               and (p_kind = 'users' or u.created_at > now() - interval '7 days')
             order by u.created_at desc limit 200) x;

  elsif p_kind = 'verified' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.name, 'placeId', x.place_id, 'need', x.need, 'level', x.level,
                                                 'count', x.confirm_count, 'at', x.verified_at) order by x.verified_at desc nulls last), '[]'::jsonb)
      into result
      from (select c.id, p.name, c.place_id, c.need, c.level, c.confirm_count, c.verified_at
              from claims c join places p on p.id = c.place_id
             where c.status = 'verified' and c.source = 'community'
             order by c.verified_at desc nulls last limit 200) x;

  elsif p_kind = 'reviews' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.user_id::text || x.place_id::text, 'title', x.name, 'placeId', x.place_id, 'rating', x.rating,
                                                 'sub', x.comment, 'by', x.author, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select r.user_id, r.place_id, p.name, r.rating, r.comment, pr.display_name as author, r.created_at
              from reviews r join places p on p.id = r.place_id
              left join profiles pr on pr.id = r.user_id
             order by r.created_at desc limit 200) x;

  elsif p_kind = 'lists' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'by', x.author, 'count', x.places, 'at', x.created_at) order by x.created_at desc), '[]'::jsonb)
      into result
      from (select l.id, l.title, pr.display_name as author, l.created_at,
                   (select count(*) from list_places lp where lp.list_id = l.id) as places
              from lists l left join profiles pr on pr.id = l.owner_id
             order by l.created_at desc limit 200) x;

  else
    raise exception 'Unknown kind';
  end if;

  return result;
end;
$$;

revoke all on function admin_stat_details(text) from public, anon;
grant execute on function admin_stat_details(text) to authenticated;

notify pgrst, 'reload schema';
