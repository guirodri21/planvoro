create table if not exists public.trip_entitlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  purchaser_user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'trip_pass',
  status text not null default 'checkout_pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  stripe_price_id text,
  amount_total integer,
  currency text,
  paid_at timestamptz,
  access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_entitlements_plan_check check (plan in ('trip_pass')),
  constraint trip_entitlements_status_check check (
    status in ('checkout_pending', 'paid', 'expired', 'refunded', 'canceled')
  )
);

create index if not exists trip_entitlements_trip_id_idx
  on public.trip_entitlements (trip_id);

create index if not exists trip_entitlements_purchaser_user_id_idx
  on public.trip_entitlements (purchaser_user_id);

create unique index if not exists trip_entitlements_one_paid_per_trip_idx
  on public.trip_entitlements (trip_id)
  where status = 'paid';

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_status_check check (
    status in ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')
  )
);

create index if not exists user_subscriptions_stripe_customer_id_idx
  on public.user_subscriptions (stripe_customer_id);

grant select, insert, update, delete on public.trip_entitlements to service_role;
grant select, insert, update, delete on public.user_subscriptions to service_role;

alter table public.trip_entitlements enable row level security;
alter table public.user_subscriptions enable row level security;

comment on table public.trip_entitlements is
  'Passes de pagamento avulso que liberam uma viagem para o grupo.';

comment on table public.user_subscriptions is
  'Assinatura Pro anual ligada ao usuario autenticado.';
