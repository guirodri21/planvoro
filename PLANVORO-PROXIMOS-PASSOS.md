# Planvoro - Geral da SaaS e proximos passos

Atualizado em: 01/09/2026

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
Status: READY
```

Ultimos commits relevantes:

```text
2c4d44b fix(planvoro): acabamento mobile do workspace
f099758 feat(planvoro): termos, privacidade, contato e exclusao de conta
f0780e3 feat(planvoro): observabilidade nas rotas criticas
6df5562 feat(planvoro): limitar uso da ia na beta
094ca19 fix(planvoro): abrir anexo do cofre sem forcar download
ab8a54b feat(planvoro): anexar arquivos ja no cadastro do cofre
a78b86e feat(planvoro): importar reservas para o cofre
```

Atencao: os seis commits acima de `a78b86e` estao apenas no repositorio
local. Producao ja tem tudo, porque o deploy Vercel envia os arquivos da
maquina, mas o GitHub esta atras. Rodar o push antes de continuar.

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
- Anexos reais: PDF, print ou comprovante presos ao item, em bucket privado do Supabase Storage.
- Anexo pode ser escolhido ja no formulario de cadastro e sobe junto ao salvar.
- Abertura por signed URL de 2 minutos; botao separado para baixar.
- Remover item do Cofre tambem apaga os objetos no Storage.

Limites de uso (beta gratis):

- Roteiro: 15 por viagem e 25 por pessoa/dia.
- Agente: 40 perguntas por pessoa/dia.
- Importacao do Cofre: 30 por pessoa/dia.
- Viagens criadas: 12 por pessoa.
- Tabela `ai_usage_events` registra cada chamada cobravel de IA.
- Limite responde 429 com mensagem explicando o que fazer.

Observabilidade:

- `lib/logger.ts` escreve uma linha JSON por evento, filtravel nos logs da Vercel.
- Roteiro, agente e importacao logam sucesso, falha e limite atingido.
- Webhook Stripe e convite por e-mail logam sucesso e falha.
- Log nunca leva conteudo de usuario nem segredo.
- Eventos PostHog ligados: viagem criada, roteiro gerado/falhou, item do Cofre salvo, anexo enviado, importacao usada, pergunta ao agente e limite atingido.
- `NEXT_PUBLIC_POSTHOG_KEY` confirmada na Vercel em producao.

Legal e conta:

- `/termos`, `/privacidade` e `/contato`, linkadas no rodape e no sitemap.
- Aviso no rodape de que a IA erra e precisa ser conferida na fonte.
- `DELETE /api/me` apaga conta, viagens organizadas e anexos no Storage.
- Painel tem zona de exclusao com confirmacao digitada.
- Identificacao juridica fica em `lib/legal.ts`, ainda em branco.

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

lib/ai-limits.ts
Limites de uso da IA e teto de viagens por pessoa.

lib/logger.ts
Log estruturado das rotas criticas. Uma linha JSON por evento.

lib/legal.ts
Identificacao juridica e contatos. AINDA EM BRANCO.

lib/vault-attachments.ts
Regras dos anexos: mime aceito, tamanho, nome seguro, caminho no Storage.

app/api/trips/[slug]/vault/[itemId]/attachments
Upload, abertura por signed URL e remocao de anexos.

app/api/me/route.ts
Exclusao de conta, viagens organizadas e anexos no Storage.

app/termos, app/privacidade, app/contato
Paginas legais.

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

### Concluido em 26/08/2026

Entregue, em producao, com `npx tsc --noEmit` e `npm run build` limpos:

- Anexos reais no Cofre (era Prioridade 1).
- Limites de uso da IA (era Prioridade 3).
- Observabilidade: logs estruturados e eventos PostHog (era Prioridade 4).
- Acabamento mobile (era Prioridade 5).
- Termos, privacidade, contato e exclusao de conta (era Prioridade 6).

Ressalva do mobile: foi auditoria de CSS, nao teste visual. Nao ha
navegador headless no projeto e o workspace fica atras de login. Os
problemas corrigidos foram confirmados lendo as regras; nao da para
afirmar que nao sobrou nada.

### Concluido em 01/09/2026

- Os 12 testes manuais passaram. Detalhe em `PLANVORO-PLANO-DE-TESTES.md`.
- `lib/legal.ts` preenchido: Guilherme Paixao Rodrigues, pessoa fisica,
  contato paixaodevtech@gmail.com. As paginas legais nao se declaram mais
  em preparacao.
- Amostra de roteiro sem conta em `/experimente`, com cache por destino,
  limite por IP e teto diario.
- Posicionamento refeito para atacar o grupo, que e o que o concorrente
  mais visivel nao faz.
- Workspace quebrado em `_lib` e `_components`: page.tsx caiu de 5.536
  para 1.615 linhas.

### Duas coisas descobertas testando, que travam o lancamento

1. **Confirmacao de e-mail obrigatoria + limite de envio do Supabase.**
   O envio padrao bate o teto com pouquissimas tentativas. Numa
   divulgacao, as pessoas nao conseguem criar conta e voce nao fica
   sabendo, porque nao gera erro visivel. Configurar SMTP do Resend em
   Authentication → SMTP Settings.

2. **Protecao contra senha vazada e paga.** No gratuito ficou o minimo de
   10 caracteres com letra e numero, exigido na tela e no servidor. E
   mais fraco, e vale saber disso.

### ~~Prioridade 1 - preencher a identificacao juridica~~ (feito)

Arquivo: `lib/legal.ts`. Preenchido em 01/09.

CPF, cidade e foro ficaram de fora por escolha: identificar o controlador
nao exige publicar documento, e foro proprio contra consumidor costuma
ser tratado como clausula abusiva.

Texto original, para referencia: faltavam razao social, CNPJ, cidade,
foro, e-mail de suporte e e-mail de privacidade. Enquanto estiverem em branco, as tres paginas legais mostram
um aviso de "documento em preparacao" em vez de posar de versao final sem
dizer quem e o controlador, que e o que a LGPD exige.

Os textos sao bons rascunhos, escritos para o que o produto faz. Nao
substituem revisao de advogado antes de cobrar de alguem.

### Prioridade 2 - Stripe de verdade

O que ja existe:

- Rotas de checkout, portal e webhook.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e as publishable ja estao
  na Vercel em producao.

O que falta:

- Criar produtos e precos no painel da Stripe.
- Definir o modelo: por viagem, Pro anual, quanto custa cada um.
- Testar em modo teste com cartao de teste, sem dinheiro real.
- Validar o webhook `checkout.session.completed`.
- Persistir status de plano de forma confiavel.
- Decidir o que a beta gratis libera e o que passa a ser pago.

Cuidado encontrado: `STRIPE_SECRET_KEY` esta marcada como Non-sensitive
na Vercel. Nao vaza para o navegador, porque nao tem prefixo
`NEXT_PUBLIC_`, mas qualquer pessoa com acesso ao projeto le o valor.
Trocar para sensitive ao mexer no Stripe.

### Prioridade 3 - validar o mobile no aparelho

O CSS ja foi auditado e corrigido. Falta abrir num aparelho de verdade e
ver o que sobrou, porque leitura de regra nao substitui olho.

Checar:

- `/v/[slug]` em tela pequena.
- Modo viagem.
- Agenda.
- Cards do Cofre.
- Botoes de status.
- Formulario do Cofre e importador.
- Fluxo de login Google em mobile.

### Prioridade 4 - produto publico/viral

Objetivo:

- Dar tracao sem depender de anuncio pago.

O que faz mais sentido primeiro:

- Exportar roteiro para PDF, que e o que a pessoa manda pro grupo.
- Compartilhar resumo no WhatsApp.
- Duplicar viagem/roteiro.
- Templates de viagem.

### Ideias sem prioridade definida

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

Testar o que foi entregue, em producao, com conta real. Nada do que
entrou em 26/08 foi exercitado por uma pessoa: anexos, limites, exclusao
de conta e mobile foram validados so por tipagem e build.

Roteiro de teste:

1. Criar viagem e gerar um roteiro curto.
2. Cadastrar item no Cofre com anexo escolhido ja no formulario.
3. Abrir o anexo (tem que exibir, nao baixar) e depois baixar.
4. Remover o anexo, e depois remover o item inteiro.
5. Conferir no painel do Supabase que o objeto sumiu do bucket.
6. Colar uma confirmacao real no importador.
7. Perguntar algo ao agente.
8. Abrir o workspace no celular e percorrer as abas.
9. Apagar uma conta de teste e conferir que as viagens dela sumiram.

Depois: preencher `lib/legal.ts` e partir para o Stripe.

Prompt sugerido:

```text
Continuar o Planvoro em C:\Users\guiro\Downloads\planvoro_1\planvoro-app.
Leia primeiro PLANVORO-PROXIMOS-PASSOS.md.
Rodar o push dos commits locais antes de comecar.
Depois seguir a Prioridade 1 (lib/legal.ts) ou a 2 (Stripe), conforme o usuario decidir.
Nao expor secrets. Rodar npx tsc --noEmit e npm run build antes de considerar pronto.
```
