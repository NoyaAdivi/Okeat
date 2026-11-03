-- Okeat: your account shows everything you added, newest first, photos included.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

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
      select 'saved', fv.place_id::text, fv.place_id, p.name, fv.created_at, null, null, null, null, null, null, null
        from favorites fv join places p on p.id = fv.place_id
       where fv.user_id = auth.uid() and not p.removed
    ) everything
  ) f where f.n <= 300;
$$;

revoke execute on function my_feed() from anon, public;
grant execute on function my_feed() to authenticated;

-- people can take down their own photos
drop policy if exists "remove own photo" on place_photos;
create policy "remove own photo" on place_photos for delete to authenticated using (user_id = auth.uid());
drop policy if exists "remove own place photo files" on storage.objects;
create policy "remove own place photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'place-photos' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
