-- Cidade do recebedor no codigo Pix.
--
-- O campo 60 do BR Code e obrigatorio pela especificacao, e ate agora ia
-- fixo como "SAO PAULO" — informacao errada num campo que parte dos
-- bancos exibe. Sem saber a cidade, o certo e nao afirmar nada: o
-- fallback passa a ser "BRASIL", que e verdade para todo mundo.
--
-- Fica ao lado da chave, em members, pela mesma razao: a pessoa pode
-- receber numa conta para a viagem com amigos e em outra para a de
-- trabalho.

alter table public.members
  add column if not exists pix_city text;

alter table public.members
  add constraint members_pix_city_length_check
  check (pix_city is null or length(btrim(pix_city)) between 2 and 40);

comment on column public.members.pix_city is
  'Cidade do recebedor, campo 60 do BR Code. Sem valor, o codigo usa BRASIL.';
