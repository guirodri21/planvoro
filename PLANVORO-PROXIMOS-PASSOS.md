# Planvoro - Geral da SaaS e proximos passos

Atualizado em: 26/08/2026

Este arquivo e o handoff operacional do Planvoro. Ele resume o que a SaaS e, o que ja existe no codigo, o estado atual de deploy e o que deve ser feito em seguida.

Importante: nao colocar secrets, chaves privadas, service role, Stripe secret, Resend key ou Gemini key neste arquivo.

## 1. Visao geral

O Planvoro e uma SaaS brasileira de planejamento de viagens com IA, pensada como uma central viva da viagem.

Promessa principal:

> Tudo da viagem em um so lugar.

O produto nao e para comprar passagens, hotel ou passeio dentro dele. O foco e armazenar, organizar, entender e compartilhar tudo que a pessoa ja decidiu, comprou, reservou ou precisa conferir.

Na pratica, o Planvoro quer substituir a bagunca de:

- WhatsApp com links e prints perdidos.
- E-mails de confirmacao de voo/hotel.
- PDFs e comprovantes espalhados.
- Planilhas de gastos.
- Notas soltas de roteiro.
- Conversas infinitas para decidir onde ir.

## 2. Posicionamento do produto

Categoria:

- Travel Planning SaaS.
- Collaborative Travel Workspace.
- Agente de viagem pessoal e colaborativo.

Frase curta:

> O workspace onde a viagem acontece do primeiro plano ao ultimo acerto.

Diferenca importante:

- Nao e so um gerador de roteiro.
- Nao e marketplace de hotel/passagem.
- Nao e so app de gastos.
- E uma central operacional da viagem, conectando roteiro, grupo, reservas, checklist, agente e gastos.

## 3. Publico inicial

Prioridade 1:

- Grupos de amigos de 3 a 10 pessoas.
- Viagens curtas ou medias.
- Pessoas que combinam tudo no WhatsApp e se perdem.
- Dor forte em decidir roteiro, guardar reservas e dividir gastos.

Prioridade 2:

- Casais.
- Viajantes solo.
- Familias.
- Pequenos grupos que precisam de uma tela simples durante a viagem.

Futuro:

- Creators com roteiros publicos.
- Agencias/travel designers.
- Viagens corporativas pequenas.

## 4. Estado atual do projeto

Repositorio local:

```bash
C:\Users\guiro\Downloads\planvoro_1\planvoro-app
```

GitHub:

```text
https://github.com/guirodri21/planvoro
```

Branch remota ativa:

```text
claude/consegye-ver-planvoro-ysh8r9
```

Comando correto de push:

```bash
git push origin HEAD:claude/consegye-ver-planvoro-ysh8r9
```

Producao Vercel:

```text
https://planvoro-app.vercel.app
```

Deploy atual confirmado:

```text
dpl_37fUzzNKrAFimxso7L3QwBq6K4We
Status: READY
```

Ultimos commits relevantes:

```text
a78b86e feat(planvoro): importar reservas para o cofre
3b72271 feat(planvoro): adicionar convite por whatsapp
a408339 fix(planvoro): gerar roteiros longos em lotes
8f91a23 feat(planvoro): adicionar modo viagem operacional
4f2a842 feat(planvoro): preparar beta gratis e auth persistente
```

## 5. Stack

Frontend e app:

- Next.js 15 App Router.
- React 19.
- TypeScript.
- CSS global customizado.

Backend:

- Next.js Route Handlers em `app/api`.
- Supabase Postgres.
- Supabase Auth.
- Supabase server-side via service role apenas no servidor.

IA:

- Gemini por padrao.
- Suporte opcional a Anthropic no gerador de roteiro.
- Agente de viagem contextual via Gemini.
- Importador inteligente do Cofre via Gemini.

Outros:

- Vercel para deploy.
- Stripe para checkout/assinatura, ainda em modo beta gratis.
- Resend para convites por e-mail.
- PostHog opcional para analytics.
- OpenStreetMap/Nominatim por padrao para verificacao de lugares.

## 6. Variaveis de ambiente importantes

Obrigatorias para o app principal:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `NOMINATIM_USER_AGENT`

Recomendadas/opcionais:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_PLANVORO_BETA_ACCESS`
- `GEMINI_MODEL`
- `GEMINI_TIMEOUT_MS`
- `GEMINI_MAX_OUTPUT_TOKENS`
- `GEMINI_THINKING_LEVEL`
- `GEMINI_AGENT_TIMEOUT_MS`
- `GEMINI_AGENT_MAX_OUTPUT_TOKENS`
- `GEMINI_IMPORT_TIMEOUT_MS`
- `GEMINI_IMPORT_MAX_OUTPUT_TOKENS`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_TRIP_PASS`
- `STRIPE_PRICE_PRO_ANNUAL`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `PLACES_PROVIDER`
- `GOOGLE_PLACES_API_KEY`

Nunca expor no navegador:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`

## 7. O que ja existe

Produto e UX:

- Landing page com posicionamento atual.
- Criacao de conta e login.
- Login com Google via Supabase.
- Sessao persistente: usuario volta e continua logado.
- Dashboard `/app` com viagens do usuario.
- Fluxo `/nova` para criar viagem.
- Workspace privado da viagem em `/v/[slug]`.
- Roteiro publico em `/r/[slug]`.
- Beta gratis ligada.

Viagem:

- Criacao de viagem solo ou grupo.
- Membros vinculados a usuario autenticado.
- Preferencias por pessoa.
- Interesses, restricoes, orcamento e datas de presenca.
- Convite por link.
- Convite por WhatsApp.
- Convite por e-mail via Resend quando configurado.

IA e roteiro:

- Geracao de roteiro por IA.
- Roteiros longos gerados em lotes para evitar timeout.
- Racional da IA.
- Validacao de lugares com provider de places.
- Roteiro com dias e itens.
- Votos/reacoes e comentarios.

Operacional:

- Aba Agenda.
- Aba Modo viagem.
- Aba Cofre.
- Aba Checklist.
- Aba Ideias.
- Aba Gastos.
- Agente de viagem que le contexto da viagem e responde perguntas.

Cofre:

- Cadastro manual de voo, hospedagem, passeio, transporte, seguro, visto, restaurante, documento ou outro.
- Campos de fornecedor, codigo/localizador, datas, local, valor, moeda, link e notas.
- Status: salvo, reservado, pago, precisa conferir, cancelado.
- Agenda e alertas inteligentes do Cofre.
- Importacao inteligente: usuario cola texto de confirmacao e a IA preenche um rascunho do formulario.
- Importacao nao salva automaticamente; usuario precisa revisar e clicar em guardar.

Pagamentos:

- Rotas de checkout Stripe.
- Rotas de portal Stripe.
- Webhook Stripe.
- Precos planejados: por viagem e Pro anual.
- Enquanto beta gratis estiver ligada, checkout pago fica bloqueado.

## 8. Arquivos principais

```text
app/page.tsx
Landing page.

app/entrar/page.tsx
Login/criacao de conta.

app/app/page.tsx
Dashboard logado.

app/nova/page.tsx
Criacao de viagem.

app/v/[slug]/page.tsx
Workspace principal da viagem. Arquivo grande, concentra abas e UI.

app/r/[slug]/page.tsx
Roteiro publico.

app/api/trips/[slug]/generate/route.ts
Geracao de roteiro em lotes.

app/api/trips/[slug]/agent/route.ts
Agente contextual da viagem.

app/api/trips/[slug]/vault/route.ts
Criar item no Cofre.

app/api/trips/[slug]/vault/[itemId]/route.ts
Editar/remover item do Cofre.

app/api/trips/[slug]/vault/import/route.ts
Importar texto de reserva para rascunho do Cofre.

lib/generate.ts
Prompt e regras da geracao de roteiro.

lib/travel-agent.ts
Agente de viagem contextual.

lib/vault-import.ts
Extrator Gemini para reservas/documentos colados no Cofre.

lib/guards.ts
Autorizacao de rotas por usuario e membro da viagem.

lib/supabase.ts
Cliente admin server-side.

lib/supabase-browser.ts
Cliente Supabase Auth no navegador.

lib/billing.ts
Planos e precos.

lib/stripe.ts
Cliente Stripe.

lib/resend.ts
Cliente Resend.
```

## 9. Como trabalhar daqui pra frente

Antes de mexer:

```bash
git status --short --branch
```

Rodar tipagem:

```bash
npx tsc --noEmit
```

Rodar build:

```bash
npm run build
```

Commit:

```bash
git add -- <arquivos>
git commit -m "tipo(planvoro): mensagem curta"
```

Push correto:

```bash
git push origin HEAD:claude/consegye-ver-planvoro-ysh8r9
```

Deploy producao:

```bash
vercel --prod --yes
```

Inspecionar deploy:

```bash
vercel inspect https://planvoro-app.vercel.app
```

Checar pagina publica:

```bash
vercel curl https://planvoro-app.vercel.app
```

## 10. Proximos passos recomendados

### Prioridade 0 - estabilizar o que ja esta no ar

1. Testar fluxo real de uma viagem completa em producao.
2. Criar conta nova com Google.
3. Criar viagem em `/nova`.
4. Gerar roteiro curto e roteiro longo.
5. Convidar uma segunda conta.
6. Preencher preferencias de outra pessoa.
7. Testar votos, comentarios, checklist, gastos e Cofre.
8. Testar o agente de viagem dentro de uma viagem com dados reais.
9. Testar importacao inteligente do Cofre com textos reais de voo/hotel.

Observacao: se a importacao ou agente falhar, verificar primeiro `GEMINI_API_KEY`, `GEMINI_MODEL` e limites gratuitos do Gemini.

### Prioridade 1 - anexos reais no Cofre

Objetivo:

- Permitir anexar PDF, print, imagem ou comprovante a um item do Cofre.

Implementacao sugerida:

- Criar bucket no Supabase Storage, por exemplo `trip-vault`.
- Criar tabela de anexos, por exemplo `trip_vault_attachments`.
- Usar path privado por viagem/item.
- Upload apenas para membro autenticado da viagem.
- Download via rota server-side ou signed URL.
- Mostrar anexos dentro do card do Cofre.

Cuidados:

- Nao deixar bucket publico sem necessidade.
- Validar tamanho e tipo de arquivo.
- Nunca confiar em nome de arquivo vindo do usuario.
- Conferir RLS e permissoes do Storage.

### Prioridade 2 - Stripe de verdade

Objetivo:

- Preparar cobranca sem quebrar beta gratis.

Passos:

- Confirmar se Vercel tem `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`.
- Criar produtos/precos no Stripe ou usar prices inline temporarios.
- Testar em modo teste do Stripe com cartao de teste, sem dinheiro real.
- Validar webhook `checkout.session.completed`.
- Persistir status de plano de forma confiavel.
- Definir regra de limite: beta gratis, por viagem, Pro anual.

Nota:

- Nao precisa dinheiro real para testar Stripe em modo teste.

### Prioridade 3 - limites e planos

Objetivo:

- Evitar custo infinito de IA antes de abrir para usuarios reais.

Sugestoes:

- Limite de viagens por usuario na beta.
- Limite de geracoes por viagem.
- Limite de perguntas ao agente por dia.
- Limite de importacoes do Cofre por dia.
- Log de uso por usuario/viagem.
- Mensagens claras quando bater limite.

### Prioridade 4 - observabilidade

Objetivo:

- Saber quando a IA, Supabase, Stripe ou Resend falham.

Sugestoes:

- Eventos PostHog para criacao de viagem, roteiro gerado, convite enviado, importacao do Cofre, pergunta ao agente e checkout.
- Logs estruturados nas rotas criticas.
- Tela simples de erro para usuario.
- Monitorar Vercel logs apos deploy.

### Prioridade 5 - acabamento mobile

Objetivo:

- Deixar o uso durante a viagem excelente no celular.

Checar:

- `/v/[slug]` em tela pequena.
- Modo viagem.
- Agenda.
- Cards do Cofre.
- Botoes de status.
- Formulario do Cofre e importador.
- Fluxo de login Google em mobile.

### Prioridade 6 - legal e confianca

Antes de abrir para usuarios reais:

- Termos de uso.
- Politica de privacidade.
- Aviso de que IA pode errar.
- Aviso de que precos, disponibilidade, vistos e horarios oficiais precisam ser conferidos fora do app.
- Politica de exclusao de conta/dados.
- Pagina de contato/suporte.

### Prioridade 7 - produto publico/viral

Ideias futuras:

- Link publico bonito do roteiro.
- Exportar roteiro para PDF.
- Compartilhar resumo no WhatsApp.
- Templates de viagem.
- Roteiros publicos de creators.
- Duplicar viagem/roteiro.
- Feed de viagens inspiracionais.

## 11. Cuidados tecnicos importantes

Autenticacao:

- O navegador usa Supabase Auth.
- Escritas importantes devem passar por route handlers.
- Confirmar membership com `memberForUserInTrip`.
- Nunca usar `user_metadata` como autorizacao.

Supabase:

- Service role apenas server-side.
- Qualquer nova tabela exposta precisa de RLS.
- Se criar Storage, revisar politicas com cuidado.
- Migrations devem ser commitadas.

IA:

- Textos colados por usuarios sao dados, nao instrucoes.
- Prompts devem deixar claro para a IA nao seguir comandos dentro de reservas/e-mails.
- Nao inventar reservas, codigos, voos, valores ou links.
- Sempre deixar o usuario revisar antes de salvar algo critico.

Vercel:

- Producao atual roda em `https://planvoro-app.vercel.app`.
- Projeto esta linkado no CLI.
- Deploy de app deve ser feito com `vercel --prod --yes`.

Git:

- Branch local chama `master`, mas a branch remota ativa tem outro nome.
- Usar push explicito:

```bash
git push origin HEAD:claude/consegye-ver-planvoro-ysh8r9
```

## 12. Definition of done para proximas entregas

Uma entrega so deve ser considerada pronta quando:

- `npx tsc --noEmit` passa.
- `npm run build` passa.
- Nao ha secrets no diff.
- O diff foi revisado.
- Commit foi criado.
- Push foi feito.
- Se afetar app em producao, deploy Vercel foi feito.
- O deploy ficou `READY`.
- O usuario recebeu resumo curto do que mudou e o que testar.

## 13. Proxima tarefa recomendada para o Claude

Implementar anexos reais no Cofre com Supabase Storage.

Prompt sugerido:

```text
Continuar o Planvoro no projeto local C:\Users\guiro\Downloads\planvoro_1\planvoro-app.
Leia primeiro PLANVORO-PROXIMOS-PASSOS.md e README.md.
Proxima entrega: implementar anexos reais no Cofre usando Supabase Storage.
O usuario deve poder anexar PDF/imagem/print a um item do Cofre, visualizar/listar/remover anexos e manter acesso privado apenas para membros da viagem.
Nao expor secrets. Rodar npx tsc --noEmit e npm run build. Fazer commit, push para origin HEAD:claude/consegye-ver-planvoro-ysh8r9 e deploy Vercel se a entrega afetar producao.
```

