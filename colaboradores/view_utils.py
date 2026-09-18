


def derive_termino_state(colaborador, reference_date, controles=None):
    """
    Define o estado do término de experiência do colaborador.
    Existe para centralizar as regras de negócio de vencimento contratual em um único ponto,
    evitando duplicação nas views e facilitando a manutenção do código.
    Ele analisa as decisões salvas no histórico para determinar se o contrato foi encerrado
    (efetivado ou demitido) ou prorrogado para a segunda etapa.
    """
    if controles is None:
        controles = list(colaborador.controles_termino.all())

    latest_first = next((controle for controle in controles if controle.etapa == 1), None)
    latest_second = next((controle for controle in controles if controle.etapa == 2), None)
    first_term_passed = colaborador.termino_1 and colaborador.termino_1 < reference_date
    second_term_passed = colaborador.termino_2 and colaborador.termino_2 < reference_date

    # 1. Se a última decisão da etapa 1 for término ou manter (Efetivado), o processo encerra na etapa 1.
    # Isto também garante que, se houver alteração retroativa da etapa 1, a etapa 2 seja ignorada.
    if latest_first and latest_first.acao == "termino":
        return {
            "etapaAtual": 1,
            "tipoTermino": "1º Término",
            "statusControle": "Término registrado",
            "encerrado": True,
            "ultimaAcao": latest_first.acao,
        }

    if latest_first and latest_first.acao == "manter":
        return {
            "etapaAtual": 1,
            "tipoTermino": "1º Término",
            "statusControle": "Mantido",
            "encerrado": True,
            "ultimaAcao": latest_first.acao,
        }

    # 2. Se a etapa 1 não encerrou o contrato, avalia as decisões registradas na etapa 2.
    if latest_second and latest_second.acao == "termino":
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Término registrado",
            "encerrado": True,
            "ultimaAcao": latest_second.acao,
        }

    if latest_second and latest_second.acao == "manter":
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Mantido",
            "encerrado": True,
            "ultimaAcao": latest_second.acao,
        }

    # 3. Se foi prorrogado na etapa 1, está na etapa 2 (mas ainda sem decisão para a etapa 2).
    # Caso a data do segundo término tenha passado da data de referência, ele fica com status "Atrasado".
    if latest_first and latest_first.acao == "prorrogado":
        if second_term_passed:
            return {
                "etapaAtual": 2,
                "tipoTermino": "2º Término",
                "statusControle": "Atrasado",
                "encerrado": False,
                "ultimaAcao": latest_first.acao,
            }
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Prorrogado",
            "encerrado": False,
            "ultimaAcao": latest_first.acao,
        }

    # 4. Se a data do primeiro prazo passou e não houve decisão, assume que está na etapa 2.
    # Caso a data do segundo término também já tenha passado, o status será "Atrasado".
    if first_term_passed:
        if second_term_passed:
            return {
                "etapaAtual": 2,
                "tipoTermino": "2º Término",
                "statusControle": "Atrasado",
                "encerrado": False,
                "ultimaAcao": None,
            }
        return {
            "etapaAtual": 2,
            "tipoTermino": "2º Término",
            "statusControle": "Pendente 2º Término",
            "encerrado": False,
            "ultimaAcao": None,
        }

    # 5. Caso contrário, ainda está pendente de decisão da etapa 1.
    return {
        "etapaAtual": 1,
        "tipoTermino": "1º Término",
        "statusControle": "Pendente 1º Término",
        "encerrado": False,
        "ultimaAcao": None,
    }
