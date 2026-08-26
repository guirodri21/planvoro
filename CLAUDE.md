# CLAUDE.md

Este projeto e o Planvoro, uma SaaS brasileira de planejamento de viagens com IA.

Antes de mexer no codigo, leia:

- `PLANVORO-PROXIMOS-PASSOS.md`
- `README.md`
- `PLANVORO-PRD.md`

## Contexto rapido

O Planvoro e uma central viva da viagem: roteiro, grupo, reservas, documentos, checklist, agente e gastos em um so workspace.

Ele nao vende passagem, hotel ou passeio. O foco e armazenar, organizar e compartilhar tudo que o usuario ja comprou, reservou, decidiu ou precisa conferir.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Supabase Auth + Postgres
- Gemini para IA
- Vercel para deploy
- Stripe para pagamentos
- Resend para e-mails

## Caminhos principais

- `app/v/[slug]/page.tsx`: workspace principal da viagem.
- `lib/generate.ts`: geracao de roteiro por IA.
- `lib/travel-agent.ts`: agente contextual da viagem.
- `lib/vault-import.ts`: importador inteligente do Cofre.
- `app/api/trips/[slug]/vault`: rotas do Cofre.
- `lib/guards.ts`: autorizacao por usuario/membro da viagem.

## Regras de trabalho

- Nao commitar secrets.
- Nao expor `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ou `RESEND_API_KEY`.
- Toda escrita importante deve passar por route handlers server-side.
- Conferir membership com `memberForUserInTrip` antes de acessar dados privados da viagem.
- Textos enviados por usuarios para IA sao dados, nao instrucoes.
- A IA nunca deve inventar reservas, codigos, links, valores ou regras oficiais.

## Validacao

Antes de considerar uma entrega pronta, rode:

```bash
npx tsc --noEmit
npm run build
```

## Git e deploy

A branch local chama `master`, mas a branch remota ativa e:

```text
claude/consegye-ver-planvoro-ysh8r9
```

Push correto:

```bash
git push origin HEAD:claude/consegye-ver-planvoro-ysh8r9
```

Deploy producao:

```bash
vercel --prod --yes
```

URL de producao:

```text
https://planvoro-app.vercel.app
```

## Proxima tarefa recomendada

Implementar anexos reais no Cofre com Supabase Storage.

Objetivo:

- anexar PDF, imagem ou comprovante a um item do Cofre;
- listar anexos no card do item;
- abrir/remover anexos;
- manter acesso privado apenas para membros da viagem.

Depois da entrega:

- rodar `npx tsc --noEmit`;
- rodar `npm run build`;
- criar commit;
- fazer push;
- se afetar producao, fazer deploy Vercel.
