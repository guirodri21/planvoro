# -*- coding: utf-8 -*-
"""
Procura palavra sem acento em texto que a pessoa le.

Corrigir acento a cada relatorio de teste nao termina nunca: sao dezenas
de arquivos e cada rodada acha tres novos. Este script olha o projeto
inteiro de uma vez.

So considera texto visivel: conteudo entre tags JSX e valores de props
que viram texto na tela. Ignora comentario, nome de variavel, chave de
objeto, rota e classe CSS — foi trocando `/historico` por `/historico`
com acento que uma varredura anterior criou 404 de verdade.
"""
import io
import os
import re
import sys

# Palavra errada -> certa. So palavra inteira, sem prefixo ou sufixo.
DICIONARIO = {
    "nao": "não", "sao": "são", "tambem": "também", "voce": "você",
    "Voce": "Você", "ja": "já", "vao": "vão", "sera": "será",
    "possivel": "possível", "disponivel": "disponível", "proximo": "próximo",
    "Proximo": "Próximo", "proxima": "próxima", "Proxima": "Próxima",
    "preferencias": "preferências", "Preferencias": "Preferências",
    "preferencia": "preferência", "Versao": "Versão", "versao": "versão",
    "Descricao": "Descrição", "descricao": "descrição",
    "lancamento": "lançamento", "lancamentos": "lançamentos",
    "transferencias": "transferências", "transferencia": "transferência",
    "Restricoes": "Restrições", "restricoes": "restrições",
    "votacao": "votação", "Votacao": "Votação", "criacao": "criação",
    "comentario": "comentário", "comentarios": "comentários",
    "Saude": "Saúde", "acionavel": "acionável", "horarios": "horários",
    "horario": "horário", "Confianca": "Confiança", "confianca": "confiança",
    "Comeca": "Começa", "comeca": "começa", "precos": "preços",
    "preco": "preço", "historico": "histórico", "Historico": "Histórico",
    "codigo": "código", "codigos": "códigos", "usuario": "usuário",
    "usuarios": "usuários", "publico": "público", "publica": "pública",
    "Publico": "Público", "unico": "único", "unica": "única",
    "automatico": "automático", "automatica": "automática",
    "pagina": "página", "Pagina": "Página", "paginas": "páginas",
    "aereo": "aéreo", "aerea": "aérea", "orcamento": "orçamento",
    "Orcamento": "Orçamento", "duvida": "dúvida", "duvidas": "dúvidas",
    "endereco": "endereço", "enderecos": "endereços",
    "servico": "serviço", "servicos": "serviços", "opcao": "opção",
    "opcoes": "opções", "Opcoes": "Opções", "informacao": "informação",
    "informacoes": "informações", "confirmacao": "confirmação",
    "sugestao": "sugestão", "sugestoes": "sugestões", "decisao": "decisão",
    "decisoes": "decisões", "reuniao": "reunião", "atencao": "atenção",
    "Atencao": "Atenção", "duracao": "duração", "localizacao": "localização",
    "e-mails": "e-mails",
}

# Linha que e claramente codigo, nao texto de tela.
IGNORAR_LINHA = re.compile(
    r"^\s*(//|/\*|\*)"                       # comentario
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


def revisar(caminho):
    achados = []
    for numero, linha in enumerate(io.open(caminho, encoding="utf-8"), 1):
        if IGNORAR_LINHA.search(linha):
            continue

        trechos = []
        for padrao in VISIVEL:
            trechos += padrao.findall(linha)

        # Tambem string solta em portugues, que vira texto em quase todo caso.
        for aspas in re.findall(r'"([^"]{6,})"', linha) + re.findall(r"`([^`]{6,})`", linha):
            if " " in aspas and "/" not in aspas:
                trechos.append(aspas)

        for trecho in trechos:
            for palavra in re.findall(r"\b[A-Za-z][a-z-]+\b", trecho):
                if palavra in DICIONARIO:
                    achados.append((numero, palavra, DICIONARIO[palavra], trecho.strip()[:70]))
    return achados


def main():
    raiz = sys.argv[1] if len(sys.argv) > 1 else "."
    total = 0
    for pasta, _, arquivos in os.walk(raiz):
        if "node_modules" in pasta or ".next" in pasta:
            continue
        for arquivo in arquivos:
            if not arquivo.endswith(".tsx"):
                continue
            caminho = os.path.join(pasta, arquivo)
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
