-- Okeat: move Wemeat Pardes Hanna to Dekalim 86.
-- Before running: on the next line, replace PASTE-HERE with the coordinates from Google Maps, e.g. 32.47,34.97
-- If PASTE-HERE is left in, the file stops with an error and nothing changes.

-- A place whose location was fixed by hand keeps it, even when the import runs again.
alter table places add column if not exists location_locked boolean not null default false;

create or replace function keep_locked_location() returns trigger language plpgsql as $$
begin
  if old.location_locked then new.location := old.location; new.address := old.address; end if;
  return new;
end;
$$;
drop trigger if exists places_keep_location on places;
create trigger places_keep_location before update of location, address on places
  for each row execute function keep_locked_location();

with pin as (
  select split_part(c, ',', 1)::float8 as lat, trim(split_part(c, ',', 2))::float8 as lng
    from (select 'PASTE-HERE'::text as c) t
)
update places p
   set location = st_setsrid(st_makepoint(pin.lng, pin.lat), 4326)::geography,
       address = 'דקלים 86, פרדס חנה-כרכור',
       location_locked = true
  from pin
 where p.name ilike '%wemeat%'
   and p.name like '%פרדס חנה%'
   and st_y(p.location::geometry) < 31.6;  -- only the copy that landed in the south

-- What to check afterwards: Wemeat should show the new address, and this also shows where
-- the V on Mount Masada came from (source: osm = OpenStreetMap, auto = guessed from the name).
select p.name, p.address, p.data_source,
       round(st_y(p.location::geometry)::numeric, 5) as lat,
       round(st_x(p.location::geometry)::numeric, 5) as lng,
       string_agg(c.need::text || ' / ' || c.level || ' / ' || c.source, ', ') as details
  from places p
  left join claims c on c.place_id = p.id and c.status = 'verified'
 where p.name ilike '%wemeat%' or p.name ilike '%mount masada%'
 group by p.id;
