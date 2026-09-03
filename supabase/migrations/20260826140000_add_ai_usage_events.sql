-- Log de uso da IA.
--
-- Serve para duas coisas: aplicar limite antes de chamar o modelo e ter
-- historico de quanto cada usuario/viagem consumiu. O registro acontece
-- ANTES da chamada ao modelo, porque o custo nasce na chamada e nao na
-- resposta: contar so o que deu certo deixaria o retry virar burrico.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_kind_check check (
    kind in ('itinerary_generation', 'agent_question', 'vault_import')
  )
);

create index if not exists ai_usage_events_user_kind_idx
  on public.ai_usage_events (user_id, kind, created_at desc);

create index if not exists ai_usage_events_trip_kind_idx
  on public.ai_usage_events (trip_id, kind, created_at desc);

grant select, insert, delete on public.ai_usage_events to service_role;

alter table public.ai_usage_events enable row level security;

comment on table public.ai_usage_events is
  'Uma linha por chamada de IA cobravel. Base dos limites de uso da beta.';
