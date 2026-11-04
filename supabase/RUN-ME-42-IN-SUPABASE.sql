-- Okeat: whatever is vegan is also vegetarian, so saying a place is vegan says both.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function vegan_is_vegetarian() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.need = 'vegan' and new.status in ('pending', 'verified') then
    insert into claims (place_id, need, level, status, source, proposed_by, verified_at)
    select new.place_id, 'vegetarian', new.level, new.status, new.source, new.proposed_by, new.verified_at
    where not exists (select 1 from claims c where c.place_id = new.place_id and c.need = 'vegetarian'
                      and c.status in ('pending', 'verified'));
  end if;
  return new;
end; $$;

drop trigger if exists claims_vegan_is_vegetarian on claims;
create trigger claims_vegan_is_vegetarian after insert on claims
  for each row execute function vegan_is_vegetarian();
