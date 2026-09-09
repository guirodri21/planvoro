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

grant select, insert, update, delete on public.ideas to service_role;
grant select, insert, update, delete on public.idea_votes to service_role;

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;

comment on table public.ideas is
  'Ideias soltas sugeridas pelo grupo antes de virarem itens de roteiro.';

comment on table public.idea_votes is
  'Reacoes dos membros em ideias da viagem.';
