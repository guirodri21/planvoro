# Planvoro

Roteiro de viagem por IA — sozinho ou com o grupo inteiro.

A IA monta o roteiro dia a dia equilibrando as preferências de todas as pessoas do grupo,
explica o raciocínio citando cada uma pelo nome, e confere se cada lugar existe de verdade
antes de colocar no roteiro.

## Como rodar

```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
# preencha as chaves no .env.local
npm run dev
```

Abra http://localhost:3000

O passo a passo completo, incluindo onde pegar cada chave, está em **COMECE-AQUI.md**.
Para rodar sem gastar nada, veja **PLANO-CUSTO-ZERO.md**.

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Endereço do banco |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sim | Login no navegador com Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Acesso ao banco (só no servidor) |
| `GEMINI_API_KEY` | sim | Gera os roteiros (camada gratuita) |
| `GEMINI_MODEL` | não | Modelo Gemini usado na geração (`gemini-3.6-flash` por padrão) |
| `GEMINI_THINKING_LEVEL` | não | Nível de raciocínio do Gemini (`LOW` por padrão para evitar timeout) |
| `GEMINI_AGENT_TIMEOUT_MS` | não | Timeout opcional do agente de viagem (`28000` por padrão) |
| `NOMINATIM_USER_AGENT` | sim | Exigido pelo OpenStreetMap — use seu e-mail real |
| `RESEND_API_KEY` | não | Envia convites por e-mail de dentro da viagem |
| `RESEND_FROM_EMAIL` | não | Remetente usado nos convites (`Planvoro <onboarding@resend.dev>` por padrão) |
| `ABACATEPAY_API_KEY` | não | Cria os checkouts de pagamento |
| `ABACATEPAY_WEBHOOK_SECRET` | não | Autentica os eventos em `/api/billing/webhook` |
| `ABACATEPAY_PRODUCT_TRIP_PASS` | não | External ID do produto do Passe |
| `ABACATEPAY_PRODUCT_PRO_ANNUAL` | não | External ID do produto do Pro |
| `NEXT_PUBLIC_SITE_URL` | não | Usada no sitemap e nos links compartilhados |
| `NEXT_PUBLIC_PLANVORO_BETA_ACCESS` | não | Liga a beta grátis e bloqueia checkout pago (`true` por padrão) |
| `ANTHROPIC_API_KEY` | não | Só se trocar `LLM_PROVIDER` para `anthropic` |
| `GOOGLE_PLACES_API_KEY` | não | Só se trocar `PLACES_PROVIDER` para `google` |

> ⚠️ A `SUPABASE_SERVICE_ROLE_KEY` é a senha mestra do banco. Ela só é usada no servidor e
> nunca pode ir para o navegador nem para o Git.

## Estrutura

```
app/
  page.tsx                       landing
  app/page.tsx                   area logada com historico de viagens
  entrar/page.tsx                login e criacao de conta
  nova/page.tsx                  onboarding premium com preview vivo da viagem
  v/[slug]/page.tsx              área privada com resumo, agenda e abas da viagem
  r/[slug]/page.tsx              roteiro público, indexável
  api/billing/checkout/route.ts  cria o checkout na AbacatePay
  api/billing/webhook/route.ts   recebe a confirmação de pagamento
  api/me/dashboard/route.ts      viagens ligadas ao usuario logado
  api/trips/...                  criar, entrar, preferências, gerar, votar, comentar e lançar gastos
  api/trips/[slug]/checklist     tarefas operacionais da viagem
  api/trips/[slug]/vault         guarda e edita passagens, hoteis, documentos, links e codigos
components/
  auth-provider.tsx              sessao do Supabase no navegador
  auth-screen.tsx                UI de entrar / criar conta
lib/
  email.ts                       envio de convite por e-mail
  generate.ts                    o prompt e as regras da IA  <- o coração do produto
  places.ts                      verificação antialucinação + cache
  travel-agent.ts                agente de viagem que le contexto, saldos e vira respostas em tarefas
  guards.ts                      autorização das rotas de escrita
  resend.ts                      cliente do Resend
  abacatepay.ts                  cliente da AbacatePay
  supabase.ts                    conexão admin (só servidor)
  supabase-browser.ts            cliente do Supabase Auth no navegador
```

## Arquitetura em três decisões

1. **O navegador nunca fala direto com as tabelas.** Toda leitura e escrita de viagens passa
   pelas rotas de servidor. O navegador usa apenas o Supabase Auth para login.
2. **A IA fica atrás de uma interface própria.** Trocar de provedor é mudar uma variável de
   ambiente, sem tocar no resto do código.
3. **Cache de lugares é obrigatório.** Segura o custo de API e é exigência da política de uso
   do OpenStreetMap.

## Auth: o que configurar

1. No Supabase, deixe `Email` auth habilitado.
2. Copie a `Publishable key` do projeto para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Aplique a migration `supabase/migrations/20260820123000_add_auth_membership.sql`.
4. Se a confirmacao por e-mail estiver ligada, confira `Site URL` e `Redirect URLs` com seu
   dominio local e de producao.
5. Para login com Google, crie um OAuth Client do tipo Web no Google Cloud. Em
   `Authorized JavaScript origins`, adicione `https://planvoro-app.vercel.app` e
   `http://localhost:3000`. Em `Authorized redirect URIs`, adicione a callback do Supabase:
   `https://kqmidnynzynnjejvltmo.supabase.co/auth/v1/callback`.
6. No Supabase Auth, habilite o provedor Google com o Client ID/Secret do Google Cloud. Em
   `Redirect URLs`, libere `https://planvoro-app.vercel.app/entrar`,
   `https://planvoro-app.vercel.app/**` e `http://localhost:3000/entrar`.
7. Repita as mesmas variaveis de ambiente na Vercel antes do proximo deploy.

## Convites por e-mail

1. Configure `RESEND_API_KEY` no ambiente.
2. Enquanto nao houver dominio verificado no Resend, use `RESEND_FROM_EMAIL=Planvoro <onboarding@resend.dev>`.
3. Depois que seu dominio estiver verificado no Resend, troque `RESEND_FROM_EMAIL` para algo como
   `Planvoro <oi@seudominio.com>`.

## Pagamentos

Durante a beta, `NEXT_PUBLIC_PLANVORO_BETA_ACCESS=true` deixa todos os recursos principais
liberados para teste e bloqueia a criação de checkout pago. Quando quiser cobrar, troque para
`false` na Vercel e faça um novo deploy.

O provedor é a **AbacatePay**. A Stripe foi abandonada porque não liberou a conta brasileira,
e o modelo de preço do Planvoro — um pagamento avulso e um anual, sem mensalidade — dispensa a
recorrência, que era a única coisa que prendia o projeto a ela.

1. Crie a conta na AbacatePay. Toda conta nova já começa em **Dev mode**, onde os pagamentos são
   simulados: dá para validar o fluxo inteiro antes da aprovação. O ambiente é definido pela
   chave, não pela URL.
2. Crie dois produtos, **ambos sem ciclo de recorrência**: Passe de viagem (R$ 29) e Planvoro Pro
   (R$ 79). Guarde os External IDs em `ABACATEPAY_PRODUCT_TRIP_PASS` e
   `ABACATEPAY_PRODUCT_PRO_ANNUAL`.
3. Configure `ABACATEPAY_API_KEY` na Vercel.
4. Cadastre o webhook em `https://planvoro.com.br/api/billing/webhook?webhookSecret=SEGREDO` e
   guarde o mesmo segredo em `ABACATEPAY_WEBHOOK_SECRET`.

O Pro é **pagamento único que vale um ano**, sem renovação automática. Renovar sozinho exigiria
um fluxo de cancelamento fácil, que o CDC obriga e a AbacatePay não oferece pronto.

Atenção: uma chave de Dev em produção simula todo pagamento. Ela precisa virar chave de produção
**antes** de `NEXT_PUBLIC_PLANVORO_BETA_ACCESS` virar `false`, ou o cliente compra e nada é
cobrado.

## Stack

Next.js 15 · React 19 · TypeScript · PostgreSQL (Supabase) · Gemini ou Claude · OpenStreetMap
