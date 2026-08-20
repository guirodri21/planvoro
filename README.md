# Planvoro

Roteiro de viagem por IA — sozinho ou com o grupo inteiro.

A IA monta o roteiro dia a dia equilibrando as preferências de todas as pessoas do grupo,
explica o raciocínio citando cada uma pelo nome, e confere se cada lugar existe de verdade
antes de colocar no roteiro.

## Como rodar

```bash
npm install
cp .env.example .env.local   # no Windows: copy .env.example .env.local
# preencha as chaves no .env.local
npm run dev
```

Abra http://localhost:3000

A estratégia de produto, o corte do MVP e o backlog priorizado estão em **[docs/PRD.md](docs/PRD.md)**.

O passo a passo completo, incluindo onde pegar cada chave, está em **COMECE-AQUI.md**.
Para rodar sem gastar nada, veja **PLANO-CUSTO-ZERO.md**.

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Endereço do banco |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Acesso ao banco (só no servidor) |
| `GEMINI_API_KEY` | sim | Gera os roteiros (camada gratuita) |
| `NOMINATIM_USER_AGENT` | sim | Exigido pelo OpenStreetMap — use seu e-mail real |
| `NEXT_PUBLIC_SITE_URL` | não | Usada no sitemap e nos links compartilhados |
| `ANTHROPIC_API_KEY` | não | Só se trocar `LLM_PROVIDER` para `anthropic` |
| `GOOGLE_PLACES_API_KEY` | não | Só se trocar `PLACES_PROVIDER` para `google` |

> ⚠️ A `SUPABASE_SERVICE_ROLE_KEY` é a senha mestra do banco. Ela só é usada no servidor e
> nunca pode ir para o navegador nem para o Git.

## Estrutura

```
app/
  page.tsx                       landing
  nova/page.tsx                  criar viagem: solo ou grupo
  v/[slug]/page.tsx              área de trabalho da viagem (privada)
  r/[slug]/page.tsx              roteiro público, indexável
  api/trips/...                  criar, entrar, preferências, gerar, votar, comentar
lib/
  generate.ts                    o prompt e as regras da IA  <- o coração do produto
  places.ts                      verificação antialucinação + cache
  guards.ts                      autorização das rotas de escrita
  supabase.ts                    conexão (só servidor)
```

## Arquitetura em três decisões

1. **O navegador nunca fala com o banco.** Todas as tabelas têm RLS ligado e nenhuma policy.
   Tudo passa pelas rotas de servidor.
2. **A IA fica atrás de uma interface própria.** Trocar de provedor é mudar uma variável de
   ambiente, sem tocar no resto do código.
3. **Cache de lugares é obrigatório.** Segura o custo de API e é exigência da política de uso
   do OpenStreetMap.

## Stack

Next.js 15 · React 19 · TypeScript · PostgreSQL (Supabase) · Gemini ou Claude · OpenStreetMap
