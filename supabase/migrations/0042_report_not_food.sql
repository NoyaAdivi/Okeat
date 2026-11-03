-- Okeat: "not a food place" is a report of its own and goes straight to the moderators.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or new.reason like '[לא קשור לאוכל]%'
     or (select count(*) from place_reports where place_id = new.place_id) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;

notify pgrst, 'reload schema';
