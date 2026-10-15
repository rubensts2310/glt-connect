-- Panel en vivo del autoshow (gerencia): métricas agregadas en una sola llamada.
-- Se consume solo desde la Edge Function autoshow-panel (service role); sin acceso anon.
create or replace function as_panel_stats() returns jsonb
language sql stable set search_path = public as $$
with tz as (select 'America/Guatemala'::text z),
hoy as (select (now() at time zone (select z from tz))::date d),
l as (select *, (created_at at time zone (select z from tz)) lt from as_leads),
q as (select *, (created_at at time zone (select z from tz)) lt from as_quotes),
a as (select *, (created_at at time zone (select z from tz)) lt from as_activities)
select jsonb_build_object(
  'generated_at', now(),
  'event', (select value from as_settings where key = 'event'),
  'kpis', jsonb_build_object(
    'leads_total', (select count(*) from l),
    'leads_hoy', (select count(*) from l where lt::date = (select d from hoy)),
    'leads_ultima_hora', (select count(*) from l where created_at > now() - interval '1 hour'),
    'quotes_total', (select count(*) from q),
    'quotes_hoy', (select count(*) from q where lt::date = (select d from hoy)),
    'quotes_abiertas', (select count(*) from q where open_count > 0),
    'opens_total', (select coalesce(sum(open_count), 0) from q),
    'calientes', (select count(*) from l where temperature = 'caliente'),
    'test_drives', (select count(*) from l where stage = 'test_drive'),
    'ganados', (select count(*) from l where stage = 'ganado'),
    'followups_vencidos', (select count(*) from l where next_action_at <= now() and stage not in ('ganado','perdido')),
    'sin_contactar', (select count(*) from l where stage = 'nuevo'),
    'valor_cotizado', (select coalesce(sum(total), 0) from q),
    'devices_activos', (select count(*) from as_devices where not revoked and last_seen > now() - interval '2 hours'),
    'vendedores_activos_hoy', (select count(distinct seller_id) from l where lt::date = (select d from hoy)),
    'cliente_acciones', (select count(*) from a where type in ('cliente_llamar','cliente_test_drive','cliente_quiero_este','cliente_whatsapp'))
  ),
  'por_hora_hoy', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'leads', leads, 'quotes', quotes) order by h), '[]') from (
      select h, (select count(*) from l where lt::date = (select d from hoy) and extract(hour from lt) = h) leads,
                (select count(*) from q where lt::date = (select d from hoy) and extract(hour from lt) = h) quotes
      from generate_series(8, 21) h) s),
  'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'leads', n) order by d), '[]') from (select lt::date d, count(*) n from l group by 1) s),
  'por_modelo', (select coalesce(jsonb_agg(jsonb_build_object('modelo', modelo, 'leads', leads, 'quotes', quotes) order by leads desc, quotes desc), '[]') from (
      select coalesce(m.name, x.model_id) modelo, count(distinct x.lid) filter (where x.src = 'l') leads, count(distinct x.qid) quotes
      from (select id lid, null::uuid qid, model_id, 'l' src from l union all select null, id, model_id, 'q' from q) x
      left join as_models m on m.id = x.model_id group by 1) s),
  'por_temperatura', (select coalesce(jsonb_agg(jsonb_build_object('k', temperature, 'n', n)), '[]') from (select temperature, count(*) n from l group by 1) s),
  'por_pago', (select coalesce(jsonb_agg(jsonb_build_object('k', coalesce(pago, 'sin_dato'), 'n', n)), '[]') from (select pago, count(*) n from l group by 1) s),
  'embudo', (select coalesce(jsonb_agg(jsonb_build_object('k', stage, 'n', n)), '[]') from (select stage, count(*) n from l group by 1) s),
  'vendedores', (select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'role', s.role, 'photo', s.photo, 'leads', leads, 'hoy', hoy, 'quotes', quotes, 'calientes', calientes, 'vencidos', vencidos, 'abiertas', abiertas) order by leads desc, quotes desc, s.name), '[]') from (
      select s.*,
        (select count(*) from l where l.seller_id = s.id) leads,
        (select count(*) from l where l.seller_id = s.id and lt::date = (select d from hoy)) hoy,
        (select count(*) from q where q.seller_id = s.id) quotes,
        (select count(*) from l where l.seller_id = s.id and temperature = 'caliente') calientes,
        (select count(*) from l where l.seller_id = s.id and next_action_at <= now() and stage not in ('ganado','perdido')) vencidos,
        (select count(*) from q where q.seller_id = s.id and open_count > 0) abiertas
      from as_sellers s where s.active) s),
  'vencidos', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'phone', l.phone, 'vendedor', s.name, 'modelo', m.name, 'temperature', l.temperature, 'next_action_at', l.next_action_at, 'stage', l.stage) order by l.next_action_at), '[]')
      from l join as_sellers s on s.id = l.seller_id left join as_models m on m.id = l.model_id where l.next_action_at <= now() and l.stage not in ('ganado','perdido')),
  'feed', (select coalesce(jsonb_agg(jsonb_build_object('t', a.created_at, 'type', a.type, 'detail', a.detail, 'vendedor', s.name, 'cliente', l.name) order by a.created_at desc), '[]')
      from (select * from a order by created_at desc limit 40) a left join as_sellers s on s.id = a.seller_id left join as_leads l on l.id = a.lead_id)
);
$$;
revoke all on function as_panel_stats() from public, anon, authenticated;
