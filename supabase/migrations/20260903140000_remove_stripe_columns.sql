-- Tira a Stripe do banco.
--
-- A migracao anterior preservou as colunas stripe_* por precaucao, supondo
-- que houvesse historico de cobranca. Ao conferir os dados antes de
-- apagar, nao havia: trip_entitlements estava vazia e user_subscriptions
-- tinha uma unica linha, a assinatura de teste criada para validar o
-- checkout. Ela concedia Pro ate 2027 por um pagamento que nunca existiu e
-- ainda bloqueava o teste da compra pela AbacatePay, porque o checkout
-- responde "sua conta ja esta no Pro".
--
-- Sem historico para proteger, manter coluna vazia com nome de um
-- fornecedor que o app nao usa mais so engana quem abrir a tabela depois.

delete from user_subscriptions where stripe_subscription_id is not null;

alter table user_subscriptions
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id,
  drop column if exists stripe_price_id;

alter table trip_entitlements
  drop column if exists stripe_checkout_session_id,
  drop column if exists stripe_customer_id,
  drop column if exists stripe_payment_intent_id,
  drop column if exists stripe_price_id;
