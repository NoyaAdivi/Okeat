-- Places on the map that have nothing to do with food (a garage, an embassy, DJs...).
-- They are hidden, not deleted, so any of them can be brought back.
update places set removed = true
where not removed and id in (
  '0858e84d-c7ad-42a2-8b89-9a2b984e99d8','0ed43088-a6af-4b4e-9348-e98a1b5e0ac0','2b940bb3-0fed-4681-8b75-2b56af7fe6ad',
  '30bd01d2-352c-4902-8c77-804466725728','38131ca2-bec7-4c91-a421-e9aa61802255','38f16cb3-1bce-49e8-a748-785af073095d',
  '4f135007-4a61-4121-9358-89cb0757c5bd','56b19e58-9caf-4040-be58-fdfced5e84b0','5a2249a0-0353-4a32-9d55-9fb3ba09eff3',
  '5c73a405-d24c-4269-a957-1d41ce236e19','6fb120cd-d73c-449c-8ea4-5c5d06e41d3d','7da4c244-b277-4cd7-a375-3547ead0f6fb',
  '7f3eda0c-0d93-4723-9963-a5f6a5494364','85644ebf-e93f-4d59-914e-b90969a34bb8','8ea3f0bf-aa6d-4944-a5b9-e8453b8c91fb',
  '9c833622-4d91-41ca-9467-4a42122e246a','a01f046d-306c-4547-bf10-2a49684aad4c','b30ab56c-7c68-4b8c-bbcc-7ecfa39fa523',
  'c58b3d34-6f7b-40fe-8aa9-ecfc28e5376f','c7066353-0182-4332-9806-12eb2e54811c','d8309181-5481-4f1d-919e-4a5047cb7fac',
  'e079ca12-f39a-48f0-a01c-a10d08454f7e','ef6bd4ba-2216-433c-a141-c8b67adeba78','f080a79b-3de0-4a6b-b604-dcd4fa319abf'
);

-- A place whose own name says what it is goes under that type, so the filters find it.
update places set place_type = 'ice_cream'
where not removed and place_type in ('restaurant', 'cafe') and name ~* 'גלידה|גלידות|גלידריה|ice ?cream|gelato';
update places set place_type = 'sushi'
where not removed and place_type = 'restaurant' and name ~* 'סושי|sushi';
update places set place_type = 'bakery'
where not removed and place_type in ('restaurant', 'cafe') and name ~* 'מאפיי?ה|מאפיית|bakery';
update places set place_type = 'pizza'
where not removed and place_type in ('restaurant', 'cafe', 'stand') and name ~* 'פיצה|פיצריה|pizza|pizzeria';
