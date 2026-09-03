# Planvoro - Geral da SaaS e proximos passos

Atualizado em: 01/09/2026

Este arquivo e o handoff operacional do Planvoro. Ele resume o que a SaaS e, o que ja existe no codigo, o estado atual de deploy e o que deve ser feito em seguida.

Importante: nao colocar secrets, chaves privadas, service role, chave da AbacatePay, Resend key ou Gemini key neste arquivo.

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

Producao:

```text
https://planvoro.com.br
```

O dominio foi comprado no registro.br em 03/09/2026 e aponta para a
Vercel. O `www` responde tambem — ele exige estar adicionado ao projeto na
Vercel, nao so ter CNAME no DNS, senao o certificado cobre apenas o apex e
o navegador acusa site inseguro.

A URL `planvoro-app.vercel.app` continua valendo e nao deve ser removida:
ha links de confirmacao de e-mail ja enviados que apontam para ela.

Ultimos commits:

```text
defc52e chore: remover a Stripe do banco, das variaveis e da documentacao
1868a20 fix(auth): o link de esqueci a senha agora chega na tela de nova senha
d54b40a feat(billing): trocar Stripe por AbacatePay, com Pix como caminho principal
3d9b91f feat(home): a primeira tela promete o roteiro, que e o que a pessoa veio buscar
8284ab2 refactor: um lugar so para o endereco do site, antes da troca de dominio
3979ee7 feat(auth): confirmou no celular, entra no computador automaticamente
30cec09 feat(planvoro): destacar a entrada pelo google
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
- AbacatePay para checkout (Pix e cartao), ainda em modo beta gratis.
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
- `ABACATEPAY_API_KEY`
- `ABACATEPAY_WEBHOOK_SECRET`
- `ABACATEPAY_PRODUCT_TRIP_PASS`
- `ABACATEPAY_PRODUCT_PRO_ANNUAL`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `PLACES_PROVIDER`
- `GOOGLE_PLACES_API_KEY`

Nunca expor no navegador:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ABACATEPAY_API_KEY`
- `ABACATEPAY_WEBHOOK_SECRET`
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
- Webhook de pagamento e convite por e-mail logam sucesso e falha.
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

- Rota de checkout da AbacatePay.
- Webhook de confirmacao de pagamento.
- Precos: Passe de viagem R$ 29 e Pro R$ 79 por ano.
- O Pro e pagamento unico que vale um ano, sem renovacao automatica.
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

lib/abacatepay.ts
Cliente da AbacatePay: checkout, cliente e validacao de webhook.

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

Revisao de 03/09: surgiu um CNPJ, e isso muda metade dessa decisao.

- `document`: passa a valer preencher. A regra anterior protegia CPF, que
  exposto em pagina publica vira materia-prima para fraude de identidade.
  CNPJ e registro publico, e publica-lo e o que faz o site parecer empresa
  e nao projeto de fim de semana. Trocar tambem `documentLabel` para
  "CNPJ".
- `city`: preencher, so identificacao.
- `jurisdiction`: continua vazio, e de proposito. Eleger foro contra
  consumidor e o que o CDC trata como abusivo — ter CNPJ nao muda isso.

Texto original, para referencia: faltavam razao social, CNPJ, cidade,
foro, e-mail de suporte e e-mail de privacidade. Enquanto estiverem em branco, as tres paginas legais mostram
um aviso de "documento em preparacao" em vez de posar de versao final sem
dizer quem e o controlador, que e o que a LGPD exige.

Os textos sao bons rascunhos, escritos para o que o produto faz. Nao
substituem revisao de advogado antes de cobrar de alguem.

### Prioridade 2 - ligar a AbacatePay

A Stripe foi abandonada: nao liberou a conta brasileira, primeiro com CPF
e depois com o processo travado em analise. A troca saiu barata porque o
modelo de preco — um pagamento avulso e um anual, sem mensalidade —
dispensa recorrencia, que era a unica coisa que prendia o projeto a ela.

O que ja existe, em codigo e no banco:

- `lib/abacatepay.ts`: checkout, cliente e validacao de webhook.
- Rotas de checkout e webhook reescritas.
- Tabela `billing_checkouts`, que guarda o pedido antes de mandar a pessoa
  pagar. O id dela e a unica coisa que viaja ate o provedor e volta no
  webhook, entao nenhum identificador interno passa por terceiro.
- Colunas neutras (`provider`, `provider_checkout_id`) no lugar das
  `stripe_*`, que foram removidas.

O que falta, tudo em painel:

- Criar a chave de API. Toda conta comeca em Dev mode, com pagamento
  simulado: da para validar o fluxo inteiro antes da aprovacao do CNPJ.
- Criar dois produtos, ambos **sem ciclo de recorrencia**: Passe R$ 29 e
  Pro R$ 79.
- Cadastrar o webhook com o segredo na query string.
- Testar ponta a ponta: checkout abre, pagamento simulado, webhook chega,
  acesso libera.

Duas coisas para nao esquecer:

1. A chave de Dev precisa virar chave de producao **antes** de a beta ser
   desligada. Na ordem contraria, o cliente compra e nada e cobrado.
2. A chave HMAC que assina os webhooks da AbacatePay esta publicada na
   documentacao deles, ou seja, qualquer um forja uma assinatura valida.
   Quem autentica de verdade e o segredo na query string. Por isso o
   webhook exige os dois, e nenhum dos dois e redundante.

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

Revisado em 03/09/2026. O roteiro anterior — testar anexos, limites,
exclusao de conta e mobile — foi executado com conta real e passou. O que
sobrou nao e codigo: e configuracao em painel de terceiro e decisao de
negocio.

### Bloqueia o lancamento

1. **SMTP do Resend no Supabase.** Sem isso o convite por e-mail nao
   entrega para ninguem alem do dono da conta Resend. O dominio
   `planvoro.com.br` ja esta verificado no Resend; falta apontar o
   Supabase para `smtp.resend.com`, porta 465, usuario `resend`, senha =
   `RESEND_API_KEY`. Depois de ligar, subir o limite em Authentication >
   Rate Limits: ele vem em 2 e-mails por hora, e quem esquece descobre na
   terceira conta criada.

2. **Preencher `lib/legal.ts`.** Faltam `city`, `jurisdiction` e
   `document`. Com CNPJ a recomendacao inverte em relacao ao que estava
   escrito no proprio arquivo: CNPJ e registro publico e deve ser
   publicado. A regra antiga valia para CPF, que exposto em pagina publica
   vira materia-prima para fraude de identidade.

3. **Chave da AbacatePay.** Toda conta comeca em Dev mode, onde os
   pagamentos sao simulados — da para validar o fluxo inteiro antes da
   aprovacao do CNPJ. Faltam a chave, os dois produtos (sem ciclo) e o
   webhook.

### Ordem que nao pode ser invertida

Trocar a chave da AbacatePay de Dev para producao **antes** de
`NEXT_PUBLIC_PLANVORO_BETA_ACCESS` virar `false`. Na ordem contraria, o
cliente completa a compra e nada e cobrado.

### Nao testado por uma pessoa

- Login entre aparelhos: confirmar o e-mail no celular deve fazer a aba do
  computador entrar sozinha.
- Redefinicao de senha ponta a ponta. O teste que importa e o ultimo:
  depois de trocar, a senha antiga tem que parar de funcionar. Da para
  passar em todos os outros passos e ainda nao ter redefinido nada — era
  exatamente o estado ate 03/09.

### Prompt sugerido

```text
Continuar o Planvoro em C:\Users\guiro\Downloads\planvoro_1\planvoro-app.
Leia primeiro PLANVORO-PROXIMOS-PASSOS.md.
Rodar o push dos commits locais antes de comecar.
Nao expor secrets. Rodar npx tsc --noEmit e npm run build antes de
considerar pronto.
```
