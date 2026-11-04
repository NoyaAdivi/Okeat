-- Okeat: the same place in Hebrew and in English ("רולדין" and "Roladin") was not seen as a pair,
-- because the Hebrew vav counted as a letter while the English "o" did not. It no longer counts.
-- This file also merges the pairs. A merged place is hidden, keeps a pointer to the one that stays,
-- and everything people added to it moves over.
-- (run once in Supabase → SQL Editor → Run; safe to run again)

create or replace function place_skeleton(t text)
returns text
language sql immutable
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        replace(replace(replace(lower(t), 'sh', 's'), 'ch', 'h'), 'ph', 'p'),
        'בגדזחטכךלמםנןספףצץקרשתfwcqואהיעaeiouy',
        'bgdzhtkklmmnnsppzzkrstpvkk'
      ),
      '[^a-z0-9]', '', 'g'
    ),
    '(.)\1+', '\1', 'g'
  )
$$;

do $$
declare
  r record;
  who uuid;
begin
  select id into who from profiles where role = 'admin' limit 1;
  if who is null then return; end if;
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  for r in select * from duplicate_pairs() where length(place_skeleton(a_name)) >= 4 loop
    perform admin_merge_pair(r.a_id, r.b_id);
  end loop;
end $$;

-- Four more that are not food.
update places set removed = true
where not removed and name in (
  'סיעת העבודה בהסתדרות נעמת והגמלאים', 'ענבל דרור - שמלות כלה', 'דרור קונטנטו שמלות כלה', 'ולרי הקוסם'
);
