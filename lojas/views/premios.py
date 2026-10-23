import datetime
from io import BytesIO
import pandas as pd
from django.http import HttpResponse
from django.db.models import Sum, Count, Q
from operator import or_
from functools import reduce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from usuarios.permissions import IsAdministrador
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from lojas.models import Premio, Loja, Coordenador
from lojas.serializers import PremioSerializer

class PremioPaginacao(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

def _filtrar_premios_queryset(request):
    """
    Aplica os filtros de requisição HTTP sobre o queryset de Prêmios,
    otimizando os relacionamentos com Loja, Coordenador e Supervisor,
    e excluindo lojas inativas.
    """
    queryset = (
        Premio.objects.all()
        .select_related("loja", "coordenador", "supervisor")
        .exclude(loja__status="INATIVA")
    )
    params = getattr(request, "query_params", request.GET)

    # Filtro de Período (separado por vírgula, ex: 202605)
    periodo_val = params.get("period")
    if periodo_val:
        periodos = [p.strip() for p in periodo_val.split(",") if p.strip()]
        if periodos:
            queryset = queryset.filter(period__in=periodos)

    # Filtro de Loja Física
    loja_val = params.get("loja")
    if loja_val:
        lojas_ids = [l.strip() for l in loja_val.split(",") if l.strip()]
        if lojas_ids:
            has_null = "null" in lojas_ids
            vals = [int(l) for l in lojas_ids if l != "null" and l.isdigit()]
            q_obj = Q()
            if vals:
                q_obj = Q(loja_id__in=vals)
            if has_null:
                q_obj = q_obj | Q(loja_id__isnull=True)
            queryset = queryset.filter(q_obj)

    # Filtro de Status
    status_val = params.get("status")
    if status_val:
        status_list = [s.strip().upper() for s in status_val.split(",") if s.strip()]
        if status_list:
            queryset = queryset.filter(status__in=status_list)

    # Filtro de Tipo de Prêmio (verb_name)
    verb_val = params.get("verb_name")
    if verb_val:
        verbs = [v.strip() for v in verb_val.split(",") if v.strip()]
        if verbs:
            queryset = queryset.filter(verb_name__in=verbs)

    # Filtro de Supervisor do Prêmio
    supervisor_val = params.get("supervisor")
    if supervisor_val:
        supervisores = [s.strip() for s in supervisor_val.split(",") if s.strip()]
        if supervisores:
            has_null = "null" in supervisores
            vals = [s for s in supervisores if s != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(supervisor__nome__in=vals)
            if has_null:
                q_obj = q_obj | Q(supervisor__isnull=True)
            queryset = queryset.filter(q_obj)

    # Filtro de Coordenador do Prêmio
    coordenador_val = params.get("coordenador")
    if coordenador_val:
        coordenadores = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        if coordenadores:
            has_null = "null" in coordenadores
            vals = [c for c in coordenadores if c != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(coordenador__nome__in=vals)
            if has_null:
                q_obj = q_obj | Q(coordenador__isnull=True)
            queryset = queryset.filter(q_obj)

    # Filtro de UF do Prêmio
    uf_val = params.get("uf")
    if uf_val:
        ufs = [u.strip().upper() for u in uf_val.split(",") if u.strip()]
        if ufs:
            has_null = "NULL" in ufs
            vals = [u for u in ufs if u != "NULL"]
            q_obj = Q()
            if vals:
                q_obj = Q(uf__in=vals)
            if has_null:
                q_obj = q_obj | Q(uf__isnull=True) | Q(uf="")
            queryset = queryset.filter(q_obj)

    # Filtro de Tipo de Pedido (order_type: SISTEMA, MANUAL)
    order_type_val = params.get("order_type")
    if order_type_val:
        order_types = [ot.strip().upper() for ot in order_type_val.split(",") if ot.strip()]
        if order_types:
            queryset = queryset.filter(order_type__in=order_types)

    # Filtro de Roteiro (roteiro: FOLHA, VEX)
    roteiro_val = params.get("roteiro")
    if roteiro_val:
        roteiros = [r.strip().upper() for r in roteiro_val.split(",") if r.strip()]
        if roteiros:
            queryset = queryset.filter(roteiro__in=roteiros)

    # Busca livre (centro de custo ou tipo de prêmio)
    search_query = params.get("search")
    if search_query:
        queryset = queryset.filter(
            cost_center_name__icontains=search_query
        ) | queryset.filter(
            verb_name__icontains=search_query
        )

    return queryset

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def premios_list_api(request):
    """
    Retorna a listagem detalhada de prêmios com suporte a filtros e paginação,
    além de agregar estatísticas e dados estruturados para renderização de gráficos do BI.

    Docstring explicativa: Esta view realiza a consulta de prêmios no banco de dados,
    aplica os filtros dinâmicos selecionados pelo usuário no frontend (período, loja, UF,
    supervisor, coordenador, status, tipo de prêmio, roteiro e tipo de pedido) e
    calcula as métricas financeiras consolidadas (Valor Gasto, Quantidade e Preço Médio).
    """
    queryset = _filtrar_premios_queryset(request)

    # 1. Cálculo de KPIs
    # Quantidade total de solicitações
    total_solicitacoes = queryset.count()

    # Valor Gasto: Apenas prêmios com status 'PAGO' ou 'APROVADO'
    soma_valores = queryset.filter(
        status__in=["PAGO", "APROVADO"]
    ).aggregate(soma=Sum("reward_value"))["soma"] or 0.0
    soma_valores = float(soma_valores)

    # Contagem de prêmios pagos/aprovados para calcular a média
    count_pagos = queryset.filter(status__in=["PAGO", "APROVADO"]).count()
    preco_medio = soma_valores / count_pagos if count_pagos > 0 else 0.0

    # 2. Distribuição Mensal (Gráfico de Evolução)
    if coordenador_val:
        coordenadores_list_filter = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        vals_coordenadores = [c for c in coordenadores_list_filter if c != "null"]
        coordenadores_qs = Coordenador.objects.filter(nome__in=vals_coordenadores)
    else:
        if not (loja_val or supervisor_val or coordenador_val):
            coordenadores_qs = Coordenador.objects.all()
        else:
            coordenadores_ids = queryset.exclude(coordenador__isnull=True).values_list("coordenador_id", flat=True).distinct()
            coordenadores_qs = Coordenador.objects.filter(id__in=coordenadores_ids)

    orcamento_premios_total = float(coordenadores_qs.aggregate(total=Sum("orcamento_premios"))["total"] or 0.0)

    dist_mensal = (
        queryset.values("period")
        .annotate(total=Sum("reward_value"), quantidade=Count("id"))
        .order_by("period")
    )
    dados_grafico_linha = []
    for item in dist_mensal:
        p = item["period"]
        # Formata '202605' para '05/2026'
        label = f"{p[4:6]}/{p[0:4]}" if len(p) == 6 else p
        dados_grafico_linha.append({
            "mes": label,
            "faturamento": float(item["total"] or 0),
            "quantidade": item["quantidade"],
            "orcamento": orcamento_premios_total
        })

    # 3. Distribuição por Status
    dist_status = (
        queryset.values("status")
        .annotate(quantidade=Count("id"), total=Sum("reward_value"))
        .order_by("-quantidade")
    )
    dados_grafico_status = [
        {
            "status": item["status"],
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_status
    ]

    # 4. Distribuição por Tipo de Pedido (SISTEMA vs MANUAL)
    dist_order_type = (
        queryset.values("order_type")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-quantidade")
    )
    dados_grafico_order_type = [
        {
            "order_type": item["order_type"] if item["order_type"] else "N/D",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_order_type
    ]

    # Subdivisão de pedidos manuais por roteiro para o relatório mensal.
    # Por que existe: Permite auditar quantos prêmios manuais foram lançados via VEX ou via FOLHA.
    manual_queryset = queryset.filter(order_type="MANUAL")
    dist_manual_roteiro = (
        manual_queryset.values("roteiro")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-quantidade")
    )
    dados_resumo_manual = [
        {
            "roteiro": item["roteiro"] if item["roteiro"] else "N/D",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_manual_roteiro
    ]

    # 5. Distribuição por Roteiro (FOLHA vs VEX)
    dist_roteiro = (
        queryset.values("roteiro")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-quantidade")
    )
    dados_grafico_roteiro = [
        {
            "roteiro": item["roteiro"] if item["roteiro"] else "N/D",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_roteiro
    ]

    # 6. Distribuição por UF (Região)
    dist_uf = (
        queryset.values("uf")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-total")
    )
    dados_grafico_uf = [
        {
            "uf": item["uf"] if item["uf"] else "N/A",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_uf
    ]

    # 7. Distribuição por Coordenador
    # Por que existe: Segmenta o valor total de prêmios pagos/aprovados de cada coordenador
    # em valores originados de pedidos automáticos do SISTEMA e pedidos lançados de forma MANUAL.
    dist_coord = (
        queryset.values("coordenador__nome")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"])),
            total_sistema=Sum(
                "reward_value",
                filter=Q(status__in=["PAGO", "APROVADO"], order_type="SISTEMA")
            ),
            total_manual=Sum(
                "reward_value",
                filter=Q(status__in=["PAGO", "APROVADO"], order_type="MANUAL")
            )
        )
        .order_by("-total")
    )
    dados_grafico_coordenador = [
        {
            "coordenador": item["coordenador__nome"] if item["coordenador__nome"] else "N/A",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0),
            "total_sistema": float(item["total_sistema"] or 0),
            "total_manual": float(item["total_manual"] or 0)
        } for item in dist_coord
    ]

    # 8. Top 10 Lojas com maiores gastos
    dist_loja = (
        queryset.filter(loja__isnull=False)
        .values("loja__nome_referencia")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-total")[:10]
    )
    dados_grafico_loja = [
        {
            "loja": item["loja__nome_referencia"],
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_loja
    ]

    # 9. Distribuição por Tipo de Prêmio (verb_name)
    # Por que existe: Consolida os valores totais gastos e a quantidade para cada tipo de prêmio para apresentar no painel do BI do frontend.
    dist_tipo_premio = (
        queryset.values("verb_name")
        .annotate(
            quantidade=Count("id"),
            total=Sum("reward_value", filter=Q(status__in=["PAGO", "APROVADO"]))
        )
        .order_by("-total")
    )
    dados_grafico_tipo_premio = [
        {
            "tipo": item["verb_name"] if item["verb_name"] else "N/A",
            "quantidade": item["quantidade"],
            "total": float(item["total"] or 0)
        } for item in dist_tipo_premio
    ]

    # Paginação dos resultados da tabela detalhada
    paginator = PremioPaginacao()
    page = paginator.paginate_queryset(queryset, request)
    serializer = PremioSerializer(page, many=True)

    return paginator.get_paginated_response({
        "kpis": {
            "valor_total": soma_valores,
            "quantidade_total": total_solicitacoes,
            "preco_medio": preco_medio
        },
        "graficos": {
            "mensal": dados_grafico_linha,
            "status": dados_grafico_status,
            "order_type": dados_grafico_order_type,
            "roteiro": dados_grafico_roteiro,
            "uf": dados_grafico_uf,
            "coordenador": dados_grafico_coordenador,
            "lojas": dados_grafico_loja,
            "tipo_premio": dados_grafico_tipo_premio
        },
        "resumo_manual": dados_resumo_manual,
        "resultados": serializer.data
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def premios_filtro_opcoes_api(request):
    """
    Retorna as opções de preenchimento para os filtros de prêmios.

    Docstring explicativa: Este endpoint serve para carregar as opções de filtros
    (tipo de prêmio, status, supervisores, coordenadores, ufs, tipo de pedido, roteiro e períodos)
    disponíveis no banco de dados para popular os seletores no menu lateral do dashboard.
    """
    # Tipos de prêmio únicos (verb_name)
    verb_names = Premio.objects.values_list("verb_name", flat=True).distinct().order_by("verb_name")
    verb_names_list = sorted(list(set(v.strip() for v in verb_names if v and v.strip())))

    # Status únicos
    status_opcoes = Premio.objects.values_list("status", flat=True).distinct().order_by("status")
    status_list = sorted(list(set(s.strip().upper() for s in status_opcoes if s and s.strip())))

    # Tipos de Pedido únicos
    order_types = Premio.objects.values_list("order_type", flat=True).distinct().order_by("order_type")
    order_types_list = sorted(list(set(o.strip().upper() for o in order_types if o and o.strip())))

    # Roteiros únicos
    roteiros = Premio.objects.values_list("roteiro", flat=True).distinct().order_by("roteiro")
    roteiros_list = sorted(list(set(r.strip().upper() for r in roteiros if r and r.strip())))

    # Filtros do próprio prêmio
    supervisores = Premio.objects.filter(supervisor__isnull=False).exclude(loja__status="INATIVA").values_list("supervisor__nome", flat=True).distinct()
    supervisores_list = sorted(list(set(s.strip() for s in supervisores if s and s.strip())))
    has_null_supervisor = Premio.objects.filter(supervisor__isnull=True).exists()
    if has_null_supervisor:
        supervisores_list.append("null")

    coordenadores = Premio.objects.filter(coordenador__isnull=False).exclude(loja__status="INATIVA").values_list("coordenador__nome", flat=True).distinct()
    coordenadores_list = sorted(list(set(c.strip() for c in coordenadores if c and c.strip())))
    has_null_coordenador = Premio.objects.filter(coordenador__isnull=True).exists()
    if has_null_coordenador:
        coordenadores_list.append("null")

    ufs = Premio.objects.filter(uf__isnull=False).exclude(uf="").exclude(loja__status="INATIVA").values_list("uf", flat=True).distinct()
    ufs_list = sorted(list(set(u.strip().upper() for u in ufs if u and u.strip())))
    has_null_uf = Premio.objects.filter(Q(uf__isnull=True) | Q(uf="")).exists()
    if has_null_uf:
        ufs_list.append("null")

    # Mapeia as lojas associadas (excluindo inativas)
    lojas_ids = Premio.objects.filter(loja__isnull=False).exclude(loja__status="INATIVA").values_list("loja_id", flat=True).distinct()
    lojas = Loja.objects.filter(id__in=lojas_ids).exclude(status="INATIVA").values("id", "nome_referencia")
    lojas_lista = [{"value": str(l["id"]), "label": l["nome_referencia"]} for l in lojas]
    has_null_loja = Premio.objects.filter(loja__isnull=True).exists()
    if has_null_loja:
        lojas_lista.append({"value": "null", "label": "(Sem Loja)"})

    # Mapeia períodos e formata labels
    periodos = Premio.objects.values_list("period", flat=True).distinct().order_by("-period")
    periodos_lista = []
    for p in periodos:
        label = f"{p[4:6]}/{p[0:4]}" if len(p) == 6 else p
        periodos_lista.append({
            "value": p,
            "label": label
        })

    return Response({
        "verb_names": verb_names_list,
        "status": status_list,
        "order_types": order_types_list,
        "roteiros": roteiros_list,
        "supervisores": supervisores_list,
        "coordenadores": coordenadores_list,
        "ufs": ufs_list,
        "lojas": lojas_lista,
        "periodos": periodos_lista
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def premios_exportar_excel(request):
    """
    Exporta a listagem completa de solicitações de prêmios respeitando os filtros aplicados
    para um arquivo Excel (.xlsx).
    
    Colunas incluídas:
    ID | Tipo de Prêmio | Centro de Custo | Loja | Coordenador | Supervisor | UF | Período | Origem | Roteiro | Valor (R$) | Status
    """
    queryset = _filtrar_premios_queryset(request).order_by("-period", "id")

    linhas_excel = []
    for item in queryset:
        loja_nome = item.loja.nome_referencia if item.loja else "Não vinculada"
        coord_nome = item.coordenador.nome if item.coordenador else (item.loja.coordenador.nome if (item.loja and item.loja.coordenador) else "-")
        sup_nome = item.supervisor.nome if item.supervisor else (item.loja.supervisor.nome if (item.loja and item.loja.supervisor) else "-")

        periodo_fmt = item.period
        if periodo_fmt and len(periodo_fmt) == 6:
            periodo_fmt = f"{periodo_fmt[4:6]}/{periodo_fmt[0:4]}"

        linhas_excel.append({
            "ID": str(item.id),
            "Tipo de Prêmio": item.verb_name,
            "Centro de Custo": item.cost_center_name,
            "Loja": loja_nome,
            "Coordenador": coord_nome,
            "Supervisor": sup_nome,
            "UF": item.uf or "",
            "Período": periodo_fmt,
            "Origem": item.order_type,
            "Roteiro": item.roteiro,
            "Valor (R$)": float(item.reward_value) if item.reward_value is not None else 0.0,
            "Status": item.status,
        })

    df = pd.DataFrame(linhas_excel)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Prêmios")
        worksheet = writer.sheets["Prêmios"]
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buffer.seek(0)
    data_hoje = datetime.date.today().strftime("%d_%m_%Y")
    filename = f"premios_{data_hoje}.xlsx"

    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


