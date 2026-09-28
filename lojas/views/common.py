"""
Funções auxiliares compartilhadas entre views (competência, query string, etc.).
"""

from django.db import transaction
from ..models import EscopoMensal, ItemEscopoMensal


def competencia_anterior(ano, mes):
    """
    Retorna (ano, mes) da competência anterior.
    Ex.: 2026/1 -> 2025/12
    """
    if mes == 1:
        return ano - 1, 12
    return ano, mes - 1


def replicar_do_mes_anterior_se_existir(escopo_mensal):
    """
    Regra de negócio:
    quando abrir um novo mês e não houver itens preenchidos ainda,
    copiamos o mês anterior para acelerar operação.
    """
    ano_anterior, mes_anterior = competencia_anterior(
        escopo_mensal.ano,
        escopo_mensal.mes,
    )
    escopo_anterior = (
        EscopoMensal.objects.filter(
            loja=escopo_mensal.loja,
            ano=ano_anterior,
            mes=mes_anterior,
        )
        .prefetch_related("itens")
        .first()
    )
    if not escopo_anterior:
        return False

    itens_para_criar = []
    for item_anterior in escopo_anterior.itens.all():
        itens_para_criar.append(
            ItemEscopoMensal(
                escopo_mensal=escopo_mensal,
                cargo=item_anterior.cargo,
                turno=item_anterior.turno,
                quantidade=item_anterior.quantidade,
                dsr_valor_fixo=item_anterior.dsr_valor_fixo,
            )
        )
    if itens_para_criar:
        ItemEscopoMensal.objects.bulk_create(itens_para_criar)
    if escopo_anterior.dsr_valor_fixo and (not escopo_mensal.dsr_valor_fixo or escopo_mensal.dsr_valor_fixo == Decimal("0.00")):
        escopo_mensal.dsr_valor_fixo = escopo_anterior.dsr_valor_fixo
        escopo_mensal.save(update_fields=["dsr_valor_fixo"])
    return True


def parse_int_param(value, min_value=None, max_value=None):
    """Lê inteiro da query string; retorna None se inválido ou vazio."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    try:
        n = int(text)
    except ValueError:
        return None
    if min_value is not None and n < min_value:
        return None
    if max_value is not None and n > max_value:
        return None
    return n


def competencia_seguinte(ano, mes):
    """Mês seguinte à competência (ano, mês)."""
    if mes == 12:
        return ano + 1, 1
    return ano, mes + 1


def escopo_obter_ultima_competencia_global():
    """
    Último (ano, mês) que existe em algum escopo (ordenação ano/mês desc).
    Retorna None se não houver nenhum escopo.
    """
    ultimo = EscopoMensal.objects.order_by("-ano", "-mes").first()
    if ultimo is None:
        return None
    return ultimo.ano, ultimo.mes


def escopo_duplicar_proximo_mes_para_todas_as_lojas():
    """
    Para cada loja que tem escopo no último mês global, cria o escopo do mês seguinte
    e copia os itens do mês anterior via replicar_do_mes_anterior_se_existir.
    Insalubridade segue na configuração da loja (não no escopo mensal).
    Retorna dict com contadores para mensagens na view.
    """
    origem = escopo_obter_ultima_competencia_global()
    if origem is None:
        return {
            "ok": False,
            "mensagem": "Não há nenhum escopo cadastrado.",
            "criados": 0,
            "pulados_ja_existia_destino": 0,
            "origem": None,
            "destino": None,
        }
    ano_o, mes_o = origem
    ano_d, mes_d = competencia_seguinte(ano_o, mes_o)
    escopos_origem = EscopoMensal.objects.filter(ano=ano_o, mes=mes_o).select_related(
        "loja"
    )
    criados = 0
    pulados_ja_existia_destino = 0
    with transaction.atomic():
        for esc_orig in escopos_origem:
            loja = esc_orig.loja
            if EscopoMensal.objects.filter(loja=loja, ano=ano_d, mes=mes_d).exists():
                pulados_ja_existia_destino += 1
                continue
            novo = EscopoMensal.objects.create(
                loja=loja,
                ano=ano_d,
                mes=mes_d,
                dsr_valor_fixo=esc_orig.dsr_valor_fixo,
            )
            # Copia do mês anterior ao destino (= origem que já sabemos existir para esta loja)
            replicar_do_mes_anterior_se_existir(novo)
            criados += 1
    return {
        "ok": True,
        "mensagem": (
            f"Origem {mes_o:02d}/{ano_o} → destino {mes_d:02d}/{ano_d}. "
            f"Criados: {criados}. Já existiam no destino: {pulados_ja_existia_destino}."
        ),
        "criados": criados,
        "pulados_ja_existia_destino": pulados_ja_existia_destino,
        "origem": (ano_o, mes_o),
        "destino": (ano_d, mes_d),
    }
