# Planvoro — como colocar pra rodar

Guia passo a passo. Você não precisa saber muito de programação — é copiar, colar e clicar.
Tempo estimado: **20 a 30 minutos**.

---

## O que já está pronto

- ✅ Projeto Supabase **planvoro** criado (região São Paulo, plano gratuito)
- ✅ Banco de dados com todas as tabelas e segurança configurada
- ✅ Aplicativo Next.js completo com o fluxo principal funcionando
- ✅ Build testado e passando
- ✅ **Tudo rodando em camadas gratuitas — custo R$ 0,00, sem cartão de crédito**
- ✅ Landing page pronta, com sua logo oficial
- ✅ Dois caminhos: viagem individual e viagem em grupo
- ✅ Páginas públicas de roteiro indexáveis pelo Google (SEO)
- ✅ **Votação e comentários em cada item do roteiro — o MVP está completo**

O que falta é só pegar duas chaves gratuitas e rodar. Veja também o `PLANO-CUSTO-ZERO.md`.

---

## Passo 1 — Instalar o Node.js

Se você ainda não tem, baixe em **https://nodejs.org** (versão LTS) e instale normalmente.

Para conferir se deu certo, abra o Terminal (Mac) ou o Prompt de Comando (Windows) e digite:

```bash
node -v
```

Se aparecer algo como `v22.x.x`, está tudo certo.

---

## Passo 2 — Abrir a pasta do projeto

Descompacte o arquivo `planvoro.zip` em algum lugar fácil de achar (a Área de Trabalho serve).
Depois, no Terminal, entre na pasta:

```bash
cd caminho/para/planvoro
```

Dica: no Mac, você pode digitar `cd ` (com espaço) e arrastar a pasta pra dentro do Terminal.

---

## Passo 3 — Instalar as dependências

```bash
npm install
```

Isso baixa as bibliotecas. Demora 1 ou 2 minutos na primeira vez.

---

## Passo 4 — Pegar a chave do Supabase

1. Acesse **https://supabase.com/dashboard/project/kqmidnynzynnjejvltmo/settings/api-keys**
2. Procure a seção **service_role** (fica escondida atrás de um botão "Reveal")
3. Copie essa chave

> ⚠️ **Essa chave é a senha mestra do seu banco.** Nunca coloque ela em código que vai pro navegador, nunca poste em print, nunca suba pro GitHub. No app ela só é usada no servidor — já deixei configurado assim.

---

## Passo 5 — Pegar a chave da IA (gratuita, sem cartão)

1. Acesse **https://aistudio.google.com/apikey**
2. Entre com sua conta Google
3. Clique em **Create API key** e copie

Pronto — **não precisa de cartão de crédito**. A cota gratuita é de 1.500 roteiros por dia, muito
mais do que você vai usar testando.

> ⚠️ No plano gratuito o Google pode usar os dados que passam pela API para treinar os modelos
> deles. Para você e seus amigos testando, tudo bem. Antes de abrir para usuários de verdade,
> leia o `PLANO-CUSTO-ZERO.md` — explico lá quando trocar.

---

## Passo 6 — Criar o arquivo de configuração

Na pasta do projeto tem um arquivo chamado `.env.example`. Faça uma cópia dele com o nome `.env.local`:

```bash
cp .env.example .env.local
```

(No Windows: `copy .env.example .env.local`)

Agora abra o `.env.local` num editor de texto e preencha só estas três linhas:

```
SUPABASE_SERVICE_ROLE_KEY=cole_aqui_a_chave_do_passo_4
GEMINI_API_KEY=cole_aqui_a_chave_do_passo_5
NOMINATIM_USER_AGENT=Planvoro/0.1 (contato: SEU_EMAIL_REAL_AQUI)
```

O resto pode deixar como está. **Coloque seu email de verdade** no `NOMINATIM_USER_AGENT` — o
OpenStreetMap exige isso e pode bloquear quem não se identifica.

---

## Passo 7 — Rodar

```bash
npm run dev
```

Abra **http://localhost:3000** no navegador. Deve aparecer a tela de criar viagem.

---

## Passo 8 — Testar o fluxo inteiro

**Teste o caminho individual primeiro (é o mais rápido):**

1. Na home, clique em **Criar viagem** → escolha **Vou sozinho**
2. Preencha destino, datas e seu nome → **Continuar**
3. Marque seus interesses e salve
4. Clique em **Gerar meu roteiro** — em ~30 segundos ele aparece
5. Role até o fim: aparece o convite pra virar viagem de grupo e o link público

**Depois teste o caminho em grupo:**

6. Crie outra viagem escolhendo **Vou em grupo**
7. **Abra o link de convite numa janela anônima** (isso simula outra pessoa) e entre com outro nome
8. Preencha preferências diferentes das suas — coloque restrições conflitantes de propósito
9. Volte pra sua janela e clique em **Gerar roteiro do grupo**
10. Leia a explicação: ela deve citar as pessoas pelo nome e dizer como resolveu os conflitos
11. **Reaja (👍 🤔 👎) e comente nos itens** — passe o mouse sobre a reação para ver quem votou
12. Volte na janela anônima e reaja também: os dois votos aparecem somados

**É esse momento que você precisa testar com gente de verdade.** Se a explicação da IA fizer as pessoas falarem "nossa, ele pensou na Ana mesmo", você tem produto.

---

## Passo 9 — A verificação de lugares já está ligada

Não precisa fazer nada: o app usa o **OpenStreetMap**, que é gratuito e não pede cartão. Lugares
encontrados ganham o selo "verificado" no roteiro.

O OpenStreetMap acha bem monumentos, museus e pontos turísticos, mas às vezes não acha comércio
pequeno. Quando não acha, o item simplesmente não ganha o selo — nada quebra.

Se um dia você quiser a precisão do Google Places (que exige cartão), é só mudar duas linhas no
`.env.local`:

```
PLACES_PROVIDER=google
GOOGLE_PLACES_API_KEY=sua_chave
```

---

## Passo 10 — Publicar na internet

Quando quiser mostrar pros outros:

1. Suba o código pro GitHub (repositório **privado**)
2. Acesse **https://vercel.com**, crie conta com o GitHub
3. **Add New → Project** → escolha o repositório
4. Em **Environment Variables**, cole as mesmas variáveis do `.env.local`
5. **Deploy**

Em 2 minutos você tem uma URL pública tipo `planvoro.vercel.app`, **de graça** — não precisa
comprar domínio agora. Aí sim dá pra mandar no grupo do WhatsApp de verdade.

---

## Passo 11 — Impedir que o banco pause (importante)

O Supabase gratuito pausa o projeto depois de 7 dias sem atividade. Para evitar:

1. Acesse **https://cron-job.org** e crie uma conta grátis
2. Crie um cronjob apontando para `https://seu-app.vercel.app/api/keepalive`
3. Deixe rodando 1 vez por dia

Leva 3 minutos e resolve pra sempre.

---

## Como o código está organizado

```
app/
  page.tsx                       landing page (a home do site)
  nova/page.tsx                  criar viagem: escolha solo ou grupo
  v/[slug]/page.tsx              área de trabalho da viagem (privada do grupo)
  r/[slug]/page.tsx              roteiro público, indexável pelo Google
  sitemap.ts / robots.ts         SEO
  opengraph-image.tsx            imagem que aparece ao mandar o link no WhatsApp
  api/trips/route.ts             cria a viagem
  api/trips/[slug]/route.ts      carrega os dados da viagem
  api/trips/[slug]/join/         entrar na viagem pelo link
  api/trips/[slug]/preferences/  salvar preferências
  api/trips/[slug]/generate/     gera o roteiro com a IA
lib/
  supabase.ts   conexão com o banco (só servidor)
  generate.ts   o prompt, as regras da IA e a troca de provedor (Gemini/Anthropic)
  places.ts     verificação antialucinação + cache (OpenStreetMap ou Google)
  types.ts      tipos e as listas de interesses/restrições
```

**O arquivo mais importante é o `lib/generate.ts`.** É lá que ficam as regras de como a IA
equilibra o grupo. Quando você quiser melhorar a qualidade do roteiro, mexa nas "REGRAS
OBRIGATORIAS" — não precisa mudar mais nada.

---

## Sobre segurança

Todas as tabelas estão com Row Level Security ligado e **sem nenhuma policy**. Isso significa que
o navegador não consegue ler nem escrever nada direto no banco: tudo obrigatoriamente passa pelas
rotas de API do servidor. É a configuração mais segura pra este estágio.

Quando você for adicionar login de verdade, aí sim criamos as policies.

---

## O que ainda não está no código (de propósito)

Estas coisas já têm tabela no banco pronta, só falta a interface:

- Votação nos itens em aberto
- Comentários por item do roteiro
- Divisão de despesas e acerto por Pix
- Mapa com a rota do dia
- Arrastar itens pra reordenar

Deixei de fora pra você conseguir testar o "aha" o quanto antes. Quando o fluxo principal estiver
validado com grupos reais, a gente adiciona na ordem que fizer mais sentido.

---

## Se algo der errado

| Erro | O que fazer |
|---|---|
| `Faltam as variaveis NEXT_PUBLIC_SUPABASE_URL...` | O `.env.local` não foi criado ou está com nome errado. Reinicie o `npm run dev` depois de criar |
| `Falta a variavel GEMINI_API_KEY` | Faltou a chave do Passo 5, ou faltou reiniciar o servidor |
| `Voce bateu o limite gratuito do Gemini` | São 15 chamadas por minuto. Espere um minuto |
| Nenhum lugar aparece como "verificado" | Confira se colocou seu email real no `NOMINATIM_USER_AGENT` |
| `A IA nao retornou um roteiro no formato esperado` | Tente de novo. Se persistir, o destino pode ser muito genérico — teste com uma cidade específica |
| `Ninguem preencheu as preferencias ainda` | Salve suas preferências antes de gerar |
| Página em branco | Olhe o Terminal: a mensagem de erro real aparece lá |

Qualquer coisa que travar, me manda a mensagem de erro que eu resolvo.
