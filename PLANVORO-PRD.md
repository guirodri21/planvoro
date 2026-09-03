# Planvoro PRD

Data: 20/08/2026

Status: Fase 1 concluida

Escopo deste documento:
- Traduz o arquivo "Prompt mestre — Construcao do Planvoro.md" em um plano de produto executavel.
- Usa o briefing como direcao estrategica, nao como ordem para construir tudo de uma vez.
- Considera o estado atual do repositorio como ponto de partida real do MVP.

## 1. Visao

Planvoro e um SaaS web brasileiro para planejamento de viagens colaborativas.

Tese central:
- uma viagem em grupo e um projeto colaborativo
- o principal problema nao e apenas montar um roteiro
- o principal problema e ajudar pessoas diferentes a chegar a um acordo sem espalhar tudo entre WhatsApp, planilha, mapa, reserva, comprovante e memoria

Promessa do produto:

> Sua viagem inteira. Em um so lugar.

## 2. Problema

Hoje o planejamento de viagem e fragmentado:
- conversas no WhatsApp
- links soltos de hotel, restaurante e passeio
- roteiro em Docs, Notion ou Excel
- custos no Splitwise
- reservas no e-mail
- localizacao no Google Maps
- comprovantes em fotos, PDFs e prints

Dor principal do publico inicial:
- o grupo nao consegue decidir rapido
- informacoes se perdem
- o roteiro vira caos
- os gastos ficam mal resolvidos
- durante a viagem falta uma tela simples de "o que vem agora"

## 3. Posicionamento

Categoria:
- Travel Planning SaaS
- Collaborative Travel Workspace

Posicionamento recomendado:

> O workspace onde a viagem acontece do primeiro plano ao ultimo acerto.

Diferenca em relacao ao "app de roteiro":
- nao e apenas discovery
- nao e apenas itinerario
- nao e apenas expense splitting
- e uma camada de coordenacao da viagem inteira

## 4. Publico-alvo inicial

Prioridade 1: grupos de amigos
- 4 a 10 pessoas
- viagem domestica ou internacional curta
- muita conversa, pouca decisao
- alta dor com votos, roteiro e gasto compartilhado

Prioridade 2: casais
- querem montar rapido
- valorizam IA e praticidade
- ticket potencial para plano individual premium

Prioridade 3: familias
- preferencias conflitantes
- idosos, criancas, restricoes e ritmo diferente

Prioridade 4: viajantes frequentes
- repeticao de uso
- maior propensao a assinar

Publicos futuros:
- creators com roteiros publicos
- agencias e travel designers
- viagens corporativas

## 5. Principios do produto

- Brasil first na linguagem, moeda, datas e fluxos
- desktop web como centro do planejamento
- mobile web excelente para acompanhar a viagem
- convite sem friccao antes de login obrigatorio
- IA como copiloto, nunca como piloto absoluto
- mapa e tempo de deslocamento como elementos nativos do planejamento
- gastos, votos e roteiro conectados na mesma experiencia
- arquitetura preparada para evoluir, mas MVP enxuto

## 6. Benchmark atual

Observacao:
- a analise abaixo usa fontes oficiais e paginas publicas acessadas em 20/08/2026
- a conclusao e interpretativa, nao um espelho literal dos concorrentes

### 6.1 O que concorrentes fortes fazem bem

TripLinq:
- foco explicito em group trip planner, itinerary builder e expense splitter
- posicionamento claro para viagens em grupo
- forte narrativa de colaboracao e organizacao all-in-one
- fonte: https://apps.apple.com/us/app/triplinq-group-trip-planner/id6751021075

Wanderlog:
- itinerario + mapa na mesma visao
- reservas, budgeting, checklist, colaboracao e IA
- forte componente de exploracao e guias compartilhados
- fontes: https://wanderlog.com/ e https://wanderlog.com/road-trip-planner

TripIt:
- muito forte em organizacao automatica de reservas
- documentos, alertas e uso durante a viagem
- menos orientado a decisao colaborativa do grupo
- fontes: https://www.tripit.com/web e https://apps.apple.com/us/app/tripit-travel-planner/id311035142

Splitwise:
- melhor referencia para divisao de despesas e quem deve para quem
- otimo modelo mental de grupos e saldos
- nao resolve roteiro, colaboracao de viagem nem descoberta
- fontes: https://www.splitwise.com/ e https://www.splitwise.com/calculators/travel

Lambus:
- combinacao forte de itinerary, expenses, tickets e grupo
- narrativa de all-in-one travel planner
- fontes: https://www.lambus.com/ e https://play.google.com/store/apps/details?hl=en&id=io.lambus.app

Polarsteps:
- muito forte em memoria, tracking e inspiracao
- bom para pos-viagem e para acompanhar jornada
- menos forte que Planvoro deve ser em decisao coletiva e acerto de grupo
- fontes: https://www.polarsteps.com/ e https://support.polarsteps.com/hc/en-us/articles/27170922889874-How-do-I-use-the-AI-powered-itinerary-builder-to-plan-my-trip

Stippl:
- narrativa de "one travel app to replace them all"
- IA, budget, packing list e itinerarios copiaveis
- forte apelo all-in-one para individuo e creator
- fonte: https://www.stippl.io/

Mega Roteiro:
- concorrente brasileiro mais proximo do espaco de planejamento
- colaboracao, roteiro, modo viagem e anexos
- fonte: https://apps.apple.com/br/app/mega-roteiro-planejar-viagem/id6762229731

### 6.2 O que quase todos fazem

- itinerario
- mapa
- reservas e documentos
- budget ou expenses em algum nivel
- compartilhamento
- mobile forte

### 6.3 O que poucos parecem fazer muito bem

- tomada de decisao do grupo antes da reserva
- conciliacao explicita de preferencias conflitantes
- IA que reorganiza a viagem inteira com contexto acumulado
- experiencia WhatsApp-first para convite e participacao
- previsao orcamentaria conectada ao roteiro

### 6.4 Onde o Planvoro pode ser 10x melhor

- transformar "planejar com amigos" em fluxo nativo, nao adaptado
- mostrar por que uma sugestao entrou no roteiro
- ligar ideias, votos, roteiro e gastos num mesmo workspace
- tornar o convite sem cadastro uma arma de crescimento
- tratar Brasil como caso principal, nao localizacao secundaria

## 7. O que o codigo atual ja entrega

O repositorio atual ja tem um MVP funcional focado em "trip planning + IA + colaboracao leve".

Ja existe:
- landing page de posicionamento
- onboarding para viagem solo ou em grupo
- criacao de viagem
- entrada por link sem cadastro
- preferencias por participante
- geracao de roteiro por IA
- explicacao do racional da IA
- verificacao de lugares contra base real
- roteiro publico por link
- votos por item
- comentarios por item
- versoes de roteiro
- estrutura basica de SEO

Arquitetura atual:
- Next.js App Router
- TypeScript
- Supabase com uso server-side
- modelo sem auth tradicional no MVP
- camada de IA desacoplada por provider
- validacao e regras centrais no backend

## 8. Gaps entre o MVP atual e a visao do produto

Blocos ainda ausentes ou incompletos:
- login e contas reais
- papeis e permissoes robustas
- area de ideias independente do roteiro
- mapa interativo
- otimizacao de deslocamento
- despesas e divisao de gastos
- orcamento consolidado
- documentos e importacao inteligente
- checklist
- modo viagem
- notificacoes
- realtime verdadeiro
- offline/PWA
- area publica de discover
- analytics de produto
- monetizacao

Conclusao:
- o MVP atual ja valida a tese "IA + grupo + convite sem cadastro"
- o produto ainda nao valida a tese maior "travel workspace completo"

## 9. MVP web recomendado

O briefing original pede muitas frentes. Para manter capacidade de execucao, o MVP web deve ser definido assim:

### Objetivo do MVP

Validar que grupos brasileiros conseguem:
- criar viagem rapido
- convidar participantes sem friccao
- colocar preferencias e ideias
- chegar a um acordo
- ver um roteiro util
- registrar gastos principais

### Escopo do MVP real

1. Landing page
2. Criacao de viagem
3. Convite por link e WhatsApp
4. Membros da viagem
5. Preferencias dos participantes
6. IA basica para roteiro e replanejamento
7. Itinerario dia a dia
8. Votacao e comentarios
9. Ideias separadas do roteiro
10. Gastos basicos + divisao simples
11. Orcamento consolidado
12. Pagina publica compartilhavel
13. Modo viagem simplificado
14. Mobile web responsivo forte

### Fica fora do MVP

- importacao completa de PDF/e-mail com parsing robusto
- offline avancado
- pagamentos reais
- marketplace
- creator economy
- organizacoes e travel business
- recomendacao profunda por historico do usuario

## 10. Roadmap recomendado

### V0

Objetivo:
- provar que grupos querem usar Planvoro para sair do WhatsApp

Escopo:
- o que o repositorio ja tem
- mais ideias
- mais gastos
- mais compartilhamento

Metrica de sucesso:
- porcentagem de viagens com ao menos 2 participantes ativos
- porcentagem de viagens com roteiro gerado
- porcentagem de viagens com interacao colaborativa

### V1

Objetivo:
- virar produto competitivo e usavel do inicio ao fim de uma viagem

Entradas:
- auth real
- mapa
- expenses com split
- checklist
- documentos manuais
- modo viagem
- notificacoes basicas
- analytics

### V2

Objetivo:
- elevar IA e aumentar retencao

Entradas:
- AI trip editor conversacional
- importacao inteligente de reservas
- otimizacao automatica de rota
- previsao de gasto
- discover e roteiros copiaveis
- memories pos-viagem

### V3

Objetivo:
- criar ecossistema

Entradas:
- creator/business
- marketplace
- pagamentos
- integracoes
- travel OS

## 11. Diferenciais que precisam ser protegidos

Se o produto perder estes quatro elementos, ele vira mais um planner:

1. Convite sem cadastro
2. IA que explica as decisoes
3. Fluxo nativo para desacordo do grupo
4. Modo viagem simples e acionavel

## 12. Arquitetura recomendada

Frontend:
- Next.js App Router
- TypeScript
- Server Components por padrao
- Client Components so onde houver interacao

Backend:
- Route Handlers para APIs do MVP
- servicos de dominio em `lib/` ou `server/`
- separacao crescente entre web layer e business layer

Banco:
- PostgreSQL via Supabase

Tempo real:
- polling no curtissimo prazo
- Supabase Realtime quando votes, comments e ideas pedirem menor latencia

Storage:
- Supabase Storage ou S3 compativel para documentos

Auth:
- comece com magic link e Google
- mantenha guest access por convite em fluxos controlados

Mapas:
- Mapbox ou Google Maps dependendo custo e qualidade
- usar dados de place verification e coordinates como base inicial

IA:
- provider abstraction mantida
- separar claramente "planner", "editor", "extractor" e "optimizer"

Observabilidade:
- PostHog para produto
- Sentry ou equivalente para erros

## 13. Dominios de dados

Modelo conceitual recomendado:
- User
- Profile
- Trip
- TripMember
- MembershipRole
- Preference
- Itinerary
- Day
- Activity
- Idea
- Vote
- Comment
- Reaction
- Expense
- ExpenseSplit
- Budget
- Checklist
- ChecklistItem
- Document
- Booking
- Flight
- Hotel
- Transport
- Notification
- AIConversation
- AIRecommendation
- PublicTrip
- Memory

Observacao importante:
- nao precisa criar todas as tabelas agora
- precisa desenhar o modelo para evitar reescrita dolorosa depois

## 14. Mapa de telas

### Publicas

- Home
- Como funciona
- Roteiro publico
- Paginas SEO de destinos e roteiros

### App

- Onboarding de nova viagem
- Workspace da viagem
- Itinerario
- Ideias
- Gastos
- Checklist
- Documentos
- Modo viagem
- Configuracoes da viagem
- Perfil do usuario

### Estados especiais

- Entrar por convite
- Primeira preferencia
- Primeira ideia
- Primeira despesa
- Gerar roteiro
- Empty state do grupo

## 15. Fluxos UX principais

### Fluxo 1: solo para grupo

1. usuario cria viagem sozinho
2. recebe valor rapido com IA
3. compartilha link
4. amigos entram sem cadastro
5. grupo passa a colaborar

Esse fluxo deve continuar sendo o principal.

### Fluxo 2: grupo desde o inicio

1. organizador cria viagem
2. compartilha link no WhatsApp
3. participantes entram
4. cada um preenche preferencias
5. grupo adiciona ideias
6. grupo vota
7. IA transforma decisoes em roteiro

### Fluxo 3: durante a viagem

1. usuario abre modo viagem
2. ve proximo compromisso
3. acessa endereco, horario e comprovante
4. registra gasto
5. faz ajuste rapido de roteiro

## 16. Estrategia de IA

### Agentes e funcoes

1. Planner
- monta roteiro inicial
- considera preferencias, datas e budget

2. Editor
- responde pedidos como "troque", "reduza", "encurte", "adicione"

3. Optimizer
- reorganiza ordem geografica e temporal
- reduz deslocamento

4. Extractor
- le texto, PDF, print e e-mail
- extrai reserva e pede confirmacao

5. Budget Advisor
- estima custo
- mostra risco de estouro

### Guardrails

- sempre retornar estrutura
- nunca inserir reserva automaticamente se houver ambiguidade
- explicar por que mudou algo
- usar place verification e regras de negocio para conter alucinacao

## 17. Monetizacao recomendada

Free:
- criar viagem
- convidar
- preferencias
- roteiro basico
- colaboracao basica

Pro por viagem:
- IA avancada
- votos avancados
- gastos completos
- checklist
- docs
- modo viagem premium

Pro individual:
- viagens ilimitadas
- historico
- perfil persistente

Business futuro:
- creators
- travel designers
- agencias

## 18. Growth e lancamento no Brasil

Loop principal:
- uma pessoa cria
- convida 3 a 8
- grupo entra
- roteiro publico e compartilhado
- outra pessoa copia a ideia e cria a propria viagem

Canais iniciais:
- grupos reais do fundador
- casais e grupos de amigos
- conteudo SEO de roteiros
- criadores de viagem de nicho
- WhatsApp como motor de convite

Mensagens de lancamento:
- "pare de planejar viagem em 7 apps"
- "o grupo decide junto"
- "IA que entende o grupo, nao so o destino"

## 19. Metricas

North star:
- trips successfully planned

Metricas de ativacao:
- viagem criada
- convite enviado
- convite aceito
- primeira preferencia salva
- primeiro roteiro gerado

Metricas de colaboracao:
- media de membros ativos por viagem
- ideias por viagem
- votos por viagem
- comentarios por viagem
- percentual de viagens com 2+ colaboradores

Metricas de monetizacao futuras:
- upgrade para Pro
- roteiros regenerados por viagem
- documentos enviados
- gastos registrados

## 20. Riscos

Produto:
- tentar construir tudo do briefing ao mesmo tempo
- perder foco no publico inicial

Tecnologia:
- acoplamento excessivo da logica no client
- ausencia de auth real por muito tempo
- modelo de dados crescer sem modularidade

UX:
- onboarding ficar longo
- IA gerar roteiros bons mas pouco editaveis
- grupo entrar e nao saber o que fazer depois

Mercado:
- cair no meio termo entre TripIt, Wanderlog e Splitwise sem vantagem nitida

## 21. Oportunidades

- Brasil ainda e mal servido em travel collaboration de alta qualidade
- WhatsApp-first e uma vantagem real de distribuicao
- IA contextual pode virar diferencial de retencao
- publico creator e discover pode abrir flywheel forte depois

## 22. Backlog priorizado

### Agora

1. Estruturar auth e identidade sem matar o fluxo de convite
2. Criar dominio de ideias separado do roteiro
3. Criar gastos basicos e split simples
4. Melhorar o workspace da viagem com navegacao em abas
5. Medir ativacao e colaboracao

### Em seguida

6. Mapa + timeline
7. Modo viagem
8. Checklist
9. Documentos manuais
10. editor conversacional de roteiro

### Depois

11. importacao inteligente
12. discover
13. memories
14. offline
15. pagamentos e Pix

## 23. Proxima etapa recomendada para este repositorio

Melhor proximo bloco de construcao:

### Sprint A: transformar o MVP em workspace de decisao

Entregar:
- navegacao por secoes na viagem
- area "Ideias"
- votos em ideias
- acao "adicionar ao roteiro"
- telemetria minima

Por que esta e a melhor escolha agora:
- fortalece a tese "a viagem e um projeto colaborativo"
- diferencia mais do que apenas melhorar a landing
- prepara o terreno para IA reorganizar decisoes reais
- vem antes de gastos completos e antes de documentos

### Sprint B: gastos basicos

Entregar:
- cadastro de despesas
- participantes da despesa
- split igual
- saldo por membro

### Sprint C: auth gradual

Entregar:
- conta opcional para organizador
- guest access por convite mantido
- migracao progressiva do member_id local para identidade real

## 24. Decisao executiva

O Planvoro nao deve tentar nascer como "superapp de viagem".

Ele deve nascer como:

> o melhor lugar para um grupo alinhar uma viagem e sair do caos.

Se fizer isso muito bem, o resto encaixa:
- roteiro
- gasto
- documento
- memoria
- marketplace

Se nao fizer isso muito bem, qualquer expansao vira peso.
