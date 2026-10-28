-- Development fixtures only. Invented places near Ramat Gan for local testing.
-- Runs as the postgres role (supabase db reset), so it bypasses RLS and the vote trigger.

insert into places (id, name, place_type, address, location, hours) values
  ('00000000-0000-0000-0000-000000000001', 'חומוס הבוקר (דוגמה)', 'hummus', 'דוגמה 1, רמת גן',
   st_setsrid(st_makepoint(34.8105, 32.0820), 4326)::geography,
   '{"0":[["08:00","17:00"]],"1":[["08:00","17:00"]],"2":[["08:00","17:00"]],"3":[["08:00","17:00"]],"4":[["08:00","17:00"]],"5":[["07:30","14:00"]],"6":[]}'),
  ('00000000-0000-0000-0000-000000000002', 'גרעין (דוגמה)', 'vegan_restaurant', 'דוגמה 2, רמת גן',
   st_setsrid(st_makepoint(34.8140, 32.0795), 4326)::geography,
   '{"0":[["12:00","23:00"]],"1":[["12:00","23:00"]],"2":[["12:00","23:00"]],"3":[["12:00","23:00"]],"4":[["12:00","23:00"]],"5":[["11:00","23:00"]],"6":[["11:00","23:00"]]}'),
  ('00000000-0000-0000-0000-000000000003', 'בייקרי אלמה (דוגמה)', 'bakery', 'דוגמה 3, רמת גן',
   st_setsrid(st_makepoint(34.8070, 32.0808), 4326)::geography, null);

insert into claims (id, place_id, need, level, status, confirm_count, verified_at, last_confirmed_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'kosher', 'rabanut', 'verified', 23, now() - interval '30 days', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'vegan', 'options', 'verified', 9, now() - interval '20 days', now() - interval '6 days'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'vegan', 'full', 'verified', 41, now() - interval '60 days', now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'gluten_free', 'menu', 'verified', 12, now() - interval '40 days', now() - interval '9 days'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'gluten_free', 'kitchen', 'verified', 31, now() - interval '50 days', now() - interval '3 days'),
  -- expired certificate: should NOT match a kosher filter
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'kosher', 'mehadrin', 'verified', 17, now() - interval '200 days', now() - interval '40 days');

insert into kosher_certificates (claim_id, image_path, supervising_body, valid_until) values
  ('10000000-0000-0000-0000-000000000001', 'seed/hummus.jpg', 'הרבנות הראשית רמת גן', current_date + 150),
  ('10000000-0000-0000-0000-000000000006', 'seed/alma.jpg', 'הרבנות הראשית רמת גן', current_date - 26);
