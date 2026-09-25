-- Mensagens do botao "Ajuda" (app/api/suporte).
--
-- Cada mensagem tambem vai por e-mail para o suporte, com o e-mail do
-- cliente no reply-to. A tabela e o historico: o e-mail pode se perder na
-- caixa de entrada, e daqui sai quais duvidas se repetem.
--
-- `pagina`, `viagem_slug` e `dispositivo` sao o contexto que o cliente
-- nunca lembra de mandar. `user_id` fica vazio para quem escreve sem conta
-- (pagina /contato), e ai o `email` e o que ele digitou.

create table if not exists public.mensagens_suporte (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  tipo text not null check (tipo in ('ajuda', 'sugestao')),
  mensagem text not null,
  pagina text,
  viagem_slug text,
  dispositivo text,
  enviado_por_email boolean not null default false
);

create index if not exists mensagens_suporte_user_criado
  on public.mensagens_suporte (user_id, criado_em desc);

create index if not exists mensagens_suporte_email_criado
  on public.mensagens_suporte (email, criado_em desc);

-- Sem policies: so o service role (servidor) le e escreve.
alter table public.mensagens_suporte enable row level security;
