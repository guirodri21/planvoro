# Deploy — Planvoro

## Estado

O projeto Vercel **já existe e já está ligado ao GitHub**:

| | |
|---|---|
| Projeto | `planvoro` |
| Project ID | `prj_zxZoa2nZBTUdj1llYerrfHInSWTj` |
| Team | `guiro944-gmailcom's projects` (`team_jfGiwhxirU7EMWkae23OYbeR`) |
| Repositório | `guirodri21/planvoro` |
| Branch de produção | a branch padrão do repositório |

Com a ligação feita, **todo push na branch padrão publica sozinho**. Não é mais
preciso subir arquivo na mão.

## O que falta para o site funcionar de verdade

Faltam as variáveis de ambiente. Sem elas a landing e as páginas estáticas
sobem normalmente, mas criar viagem e gerar roteiro dão erro — o app não
consegue falar com o banco nem com a IA.

Em **Vercel → projeto `planvoro` → Settings → Environment Variables**, adicione
nos três ambientes (Production, Preview, Development):

| Variável | Valor | Onde pegar |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://planvoro.vercel.app` (ou o domínio final) | — |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kqmidnynzynnjejvltmo.supabase.co` | já é o projeto de produção |
| `SUPABASE_SERVICE_ROLE_KEY` | a service_role key | Supabase → Settings → API |
| `LLM_PROVIDER` | `gemini` | — |
| `GEMINI_API_KEY` | a chave gratuita | aistudio.google.com |
| `PLACES_PROVIDER` | `nominatim` | — |
| `NOMINATIM_USER_AGENT` | `Planvoro/0.1 (contato: SEU-EMAIL)` | **exigido** pela política do OpenStreetMap |
| `NEXT_PUBLIC_POSTHOG_KEY` | a Project API Key | app.posthog.com → Settings → Project |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` | ou `eu.` se criar o projeto na Europa |

> A `SUPABASE_SERVICE_ROLE_KEY` ignora RLS e dá acesso total ao banco. Ela só
> pode existir no servidor. Nunca prefixe com `NEXT_PUBLIC_`, nunca coloque no
> código, nunca versione. Se vazar, gere outra imediatamente no Supabase.

Depois de salvar, faça um **Redeploy** para o build pegar as variáveis novas.

## Por que o deploy não completava antes

A conexão da Vercel usada pelo agente consegue **criar e ligar** projetos, mas
recebe `403 forbidden` ao criar deployment e ao listar deployments:

```
You don't have permission to create a Production Deployment for this project.
```

Ou seja: não era limitação da Vercel nem falta de projeto — é escopo de
permissão do token da conexão. Isso não bloqueia mais nada, porque a publicação
agora acontece pelo git: quem dispara o build é o webhook do GitHub com as
permissões da sua conta, não o token do agente.

Se ainda assim um push não publicar, verifique em **Vercel → Settings → Git**
se o GitHub App está instalado com acesso ao repositório `guirodri21/planvoro`.

## Antes de abrir ao público

Duas pendências que não são de infraestrutura, mas travam o lançamento:

1. **Plano Vercel.** O Hobby é não-comercial. Migrar para Pro antes de cobrar.
2. **IA em plano pago.** Na camada gratuita do Gemini o Google pode usar os
   dados para treinar modelos. Aceitável entre amigos testando, inaceitável com
   usuários reais e política de privacidade publicada (LGPD). Trocar antes de
   abrir o beta aberto.

## Banco em um ambiente novo

`supabase/schema.sql` recria o banco inteiro do zero:
Supabase Studio → SQL Editor → cole o arquivo → Run.
