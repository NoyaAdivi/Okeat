-- Okeat — reporting reviews, and a private list of errors people ran into
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create table if not exists review_reports (
  place_id    uuid not null,
  review_user uuid not null,
  reporter    uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (place_id, review_user, reporter),
  foreign key (place_id, review_user) references reviews (place_id, user_id) on delete cascade
);
alter table review_reports enable row level security;
drop policy if exists "report a review" on review_reports;
create policy "report a review" on review_reports for insert to authenticated
  with check (reporter = auth.uid() and review_user <> auth.uid() and is_real_user());
drop policy if exists "own reports readable" on review_reports;
create policy "own reports readable" on review_reports for select to authenticated
  using (reporter = auth.uid() or is_moderator());
drop policy if exists "moderators clear reports" on review_reports;
create policy "moderators clear reports" on review_reports for delete to authenticated using (is_moderator());

create or replace function reported_reviews()
returns table (place_id uuid, place_name text, user_id uuid, author text, rating int, comment text, reports bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_moderator() then raise exception 'Moderators only'; end if;
  return query
    select r.place_id, pl.name, r.user_id, coalesce(nullif(pr.display_name, ''), 'משתמש/ת Okeat'), r.rating, r.comment, count(*)
      from review_reports rr
      join reviews r on r.place_id = rr.place_id and r.user_id = rr.review_user
      join places pl on pl.id = r.place_id
      join profiles pr on pr.id = r.user_id
     group by r.place_id, pl.name, r.user_id, pr.display_name, r.rating, r.comment
     order by count(*) desc
     limit 100;
end;
$$;

-- Errors from people's browsers: only the message and the page, no details about the person.
create table if not exists client_errors (
  message   text primary key,
  path      text,
  times     int not null default 1,
  last_seen timestamptz not null default now()
);
alter table client_errors enable row level security;
drop policy if exists "moderators read errors" on client_errors;
create policy "moderators read errors" on client_errors for select to authenticated using (is_moderator());
drop policy if exists "moderators clear errors" on client_errors;
create policy "moderators clear errors" on client_errors for delete to authenticated using (is_moderator());

-- Anyone may report an error, but only through here: short text, and at most 200 different errors.
create or replace function log_client_error(p_message text, p_path text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_message text := left(trim(p_message), 300);
begin
  if v_message = '' then return; end if;
  update client_errors set times = times + 1, last_seen = now(), path = left(p_path, 120) where message = v_message;
  if not found and (select count(*) from client_errors) < 200 then
    insert into client_errors (message, path) values (v_message, left(p_path, 120)) on conflict do nothing;
  end if;
end;
$$;

grant select, insert, delete on review_reports to authenticated;
grant select, delete on client_errors to authenticated;
grant execute on function reported_reviews() to authenticated;
grant execute on function log_client_error(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
