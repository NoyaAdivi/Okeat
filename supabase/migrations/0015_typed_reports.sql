-- Okeat — a typed report (closed, doesn't exist, wrong address) goes straight to the moderators.
-- Other reports still need 3 people. (run once in Supabase → SQL Editor → Run; safe to run again)
create or replace function after_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason like '[המקום נסגר]%' or new.reason like '[המקום לא קיים]%' or new.reason like '[הכתובת לא נכונה]%'
     or (select count(*) from place_reports where place_id = new.place_id) >= 3 then
    update places set flagged = true where id = new.place_id;
  end if;
  return new;
end; $$;
notify pgrst, 'reload schema';
