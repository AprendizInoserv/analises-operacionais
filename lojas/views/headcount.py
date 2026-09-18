from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from usuarios.permissions import IsGestaoOrAdministrador
from unidecode import unidecode

from ..models import Loja
from colaboradores.models import Colaborador
from colaboradores.serializers import ColaboradorSerializer


class HeadcountPaginacao(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def headcount_analise_api(request):
    """
    Por que existe: Esta view calcula o headcount planejado vs. real das lojas físicas ativas.
    Ela obtém o quadro planejado diretamente do cadastro de cada loja (campo 'quadro' convertido para inteiro)
    e compara dinamicamente em tempo real com a quantidade de colaboradores ativos vinculados no TOTVS SRA
    (Sit. Folha vazia para lojas em geral, e Sit. Folha vazia + 'F' de férias para o cliente Atacadão).
    """
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models import Count
    from colaboradores.models import PresencaRelogio

    # 1. Carrega contagens agregadas em tempo real do TOTVS SRA
    # Ativos normais: status == "" ou None
    ativos_dados = (
        Colaborador.objects.filter(loja__isnull=False)
        .filter(Q(status="") | Q(status__isnull=True))
        .values("loja_id")
        .annotate(total=Count("id"))
    )
    ativos_map = {item["loja_id"]: item["total"] for item in ativos_dados}

    # Colaboradores em férias: status == "F" (relevante para lojas do Atacadão)
    ferias_dados = (
        Colaborador.objects.filter(loja__isnull=False, status="F")
        .values("loja_id")
        .annotate(total=Count("id"))
    )
    ferias_map = {item["loja_id"]: item["total"] for item in ferias_dados}

    # Carrega todas as lojas ativas
    lojas = Loja.objects.filter(status="ATIVA").order_by("nome_referencia")

    # Aplica busca textual se informada usando unidecode (para ser insensível a acentuações e case-insensitive)
    search_text = request.GET.get("busca", "").strip()
    if search_text:
        search_norm = unidecode(search_text).lower()
        lojas_filtradas = []
        for loja in lojas:
            nome_norm = unidecode(loja.nome_referencia or "").lower()
            cliente_norm = unidecode(loja.cliente or "").lower()
            cc_norm = unidecode(loja.centro_de_custo or "").lower()
            if (
                search_norm in nome_norm
                or search_norm in cliente_norm
                or search_norm in cc_norm
            ):
                lojas_filtradas.append(loja)
        lojas_list = lojas_filtradas
    else:
        lojas_list = list(lojas)

    # 2. Presenças do ponto eletrônico GeoVictoria do dia anterior
    local_today = timezone.localtime(timezone.now()).date()
    ontem = local_today - timedelta(days=1)

    presencas_ontem_dados = (
        PresencaRelogio.objects.filter(data=ontem)
        .values("loja_id")
        .annotate(count=Count("cpf_original", distinct=True))
    )
    presencas_ontem_map = {str(item["loja_id"]): item["count"] for item in presencas_ontem_dados if item["loja_id"]}

    # 3. Monta os resultados de todas as lojas calculando o headcount real dinamicamente
    resultado_completo = []
    total_planejado = 0
    total_real_acumulado = 0
    total_excedentes = 0

    for loja in lojas_list:
        quadro_planejado = 0
        try:
            quadro_planejado = int(float(str(loja.quadro).strip()))
        except (ValueError, TypeError):
            pass

        # Cálculo dinâmico do efetivo real:
        is_atacadao = "ATACADAO" in unidecode(loja.cliente or "").upper()
        real = ativos_map.get(loja.id, 0)
        if is_atacadao:
            real += ferias_map.get(loja.id, 0)

        # Se a loja não tem pessoas e nem quadro planejado, desconsidera da listagem operacional
        if real == 0 and quadro_planejado == 0:
            continue

        desvio = real - quadro_planejado

        total_planejado += quadro_planejado
        total_real_acumulado += real
        if desvio > 0:
            total_excedentes += desvio

        presencas_ontem = presencas_ontem_map.get(str(loja.id), 0)
        aderencia = 0.0
        if quadro_planejado > 0:
            aderencia = round((presencas_ontem / quadro_planejado) * 100, 1)

        resultado_completo.append({
            "loja_id": str(loja.id),
            "nome_referencia": loja.nome_referencia,
            "centro_de_custo": loja.centro_de_custo,
            "cliente": loja.cliente or "-",
            "is_atacadao": is_atacadao,
            "quadro_planejado": quadro_planejado,
            "headcount_real": real,
            "desvio": desvio,
            "presencas_ultimo_dia": presencas_ontem,
            "aderencia": aderencia,
            "geovictoria_sincronizado_em": loja.geovictoria_sincronizado_em.isoformat() if loja.geovictoria_sincronizado_em else None,
        })

    # Aplica ordenação com base no parâmetro 'ordenacao'
    ordenacao = request.GET.get("ordenacao", "").strip()
    if ordenacao == "presencas_desc":
        resultado_completo.sort(key=lambda x: x["presencas_ultimo_dia"], reverse=True)
    elif ordenacao == "presencas_asc":
        resultado_completo.sort(key=lambda x: x["presencas_ultimo_dia"])
    elif ordenacao == "desvio_desc":
        resultado_completo.sort(key=lambda x: x["desvio"], reverse=True)
    elif ordenacao == "desvio_asc":
        resultado_completo.sort(key=lambda x: x["desvio"])
    elif ordenacao == "aderencia_desc":
        resultado_completo.sort(key=lambda x: x["aderencia"], reverse=True)
    elif ordenacao == "aderencia_asc":
        resultado_completo.sort(key=lambda x: x["aderencia"])

    # Aplica a paginação de lojas sobre os resultados
    paginator = HeadcountPaginacao()
    page = paginator.paginate_queryset(resultado_completo, request)

    payload = {
        "kpis": {
            "total_planejado": total_planejado,
            "total_real": total_real_acumulado,
            "total_excedentes": total_excedentes,
            "total_lojas": len(resultado_completo),
        },
        "resultados": page if page is not None else resultado_completo,
    }

    if page is not None:
        return paginator.get_paginated_response(payload)
    return Response(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def headcount_loja_colaboradores_api(request, loja_id):
    """
    Por que existe: Retorna nominalmente a lista de colaboradores associados à loja no TOTVS SRA que
    estão contabilizados na contagem de headcount (ativos normais ou férias se for Atacadão).
    Permite auditar diretamente na tela quem são os funcionários alocados na filial.
    """
    loja = get_object_or_404(Loja, pk=loja_id)
    is_atacadao = "ATACADAO" in unidecode(loja.cliente or "").upper()

    q_filtro = Q(loja=loja)
    if is_atacadao:
        q_filtro &= (Q(status="") | Q(status__isnull=True) | Q(status="F"))
    else:
        q_filtro &= (Q(status="") | Q(status__isnull=True))

    colabs_filtrados = Colaborador.objects.filter(q_filtro).order_by("nome")
    serializer = ColaboradorSerializer(colabs_filtrados, many=True)
    return Response(serializer.data)
