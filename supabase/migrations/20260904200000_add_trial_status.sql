-- Teste gratis de 7 dias, uma viagem por conta.
--
-- Reaproveita trip_entitlements em vez de criar tabela nova: o teste
-- libera exatamente o que o Passe libera, na mesma viagem, com data de
-- fim em access_expires_at. Uma tabela paralela obrigaria a duplicar a
-- regra de acesso, e as duas copias envelheceriam separadas.
--
-- "Uma por conta" nao precisa de coluna: e a existencia de qualquer linha
-- 'trial' daquele purchaser_user_id.

alter table trip_entitlements drop constraint trip_entitlements_status_check;

alter table trip_entitlements add constraint trip_entitlements_status_check
  check (status = any (array[
    'checkout_pending', 'paid', 'trial', 'expired', 'refunded', 'canceled'
  ]));

create unique index if not exists trip_entitlements_trial_por_viagem
  on trip_entitlements (trip_id) where status = 'trial';

create index if not exists trip_entitlements_trial_por_usuario
  on trip_entitlements (purchaser_user_id) where status = 'trial';
