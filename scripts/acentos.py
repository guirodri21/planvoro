# -*- coding: utf-8 -*-
"""
Procura palavra sem acento em texto que a pessoa le.

Corrigir acento a cada relatorio de teste nao termina nunca: sao dezenas
de arquivos e cada rodada acha tres novos. Este script olha o projeto
inteiro de uma vez.

So considera texto visivel: conteudo entre tags JSX, valores de props que
viram texto na tela, e mensagens devolvidas por rota de API. Ignora
comentario, nome de variavel, chave de objeto, rota e classe CSS — foi
trocando `/historico` por `/historico` com acento que uma varredura
anterior criou 404 de verdade.

DOIS LIMITES CONHECIDOS:

1. So acha o que esta no dicionario. Palavra sem acento
que ninguem listou passa batido — foi assim que "Peca ao organizador" e "o
plano gratis" sobreviveram a varreduras que fecharam em zero. Quando achar
uma nova, adicione aqui em vez de so corrigir o arquivo: a proxima vez que
ela aparecer, o script pega sozinho.

2. Palavra ambigua fica de fora. "De um nome" precisa virar "Dê", mas
mapear "De" -> "Dê" estragaria "De acordo" e "De 10 a 20". Verbo no
imperativo que colide com preposicao so o olho resolve.

3. So olha uma linha por vez. Prosa JSX quebrada em varias linhas escapa,
porque o padrao exige `<` e `>` na mesma linha. Foi assim que "ideias e
votacao continuam liberados" sobreviveu — a frase estava partida ao meio.
Ao revisar texto longo em JSX, leia com o olho tambem.

Uso:
    python scripts/acentos.py app             # relatorio
    python scripts/acentos.py app --corrigir  # aplica
"""
import io
import os
import re
import sys

# Palavra errada -> certa. So palavra inteira, sem prefixo ou sufixo.
DICIONARIO = {
    "nao": "não", "Nao": "Não",
    "sao": "são", "Sao": "São",
    "tambem": "também", "Tambem": "Também",
    "voce": "você", "Voce": "Você",
    "ja": "já", "Ja": "Já",
    "vao": "vão", "sera": "será",
    "possivel": "possível", "disponivel": "disponível",
    "proximo": "próximo", "Proximo": "Próximo",
    "proxima": "próxima", "Proxima": "Próxima",
    "preferencias": "preferências", "Preferencias": "Preferências",
    "preferencia": "preferência",
    "versao": "versão", "Versao": "Versão",
    "descricao": "descrição", "Descricao": "Descrição",
    "lancamento": "lançamento", "lancamentos": "lançamentos",
    "transferencia": "transferência", "transferencias": "transferências",
    "restricoes": "restrições", "Restricoes": "Restrições",
    "votacao": "votação", "Votacao": "Votação",
    "criacao": "criação",
    "comentario": "comentário", "comentarios": "comentários",
    "Saude": "Saúde", "acionavel": "acionável",
    "horario": "horário", "horarios": "horários",
    "confianca": "confiança", "Confianca": "Confiança",
    "comeca": "começa", "Comeca": "Começa",
    "preco": "preço", "precos": "preços",
    "historico": "histórico", "Historico": "Histórico",
    "codigo": "código", "codigos": "códigos", "Codigo": "Código",
    "usuario": "usuário", "usuarios": "usuários", "Usuario": "Usuário",
    "publico": "público", "publica": "pública", "Publico": "Público",
    "unico": "único", "unica": "única", "Unico": "Único",
    "automatico": "automático", "automatica": "automática",
    "Automatico": "Automático",
    "pagina": "página", "paginas": "páginas", "Pagina": "Página",
    "aereo": "aéreo", "aerea": "aérea", "Aereo": "Aéreo",
    "orcamento": "orçamento", "Orcamento": "Orçamento",
    "duvida": "dúvida", "duvidas": "dúvidas", "Duvida": "Dúvida",
    "endereco": "endereço", "enderecos": "endereços", "Endereco": "Endereço",
    "servico": "serviço", "servicos": "serviços", "Servico": "Serviço",
    "opcao": "opção", "opcoes": "opções", "Opcao": "Opção", "Opcoes": "Opções",
    "informacao": "informação", "informacoes": "informações",
    "Informacao": "Informação",
    "confirmacao": "confirmação", "Confirmacao": "Confirmação",
    "sugestao": "sugestão", "sugestoes": "sugestões", "Sugestao": "Sugestão",
    "decisao": "decisão", "decisoes": "decisões", "Decisao": "Decisão",
    "atencao": "atenção", "Atencao": "Atenção",
    "duracao": "duração", "Duracao": "Duração",
    "localizacao": "localização", "Localizacao": "Localização",
    "invalido": "inválido", "invalida": "inválida",
    # Verbos com cedilha, que sao os que mais escapam: nao aparecem em
    # rotulo de tela, e sim no meio de frase de erro. Foi assim que
    # "Peca ao organizador" sobreviveu a tres varreduras.
    "peca": "peça", "Peca": "Peça",
    "faca": "faça", "Faca": "Faça",
    "gratis": "grátis", "Gratis": "Grátis",
    "apolice": "apólice", "Apolice": "Apólice",
    "necessarios": "necessários", "necessarias": "necessárias",
    "necessario": "necessário", "necessaria": "necessária",
    "media": "média", "medias": "médias",
    "visivel": "visível", "visiveis": "visíveis",
    "invisivel": "invisível",
    "responsavel": "responsável", "responsaveis": "responsáveis",
    "util": "útil", "uteis": "úteis",
    "nivel": "nível", "niveis": "níveis",
    "movel": "móvel", "moveis": "móveis",
    "possiveis": "possíveis",
    "ferias": "férias", "Ferias": "Férias",
    "saida": "saída", "saidas": "saídas", "Saida": "Saída",
    "familia": "família", "Familia": "Família",
    "criancas": "crianças", "crianca": "criança",
    "refeicao": "refeição", "refeicoes": "refeições",
    "excursao": "excursão", "excursoes": "excursões",
    "facil": "fácil", "Facil": "Fácil", "faceis": "fáceis",
    "rapido": "rápido", "rapida": "rápida", "Rapido": "Rápido",
    "proprio": "próprio", "propria": "própria", "Proprio": "Próprio",
    "ultimo": "último", "ultima": "última", "Ultimo": "Último",
    "minimo": "mínimo", "maximo": "máximo", "Minimo": "Mínimo",
    "numero": "número", "numeros": "números", "Numero": "Número",
    "cartao": "cartão", "Cartao": "Cartão",
    "sessao": "sessão", "Sessao": "Sessão",
    "conexao": "conexão", "conexoes": "conexões",
    "permissao": "permissão", "permissoes": "permissões",
    "confirmacoes": "confirmações",
    "acao": "ação", "Acao": "Ação", "acoes": "ações", "Acoes": "Ações",
    "solucao": "solução", "Solucao": "Solução",
    "ligacao": "ligação", "condicao": "condição", "condicoes": "condições",
    "excecao": "exceção", "excecoes": "exceções",
    "posicao": "posição", "posicoes": "posições",
    "selecao": "seleção", "Selecao": "Seleção",
    "verificacao": "verificação", "Verificacao": "Verificação",
    "autorizacao": "autorização", "Autorizacao": "Autorização",
    "Voces": "Vocês", "voces": "vocês",
    # "esta" fica de fora de proposito: e palavra valida ("esta viagem") e
    # verbo sem acento so as vezes. Trocar sempre estragaria o texto certo.
}

# Linha que e claramente codigo, nao texto de tela.
IGNORAR_LINHA = re.compile(
    r"^\s*(//|/\*|\*)"
    r"|\b(href|src|className|id|key|value|name|type|slug|path|route)\s*[:=]"
    r"|\bimport\b|\bexport\b|\brequire\("
    r"|process\.env"
)

# Texto visivel: entre > e <, ou valor de prop que aparece na tela.
VISIVEL = [
    re.compile(r">([^<>{}]{3,})<"),
    re.compile(r'(?:placeholder|title|label|aria-label|alt)\s*=\s*"([^"]+)"'),
    re.compile(r'(?:placeholder|title|label|aria-label|alt)\s*=\s*\{`([^`]+)`\}'),
]

PALAVRA = re.compile(r"\b[A-Za-z][a-z-]+\b")


def trechos_visiveis(linha):
    """Todos os pedacos da linha que viram texto na tela."""
    if IGNORAR_LINHA.search(linha):
        return []

    achados = []
    for padrao in VISIVEL:
        achados += padrao.findall(linha)

    # String solta em portugues: numa rota de API isso e a mensagem de erro
    # que a pessoa le. A barra descarta caminho e URL.
    for aspas in re.findall(r'"([^"]{6,})"', linha) + re.findall(r"`([^`]{6,})`", linha):
        if " " in aspas and "/" not in aspas:
            achados.append(aspas)

    return achados


def revisar(caminho):
    achados = []
    for numero, linha in enumerate(io.open(caminho, encoding="utf-8"), 1):
        for trecho in trechos_visiveis(linha):
            for palavra in PALAVRA.findall(trecho):
                if palavra in DICIONARIO:
                    achados.append((numero, palavra, DICIONARIO[palavra], trecho.strip()[:70]))
    return achados


def corrigir(caminho):
    """
    Aplica as trocas, mas so dentro do texto visivel.

    Trocar na linha inteira foi como uma varredura antiga quebrou rotas.
    Aqui cada trecho e reescrito isolado e devolvido ao lugar de onde saiu.
    """
    linhas = io.open(caminho, encoding="utf-8").readlines()
    mudou = 0

    for i, linha in enumerate(linhas):
        nova = linha
        for trecho in set(trechos_visiveis(linha)):
            corrigido = PALAVRA.sub(lambda m: DICIONARIO.get(m.group(0), m.group(0)), trecho)
            if corrigido != trecho:
                nova = nova.replace(trecho, corrigido)

        if nova != linha:
            linhas[i] = nova
            mudou += 1

    if mudou:
        io.open(caminho, "w", encoding="utf-8", newline="\n").writelines(linhas)
    return mudou


def main():
    aplicar = "--corrigir" in sys.argv
    caminhos = [a for a in sys.argv[1:] if not a.startswith("--")] or ["."]
    total = 0

    for raiz in caminhos:
        for pasta, _, arquivos in os.walk(raiz):
            if "node_modules" in pasta or ".next" in pasta:
                continue
            for arquivo in arquivos:
                # Rota de API e .ts e devolve mensagem que a pessoa le. Ficou
                # de fora da primeira versao, e foi por isso que "So o
                # organizador pode liberar a viagem" sobreviveu.
                if not arquivo.endswith((".tsx", ".ts")):
                    continue

                caminho = os.path.join(pasta, arquivo)

                if aplicar:
                    n = corrigir(caminho)
                    if n:
                        print("%3d linhas  %s" % (n, caminho))
                        total += n
                    continue

                achados = revisar(caminho)
                if not achados:
                    continue
                print("\n" + caminho)
                for numero, errada, certa, contexto in achados:
                    print("  %5d  %-16s -> %-16s  %s" % (numero, errada, certa, contexto))
                    total += 1

    print("\ntotal:", total)


if __name__ == "__main__":
    main()
