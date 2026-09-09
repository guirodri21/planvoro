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

grant select, insert, update, delete on public.trip_checklist_items to service_role;

alter table public.trip_checklist_items enable row level security;

comment on table public.trip_checklist_items is
  'Checklist operacional da viagem: pendencias de reservas, documentos, dinheiro, transporte, mala e alinhamento do grupo.';
