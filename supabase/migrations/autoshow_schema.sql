-- GLT Connect · Autoshow (producción). Todas las tablas cerradas: solo las Edge Functions (service role) acceden.
create extension if not exists pgcrypto with schema extensions;

create table if not exists as_settings (key text primary key, value jsonb not null, updated_at timestamptz default now());

create table if not exists as_sellers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'vendedor' check (role in ('vendedor','gerente')),
  phone text,
  showroom text,
  pin_hash text not null,
  active boolean not null default true,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz default now()
);

create table if not exists as_devices (
  id uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz default now(),
  last_seen timestamptz,
  revoked boolean not null default false
);

create table if not exists as_auth_attempts (id bigserial primary key, kind text, ip text, ok boolean, created_at timestamptz default now());
create index if not exists as_auth_attempts_ip on as_auth_attempts (ip, created_at);

create table if not exists as_models (
  id text primary key, name text not null, version text, family text, price numeric not null, currency text not null default 'GTQ',
  price_from boolean default false, powertrain text, tagline text, highlights jsonb default '[]', specs jsonb default '[]',
  colors jsonb default '[]', versions jsonb default '[]', media jsonb default '[]', warranty text, sort int default 0, active boolean default true
);

create table if not exists as_leads (
  id uuid primary key,
  seller_id uuid references as_sellers(id),
  device_id uuid references as_devices(id),
  created_at timestamptz default now(),
  captured_at timestamptz,
  updated_at timestamptz default now(),
  name text not null,
  phone text,
  email text,
  model_id text references as_models(id),
  temperature text not null default 'tibio' check (temperature in ('caliente','tibio','frio')),
  pago text check (pago in ('contado','credito','no_sabe')),
  enganche_q numeric,
  plazo text check (plazo in ('inmediato','1-3m','3-6m','6m+')),
  parte_pago boolean,
  parte_pago_desc text,
  notes text,
  consent boolean not null default false,
  stage text not null default 'nuevo' check (stage in ('nuevo','contactado','test_drive','negociacion','ganado','perdido')),
  lost_reason text,
  next_action_at timestamptz,
  followup_step int not null default 0,
  last_contact_at timestamptz
);
create index if not exists as_leads_seller on as_leads (seller_id, next_action_at);

create table if not exists as_quotes (
  id uuid primary key,
  public_token uuid not null unique,
  lead_id uuid not null references as_leads(id) on delete cascade,
  seller_id uuid references as_sellers(id),
  model_id text references as_models(id),
  color text, color_img text,
  price numeric not null, currency text not null default 'GTQ',
  bonus_label text, bonus_amount numeric default 0,
  accessories jsonb default '[]',
  trade_in jsonb,
  enganche_q numeric, term_months int, bank text, rate numeric, monthly numeric, total numeric,
  valid_until date,
  open_count int not null default 0, first_opened_at timestamptz, last_opened_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists as_quotes_lead on as_quotes (lead_id);

create table if not exists as_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references as_leads(id) on delete cascade,
  seller_id uuid references as_sellers(id),
  type text not null,
  detail text,
  meta jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists as_activities_lead on as_activities (lead_id, created_at);

do $$ declare t text; begin
  foreach t in array array['as_settings','as_sellers','as_devices','as_auth_attempts','as_models','as_leads','as_quotes','as_activities'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence as_auth_attempts_id_seq from anon, authenticated;

-- Verificación de PIN / código sin exponer hashes (solo service role)
create or replace function as_check_hash(p_plain text, p_hash text) returns boolean language sql stable set search_path = public, extensions as $$ select extensions.crypt(p_plain, p_hash) = p_hash $$;
create or replace function as_hash(p_plain text) returns text language sql volatile set search_path = public, extensions as $$ select extensions.crypt(p_plain, extensions.gen_salt('bf', 8)) $$;
revoke all on function as_check_hash(text,text) from public, anon, authenticated;
revoke all on function as_hash(text) from public, anon, authenticated;
