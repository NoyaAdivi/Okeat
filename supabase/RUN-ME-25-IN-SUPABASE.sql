-- Okeat: places that got the wrong food type because a word only looked like food.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

-- kiosks and nut shops were read as pizzerias, because of the letters in their name
update claims set status = 'rejected'
 where source = 'auto' and confirm_count = 0 and status = 'verified'
   and place_id in (select id from places where place_type = 'pizza' and name ~ 'פיצוח|פיצוצ' and name !~ 'פיצה|פיצרי');

update places
   set place_type = 'stand', cuisine = nullif(array_remove(cuisine, 'pizza'), '{}')
 where place_type = 'pizza' and name ~ 'פיצוח|פיצוצ' and name !~ 'פיצה|פיצרי';

-- cafes that were stored as something else
update places
   set place_type = 'cafe', cuisine = array['coffee_shop']
 where name in ('קפה פיצי', 'קפה נטו', 'Coffee-Chino  קופיצ''ינו') and place_type in ('pizza', 'hummus');

-- names that only contain the letters of a food word
update places set cuisine = nullif(array_remove(cuisine, 'indian'), '{}')
 where cuisine_source = 'auto' and cuisine @> array['indian'] and name ~* 'יהודית|הודיה|סנדיאנה|sindiana';

update places set cuisine = nullif(array_remove(cuisine, 'italian'), '{}')
 where cuisine_source = 'auto' and cuisine @> array['italian'] and name ~* 'meital|lital|digital|ital" fish';
