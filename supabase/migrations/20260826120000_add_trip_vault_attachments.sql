-- Anexos reais do Cofre.
--
-- O arquivo em si vive no Supabase Storage, em um bucket PRIVADO.
-- Esta tabela guarda apenas o metadado e o caminho do objeto.
-- Nada aqui e acessivel pelo browser: RLS ligado e sem policies,
-- entao todo upload/leitura/remocao passa por route handler server-side
-- que confere membership com `memberForUserInTrip`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-vault',
  'trip-vault',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.trip_vault_attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid not null references public.trip_vault_items(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint trip_vault_attachments_file_name_not_blank check (length(btrim(file_name)) > 0),
  constraint trip_vault_attachments_size_check check (size_bytes > 0 and size_bytes <= 15728640),
  constraint trip_vault_attachments_mime_check check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    )
  )
);

create index if not exists trip_vault_attachments_item_idx
  on public.trip_vault_attachments (item_id, created_at desc);

create index if not exists trip_vault_attachments_trip_idx
  on public.trip_vault_attachments (trip_id);

grant select, insert, update, delete on public.trip_vault_attachments to service_role;

alter table public.trip_vault_attachments enable row level security;

comment on table public.trip_vault_attachments is
  'Anexos do Cofre (PDF, print, comprovante). O arquivo fica no bucket privado trip-vault; aqui so o metadado.';
