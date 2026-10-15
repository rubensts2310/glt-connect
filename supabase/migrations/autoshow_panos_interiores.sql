-- Autoshow: quitar vistas 360° de interiores que no están disponibles en el catálogo (oct 2026).
-- Criterio: la vista se queda si su color principal está entre los interior_colors del modelo.
with quitar(id, src) as (values
  ('t2h4x4',   'pano_t2_brown'),
  ('t2',       'pano_t2_brown'),
  ('x70',      'pano_x70_brown'),
  ('x90plus',  'pano_x90_in'),
  ('x50',      'pano_x50_bluegrey'),
  ('dashing2', 'pano_dash_greywhite'),
  ('dashing',  'pano_dash_greywhite')
)
update as_models m set media = (
  select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
  from jsonb_array_elements(m.media) with ordinality as e(x, i)
  where not (x->>'type' = 'pano' and x->>'src' in (select q.src from quitar q where q.id = m.id))
)
where m.id in (select id from quitar);
