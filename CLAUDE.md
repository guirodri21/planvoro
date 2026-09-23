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
- AbacatePay para pagamentos (Pix e cartão)
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
- Nao expor `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET` ou `RESEND_API_KEY`.
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

Testes de ponta a ponta (Playwright, pasta `e2e/`). Rodam no CI em todo PR,
no computador e no celular, com as APIs simuladas — sem banco e sem chaves.
Mexeu em tela, rode antes; mudou texto ou fluxo de proposito, ajuste o teste:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://sb.local NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build
npm run e2e   # no container da Claude: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
```

## Git e deploy

A producao sai da branch `main`. A Vercel esta ligada ao GitHub: todo
push ou merge na `main` vira deploy de producao sozinho, sem
`vercel --prod`.

Por isso, nunca publicar a partir de uma branch que nao contenha a `main`
inteira: o deploy substituiria o que esta no ar e apagaria o que so a
`main` tem. Antes de publicar, trazer a `main`:

```bash
git fetch origin main
git merge origin/main
```

Fluxo de entrega:

1. Trabalhar numa branch propria, criada a partir da `main`.
2. Rodar `npx tsc --noEmit` e `npm run build`.
3. Commit e push da branch.
4. Abrir PR para a `main` e fazer o merge. O deploy acontece no merge.
5. Conferir na Vercel se o deploy de producao ficou `READY`.

A branch `claude/consegye-ver-planvoro-ysh8r9` e historica. Nao usar como
destino de push nem de deploy.

URLs de producao (as tres apontam para o mesmo deploy):

```text
https://planvoro.com.br
https://www.planvoro.com.br
https://planvoro-app.vercel.app
```

`planvoro-app.vercel.app` nao pode ser removida: ha links de confirmacao
de e-mail ja enviados que apontam para ela.

## Proxima tarefa recomendada

Testar logado, de preferencia no celular, o que entrou em 23/09/2026
(PR #2). Nada disso foi clicado por uma pessoa, so passou por tipagem e
build:

- salvar preferencias e ver erro quando o servidor recusa;
- abrir anexo do Cofre no iPhone (Safari);
- "Liberar esta viagem" levando ao cartao em `/app?liberar=<slug>`;
- viagem com mais de 7 dias gerando o roteiro inteiro, em lotes;
- aba do workspace no hash da URL (`#cofre`), recarregar e voltar.

Os bloqueios de lancamento (SMTP do Resend, AbacatePay em producao) ja
foram resolvidos em 23/09/2026; o estado atual esta na secao 13 de
`PLANVORO-PROXIMOS-PASSOS.md`.
