alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists members_user_id_idx
  on public.members (user_id);

create unique index if not exists members_trip_user_id_key
  on public.members (trip_id, user_id)
  where user_id is not null;

comment on column public.members.user_id is
  'Usuario do Supabase Auth ligado a este membro da viagem.';
