-- Okeat: list places that look far from their city. Read only: changes nothing.
-- A place is listed if its address or name mentions a city, and it is over 20 km from
-- the middle of that city's places. Some rows will be fine, like "Cafe Tel Aviv" in Haifa.
with located as (
  select id, name, address,
         nullif(trim(regexp_replace(coalesce(address, ''), '^.*,', '')), '') as city,
         st_y(location::geometry) as lat, st_x(location::geometry) as lng
    from places
   where not removed
),
cities as (
  select city,
         percentile_cont(0.5) within group (order by lat) as lat,
         percentile_cont(0.5) within group (order by lng) as lng
    from located
   where city is not null and length(city) >= 4
   group by city
  having count(*) >= 5
)
select distinct on (l.id)
       l.name, l.address, c.city as mentions_city,
       round((st_distance(st_makepoint(l.lng, l.lat)::geography, st_makepoint(c.lng, c.lat)::geography) / 1000)::numeric) as km_away
  from located l
  join cities c on l.city = c.city or l.name ilike '%' || c.city || '%'
 where st_distance(st_makepoint(l.lng, l.lat)::geography, st_makepoint(c.lng, c.lat)::geography) > 20000
 order by l.id, km_away desc
 limit 300;
