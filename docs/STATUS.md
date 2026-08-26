# Status — 20 de agosto de 2026

Adendo ao [PRD v1.0](PRD.md). O PRD fica como está, datado; o que mudou desde
ele fica aqui.

## Correção ao PRD: o MVP está completo

O PRD diz que falta o bloco 6 (votação e comentários) e que o rename ainda não
foi feito. **Os dois já estão prontos** no código:

| # | Bloco do MVP | Onde está |
|---|---|---|
| 1 | Criar viagem (solo ou grupo) | `app/nova/page.tsx`, `app/api/trips/route.ts` |
| 2 | Convite por link, sem cadastro | `app/api/trips/[slug]/join/route.ts` |
| 3 | Preferências individuais | `app/api/trips/[slug]/preferences/route.ts` |
| 4 | Roteiro por IA + explicação nominal | `lib/generate.ts` |
| 5 | Verificação antialucinação | `lib/places.ts` |
| 6 | **Votação + comentário por item** | `app/api/trips/[slug]/items/[itemId]/{vote,comment}/route.ts` |

Rename Wanderpack → Planvoro: concluído, zero ocorrências no código.

## Backlog "Agora" (seção 18 do PRD)

| # | Item | Estado |
|---|---|---|
| 1 | Renomear Wanderpack → Planvoro | ✅ feito |
| 2 | Votação e comentários por item | ✅ feito |
| 3 | Deploy na Vercel | 🟡 projeto criado, mas a conexão não consegue lê-lo de volta nem publicar (403/404). Confirme no painel e configure as variáveis — ver [DEPLOY.md](DEPLOY.md) |
| 4 | PostHog com o funil de convite | 🟡 código pronto; falta criar o projeto no PostHog e colar a chave |
| 5 | Domínios `planvoro.com.br` e `planvoro.app` | ⬜ pendente, precisa de cartão |

## Feito nesta rodada

- **`supabase/schema.sql`** — o schema só existia dentro do projeto Supabase.
  Agora está versionado, extraído do banco de produção e validado contra ele.
  Sem isso, não havia como recriar o banco a partir do repositório.
- **Funil de convite instrumentado** (`lib/analytics.ts`, `app/analytics.tsx`).
- **Projeto Vercel criado e ligado ao repositório** — com a ressalva de que a
  conexão não consegue confirmar isso de volta. O diagnóstico completo do que
  trava o deploy está em [DEPLOY.md](DEPLOY.md).

## O funil, evento por evento

A métrica que decide o rumo do produto é **% de convidados que entram**. As três
metas do PRD saem destes eventos:

| Métrica do PRD | Meta | Como calcular |
|---|---|---|
| % de convidados que entram | ≥ 60% | `convidado_entrou` ÷ `convite_aberto` |
| % que preenchem preferências | ≥ 40% | `preferencias_salvas` ÷ `convite_aberto` |
| % de grupos que fecham roteiro | ≥ 50% | viagens com `roteiro_gerado` ÷ viagens com `viagem_criada` |

`convite_aberto` dispara uma única vez por sessão, só para quem **ainda não é do
grupo** e só em viagem de grupo — viagem solo não tem convite, e contá-la
inflaria o denominador e faria a métrica mentir para melhor.

Outros eventos: `viagem_criada`, `convite_copiado`, `roteiro_falhou` (com o
motivo, para achar erro de prompt), `voto_registrado`, `comentario_enviado`.

Sem `NEXT_PUBLIC_POSTHOG_KEY` tudo isso vira no-op silencioso — o app funciona
igual, só não mede. Sem autocapture e sem gravação de sessão, por LGPD.

## Adendo — 26 de agosto de 2026

### A conexão com a Vercel funciona; o 403/404 era CLI deslogada

O item 3 do backlog acima está **resolvido**. O projeto `planvoro-app` sempre
existiu, ligado ao repositório, com deploy automático. Produção está no ar com
6 viagens reais no banco:

    https://planvoro-app.vercel.app/api/keepalive -> {"ok":true,"trips":6}

### Corrigido: o Nominatim recebia um e-mail de contato falso

`NOMINATIM_USER_AGENT` não estava configurada na Vercel, então `lib/places.ts`
caía no fallback do `.env.example` e mandava `contato: seu-email@exemplo.com`
para o OpenStreetMap a cada verificação de lugar. A política do OSM exige
contato válido, e a punição é bloqueio por IP — o que desligaria justamente a
verificação antialucinação. Variável criada nos três ambientes e produção
redeployada.

### `supabase/schema.sql` estava incompleto

Faltavam 6 tabelas (`ideas`, `idea_votes`, `trip_entitlements`,
`user_subscriptions`, `trip_vault_items`, `trip_checklist_items`) e a coluna
`members.user_id`. Quem rodasse o arquivo num projeto novo levantava um banco
quebrado. Consolidado e validado rodando de verdade contra um PostgreSQL 16
limpo: roda do zero, é idempotente, e as migrations ainda aplicam por cima.

### O PRD está desatualizado a favor do projeto

`PLANVORO-PRD.md` (20/08) lista como ausentes vários blocos que já existem.
Cruzando o backlog da seção 22 com o código:

| # | Item | Estado real |
|---|---|---|
| 1 | Auth sem matar o convite | ✅ `components/auth-*`, `members.user_id` |
| 2 | Domínio de ideias | ✅ `ideas`, `idea_votes`, rotas de voto e status |
| 3 | Gastos e split | ✅ tabela `expenses` + aba de gastos |
| 4 | Workspace com abas | ✅ roteiro, ideias, gastos, cofre, checklist, viagem |
| 5 | Medir ativação | 🟡 código pronto; falta a chave do PostHog |
| 6 | **Mapa + timeline** | ⬜ **não construído** |
| 7 | Modo viagem | ✅ aba "viagem" |
| 8 | Checklist | ✅ `trip_checklist_items` |
| 9 | Documentos | ✅ cofre (`trip_vault_items`) |
| 10 | Editor conversacional | ✅ `lib/travel-agent.ts` |
| 11 | Importação inteligente | ✅ `lib/vault-import.ts` (estava em "Depois") |

Ou seja: tudo do "Agora" está feito, e o "Em seguida" só tem o **mapa** em
aberto. Pela ordem do próprio PRD, mapa + timeline é o próximo bloco. Os dados
já estão lá — `itinerary_items` tem `lat` e `lng` preenchidos pela verificação
de lugares — mas nenhuma tela os desenha.

## Próximo passo

Colar a chave do PostHog (`NEXT_PUBLIC_POSTHOG_KEY`) na Vercel para o funil
começar a medir, e rodar o beta com os 5 grupos reais. Depois disso, mapa +
timeline. O código não é mais o gargalo.
