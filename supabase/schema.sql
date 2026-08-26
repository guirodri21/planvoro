-- =============================================================
-- Planvoro — schema do banco (PostgreSQL / Supabase)
--
-- Extraido do projeto de producao "planvoro" (ref kqmidnynzynnjejvltmo,
-- regiao sa-east-1) em 2026-08-20 e consolidado com todas as migrations
-- de supabase/migrations em 2026-08-26. Este arquivo e a fonte da verdade:
-- roda do zero num projeto Supabase novo e reproduz o banco inteiro.
--
-- Manutencao: toda migration nova precisa ser refletida aqui na mesma
-- rodada. Se as duas fontes divergirem, um projeto novo sobe quebrado.
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

-- Vinculo com o Supabase Auth. Cada participacao aponta para um usuario
-- autenticado; o indice unico parcial impede a mesma pessoa entrar duas
-- vezes na mesma viagem.
alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists members_user_id_idx
  on public.members (user_id);

create unique index if not exists members_trip_user_id_key
  on public.members (trip_id, user_id)
  where user_id is not null;

comment on column public.members.user_id is
  'Usuario do Supabase Auth ligado a este membro da viagem.';

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

-- -------------------------------------------------------------
-- ideas / idea_votes — ideias soltas do grupo antes de virarem
-- itens de roteiro. O grupo reage, e o que sobe vira item.
-- -------------------------------------------------------------
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  notes text,
  category text,
  estimated_cost numeric(10, 2),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ideas_title_not_blank check (length(btrim(title)) > 0),
  constraint ideas_status_check check (status in ('open', 'planned', 'dismissed')),
  constraint ideas_estimated_cost_check check (
    estimated_cost is null or estimated_cost >= 0
  )
);

create index if not exists ideas_trip_status_created_idx
  on public.ideas (trip_id, status, created_at desc);

create index if not exists ideas_member_id_idx
  on public.ideas (member_id);

create table if not exists public.idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  value integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_votes_value_check check (value in (-1, 0, 1)),
  constraint idea_votes_unique_member unique (idea_id, member_id)
);

create index if not exists idea_votes_idea_id_idx
  on public.idea_votes (idea_id);

create index if not exists idea_votes_member_id_idx
  on public.idea_votes (member_id);

comment on table public.ideas is
  'Ideias soltas sugeridas pelo grupo antes de virarem itens de roteiro.';

comment on table public.idea_votes is
  'Reacoes dos membros em ideias da viagem.';

-- -------------------------------------------------------------
-- trip_entitlements — passe avulso que libera uma viagem
-- O indice unico parcial garante no maximo um passe pago por
-- viagem, mesmo se o webhook do Stripe chegar duas vezes.
-- -------------------------------------------------------------
create table if not exists public.trip_entitlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  purchaser_user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'trip_pass',
  status text not null default 'checkout_pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_price_id text,
  amount_total integer,
  currency text,
  paid_at timestamptz,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_entitlements_plan_check check (plan in ('trip_pass')),
  constraint trip_entitlements_status_check check (
    status in ('checkout_pending', 'paid', 'expired', 'refunded', 'canceled')
  )
);

create index if not exists trip_entitlements_trip_id_idx
  on public.trip_entitlements (trip_id);

create index if not exists trip_entitlements_purchaser_user_id_idx
  on public.trip_entitlements (purchaser_user_id);

create unique index if not exists trip_entitlements_one_paid_per_trip_idx
  on public.trip_entitlements (trip_id)
  where status = 'paid';

-- -------------------------------------------------------------
-- user_subscriptions — assinatura Pro anual, uma linha por usuario
-- -------------------------------------------------------------
create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_status_check check (
    status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
  )
);

create index if not exists user_subscriptions_stripe_customer_id_idx
  on public.user_subscriptions (stripe_customer_id);

comment on table public.trip_entitlements is
  'Passes de pagamento avulso que liberam uma viagem para o grupo.';

comment on table public.user_subscriptions is
  'Assinatura Pro anual ligada ao usuario autenticado.';

-- -------------------------------------------------------------
-- trip_vault_items — o cofre da viagem
-- Passagens, hospedagens, seguros e codigos de confirmacao que
-- hoje vivem espalhados no e-mail e no WhatsApp.
-- -------------------------------------------------------------
create table if not exists public.trip_vault_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  kind text not null,
  title text not null,
  provider text,
  confirmation_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  amount numeric(10, 2),
  currency text not null default 'BRL',
  status text not null default 'saved',
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_vault_items_kind_check check (
    kind in ('flight', 'lodging', 'activity', 'transport', 'insurance', 'visa', 'restaurant', 'document', 'other')
  ),
  constraint trip_vault_items_status_check check (
    status in ('saved', 'reserved', 'paid', 'attention', 'canceled')
  ),
  constraint trip_vault_items_title_not_blank check (length(btrim(title)) > 0),
  constraint trip_vault_items_amount_check check (amount is null or amount >= 0),
  constraint trip_vault_items_currency_check check (length(btrim(currency)) between 3 and 8)
);

create index if not exists trip_vault_items_trip_starts_idx
  on public.trip_vault_items (trip_id, starts_at nulls last, created_at desc);

create index if not exists trip_vault_items_trip_kind_idx
  on public.trip_vault_items (trip_id, kind);

create index if not exists trip_vault_items_member_id_idx
  on public.trip_vault_items (member_id);

comment on table public.trip_vault_items is
  'Cofre da viagem: passagens, hospedagens, passeios, seguros, documentos, links e codigos guardados pelo grupo.';

-- -------------------------------------------------------------
-- trip_checklist_items — o checklist operacional
-- source distingue o que a pessoa escreveu do que o app sugeriu.
-- -------------------------------------------------------------
create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  category text not null default 'planning',
  title text not null,
  notes text,
  due_date date,
  status text not null default 'open',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_checklist_items_category_check check (
    category in ('booking', 'documents', 'money', 'packing', 'group', 'transport', 'health', 'planning', 'other')
  ),
  constraint trip_checklist_items_status_check check (status in ('open', 'done', 'skipped')),
  constraint trip_checklist_items_source_check check (source in ('manual', 'suggested')),
  constraint trip_checklist_items_title_not_blank check (length(btrim(title)) > 0)
);

create index if not exists trip_checklist_items_trip_status_idx
  on public.trip_checklist_items (trip_id, status, due_date nulls last, created_at desc);

create index if not exists trip_checklist_items_trip_category_idx
  on public.trip_checklist_items (trip_id, category);

create index if not exists trip_checklist_items_member_id_idx
  on public.trip_checklist_items (member_id);

comment on table public.trip_checklist_items is
  'Checklist operacional da viagem: pendencias de reservas, documentos, dinheiro, transporte, mala e alinhamento do grupo.';

-- =============================================================
-- Grants: so a service_role toca no banco. Ver o comentario no topo.
-- =============================================================
grant select, insert, update, delete on public.ideas                to service_role;
grant select, insert, update, delete on public.idea_votes           to service_role;
grant select, insert, update, delete on public.trip_entitlements    to service_role;
grant select, insert, update, delete on public.user_subscriptions   to service_role;
grant select, insert, update, delete on public.trip_vault_items     to service_role;
grant select, insert, update, delete on public.trip_checklist_items to service_role;

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
alter table public.ideas                enable row level security;
alter table public.idea_votes           enable row level security;
alter table public.trip_entitlements    enable row level security;
alter table public.user_subscriptions   enable row level security;
alter table public.trip_vault_items     enable row level security;
alter table public.trip_checklist_items enable row level security;
