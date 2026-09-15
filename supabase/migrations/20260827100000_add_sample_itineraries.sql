-- Amostra de roteiro sem conta.
--
-- Geracao aberta e uma torneira de custo: qualquer pessoa, ou qualquer
-- script, dispara chamada de modelo sem se identificar. Estas duas
-- tabelas sao as travas.
--
-- `sample_itineraries` e a mais importante: guarda a amostra por destino.
-- Destino repete muito — Paris, Lisboa, Rio — entao a partir do segundo
-- pedido o custo cai a zero e a resposta fica instantanea.
--
-- `sample_requests` e o contador para limitar por IP e no total do dia.
-- Guarda o IP com hash, nunca em claro: e dado pessoal e nao ha motivo
-- para conseguir ler de volta.

create table if not exists public.sample_itineraries (
  destination_key text primary key,
  destination text not null,
  payload jsonb not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  constraint sample_itineraries_destination_not_blank check (length(btrim(destination)) > 0)
);

create index if not exists sample_itineraries_created_idx
  on public.sample_itineraries (created_at desc);

create table if not exists public.sample_requests (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  destination_key text,
  generated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sample_requests_ip_idx
  on public.sample_requests (ip_hash, created_at desc);

create index if not exists sample_requests_created_idx
  on public.sample_requests (created_at desc);

grant select, insert, update, delete on public.sample_itineraries to service_role;
grant select, insert, delete on public.sample_requests to service_role;

alter table public.sample_itineraries enable row level security;
alter table public.sample_requests enable row level security;

comment on table public.sample_itineraries is
  'Amostra de roteiro por destino. Cache que evita gerar de novo o que ja foi gerado.';

comment on table public.sample_requests is
  'Contador de pedidos da amostra, para limite por IP e teto diario. IP guardado com hash.';
