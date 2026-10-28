-- =====================================================================
-- Okeat — places from more open sources
-- Adds a general "where did this place come from" id, so places can be
-- imported from Overture Maps (open data from Meta, Microsoft, Foursquare
-- and others) next to OpenStreetMap, and re-imported safely.
-- Run after 0005_details.sql. Safe to run twice.
-- =====================================================================

alter table places add column if not exists ext_id text;       -- e.g. 'overture:08f2...'
alter table places add column if not exists data_source text;  -- 'osm' | 'overture' | null (added on the site)

-- food category can now also come from Overture
alter table places drop constraint if exists places_cuisine_source_check;
alter table places add constraint places_cuisine_source_check
  check (cuisine_source in ('osm', 'auto', 'community', 'overture'));

create unique index if not exists places_ext_id_key on places (ext_id);

update places set data_source = 'osm' where osm_id is not null and data_source is null;

notify pgrst, 'reload schema';
