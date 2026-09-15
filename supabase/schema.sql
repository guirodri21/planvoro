-- =============================================================
-- Planvoro — schema do banco (PostgreSQL / Supabase)
--
-- Extraido do projeto de producao "planvoro" (ref kqmidnynzynnjejvltmo,
-- regiao sa-east-1) em 2026-08-20. Este arquivo e a fonte da verdade:
-- roda do zero num projeto Supabase novo e reproduz o banco inteiro.
--
-- Como usar num projeto novo:
--   Supabase Studio -> SQL Editor -> cole este arquivo -> Run
--
-- DECISAO ARQUITETURAL IMPORTANTE (secao 8 do PRD):
-- Todas as tabelas tem RLS LIGADO e NENHUMA policy. Isso e proposital:
-- o navegador nunca fala com o banco. Todo acesso passa pelas rotas de
-- servidor do Next.js usando a service_role key, que ignora RLS.
-- Resultado: qualquer vazamento da anon key nao le nada.
-- Quando entrar login de verdade na V1, criamos as policies aqui.
-- =============================================================

-- -------------------------------------------------------------
-- trips — a viagem
-- -------------------------------------------------------------
create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  slug          text        not null unique,
  destination   text        not null,
  start_date    date        not null,
  end_date      date        not null,
  party_size    integer     not null default 4,
  budget_band   text,
  styles        text[]      not null default '{}'::text[],
  created_at    timestamptz not null default now(),
  -- porta de entrada individual (persona P3) e paginas de SEO
  is_solo       boolean     not null default false,
  is_public     boolean     not null default true,
  view_count    integer     not null default 0
);

create index if not exists trips_public_idx
  on public.trips (is_public, created_at desc);

-- -------------------------------------------------------------
-- members — quem esta na viagem
-- No MVP nao ha login: a pessoa entra pelo link e e identificada
-- por um token guardado no navegador dela.
-- -------------------------------------------------------------
create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  name         text        not null,
  is_organizer boolean     not null default false,
  color        text        not null default '#4ade80',
  created_at   timestamptz not null default now()
);

create index if not exists members_trip_idx on public.members (trip_id);

-- -------------------------------------------------------------
-- preferences — a tabela mais importante do produto
-- E onde mora o fosso competitivo: preferencia conflitante como
-- dado de primeira classe, uma linha por pessoa.
-- -------------------------------------------------------------
create table if not exists public.preferences (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  member_id    uuid        not null unique references public.members(id) on delete cascade,
  interests    text[]      not null default '{}'::text[],
  restrictions text[]      not null default '{}'::text[],
  daily_budget text,
  -- janela de presenca: quem chega depois ou sai antes
  present_from date,
  present_to   date,
  updated_at   timestamptz not null default now()
);

create index if not exists preferences_trip_idx on public.preferences (trip_id);

-- -------------------------------------------------------------
-- itineraries — versionado, nunca sobrescrito
-- Cada geracao cria uma versao nova. E o que permite comparar,
-- voltar atras, e "a votacao remontou o roteiro".
-- -------------------------------------------------------------
create table if not exists public.itineraries (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid        not null references public.trips(id) on delete cascade,
  version    integer     not null default 1,
  model      text,
  -- a explicacao da IA citando as pessoas pelo nome
  rationale  text,
  created_at timestamptz not null default now()
);

create index if not exists itineraries_trip_idx on public.itineraries (trip_id);

-- -------------------------------------------------------------
-- itinerary_days — os dias do roteiro
-- -------------------------------------------------------------
create table if not exists public.itinerary_days (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid    not null references public.itineraries(id) on delete cascade,
  day_date     date    not null,
  title        text,
  note         text,
  position     integer not null default 0
);

create index if not exists days_itinerary_idx on public.itinerary_days (itinerary_id);

-- -------------------------------------------------------------
-- itinerary_items — cada atividade do dia
--
-- verified + place_data guardam o resultado da verificacao
-- antialucinacao. Nada entra no roteiro sem verificacao.
-- needs_vote marca o que a IA nao conseguiu equilibrar sozinha
-- e mandou para o grupo decidir.
-- -------------------------------------------------------------
create table if not exists public.itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  day_id        uuid    not null references public.itinerary_days(id) on delete cascade,
  position      integer not null default 0,
  start_time    text,
  duration_min  integer,
  title         text    not null,
  description   text,
  category      text,
  cost_estimate numeric,
  place_query   text,
  verified      boolean not null default false,
  place_data    jsonb,
  lat           double precision,
  lng           double precision,
  needs_vote    boolean not null default false
);

create index if not exists items_day_idx on public.itinerary_items (day_id);

-- -------------------------------------------------------------
-- votes — um voto por pessoa por item
-- value: 1 = a favor, -1 = contra
-- -------------------------------------------------------------
create table if not exists public.votes (
  id        uuid     primary key default gen_random_uuid(),
  item_id   uuid     not null references public.itinerary_items(id) on delete cascade,
  member_id uuid     not null references public.members(id) on delete cascade,
  value     smallint not null default 1,
  unique (item_id, member_id)
);

-- -------------------------------------------------------------
-- comments — conversa por item, no lugar do WhatsApp
-- -------------------------------------------------------------
create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  item_id    uuid        not null references public.itinerary_items(id) on delete cascade,
  member_id  uuid        not null references public.members(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_item_idx on public.comments (item_id);

-- -------------------------------------------------------------
-- expenses — estrutura pronta, funcionalidade e V1
-- -------------------------------------------------------------
create table if not exists public.expenses (
  id               uuid        primary key default gen_random_uuid(),
  trip_id          uuid        not null references public.trips(id) on delete cascade,
  payer_member_id  uuid        not null references public.members(id) on delete cascade,
  amount           numeric     not null,
  description      text        not null,
  split_member_ids uuid[]      not null default '{}'::uuid[],
  created_at       timestamptz not null default now()
);

create index if not exists expenses_trip_idx on public.expenses (trip_id);

-- -------------------------------------------------------------
-- places_cache — ativo que cresce com o uso
-- Sem este cache a conta de API quebra o negocio, e a politica do
-- OpenStreetMap exige cache. Um destino popular custa quase zero
-- a partir do segundo usuario.
-- -------------------------------------------------------------
create table if not exists public.places_cache (
  place_query text        primary key,
  place_data  jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- =============================================================
-- RLS: ligado em tudo, sem policies. Ver o comentario no topo.
-- =============================================================
alter table public.trips           enable row level security;
alter table public.members         enable row level security;
alter table public.preferences     enable row level security;
alter table public.itineraries     enable row level security;
alter table public.itinerary_days  enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.votes           enable row level security;
alter table public.comments        enable row level security;
alter table public.expenses        enable row level security;
alter table public.places_cache    enable row level security;
