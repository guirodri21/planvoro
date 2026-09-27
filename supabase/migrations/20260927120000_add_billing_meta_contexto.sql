-- Dados do navegador de quem abriu o checkout, para o Purchase da API de
-- Conversoes da Meta (lib/meta-capi.ts). O pagamento e confirmado pelo
-- webhook da AbacatePay, que nao traz o navegador de quem pagou; a Meta
-- exige o user agent em evento de site.
--
-- So e gravado com META_CAPI_TOKEN configurado, e volta a null assim que
-- o Purchase e enviado: nao fica guardado depois de cumprir a funcao.
alter table billing_checkouts add column if not exists meta_contexto jsonb;
