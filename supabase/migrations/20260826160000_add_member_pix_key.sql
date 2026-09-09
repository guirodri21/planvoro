-- Chave Pix por participante, para o acerto de contas.
--
-- Fica em `members` e nao no usuario: a pessoa pode querer receber numa
-- chave para a viagem com os amigos e em outra para a viagem de trabalho.
--
-- O Planvoro nao move dinheiro nem valida a chave contra o banco: ela e
-- so exibida para o pagador, que confirma tudo no proprio app.

alter table public.members
  add column if not exists pix_key text;

alter table public.members
  add constraint members_pix_key_length_check
  check (pix_key is null or length(btrim(pix_key)) between 3 and 140);

comment on column public.members.pix_key is
  'Chave Pix para receber o acerto. Exibida ao grupo da viagem, nunca validada nem usada para mover dinheiro.';
