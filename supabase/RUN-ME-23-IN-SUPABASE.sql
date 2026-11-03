-- Okeat: the activity log broke moderator updates. One trigger serves four tables,
-- and it read fields that only some of them have. Each table now has its own branch.
-- (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function log_admin_action() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_detail text;
begin
  if auth.uid() is null or not is_moderator() then return coalesce(new, old); end if;

  if tg_table_name = 'claims' then
    if new.status is distinct from old.status then
      v_action := 'claim_' || new.status::text;
      select name into v_detail from places where id = new.place_id;
      v_detail := v_detail || ': ' || new.need::text;
    end if;
  elsif tg_table_name = 'places' then
    if new.removed is distinct from old.removed then
      v_action := case when new.removed then 'place_removed' else 'place_restored' end;
      v_detail := new.name;
    end if;
  elsif tg_table_name = 'profiles' then
    if new.role is distinct from old.role then
      v_action := 'role_' || new.role;
      v_detail := coalesce(new.display_name, new.id::text);
    end if;
  elsif tg_table_name = 'reviews' then
    if old.user_id <> auth.uid() then
      v_action := 'review_deleted';
      select name into v_detail from places where id = old.place_id;
    end if;
  end if;

  if v_action is not null then
    insert into admin_log (actor, action, detail) values (auth.uid(), v_action, v_detail);
  end if;
  return coalesce(new, old);
end; $$;

notify pgrst, 'reload schema';
