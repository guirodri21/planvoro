# PLANVORO — Análise Estratégica e PRD
**Versão 1.0 · 19 de agosto de 2026 · Preparado para Guilherme**

---

## 0. Leitura crítica do brief (leia isto primeiro)

O brief é bom. A visão é coerente, o benchmark é o certo e a intuição sobre o Brasil está correta.
Mas ele tem **um problema grave que precisa ser resolvido antes de qualquer linha de código**, e
seria desonesto da minha parte escrever 40 páginas de PRD sem apontá-lo:

### O "MVP" do item 41 não é um MVP

A lista tem 23 itens: colaboração em tempo real, mapa, gastos, divisão de gastos, orçamento,
checklist, documentos, IA, modo viagem, notificações. Isso é o **escopo de um produto maduro**,
construído por um time de 5 a 8 pessoas em 6 a 9 meses.

Você está sozinho, sem orçamento, e o produto ainda não tem um único usuário.
Construir essa lista inteira antes de lançar significa passar meses codando para descobrir no fim
se alguém queria. É exatamente o cenário que o item 40 do seu próprio brief manda evitar.

**O que eu proponho:** um MVP de verdade, com 6 funcionalidades, executável em 3 a 4 semanas, que
prova ou derruba a tese central. Todo o resto do item 41 vira V1 e V2 — nada é jogado fora, só
reordenado. A seção 6 detalha o corte.

### O segundo ponto: "superior às soluções internacionais"

Ser melhor que Wanderlog em tudo não é realista sozinho e nem é necessário. O que é realista, e
suficiente, é ser **inquestionavelmente melhor em duas coisas específicas** para um público
específico. A seção 3 define quais.

### O que eu já tenho pronto do que construímos antes

- Projeto Supabase ativo em São Paulo (`sa-east-1`), plano gratuito
- Schema com trips, members, preferences, itineraries, days, items, votes, comments, expenses,
  places_cache — com RLS fechado e acesso só via servidor
- App Next.js funcionando: criação de viagem, convite sem cadastro, preferências individuais,
  geração de roteiro por IA com verificação antialucinação, roteiro público indexável, landing
- Logo oficial (pinos agrupados) — que atende exatamente o que o item 33 do brief pede

**Nada disso está publicado.** O deploy na Vercel não completou: a conexão só permite criar
projeto novo e não consegue publicar em projeto existente, e a listagem de projetos hoje volta
vazia. Isso é uma pendência aberta, tratada no backlog.

Renomear Wanderpack → Planvoro é trabalho de menos de um dia.

---

## 1. Visão

> **Planvoro é onde a viagem em grupo é decidida.**

Não "onde a viagem acontece" — esse é o slogan de destino, não o de entrada. A diferença importa:
"tudo em um lugar" é o que **toda** ferramenta de viagem promete, e por isso não significa nada
para quem ouve. Já "onde o grupo decide" nomeia uma dor que a pessoa reconhece em dois segundos.

A visão de Travel OS do item 54 continua sendo o destino. Ela só não pode ser a mensagem do
primeiro ano.

**Tese central, em uma frase testável:**
Grupos brasileiros preferem decidir a viagem numa ferramenta dedicada a decidir no WhatsApp — se,
e somente se, entrar for tão fácil quanto abrir um link.

---

## 2. Análise competitiva

### O benchmark: TripLinq

| Aspecto | O que encontrei |
|---|---|
| Posicionamento | "Plan trips together. Without the chaos." |
| Plataformas | **iOS e Android apenas — não tem versão web** |
| Colaboração | Forte: cursores em tempo real, comentários, reações, permissões |
| IA | **Só interpreta reservas** (e-mail, PDF, texto). Não gera roteiro |
| Despesas | Muito forte: 50+ moedas, snapshot de câmbio, motor de acerto mínimo |
| Offline | Completo, com sincronização |
| Preço | Gratuito, com premium planejado |

**Dois achados que mudam a estratégia:**

**1. TripLinq não tem web.** O brief já tinha escolhido web-first por preferência. Acontece que
essa escolha é também a maior brecha competitiva que existe contra o benchmark. Planejamento de
viagem em grupo é uma tarefa de **tela grande**: comparar hotéis, ver mapa, montar dia a dia,
mexer em planilha mental. Ninguém monta roteiro de 7 dias no celular. Web-first não é só mais
barato de construir — é onde o trabalho de verdade acontece.

**2. A IA do TripLinq é passiva.** Ela organiza o que você já reservou. Não constrói, não sugere,
não resolve conflito entre pessoas. O AI Trip Builder do item 6 do brief é território livre contra
o benchmark direto.

### O mapa completo

| Produto | Web | IA que gera | Grupo | Despesas | Brasil | Fraqueza principal |
|---|---|---|---|---|---|---|
| **TripLinq** | ❌ | ❌ (só lê) | ✅ forte | ✅ forte | ❌ | Sem web, IA passiva |
| **Wanderlog** | ✅ | ❌ fraca | ✅ forte | parcial | ❌ | Entrada manual, dados velhos |
| **TripIt** | ✅ | ❌ | ❌ | ❌ | ❌ | Organiza, não planeja |
| **Mindtrip / Layla** | ✅ | ✅ boa | ❌ | ❌ | ❌ | Zero grupo |
| **Splitwise** | ✅ | ❌ | ✅ | ✅ forte | parcial | Não é viagem |
| **Polarsteps** | parcial | ❌ | ❌ | ❌ | ❌ | Registro pós-viagem |
| **Lambus** | ✅ | ❌ | ✅ | ✅ | ❌ | Pouca presença no BR |
| **Mega Roteiro** | ❌ | ❌ | ✅ | ✅ | ✅ | **~10 downloads** |
| **Decolar / SOFIA** | ✅ | ✅ | ❌ | ❌ | ✅ | É OTA: quer vender passagem |

### As quatro perguntas do item 39

**1. O que todos fazem:** itinerário dia a dia, lista de lugares, alguma forma de compartilhar.
Isso é commodity. Não gera preferência e não vale investimento de diferenciação.

**2. O que ninguém faz bem:**
- **Decidir em grupo.** Todos guardam decisões. Nenhum ajuda a *chegar* nelas. Votação existe em
  alguns, mas ninguém conecta "o grupo escolheu X" com "o roteiro se remonta sozinho".
- **IA que entende conflito entre pessoas.** As IAs boas são todas monousuário. Nenhuma sabe o que
  fazer quando a Ana é vegetariana, o João odeia museu e a Marina chega no dia 3.
- **Confiabilidade.** Recomendar lugar fechado é a reclamação nº 1 em todas as análises de
  concorrentes que li.

**3. O que brasileiros precisam:** entrar sem cadastro (o convite morre no login), acerto por Pix,
o link funcionando bem no WhatsApp, preço em real e valores compatíveis com a realidade local.

**4. Onde o Planvoro pode ser 10x melhor:** no ponto onde **decisão em grupo + IA generativa +
web** se cruzam. Hoje, nenhum produto no mundo ocupa essa interseção. Não é um mercado vazio — é
uma interseção vazia, o que é mais defensável e mais honesto.

### O mercado brasileiro está aberto de verdade

O concorrente nacional mais direto que encontrei, o Mega Roteiro, tem **cerca de 10 downloads na
Play Store**. Não é um erro de leitura — é o tamanho da concorrência local. A Decolar tem
distribuição enorme mas é uma OTA: o incentivo dela é vender passagem, não organizar a viagem de
seis amigos.

---

## 3. Posicionamento

> **Planvoro — o jeito de decidir a viagem do grupo sem virar bagunça no WhatsApp.**

Três pilares, em ordem de prioridade de investimento:

**1. Decisão em grupo (o fosso).** Cada pessoa marca o que quer. A IA monta um roteiro que
equilibra todo mundo **e explica o raciocínio citando as pessoas pelo nome**. O que não dá pra
equilibrar vira votação, e o resultado da votação remonta o roteiro sozinho. Isso é difícil de
copiar porque é produto, não modelo: exige modelar preferência conflitante como dado de primeira
classe.

**2. Confiança (a defesa).** Todo lugar é verificado contra base real antes de entrar no roteiro.
Vira selo visível. É vantagem de engenharia, não de modelo — não evapora quando sai um LLM melhor.

**3. Brasil de verdade (a distribuição).** Sem cadastro para entrar, Pix no acerto, link desenhado
para o WhatsApp, tudo em português e em real. Nenhum concorrente global vai priorizar isso.

**O que o Planvoro NÃO é, e não deve tentar ser no primeiro ano:** OTA, rede social de viagem,
marketplace, app nativo, ferramenta de business travel. Tudo isso está no brief como futuro — e o
lugar deles é o futuro mesmo.

---

## 4. Diferenciais defensáveis

Diferencial que qualquer um copia em uma semana não é diferencial. Separando honestamente:

| Diferencial | Defensável? | Por quê |
|---|---|---|
| Reconciliação de preferências conflitantes | **Alta** | Exige modelagem de dados própria e prompt maduro. Concorrente com IA monousuário teria que refazer o produto |
| Verificação antialucinação com cache | **Alta** | Trabalho de engenharia e base de dados que cresce com o uso |
| Convite sem cadastro | **Média** | Copiável, mas os concorrentes têm login como pilar de negócio e resistem a abrir mão |
| Pix e português nativo | **Média** | Fácil de copiar, mas global não prioriza mercado pequeno |
| Voto que remonta o roteiro | **Média-alta** | Depende do pilar 1 estar pronto |
| IA que gera roteiro | **Baixa** | Todo mundo tem. É requisito de entrada, não vantagem |
| Mapa, timeline, checklist | **Nenhuma** | Commodity. Fazer bem e seguir em frente |

**Onde investir esforço desproporcional:** as duas primeiras linhas. Todo o resto é para não
perder, não para ganhar.

---

## 5. Personas

Reordenei as do brief por **facilidade de alcançar agora**, não por tamanho de mercado.

### P1 — Turma de amigos (foco absoluto do MVP)
4 a 10 pessoas, 25–40 anos, viagem de 4 a 15 dias. Despedida de solteiro, formatura, ano-novo.
**Dor:** ninguém decide nada, tudo some no grupo, uma pessoa faz tudo sozinha e fica irritada.
**Por que começar aqui:** dor máxima, e o convite é viral por natureza — uma viagem traz 7 pessoas.
**Vitória:** o roteiro sai em 3 dias em vez de 3 semanas, e ninguém ficou de fora.

### P2 — Casal
2 pessoas, decisão rápida, conflito baixo mas real (um quer praia, outro quer museu).
**Por que vem junto:** o produto de grupo já serve, sem código adicional. Volume alto, viralidade
baixa.

### P3 — Viajante solo
**O papel dele é ser porta de entrada, não público-alvo.** É quem chega pelo Google buscando
"roteiro Lisboa 5 dias", vê valor sozinho em 2 minutos, e só então convida o grupo. Já está
implementado.

### P4 — Família com crianças e idosos
Restrições reais (ritmo, mobilidade, horário) que é exatamente o que o motor de preferências já
modela. **V1.**

### P5 — Creators
Publicam roteiros públicos e trazem tráfego. **V2** — depende de ter roteiros bons o suficiente
para valer a pena publicar.

### P6 — Agências e empresas
**V3.** Modelo de negócio, ciclo de venda e produto completamente diferentes. Entrar cedo aqui
mata o foco.

---

## 6. MVP — o corte honesto

**Critério:** só entra o que serve para responder *"grupos preferem decidir aqui do que no
WhatsApp?"*. Tudo que não responde essa pergunta é V1, por melhor que seja.

### Entra (6 blocos, 3–4 semanas)

| # | Bloco | Status hoje |
|---|---|---|
| 1 | Criar viagem (solo ou grupo) | ✅ pronto |
| 2 | Convite por link, sem cadastro | ✅ pronto |
| 3 | Preferências individuais (interesses, restrições, orçamento, datas de presença) | ✅ pronto |
| 4 | Roteiro por IA equilibrando o grupo + explicação nominal | ✅ pronto |
| 5 | Verificação antialucinação | ✅ pronto |
| 6 | **Votação nos itens em aberto + comentário por item** | ⬜ falta |

O item 6 é o único que falta. **O MVP está a cerca de uma semana de trabalho de ficar pronto** —
porque o corte respeita o que já existe em vez de recomeçar.

### Fica para V1 (não é desistir, é ordenar)

Mapa, despesas e divisão, orçamento com previsão, checklist inteligente, documentos, modo viagem,
notificações, importação de reservas, tempo real com cursores, multimoeda, offline.

### Por que a divisão de despesas não está no MVP

É o recurso que eu mais gostaria de incluir, e é o primeiro da fila da V1. Mas ele responde a uma
pergunta **diferente** — "o grupo continua usando durante e depois?" — e essa pergunta só faz
sentido depois que a primeira for respondida com sim. Se grupos não decidirem aqui, dividir
despesa não salva o produto.

### Por que colaboração em tempo real não está no MVP

Cursor ao vivo é impressionante em demo e quase irrelevante no uso real: as pessoas do grupo
preenchem preferência em horários diferentes, não simultaneamente. Custa caro (WebSocket, estado
compartilhado, resolução de conflito) e entrega pouco agora. **V1, e mesmo assim só se os testes
mostrarem necessidade.**

### Critério de sucesso do MVP

Rodar com **5 grupos reais**. Três números decidem o rumo:

| Métrica | Meta | Se falhar |
|---|---|---|
| % de convidados que entram | ≥ 60% | Problema de fricção no convite. Nada mais importa |
| % de convidados que preenchem preferências | ≥ 40% | O formulário está longo ou o valor não está claro |
| % de grupos que fecham roteiro | ≥ 50% | A qualidade da IA é o gargalo |

---

## 7. Roadmap

### MVP — semanas 1 a 4 · "O grupo decide"
Votação e comentários. Renomear para Planvoro. Publicar. 5 grupos reais testando.

### V1 — meses 2 a 4 · "O grupo viaja"
Objetivo: reter durante e depois da viagem.
Mapa com timeline · Despesas com divisão flexível e Pix · Orçamento com previsão · Modo viagem ·
Checklist por tipo de viagem · Documentos · Notificações essenciais · Autenticação de verdade.

### V2 — meses 5 a 9 · "A IA conversa"
AI Trip Builder conversacional (item 6 do brief) · Importação inteligente de reservas ·
Smart Route · Explore com roteiros públicos e "copiar roteiro" · Travel Memory · Bot de WhatsApp.

### V3 — mês 10 em diante · "Ecossistema"
Marketplace e afiliados · Multimoeda completa · Offline com sincronização · PWA · Business/agências ·
Expansão para América Latina.

**Regra:** nenhuma fase começa sem que a métrica da anterior tenha batido a meta.

---

## 8. Arquitetura

Confirmando as escolhas do item 35, com as decisões que faltavam:

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript | SSR para as páginas de SEO, uma base só para desktop e mobile |
| Estilo | CSS próprio com design tokens | Menos dependência que Tailwind; o design system já existe |
| Backend | Route Handlers do Next.js | Um repositório só. Serverless nativo na Vercel |
| Banco | **PostgreSQL no Supabase (sa-east-1)** | Já está de pé, em São Paulo. Latência baixa para o Brasil |
| Auth | Supabase Auth (Google + e-mail) — **só na V1** | No MVP, membro é identificado por token local. Login mata convite |
| Storage | Supabase Storage (S3-compatible) | Documentos, na V1 |
| Realtime | Supabase Realtime | Só quando precisar de verdade (V1+) |
| IA | **Camada desacoplada de provider** | `LLM_PROVIDER` já implementado: Gemini (grátis) ou Anthropic (pago) |
| Lugares | OpenStreetMap agora, Google Places quando houver verba | Cache no Postgres é obrigatório nos dois |
| Mapas | Mapbox | Mais barato que Google em escala |
| Pagamento | Stripe + Pix via Asaas ou Pagar.me | Arquitetura pronta, cobrança só na V1 |
| Analytics | PostHog (plano grátis) | Funil de convite é a métrica que decide tudo |
| Deploy | Vercel | Zero configuração com Next.js |

### As três decisões arquiteturais que importam

**1. Nenhum acesso do navegador ao banco.** Todas as tabelas com RLS ligado e sem policies. Tudo
passa pelas rotas de servidor com a service_role key. Mais seguro e mais simples que modelar RLS
para convidado anônimo. Quando entrar login de verdade na V1, criamos as policies.

**2. IA atrás de uma interface própria.** O produto nunca chama um provider direto. Isso permite
começar de graça no Gemini e trocar para modelo melhor sem tocar no resto — e é o que o item 35
pede ao falar em "arquitetura desacoplada de provider".

**3. Cache de lugares no Postgres, não opcional.** Sem ele a conta de API quebra o negócio, e a
política do OpenStreetMap exige cache. Um destino popular custa quase zero a partir do segundo
usuário. Esse cache é um ativo que cresce com o uso.

---

## 9. Banco de dados

O item 36 lista 33 entidades. Criar as 33 agora é modelar um produto que não existe. Faseando:

### Já existe (MVP)
`trips` · `members` · `preferences` · `itineraries` · `itinerary_days` · `itinerary_items` ·
`votes` · `comments` · `expenses` · `places_cache`

Detalhes de projeto que valem registro:
- **`preferences` é a tabela mais importante do produto.** É onde mora o fosso. Guarda interesses,
  restrições, orçamento pessoal e janela de presença por pessoa.
- **`itineraries` é versionado.** Cada geração cria uma versão nova em vez de sobrescrever — dá
  para comparar e voltar atrás, e é o que permite "a votação remontou o roteiro".
- **`itinerary_items.verified` + `place_data`** guardam o resultado da verificação.
- **`trips.is_solo` e `is_public`** sustentam a porta de entrada individual e as páginas de SEO.

### V1
`users` · `profiles` (perfil do viajante, item 24) · `bookings` · `documents` · `checklists` ·
`checklist_items` · `expense_participants` · `settlements` · `notifications` · `budgets`

### V2 e V3
`public_trips` · `creators` · `reviews` · `photos` · `memories` · `ai_conversations` ·
`subscriptions` · `organizations`

---

## 10. Mapa de telas

### MVP

| Rota | O que é | Estado |
|---|---|---|
| `/` | Landing | ✅ |
| `/nova` | Criar viagem: solo ou grupo | ✅ |
| `/v/[slug]` | Workspace da viagem (privado do grupo) | ✅ |
| `/r/[slug]` | Roteiro público, indexável | ✅ |
| `/v/[slug]` → votação | Votar e comentar por item | ⬜ |

### V1
`/v/[slug]/mapa` · `/v/[slug]/despesas` · `/v/[slug]/checklist` · `/v/[slug]/documentos` ·
`/hoje` (modo viagem) · `/entrar` · `/minhas-viagens`

### V2
`/explore` · `/destinos/[cidade]` · `/roteiros/[cidade]-[n]-dias` · `/perfil`

---

## 11. Fluxos de UX

### Fluxo principal — grupo

```
Organizador cria viagem (60s)
   ↓
Manda o link no WhatsApp
   ↓
Cada pessoa entra SEM CADASTRO e marca preferências (2 min)
   ↓
IA gera o roteiro equilibrando o grupo + explica citando nomes
   ↓
O que ficou em aberto vai para votação
   ↓
Votação fecha → roteiro se remonta
   ↓
Roteiro fechado → link público
```

**O momento "aha" é a primeira geração depois que 3+ pessoas preencheram.** É quando o grupo lê a
explicação e pensa "ele pensou na Ana mesmo". Instrumentar o tempo até esse ponto é a coisa mais
importante do analytics.

### Fluxo de entrada — solo

```
Chega pelo Google em /r/[slug] ou pela landing
   ↓
Cria viagem sozinho, marca preferências, gera roteiro (2 min)
   ↓
Vê valor
   ↓
SÓ ENTÃO: "vai com mais alguém? manda o link"
```

O convite depois do valor converte muito mais do que exigir grupo antes de a pessoa saber se o
produto presta.

### Onboarding

O item 31 pede 5 perguntas em sequência. Cuidado: cada tela é uma chance de abandono. Recomendo
**3 perguntas** (destino, datas, com quem) e o resto inferido ou perguntado depois. A meta de 60
segundos do item 32 é boa e alcançável — mas só com menos perguntas, não com mais.

---

## 12. Estratégia de IA

### Camadas

| Camada | O que faz | Fase |
|---|---|---|
| Geração | Monta o roteiro equilibrando o grupo | ✅ MVP |
| Verificação | Confere cada lugar contra base real | ✅ MVP |
| Explicação | Justifica as escolhas citando pessoas | ✅ MVP |
| Reconciliação | Reprocessa quando entra gente ou muda voto | V1 |
| Conversação | "reduza o orçamento", "troque esse restaurante" | V2 |
| Extração | Lê PDF e e-mail de reserva | V2 |
| Otimização | Smart Route por distância e horário | V2 |

### O princípio que não se negocia

**Nada entra no roteiro sem verificação.** Lugar não encontrado não aparece. É o que separa o
Planvoro da crítica número um que todo concorrente recebe.

### Regras já embutidas no prompt

Respeitar toda restrição alimentar e de mobilidade · Nada antes das 10h se alguém marcou que não
acorda cedo · Máximo 4 atividades por dia · Lugares do mesmo dia geograficamente próximos ·
Ajustar quem chega depois ou sai antes · Mandar para votação quando o grupo estiver dividido.

**O prompt é o produto.** Quando um roteiro sair ruim, o conserto é ali — não em código novo.

### Custo

Gemini na camada gratuita: 1.500 gerações por dia, sem cartão. Suficiente para todo o MVP e boa
parte da V1. **Ressalva séria:** no plano gratuito o Google pode usar os dados para treinar
modelos. Aceitável entre amigos testando; **inaceitável depois de abrir para usuários reais e
escrever política de privacidade.** Trocar para plano pago é pré-requisito de lançamento público —
e conversa direto com a exigência de LGPD do item 38.

---

## 13. Monetização

Freemium, como o item 28 pede, com uma diferença importante:

| Plano | Preço | Para quem |
|---|---|---|
| Grátis | R$ 0 | 1 viagem ativa, até 3 pessoas, 3 roteiros/mês |
| **Por viagem** | **R$ 79, uma vez** | Libera tudo para o grupo inteiro naquela viagem |
| Pro anual | R$ 149/ano | Quem viaja várias vezes por ano |
| Business | depois | Agências e empresas (V3) |

**Por que o plano por viagem é o principal:** o comportamento é sazonal — a pessoa viaja 1 ou 2
vezes por ano. Assinatura mensal em produto sazonal tem churn brutal. Vender a viagem inteira
converte melhor, o organizador decide sozinho pelo grupo e o ticket é maior. Quase nenhum
concorrente faz isso.

**Segunda fonte:** comissão de afiliado em hospedagem, passeios e seguro. **Regra inegociável:
comissão nunca distorce recomendação.** Foi exatamente a crítica que Mindtrip e iplan.ai levaram
publicamente.

**Referência:** Wanderlog cobra US$ 39,99/ano e TripIt US$ 49/ano. R$ 149/ano posiciona
competitivo sem parecer barato demais.

---

## 14. Crescimento

### O loop principal

```
1 viagem criada → ~7 pessoas convidadas → algumas criam a própria viagem → repete
```

Isso é o item 46 do brief, e é o canal mais importante porque **não custa nada** — o que é
decisivo no seu contexto. Por isso a métrica "% de convidados que entram" vale mais que qualquer
outra: ela é o coeficiente de multiplicação do negócio inteiro.

### O loop secundário: SEO

Cada roteiro público vira página indexável. `/roteiros/lisboa-7-dias` e afins, exatamente como o
item 47 pede. Já implementado: rota pública, sitemap automático, robots com a área privada
bloqueada. Demora meses para render, e é por isso que precisa começar agora.

### O que NÃO fazer agora

**Anúncio pago.** Sem produto validado é dinheiro no lixo, e você não tem dinheiro para pôr no
lixo. Volta a ser considerado quando o funil de convite estiver acima de 60%.

---

## 15. Lançamento no Brasil

**Semanas 1–4 — beta fechado.** 5 grupos reais, começando pelo seu próprio. Mandar o link e **não
explicar nada** — o que a pessoa perguntar é a lista de problemas de UX.

**Meses 2–3 — beta aberto.** Comunidades onde o público está: grupos de viagem no Facebook,
r/brasil e r/viagens, Twitter de nicho. Postar o **roteiro gerado**, não o produto.

**Meses 4–6 — SEO e conteúdo.** Roteiros públicos dos destinos do item 29 (Rio, Floripa, Salvador,
Gramado, Foz, Noronha, Jeri, Bonito). Buscar "roteiro [cidade] X dias" é intenção altíssima.

**Sazonalidade que muda o cronograma:** os picos de planejamento no Brasil são **dezembro–janeiro**
(férias e ano-novo) e **junho–julho**. Estar pronto antes do pico de dezembro vale mais do que
qualquer funcionalidade extra. Isso deveria ancorar seu calendário.

---

## 16. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Escopo grande demais para uma pessoa** | **Crítica** | O corte da seção 6. É o risco nº 1 do projeto |
| Baixa frequência de uso (1–2 viagens/ano) | Alta | Plano por viagem; usar durante a viagem (V1) |
| Alucinação da IA destrói confiança | Alta | Verificação obrigatória. Já implementado |
| Convite não converte | Alta | Sem cadastro. Medir obsessivamente. Se <40%, parar tudo e consertar |
| Gemini grátis treina com dados dos usuários | **Alta (jurídico)** | Migrar para plano pago antes de abrir ao público. LGPD |
| Custo de API corroendo margem | Média | Cache agressivo, limite no plano grátis |
| Gigante copia (Google, Booking, Decolar) | Média | Foco em grupo + Brasil, que eles demoram a priorizar |
| Sazonalidade | Média | Planejar caixa; SEO trabalha o ano todo |
| Supabase grátis pausa em 7 dias | Baixa | Keepalive com cron gratuito. Já implementado |
| Vercel Hobby é não-comercial | Baixa | Migrar para Pro quando começar a cobrar |

---

## 17. Oportunidades

**1. TripLinq não tem web.** A maior. Planejamento é tarefa de tela grande e o benchmark direto
não atende. Web-first não é consolo — é ataque.

**2. O mercado brasileiro está vazio de verdade.** O concorrente nacional mais direto tem ~10
downloads. Isso quase nunca acontece.

**3. A interseção grupo + IA generativa não é ocupada por ninguém.** Quem faz IA não faz grupo;
quem faz grupo não faz IA.

**4. O Tripnotes morreu.** O produto que era exatamente "grupo + votação + comentário por dia" foi
descontinuado após aquisição. A vaga está literalmente aberta.

**5. Pix e WhatsApp são fossos locais reais.** Não são grandes, mas nenhum global vai priorizar.

**6. Roteiro público como SEO.** Conteúdo gerado pelo uso, custo marginal zero, composto ao longo
do tempo.

---

## 18. Backlog priorizado

### Agora (semana 1)

| # | Item | Esforço |
|---|---|---|
| 1 | Renomear Wanderpack → Planvoro em todo o produto | 2h |
| 2 | **Votação e comentários por item** (fecha o MVP) | 2 dias |
| 3 | Resolver o deploy na Vercel (conexão só cria projeto novo) | 1h |
| 4 | PostHog com o funil de convite instrumentado | 3h |
| 5 | Domínio: **`planvoro.com.br` e `planvoro.app` estão livres** (checagem por DNS). O `.com` já está em uso — registre os dois livres | 30 min |

### Semanas 2–4
6. Beta com 5 grupos reais · 7. Ajustar prompt conforme os erros reais · 8. Corrigir a fricção que
os testes revelarem · 9. Roteiros públicos dos 8 destinos prioritários

### V1 (meses 2–4)
10. Despesas com divisão flexível · 11. Acerto mínimo por Pix · 12. Mapa com timeline ·
13. Modo viagem · 14. Autenticação · 15. Checklist inteligente · 16. Documentos ·
17. Notificações · 18. Orçamento com previsão · 19. **Migrar a IA para plano pago (LGPD)**

### V2 (meses 5–9)
20. AI Trip Builder conversacional · 21. Importação de reservas · 22. Smart Route ·
23. Explore com copiar roteiro · 24. Travel Memory · 25. Bot de WhatsApp

### V3 (mês 10+)
26. Marketplace e afiliados · 27. Multimoeda · 28. Offline com sincronização · 29. PWA ·
30. Business · 31. América Latina

---

## Resumo em cinco linhas

1. O MVP do brief é grande demais. Cortei para 6 blocos — **5 já estão prontos**, falta votação.
2. TripLinq **não tem web**: a maior brecha contra o benchmark, e você já ia por ali.
3. O fosso é **decisão em grupo com IA que entende conflito entre pessoas**. Todo o resto é para
   não perder.
4. O mercado brasileiro está genuinamente vazio — o concorrente local tem ~10 downloads.
5. A métrica que decide tudo é **% de convidados que entram**. Abaixo de 40%, nenhuma
   funcionalidade nova salva.

---

## Fontes

- [TripLinq — site oficial](https://trip-linq.com/)
- [TripLinq na App Store](https://apps.apple.com/us/app/triplinq-group-trip-planner/id6751021075)
- [Mega Roteiro na Google Play](https://play.google.com/store/apps/details?id=com.megaroteiro.app)
- [Best AI Trip Planners 2026 — aitravel.tools](https://aitravel.tools/best-ai-trip-planner/)
- [Wanderlog vs Layla vs 8 More — Voyaige](https://voyaige.to/blog/best-ai-travel-planner-2026)
- [Gemini API Free Tier Limits 2026 — TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)
- [Nominatim Usage Policy — OSM Foundation](https://operations.osmfoundation.org/policies/nominatim/)
- [Supabase Free Tier Limits 2026](https://www.itpathsolutions.com/supabase-free-tier-limits)
