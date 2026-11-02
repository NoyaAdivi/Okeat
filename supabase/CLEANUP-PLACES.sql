-- Okeat: hide things that are not places to eat. Reversible: set removed = false to bring one back.
update places set removed = true
 where name in ('תמיר זלייט - מתכנן פיננסי', 'תחנת מידע רמת נגב', 'Cris bakery עוגות לכלבים',
                'מגדלי הים התיכון-בית אבות', 'אזור תעשיה דרומי', 'Hordus Shopping Center');

-- Check: how many were hidden, and where Wemeat is now.
select (select count(*) from places where removed) as hidden,
       p.name, p.address, p.location_locked,
       round(st_y(p.location::geometry)::numeric, 5) as lat,
       round(st_x(p.location::geometry)::numeric, 5) as lng
  from places p
 where p.name ilike '%wemeat%' and p.name like '%פרדס חנה%';
