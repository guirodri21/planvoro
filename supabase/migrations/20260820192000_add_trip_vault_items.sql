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

grant select, insert, update, delete on public.trip_vault_items to service_role;

alter table public.trip_vault_items enable row level security;

comment on table public.trip_vault_items is
  'Cofre da viagem: passagens, hospedagens, passeios, seguros, documentos, links e codigos guardados pelo grupo.';
