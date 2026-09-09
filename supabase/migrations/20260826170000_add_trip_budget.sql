-- Orcamento previsto por pessoa.
--
-- `budget_band` continua existindo e serve a IA: e uma faixa qualitativa
-- ("economico", "confortavel") que orienta o tipo de sugestao. Este campo
-- e outra coisa: um numero para comparar com o gasto real e avisar quando
-- o grupo esta perto do teto.

alter table public.trips
  add column if not exists budget_per_person numeric(10, 2);

alter table public.trips
  add constraint trips_budget_per_person_check
  check (budget_per_person is null or (budget_per_person > 0 and budget_per_person <= 1000000));

comment on column public.trips.budget_per_person is
  'Quanto cada pessoa pretende gastar na viagem, em BRL. Base dos alertas de orcamento.';
