# Plano de custo zero — até onde dá pra ir sem gastar nada

**Resposta curta:** dá pra chegar até o app publicado na internet, com IA gerando roteiros e
grupos reais testando. **Custo: R$ 0,00.** Só troquei as peças pagas por equivalentes gratuitos —
o código já está atualizado.

---

## O que mudou no código

| Peça | Antes (pago) | Agora (grátis) |
|---|---|---|
| IA que gera roteiro | Anthropic (~US$5 pra começar) | **Gemini** — 1.500 chamadas/dia, sem cartão |
| Verificação de lugares | Google Places (exige cartão) | **OpenStreetMap** — grátis, sem cartão |
| Banco de dados | Supabase free | Supabase free (já estava) |
| Hospedagem | Vercel | Vercel Hobby (já estava) |
| Domínio | planvoro.app (~R$ 100/ano) | **planvoro.vercel.app** — grátis |

Trocar de volta pro pago depois é mudar **uma linha** no arquivo de configuração:

```
LLM_PROVIDER=gemini      →  LLM_PROVIDER=anthropic
PLACES_PROVIDER=nominatim →  PLACES_PROVIDER=google
```

Fiz assim de propósito: você não fica preso na versão gratuita e não vai precisar reescrever nada.

---

## Os limites reais de cada camada grátis

### Gemini (a IA)

- **15 chamadas por minuto, 1.500 por dia.** Cada roteiro gerado = 1 chamada. Você não vai chegar
  perto disso testando.
- **Não precisa de cartão.** Pegue em https://aistudio.google.com/apikey
- ⚠️ **Atenção importante:** no plano gratuito, o Google pode usar o que passa pela API para
  treinar os modelos deles. Enquanto for você e seus amigos testando, tudo bem. **Mas antes de
  abrir pra usuários de verdade e escrever uma política de privacidade, troque pro plano pago.**
  Não prometa confidencialidade que você não pode cumprir.

### OpenStreetMap (verificação de lugares)

- Grátis, sem cadastro, sem cartão.
- **1 requisição por segundo, no máximo.** Já deixei o código respeitando isso automaticamente.
- **Exige** que você se identifique. Coloque seu email real na variável `NOMINATIM_USER_AGENT` —
  se usar o valor de exemplo, seu IP pode ser bloqueado.
- **Cache obrigatório.** Já implementado: cada lugar é consultado uma vez só, depois vem do banco.
- É menos preciso que o Google pra restaurantes e comércio pequeno. Monumento e museu ele acha
  bem; boteco pequeno às vezes não. Um lugar não encontrado simplesmente não ganha o selo
  "verificado" — o roteiro continua funcionando.

> Não consegui testar a chamada ao OpenStreetMap daqui do meu ambiente (a rede daqui bloqueia esse
> domínio). Deve funcionar normal na sua máquina e na Vercel, mas é a primeira coisa que vale
> conferir quando você rodar. Se falhar, o app não quebra — só deixa de mostrar o selo.

### Supabase (banco)

- 500 MB de banco, 5 GB de tráfego/mês. Muito mais do que você vai usar validando.
- ⚠️ **Pausa sozinho depois de 7 dias sem uso.** Criei a rota `/api/keepalive` pra resolver isso —
  instruções abaixo.
- ⚠️ **Só 2 projetos ativos no plano grátis.** Você já está no limite: `guirodri21's Project` e
  `planvoro`. O `conectar-mar-2` está pausado e não conta. Se precisar de um terceiro, vai ter
  que pausar algum.

### Vercel (hospedagem)

- Plano Hobby é grátis e mais que suficiente.
- ⚠️ O plano Hobby é oficialmente para **projetos não comerciais**. Enquanto você está validando
  sem cobrar de ninguém, tudo certo. **No dia que começar a cobrar, migre pro plano Pro.**

---

## Como impedir o Supabase de pausar (3 minutos, grátis)

1. Publique o app na Vercel (Passo 10 do `COMECE-AQUI.md`)
2. Acesse **https://cron-job.org** e crie uma conta grátis
3. Crie um novo cronjob apontando para `https://seu-app.vercel.app/api/keepalive`
4. Configure para rodar **1 vez por dia**

Pronto. O projeto nunca mais pausa.

---

## O que fazer agora, na ordem, gastando R$ 0

### Semana 1 — Colocar no ar
- [ ] Seguir o `COMECE-AQUI.md` (agora sem nenhuma chave paga)
- [ ] Publicar na Vercel → você ganha `planvoro.vercel.app`
- [ ] Configurar o keepalive
- [ ] Gerar 3 roteiros de destinos diferentes e ler com olho crítico

### Semana 2 — Testar com gente de verdade (o passo que mais importa)
- [ ] Escolher **um grupo real** que já está planejando viagem — pode ser seu próprio grupo
- [ ] Mandar o link no WhatsApp deles e **não explicar nada**
- [ ] Observar: quantos entram? quantos preenchem? o que perguntam?
- [ ] Repetir com 3 a 5 grupos

O número que decide tudo: **quantos dos convidados preenchem as preferências.** Se for menos de
40%, o problema é fricção de entrada e nenhum gasto em marketing resolve isso.

### Semana 3 e 4 — Melhorar com base no que você viu
- [ ] Ajustar as regras da IA em `lib/generate.ts` conforme os erros que aparecerem
- [ ] Adicionar a funcionalidade que os grupos mais pediram (as tabelas de votação, comentários e
      despesas já existem no banco)

---

## Onde gastar o primeiro dinheiro, quando tiver

Em ordem de prioridade:

| Ordem | Gasto | Valor | Por quê |
|---|---|---|---|
| 1º | **Domínio planvoro.app** | ~R$ 100/ano | Barato e some rápido. Assim que sobrar troco, registre |
| 2º | **IA paga** | ~R$ 30/mês | Só quando tiver usuários reais — por qualidade e privacidade |
| 3º | **Google Places** | Varia | Só quando a imprecisão do OSM virar reclamação de verdade |
| 4º | **Vercel Pro** | ~US$ 20/mês | Só no dia em que começar a cobrar dos usuários |

## Onde NÃO gastar agora

- ❌ **Anúncios.** Sem produto validado, é dinheiro no lixo. Seu canal é o convite dentro do app.
- ❌ **Logo com designer.** Um texto bem tipografado resolve nessa fase.
- ❌ **Abrir CNPJ.** Só quando for faturar.
- ❌ **Ferramentas no-code de landing page.** Você já tem um app em Next.js — a landing é mais uma
  página nele, de graça.

---

## Resumindo

Com R$ 0 você chega em: **app publicado + IA funcionando + grupos reais testando + dados pra
decidir o próximo passo.**

Isso é mais do que a maioria dos projetos consegue com dinheiro. O que dinheiro compraria agora
seria só conforto — não seria resposta pra pergunta que importa, que é se grupos preferem planejar
aqui do que no WhatsApp.
