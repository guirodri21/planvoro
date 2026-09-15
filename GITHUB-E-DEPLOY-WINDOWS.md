# Do zip ao site no ar — Windows, sem linha de comando

Guia para subir o Planvoro no GitHub e publicar na Vercel.
**Tempo: cerca de 40 minutos.** Não precisa saber Git.

Ao final você terá:

- o código num repositório privado no GitHub
- o site publicado numa URL de verdade
- **deploy automático:** toda mudança que você salvar vai pro ar sozinha

---

## Antes de começar: a regra de segurança

Você tem duas chaves que **nunca** podem ir para o GitHub:

- `SUPABASE_SERVICE_ROLE_KEY` — a senha mestra do seu banco
- `GEMINI_API_KEY` — a chave da IA

Elas ficam num arquivo chamado `.env.local`, e o projeto já está configurado para ignorar esse
arquivo. **Você não precisa fazer nada** — só não crie um arquivo de chaves com outro nome.

> Se um dia uma chave dessas subir por acidente, considere ela queimada: apague o arquivo, gere
> uma chave nova no Supabase/Google e troque. Apagar do GitHub depois não resolve, porque fica no
> histórico.

---

## Passo 1 — Criar conta no GitHub

1. Acesse **https://github.com/signup**
2. Crie a conta com seu e-mail
3. Confirme o e-mail

Se já tiver conta, pule.

---

## Passo 2 — Instalar o GitHub Desktop

É o programa que faz o trabalho do Git com botões, sem terminal.

1. Baixe em **https://desktop.github.com**
2. Instale normalmente
3. Abra e clique em **Sign in to GitHub.com**
4. Faça login e autorize

---

## Passo 3 — Descompactar o projeto

1. Pegue o arquivo `planvoro.zip`
2. Clique com o botão direito → **Extrair tudo**
3. Extraia em um lugar fácil, por exemplo:

```
C:\Users\SeuNome\Documentos\planvoro-app
```

> ⚠️ Confira se dentro da pasta aparecem `package.json`, `app` e `lib` **direto**. Às vezes o
> Windows cria uma pasta dentro da outra (`planvoro-app\planvoro-app`). Se isso acontecer, mova o
> conteúdo de dentro para fora.

---

## Passo 4 — Transformar a pasta em repositório

No GitHub Desktop:

1. Menu **File → Add local repository**
2. Clique em **Choose...** e selecione a pasta `planvoro-app`
3. Vai aparecer o aviso: *"This directory does not appear to be a Git repository"*
4. Clique no link **create a repository** dentro dessa mensagem
5. Preencha:
   - **Name:** `planvoro`
   - **Description:** Roteiro de viagem por IA, sozinho ou em grupo
   - **Git ignore:** deixe como **None** (o projeto já tem o arquivo certo)
   - **License:** None
6. Clique em **Create repository**

---

## Passo 5 — Conferir o que vai subir (importante)

Na tela principal, o GitHub Desktop lista os arquivos que serão enviados.

**Confira estas três coisas:**

| Deve aparecer | Não pode aparecer |
|---|---|
| `package.json`, `app/`, `lib/`, `README.md` | ❌ `.env.local` |
| `.env.example` (só o modelo, sem chave) | ❌ `node_modules` |
| `.gitignore` | ❌ `.next` |

Se `.env.local` aparecer na lista, **pare**. Me avise antes de continuar.

Deve dar em torno de 25 a 30 arquivos. Se aparecerem milhares, o `node_modules` entrou junto —
também pare e me avise.

---

## Passo 6 — Primeiro commit

Na parte de baixo à esquerda:

1. Em **Summary**, escreva: `MVP do Planvoro`
2. Clique em **Commit to main**

Commit é um "ponto de salvamento". A partir de agora você pode voltar atrás em qualquer mudança.

---

## Passo 7 — Publicar no GitHub

1. Clique no botão azul **Publish repository** no topo
2. **MUITO IMPORTANTE:** deixe marcado **Keep this code private**
3. Clique em **Publish repository**

Pronto — o código está no GitHub, privado.

---

## Passo 8 — Conectar na Vercel

1. Acesse **https://vercel.com/signup**
2. Escolha **Continue with GitHub** e autorize
3. Na tela inicial, clique em **Add New... → Project**
4. Encontre `planvoro` na lista e clique em **Import**
   - Se não aparecer, clique em **Adjust GitHub App Permissions** e libere o repositório
5. A Vercel detecta Next.js sozinha — **não mexa** em Framework, Build Command nem Output

---

## Passo 9 — Colocar as chaves na Vercel

Ainda na tela de importação, abra **Environment Variables** e adicione uma por uma:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kqmidnynzynnjejvltmo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(a chave do seu painel Supabase)* |
| `GEMINI_API_KEY` | *(a chave do Google AI Studio)* |
| `NOMINATIM_USER_AGENT` | `Planvoro/0.1 (contato: seu-email-real@exemplo.com)` |
| `LLM_PROVIDER` | `gemini` |
| `PLACES_PROVIDER` | `nominatim` |

Onde pegar cada chave:

- **Supabase:** https://supabase.com/dashboard/project/kqmidnynzynnjejvltmo/settings/api-keys →
  seção **service_role** → botão **Reveal**
- **Gemini:** https://aistudio.google.com/apikey → **Create API key** (não pede cartão)

Depois clique em **Deploy**.

Em 2 a 3 minutos o site está no ar, numa URL tipo `planvoro.vercel.app`.

---

## Passo 10 — Ajustar o endereço do site

Agora que você sabe a URL final:

1. Na Vercel: **Settings → Environment Variables**
2. Adicione `NEXT_PUBLIC_SITE_URL` com a URL completa, por exemplo
   `https://planvoro.vercel.app`
3. Vá em **Deployments**, clique nos três pontinhos do último e escolha **Redeploy**

Isso faz o sitemap e os links compartilhados apontarem para o lugar certo.

---

## Passo 11 — Impedir o banco de pausar

O Supabase gratuito pausa o projeto depois de 7 dias sem uso.

1. Acesse **https://cron-job.org** e crie conta grátis
2. Crie um cronjob para `https://SEU-SITE.vercel.app/api/keepalive`
3. Deixe rodando 1 vez por dia

---

## Como você trabalha a partir de agora

Esse é o ganho real de ter subido pro GitHub:

```
Você edita um arquivo
   ↓
GitHub Desktop mostra o que mudou
   ↓
Escreve um resumo e clica em "Commit to main"
   ↓
Clica em "Push origin"
   ↓
A Vercel publica sozinha em ~2 minutos
```

Não precisa mais mexer em zip, nem refazer deploy na mão.

E se algo quebrar, dá pra voltar atrás: **History** → clique com o botão direito no commit →
**Revert changes in commit**.

---

## Se der errado

| Problema | O que fazer |
|---|---|
| Aparecem milhares de arquivos pra subir | O `.gitignore` não foi aplicado. Confirme que o arquivo `.gitignore` está na raiz da pasta |
| `.env.local` aparece na lista | Pare. Confira se o `.gitignore` tem a linha `.env.*` |
| Build falha na Vercel | Abra o log do deploy e me mande a mensagem de erro |
| Site abre mas dá erro ao criar viagem | Faltou alguma variável de ambiente. Confira o Passo 9 e faça Redeploy |
| Roteiro não gera | Chave do Gemini errada, ou você passou de 15 chamadas por minuto |
| O repositório está público | Settings → Danger Zone → Change visibility → Private |

Qualquer erro, me manda a mensagem exata que eu resolvo.
