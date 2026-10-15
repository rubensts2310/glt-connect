-- Autoshow: contar aperturas de la cotización sin perder ninguna cuando el cliente la abre varias veces a la vez,
-- y registrar "El cliente abrió su cotización" una sola vez (la primera apertura).
create or replace function as_quote_open(p_id uuid) returns integer
language plpgsql as $$
declare n integer; l uuid;
begin
  update as_quotes
     set open_count = coalesce(open_count, 0) + 1, first_opened_at = coalesce(first_opened_at, now()), last_opened_at = now()
   where id = p_id
  returning open_count, lead_id into n, l;
  if n = 1 then
    insert into as_activities (lead_id, type, detail) values (l, 'cliente_abrio', 'El cliente abrió su cotización');
  end if;
  return n;
end $$;
revoke all on function as_quote_open(uuid) from public, anon, authenticated;
