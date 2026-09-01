# Planvoro — Plano de testes

Atualizado em: 01/09/2026
Produção: https://planvoro-app.vercel.app
Repositório local: `C:\Users\guiro\Downloads\planvoro_1\planvoro-app`

## Contexto

O Planvoro é uma SaaS brasileira de planejamento de viagens com IA: roteiro,
grupo, reservas, documentos, checklist, agente e gastos num só workspace.
Next.js 15 + React 19 + TypeScript, Supabase (Auth, Postgres, Storage),
Gemini, Vercel, Stripe, Resend.

Em 26/08/2026 entraram doze entregas em produção. Este documento é o
roteiro de teste manual delas.

**Estado em 01/09/2026: 9 dos 12 testes passaram.** Os seis defeitos
encontrados foram corrigidos e estao em producao. Cada teste abaixo traz
o resultado no topo.

Faltam os testes 08, 09 e 11, que precisam de aparelho: modo aviao, tela
de celular e uma conta descartavel.

## O que já foi verificado (não refazer)

Conferido direto na produção e no banco, sem depender de clique:

- Páginas públicas respondendo 200 (`/`, `/termos`, `/privacidade`, `/contato`, `/historico`, `/offline`)
- Preços R$ 29 e R$ 79 no ar na landing
- Aviso de que a IA erra no rodapé
- Service worker sendo servido
- API sem token devolve 401
- Bucket `trip-vault` privado
- Colunas `members.pix_key` e `trips.budget_per_person` criadas
- Tabelas novas com RLS ligado
- Webhook da Stripe cadastrado com os 5 eventos certos
- Checkout em BRL aceito, com Pix entre os meios de pagamento
- Linhas de anexo e objetos no Storage em sincronia, sem órfão
- Logs de produção sem erro

---

## Teste 01 — Cofre: anexo e remoção

> **PASSOU em 27/08.** Upload, exibicao inline, download, remocao de anexo e remocao do item. Banco e Storage ficaram em sincronia, sem objeto orfao.

**Risco:** alto
**Prova:** upload, bucket privado, link assinado e a limpeza do Storage ao apagar.
1. Aba Cofre, preencher só o Nome do item
2. Bloco Anexos → Escolher arquivos → um PDF ou print
3. Guardar no Cofre; o card nasce com o anexo
4. Abrir: precisa **exibir** na aba, não baixar
5. Baixar: agora sim precisa salvar o arquivo
6. Remover o anexo pelo card
7. Remover o item inteiro do Cofre

**Esperado:** o anexo abre na tela; depois de remover, some da lista e não volta ao recarregar.
**Se falhar:** informar em qual passo. Conferir se sobrou objeto órfão no bucket.

---

## Teste 02 — Acerto por Pix

> **PASSOU em 01/09.** BR Code lido pelo app do banco, com valor e recebedor corretos. CRC conferido contra o vetor oficial da especificacao antes do teste.

**Risco:** alto
**Prova:** o BR Code (EMV MPM) precisa ser aceito pelo app de um banco real.
**Requisito:** viagem com duas pessoas ou mais. Ha um membro "Bruno (teste)" e um gasto "Jantar no Pelourinho" na viagem salvador-bahia-ek44f montados para isso; remover quando nao precisar mais.

1. Aba Gastos → Cadastrar chave Pix → salvar
2. Lançar um gasto com **outra pessoa** como pagante
3. Conferir "Você paga R$ X para Fulano" no acerto
4. Clicar em Copiar Pix
5. Colar no app do banco em Pix Copia e Cola
6. Conferir valor e destinatário na tela do banco

**Esperado:** o banco reconhece o código, com valor exato e nome correto. Não confirmar o pagamento.
**Se falhar:** copiar a mensagem do banco. "Código inválido" é erro no BR Code; nome ou valor errado também.

---

## Teste 03 — Checkout da Stripe

> **PASSOU em 01/09.** Assinatura Pro anual paga com o cartao de teste. Webhook validou a assinatura e gravou status active com validade de um ano. Dois eventos distintos foram tratados: checkout.session.completed e customer.subscription.created.

**Risco:** alto
**Prova:** se o `STRIPE_WEBHOOK_SECRET` da Vercel bate com o da Stripe. Se não bater, o cliente paga e o app não fica sabendo.
**Nota:** a conta está em modo de teste. Nenhum dinheiro real se move.

1. Entrar em `/app` com a conta cadastrada em `PLANVORO_BILLING_TESTERS`
2. O painel mostra o Pro anual, não "Acesso beta ativo"
3. Numa viagem sua, clicar em liberar
4. Pagar com o cartão 4242 4242 4242 4242, validade futura, CVC qualquer
5. Voltar ao painel e conferir a viagem como liberada

**Esperado:** o passo 5 é o que importa. Pagamento aprovado sem liberar a viagem = webhook não chegou.
**Se falhar no 5:** recriar o endpoint na Stripe e gravar o segredo novo na Vercel.

---

## Teste 04 — Importar PDF e print

> **PASSOU em 27/08.** Extraiu fornecedor, codigo, datas e valor de um print real. Instrucao escondida na imagem foi ignorada, e campo ausente veio vazio em vez de inventado.

**Risco:** médio
**Prova:** a IA lendo arquivo em vez de texto colado; o limite diário; e a defesa contra instrução escondida na imagem.

1. Aba Cofre → caixa "Colar confirmação"
2. Ler PDF ou print → uma confirmação real de voo ou hotel
3. Conferir o rascunho: fornecedor, código, datas, valor
4. Corrigir o que veio errado e guardar

**Esperado:** campos preenchidos a partir do arquivo, nada salvo antes de revisar. Campo não encontrado vem vazio, não inventado.
**Se falhar:** dizer qual campo veio errado ou inventado. Inventar dado é mais grave que deixar vazio.

---

## Teste 05 — Alerta de orçamento

> **PASSOU em 27/08.** Teto por pessoa multiplicado pelo grupo, limiares em 60, 85 e 100 por cento. Confirmado que o Cofre nao entra na conta.

**Risco:** médio
**Prova:** que o teto por pessoa vira teto do grupo e que os limiares disparam onde devem.

1. Aba Gastos → Orçamento → Definir → um valor por pessoa
2. Conferir se o total bate com valor × número de pessoas
3. Lançar gastos até passar de 60% e ver mudar para "atenção"
4. Passar de 85% e ver "no limite"

**Esperado:** a barra acompanha e o texto muda de tom. Só gastos lançados contam; o Cofre não entra, para não contar o hotel duas vezes.
**Se falhar:** informar o valor definido, quantas pessoas e o total exibido.

---

## Teste 06 — Mapa e ordem do dia

> **PASSOU em 27/08.** Pinos numerados e linha entre as paradas. Os icones quebrados da primeira versao foram corrigidos.

**Risco:** médio
**Prova:** se a verificação de lugar está salvando coordenadas. Sem isso o mapa fica vazio e o problema é anterior ao mapa.

1. Abrir uma viagem com roteiro gerado → aba Mapa
2. Ver os pinos numerados e a linha ligando as paradas
3. Navegar entre os dias com Anterior e Próximo
4. Ler a sugestão de ordem, quando aparecer

**Esperado:** pinos nos lugares certos. A sugestão só aparece quando economiza mais de 20% e mais de 1 km.
**Se disser "nenhum item tem coordenada":** a verificação de lugar não está preenchendo lat/lng. É problema na geração, não no mapa.

---

## Teste 07 — Compartilhar, PDF e duplicar

> **PASSOU em 27/08.** Publicar e despublicar respondendo 200 e 404. A copia veio sem Cofre, sem gastos e privada.

**Risco:** médio
**Prova:** o laço viral inteiro.
**Requisito:** a viagem precisa estar marcada como pública.

1. Abrir o roteiro público em `/r/{slug}`
2. Enviar para o grupo: abre o menu do sistema ou o WhatsApp
3. Conferir o texto do resumo antes de enviar
4. Salvar em PDF: sem menu, sem rodapé, dia inteiro na mesma folha
5. No workspace, botão PDF abre a página já imprimindo
6. Usar este roteiro: cria cópia sua, sem Cofre nem gastos do original

**Esperado:** a cópia nasce privada e sem os dados do grupo original. Só roteiro e configuração vêm junto.
**Se a cópia trouxer Cofre ou gastos:** é grave, avisar imediatamente.

---

## Teste 08 — Sem sinal

**Risco:** médio
**Prova:** consultar o localizador no aeroporto sem rede.

1. Abrir a viagem com sinal e percorrer Roteiro, Cofre e Checklist
2. Ativar o modo avião
3. Recarregar a página
4. Ver a faixa amarela de "sem conexão"
5. Conferir que o conteúdo já visto continua lá

**Esperado:** leitura funciona; salvar não, com aviso claro. Anexos não abrem offline, e isso é proposital (o link assinado expira em 2 minutos).
**Se a página não carregar:** o service worker pode não ter instalado ainda. Voltar com sinal, navegar um pouco e tentar de novo.

---

## Teste 09 — Celular

**Risco:** médio
**Prova:** o acabamento mobile foi auditado no CSS, não visto numa tela. Maior chance de ter sobrado algo torto.

1. Abrir o workspace no celular e percorrer todas as abas
2. Tocar num campo de texto: a tela não pode dar zoom
3. Conferir se algo estoura a lateral e cria rolagem horizontal
4. Ver o Cofre: cards, botões de status, formulário
5. Ver o Mapa e o Modo viagem

**Esperado:** nada rola para o lado, nenhum botão menor que a ponta do dedo, e focar um campo não desloca a página.
**Se algo estiver torto:** print com a aba visível.

---

## Teste 10 — Histórico

> **PASSOU em 27/08.** Totais agregados corretos, com o filtro de viagem terminada funcionando.

**Risco:** baixo
**Prova:** os totais agregados e o filtro de viagem terminada.
**Nota:** as viagens ativas nao aparecem aqui. Para testar de novo, mudar a data de fim de uma viagem para o passado.

1. Abrir `/historico`
2. Conferir viagens, dias viajados, destinos e gasto total
3. Abrir uma viagem antiga pelo card
4. Repetir esta viagem: cria uma cópia nova

**Esperado:** só viagens com data de fim no passado aparecem. Os dias contam de ponta a ponta, incluindo o dia da volta.
**Se falhar:** dizer qual total está errado e qual seria o certo.

---

## Teste 11 — Exclusão de conta

**Risco:** destrutivo. Usar uma conta descartável.
**Prova:** a obrigação da LGPD, e que os anexos somem do Storage junto com a conta.

1. Criar uma conta nova de teste
2. Criar uma viagem e anexar um arquivo no Cofre
3. Painel → Apagar minha conta → digitar APAGAR
4. Conferir que a sessão caiu e o login não funciona mais

**Esperado:** conta, viagens e anexos somem. Viagens em que a conta só participava continuam existindo para o resto do grupo.
**Depois de testar:** conferir no banco se sobrou objeto órfão no bucket.

---

## Teste 12 — Gate do Passe

> **PASSOU em 01/09.** Onze de onze pontos. Rendeu dois defeitos, ja
> corrigidos: o botao do card do Passe ainda dizia "Usar beta gratis" com
> a beta desligada, e Cofre, Gastos e Checklist mostravam o formulario
> inteiro numa viagem trancada — a pessoa preenchia tudo para so entao
> levar 402.

**Prova:** que Cofre, gastos e checklist trancam sem o Passe, e que ler e apagar continuam liberados mesmo trancado.

Para repetir, e preciso desfazer o bloqueio duplo:

1. Marcar a assinatura Pro como `canceled` em `user_subscriptions`
   (nao apagar: e registro de pagamento)
2. `vercel env add NEXT_PUBLIC_PLANVORO_BETA_ACCESS production --value "false" --no-sensitive`
   — a flag `--no-sensitive` e obrigatoria: variavel `NEXT_PUBLIC_` nao
   aceita visibilidade secreta e o comando falha sem ela
3. Publicar

O que foi verificado, todos aprovados:

- Aviso "Cofre, gastos e checklist estao trancados" aparece
- Criar item no Cofre: 402
- Editar item do Cofre: 402
- Abrir item existente: funciona
- Apagar item do Cofre: 200
- Lancar gasto: 402 · Remover gasto: 200
- Criar e marcar tarefa: 402 · Apagar tarefa: 200
- Roteiro, agenda, mapa, grupo, preferencias, ideias e votacao: livres
- Organizador ve "Liberar esta viagem"
- Landing sem o selo "BETA ATIVA", precos dizendo "Pague uma vez. Ou nunca."

**Convidado nao ve botao de pagar:** verificado por leitura de codigo, nao
por observacao. Os cinco pontos do produto que oferecem pagamento exigem
`is_organizer`, e o ramo alternativo diz "Voce nao precisa pagar nada".
Janela anonima NAO testa isso: `/v/[slug]` e privado e exige login, entao
o que aparece e o muro de autenticacao. O teste real exige uma segunda
conta aceitando o convite.

**Estado restaurado em 01/09:** beta religada e assinatura de volta para
`active`. Nao deixe o site em modo pago depois de testar.

---

## Como reportar

Um problema por vez, com o número do teste e o passo onde parou. Se aparecer
erro na tela, copiar o texto exato — a mensagem diz de qual rota veio.

- Problema visual: print vale mais que descrição.
- Erro de rede: abrir o console com F12 e copiar a linha em vermelho.
- Os logs de produção e o banco podem ser lidos pelo assistente; não precisa investigar.

## Pendências que não são teste

- ~~Preencher `lib/legal.ts`~~ — feito em 01/09. Controlador: Guilherme Paixão Rodrigues, pessoa física; contato paixaodevtech@gmail.com. CPF, cidade e foro ficaram fora por escolha.
- Ligar a proteção contra senha vazada no Supabase (Authentication → Providers → Email).
- Avaliar conta Stripe Brasil: hoje é conta US com moeda padrão em dólar e `charges_enabled: false`.
- Limpar, quando não precisar mais: membro "Bruno (teste)" e gasto "Jantar no Pelourinho" na viagem `salvador-bahia-ek44f`, criados para o teste 02.
- Enviar os commits locais para o GitHub, quando houver:

```bash
cd C:\Users\guiro\Downloads\planvoro_1\planvoro-app
git push origin HEAD:claude/consegye-ver-planvoro-ysh8r9
```

## Regras de decisão que valem para todo o produto

Registradas aqui porque afetam como um bug deve ser interpretado:

- **Acesso segue a viagem, não a pessoa.** Se o organizador liberou, todo participante usa, inclusive quem entrou por convite.
- **Convidado nunca paga nada.** Entrar, preencher preferências, votar, comentar e ver o roteiro são grátis para sempre.
- **Trancar bloqueia criar e editar, nunca ler ou apagar.** Segurar o comprovante de alguém para forçar pagamento seria indefensável.
- **Duplicar não copia o Cofre.** Roteiro é sugestão; reserva é documento.
- **A IA nunca inventa reserva, código, valor ou link.** Campo não encontrado vem vazio e é marcado como pendente.
- **Nada da IA é salvo sem revisão do usuário.**
- **Log nunca leva conteúdo de usuário nem segredo.** Só tamanho e contagem.
