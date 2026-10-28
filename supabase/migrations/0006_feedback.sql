-- =====================================================================
-- Okeat — contact form
-- Messages from the "contact us" page (questions, accessibility issues,
-- privacy requests, reports). Anyone can send; only the site owner reads
-- them, in the Supabase dashboard: Table Editor -> feedback.
-- =====================================================================

create table if not exists feedback (
  id          bigserial primary key,
  topic       text not null check (topic in ('general', 'accessibility', 'privacy', 'report', 'business')),
  message     text not null check (length(trim(message)) between 5 and 3000),
  reply_to    text check (reply_to is null or length(reply_to) <= 200),
  page        text check (page is null or length(page) <= 300),
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false
);

alter table feedback enable row level security;

-- Anyone (also without an account) can send a message. Nobody can read them through the API.
drop policy if exists "anyone can send feedback" on feedback;
create policy "anyone can send feedback" on feedback for insert
  to anon, authenticated
  with check (handled = false);

grant insert on feedback to anon, authenticated;
grant usage, select on sequence feedback_id_seq to anon, authenticated;

-- Simple flood protection: at most 5 messages per user per hour.
create or replace function feedback_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid(); -- never trust the id sent by the browser
  if new.user_id is not null and (
    select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Too many messages, try again later';
  end if;
  return new;
end;
$$;
drop trigger if exists feedback_limit on feedback;
create trigger feedback_limit before insert on feedback for each row execute function feedback_rate_limit();

notify pgrst, 'reload schema';
