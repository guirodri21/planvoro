-- E-mails de reserva encaminhados para o Cofre (app/api/cofre/email).
--
-- Cada viagem tem um endereco proprio; o Resend recebe o e-mail e chama o
-- webhook. `email_id` e a chave do Resend: o webhook pode chegar mais de
-- uma vez (nova tentativa quando demora), e a chave primaria garante que
-- o mesmo e-mail nao vira dois itens no Cofre.
--
-- `situacao` diz o que aconteceu, para depurar sem abrir log:
-- importado, remetente_desconhecido, viagem_trancada, limite, sem_conteudo, falhou.

create table if not exists public.cofre_emails (
  email_id text primary key,
  criado_em timestamptz not null default now(),
  trip_id uuid references public.trips (id) on delete cascade,
  remetente text,
  assunto text,
  situacao text not null default 'recebido',
  vault_item_id uuid references public.trip_vault_items (id) on delete set null
);

create index if not exists cofre_emails_trip on public.cofre_emails (trip_id, criado_em desc);

-- Sem policies: so o service role (servidor) le e escreve.
alter table public.cofre_emails enable row level security;
