-- Catálogo Autoshow según "Cotizador Jetour" (oct 2026): orden, versiones, precios, colores exterior/interior.
-- Colores sin foto propia llevan `ref` = foto de otro color del mismo modelo (se muestra como "Foto referencial").

alter table as_models add column if not exists interior_colors jsonb default '[]';
alter table as_models add column if not exists in_show boolean default true;
alter table as_quotes add column if not exists interior text;

-- Filas nuevas: copian ficha, fotos y videos del modelo base
insert into as_models (id, name, family, price, currency, powertrain, tagline, highlights, specs, versions, media, warranty, active)
select 'g700_5', name, family, price, currency, powertrain, tagline, highlights, specs, versions, media, warranty, true from as_models where id = 'g700'
on conflict (id) do nothing;
insert into as_models (id, name, family, price, currency, powertrain, tagline, highlights, specs, versions, media, warranty, active)
select 'dashing2', name, family, price, currency, powertrain, tagline, highlights, specs, '[]', media, warranty, true from as_models where id = 'dashing'
on conflict (id) do nothing;
insert into as_models (id, name, family, price, currency, powertrain, tagline, highlights, specs, versions, media, warranty, active)
select 't2full', name, family, price, currency, 'Gasolina', tagline, highlights, specs, versions, media, warranty, true from as_models where id = 't2'
on conflict (id) do nothing;
insert into as_models (id, name, family, price, currency, active) values ('f700', 'F700', 'f700', 57900, 'USD', true)
on conflict (id) do nothing;

-- Modelos que no se deben incluir: T2 iDM (Dashing Youth sale de la fila Dashing Plus)
update as_models set active = false where id = 't2h';
update as_models set versions = (select coalesce(jsonb_agg(v), '[]') from jsonb_array_elements(versions) v where v->>'name' = 'Plus') where id = 'dashing';

with cat(id, sort, in_show, name, version, price, currency, colors, interiors) as (values
  -- En el Autoshow
  ('x50', 1, true, 'X50', '1.5T', 149900, 'GTQ',
   '[{"name":"Negro","hex":"#17191B","img":"x50_black_hero","angles":["side","rear"]},
     {"name":"Blanco","hex":"#F2F3F4","img":"x50_white_hero","angles":["side","rear"]}]',
   '[{"name":"Cuero Negro","hex":"#1A1A1A"}]'),
  ('t1h', 2, true, 'T1 Híbrido iMD', 'i-DM enchufable', 259900, 'GTQ',
   '[{"name":"Dorado","hex":"#B39A6B","img":null,"ref":"t1c_khaki_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":"t1c_black_hero","angles":["side","rear"]},
     {"name":"Negro Mate","hex":"#2B2D2F","img":null,"ref":"t1c_black_hero","angles":["side","rear"]},
     {"name":"Plata Mate","hex":"#9EA3A7","img":null,"ref":"t1c_silver_hero","angles":["side","rear"]},
     {"name":"Plata","hex":"#C9CDD1","img":"t1c_silver_hero","angles":["side","rear"]}]',
   '[{"name":"Crema","hex":"#E8DCC4"},{"name":"Negro","hex":"#1A1A1A"}]'),
  ('t2h4x4', 3, true, 'T2 Híbrido 4x4', 'i-DM enchufable 4x4', 339900, 'GTQ',
   '[{"name":"Blanco","hex":"#F2F3F4","img":null,"ref":"t2c_silversnow_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":null,"ref":"t2c_highwaygrey_hero","angles":["side","rear"]},
     {"name":"Plata Mate","hex":"#9EA3A7","img":null,"ref":"t2c_highwaygrey_hero","angles":["side","rear"]},
     {"name":"Plata","hex":"#D6D9DB","img":"t2c_silversnow_hero","angles":["side","rear"]},
     {"name":"Verde Mate","hex":"#5E6B57","img":null,"ref":"t2c_mistycyan_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"}]'),
  ('g700_5', 4, true, 'G700 5', 'PHEV 4×4', 59900, 'USD',
   '[{"name":"Blanco","hex":"#F2F3F4","img":null,"ref":"g700_orange_hero","angles":["side","rear"]}]',
   '[{"name":"Naranja Terracota","hex":"#B5562F"},{"name":"Negro","hex":"#1A1A1A"}]'),
  ('g700', 5, true, 'G700 Full', 'PHEV 4×4', 64900, 'USD',
   '[{"name":"Naranja Mate","hex":"#C96E2F","img":"g700_orange_hero","angles":["side","rear"]},
     {"name":"Azul","hex":"#3E6FB4","img":"g700_blue_hero","angles":["side","rear"]},
     {"name":"Blanco","hex":"#F2F3F4","img":null,"ref":"g700_blue_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":null,"ref":"g700_blue_hero","angles":["side","rear"]},
     {"name":"Plata Mate","hex":"#9EA3A7","img":null,"ref":"g700_blue_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Naranja","hex":"#C26A32"}]'),
  ('f700', 6, true, 'F700', null, 57900, 'USD',
   '[{"name":"Blanco","hex":"#F2F3F4","img":null},{"name":"Café","hex":"#5A4032","img":null},
     {"name":"Negro","hex":"#17191B","img":null},{"name":"Plata Mate","hex":"#9EA3A7","img":null},
     {"name":"Plata","hex":"#C9CDD1","img":null}]',
   '[{"name":"Negro","hex":"#1A1A1A"}]'),
  ('dashing', 7, true, 'Dashing Plus', 'Plus', 198900, 'GTQ',
   '[{"name":"Blanco","hex":"#F2F3F4","img":"dash_white_hero","angles":[]},
     {"name":"Gris","hex":"#565C63","img":"dash_gray_hero","angles":["side"]},
     {"name":"Gris Claro","hex":"#8F969C","img":"dash_techgray_hero","angles":["side","rear"]},
     {"name":"Rojo","hex":"#A32430","img":"dash_red_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Blanco","hex":"#EDEDED"}]'),
  ('x70plus', 8, true, 'X70 Plus', '1.6 TGDI', 198900, 'GTQ',
   '[{"name":"Negro","hex":"#17191B","img":"x70p_black_hero","angles":["side","rear"]},
     {"name":"Plata","hex":"#C9CDD1","img":null,"ref":"x70p_white_hero","angles":["side","rear"]},
     {"name":"Rojo","hex":"#8E2430","img":null,"ref":"x70p_black_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Blanco","hex":"#EDEDED"}]'),
  -- Fuera del Autoshow
  ('dashing2', 9, false, 'Dashing II Básica', 'II Básica', 174900, 'GTQ',
   '[{"name":"Blanco","hex":"#F2F3F4","img":"dash_white_hero","angles":[]},
     {"name":"Gris Claro","hex":"#8F969C","img":"dash_techgray_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":"dash_black_hero","angles":["side"]},
     {"name":"Rojo","hex":"#A32430","img":"dash_red_hero","angles":["side","rear"]},
     {"name":"Verde","hex":"#12402C","img":"dash_green_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"}]'),
  ('t1', 10, false, 'T1 Gasolina', 'Gasolina', 229900, 'GTQ',
   '[{"name":"Blanco","hex":"#E4DFD2","img":"t1c_khaki_hero","angles":["side","rear"]},
     {"name":"Dorado","hex":"#B39A6B","img":null,"ref":"t1c_khaki_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":"t1c_black_hero","angles":["side","rear"]},
     {"name":"Verde","hex":"#7E9184","img":"t1c_green_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Verde","hex":"#4B5E4A"}]'),
  ('t2', 11, false, 'T2 III Básica', 'III Básica', 289900, 'GTQ',
   '[{"name":"Arena","hex":"#C9B9A0","img":"t2c_sand_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":null,"ref":"t2c_highwaygrey_hero","angles":["side","rear"]},
     {"name":"Plata","hex":"#D6D9DB","img":"t2c_silversnow_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Verde","hex":"#4B5E4A"}]'),
  ('t2full', 12, false, 'T2 IV Full Gasolina', 'IV Full Gasolina', 319900, 'GTQ',
   '[{"name":"Blanco","hex":"#F2F3F4","img":null,"ref":"t2c_silversnow_hero","angles":["side","rear"]},
     {"name":"Negro Mate","hex":"#2B2D2F","img":null,"ref":"t2c_highwaygrey_hero","angles":["side","rear"]},
     {"name":"Plata Mate","hex":"#9EA3A7","img":null,"ref":"t2c_highwaygrey_hero","angles":["side","rear"]},
     {"name":"Plata","hex":"#D6D9DB","img":"t2c_silversnow_hero","angles":["side","rear"]},
     {"name":"Verde Mate","hex":"#5E6B57","img":null,"ref":"t2c_mistycyan_hero","angles":["side","rear"]}]',
   '[{"name":"Café","hex":"#5A4032"},{"name":"Negro","hex":"#1A1A1A"}]'),
  ('x70', 13, false, 'X70', '1.5T · 7 pasajeros', 154900, 'GTQ',
   '[{"name":"Negro","hex":"#17191B","img":null,"ref":"x70_white_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"}]'),
  ('x90plus', 14, false, 'X90 Plus', '2.0 TGDI', 249900, 'GTQ',
   '[{"name":"Azul","hex":"#2A4A6B","img":"x90_blue_hero","angles":["side","rear"]},
     {"name":"Blanco","hex":"#F2F3F4","img":"x90_white_hero","angles":["side","rear"]},
     {"name":"Negro","hex":"#17191B","img":"x90_black_hero","angles":["side","rear"]}]',
   '[{"name":"Negro","hex":"#1A1A1A"},{"name":"Café","hex":"#5A4032"}]')
)
update as_models m set sort = c.sort, in_show = c.in_show, name = c.name, version = c.version, price = c.price, currency = c.currency,
  price_from = false, colors = c.colors::jsonb, interior_colors = c.interiors::jsonb, active = true
from cat c where m.id = c.id;
