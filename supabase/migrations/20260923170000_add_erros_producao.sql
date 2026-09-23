-- Erros do servidor em producao, para o alerta por e-mail (lib/alertas.ts).
--
-- Os logs da Vercel guardam tudo, mas ninguem fica olhando: uma rota
-- quebrada so aparecia quando um cliente reclamava. Cada falha vira uma
-- linha aqui; a primeira de cada tipo numa hora dispara e-mail
-- (`alertado`), e o cron diario manda o resumo e apaga o que passou de
-- 30 dias.
--
-- `mensagem` e a mensagem do erro, cortada — nunca conteudo do usuario,
-- pela mesma regra do lib/logger.ts.

create table if not exists public.erros_producao (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  evento text not null,
  rota text,
  mensagem text,
  alertado boolean not null default false
);

create index if not exists erros_producao_evento_criado
  on public.erros_producao (evento, rota, criado_em desc);

create index if not exists erros_producao_criado
  on public.erros_producao (criado_em);

-- Sem policies: so o service role (servidor) le e escreve.
alter table public.erros_producao enable row level security;
