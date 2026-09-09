-- Pagamento deixou de ser "a Stripe" e virou "algum provedor".
--
-- A troca aconteceu porque a Stripe nao liberou a conta brasileira. Para
-- nao repetir o retrabalho no proximo provedor, o que o app grava agora e
-- neutro: quem cobrou fica numa coluna, nao no nome da coluna.
--
-- As colunas stripe_* ficam onde estao. Ha cobranca real feita por elas em
-- modo de teste, e apagar historico de pagamento para deixar o schema
-- bonito e o tipo de limpeza que ninguem consegue desfazer depois.

create table if not exists billing_checkouts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'abacatepay',
  provider_checkout_id text,
  plan text not null check (plan in ('trip_pass', 'pro_annual')),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  amount integer,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- O webhook chega identificado pelo id do provedor; sem este indice a
-- confirmacao de pagamento faria varredura na tabela inteira.
create index if not exists billing_checkouts_provider_checkout_id_idx
  on billing_checkouts (provider_checkout_id);

create index if not exists billing_checkouts_user_id_idx
  on billing_checkouts (user_id);

alter table billing_checkouts enable row level security;

-- Sem policy de proposito: leitura e escrita passam pelo service role nos
-- route handlers, como no resto do projeto.

alter table trip_entitlements
  add column if not exists provider text,
  add column if not exists provider_checkout_id text;

alter table user_subscriptions
  add column if not exists provider text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text;
