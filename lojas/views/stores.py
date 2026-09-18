from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from usuarios.permissions import IsGestaoOrAdministrador
from rest_framework.pagination import PageNumberPagination
from unidecode import unidecode

from ..models import Loja, STATUS_CHOICES, obter_ou_criar_config_insalubridade_loja, Coordenador, Supervisor
from ..serializers import LojaSerializer, CoordenadorSerializer, SupervisorSerializer

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_list(request):
    """
    Retorna a lista paginada e filtrada de lojas.
    Utiliza a paginação nativa do Django REST Framework.
    """
    stores = Loja.objects.all().order_by("nome_referencia")

    search_text = request.GET.get("busca", "").strip()
    client_name = request.GET.get("cliente", "").strip()
    panel_name = request.GET.get("quadro", "").strip()
    status_value = request.GET.get("status", "").strip()
    cost_center = request.GET.get("centro_de_custo", "").strip()
    store_code = request.GET.get("codigo_loja", "").strip()
    supervisor_val = request.GET.get("supervisor", "").strip()
    coordenador_val = request.GET.get("coordenador", "").strip()

    if search_text:
        # Por que existe: Permite buscar lojas por qualquer um dos nomes cadastrados (referencia, totvs, gestao ou geovictoria)
        # através de uma busca de texto livre parcial e insensível a maiúsculas/minúsculas.
        q_obj = (
            Q(nome_referencia__icontains=search_text) |
            Q(nome_totvs__icontains=search_text) |
            Q(nome_geovictoria__icontains=search_text)
        )
        stores = stores.filter(q_obj)

    if client_name:
        cliente_list = [c.strip() for c in client_name.split(",") if c.strip()]
        if cliente_list:
            has_null = "null" in cliente_list
            vals = [c for c in cliente_list if c != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(cliente__in=vals)
            if has_null:
                q_obj = q_obj | Q(cliente__isnull=True) | Q(cliente="")
            stores = stores.filter(q_obj)

    if panel_name:
        stores = stores.filter(quadro=panel_name)

    if status_value:
        status_list = [s.strip() for s in status_value.split(",") if s.strip()]
        if status_list:
            has_null = "null" in status_list
            vals = [s for s in status_list if s != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(status__in=vals)
            if has_null:
                q_obj = q_obj | Q(status__isnull=True) | Q(status="")
            stores = stores.filter(q_obj)

    if cost_center:
        cc_list = [cc.strip() for cc in cost_center.split(",") if cc.strip()]
        if cc_list:
            has_null = "null" in cc_list
            vals = [cc for cc in cc_list if cc != "null"]
            q_obj = Q()
            if vals:
                q_obj = Q(centro_de_custo__in=vals)
            if has_null:
                q_obj = q_obj | Q(centro_de_custo__isnull=True) | Q(centro_de_custo="")
            stores = stores.filter(q_obj)

    if supervisor_val:
        supervisor_list = [s.strip() for s in supervisor_val.split(",") if s.strip()]
        if supervisor_list:
            has_null = "null" in supervisor_list
            vals = [int(s) for s in supervisor_list if s != "null" and s.isdigit()]
            q_obj = Q()
            if vals:
                q_obj = Q(supervisor_id__in=vals)
            if has_null:
                q_obj = q_obj | Q(supervisor__isnull=True)
            stores = stores.filter(q_obj)

    if coordenador_val:
        coordenador_list = [c.strip() for c in coordenador_val.split(",") if c.strip()]
        if coordenador_list:
            has_null = "null" in coordenador_list
            vals = [int(c) for c in coordenador_list if c != "null" and c.isdigit()]
            q_obj = Q()
            if vals:
                q_obj = Q(coordenador_id__in=vals)
            if has_null:
                q_obj = q_obj | Q(coordenador__isnull=True)
            stores = stores.filter(q_obj)

    if store_code:
        code_list = [c.strip() for c in store_code.split(",") if c.strip()]
        if code_list:
            has_null = "null" in code_list
            vals = []
            for c in code_list:
                if c != "null" and c.isdigit():
                    vals.append(int(c))
            q_obj = Q()
            if vals:
                q_obj = Q(codigo_loja__in=vals)
            if has_null:
                q_obj = q_obj | Q(codigo_loja__isnull=True)
            stores = stores.filter(q_obj)

    if request.GET.get("sem_paginacao", "").strip().lower() in ("true", "1", "yes", "t"):
        serializer = LojaSerializer(stores, many=True)
        return Response(serializer.data)

    paginator = PageNumberPagination()
    paginator.page_size = 25
    page = paginator.paginate_queryset(stores, request)
    if page is not None:
        serializer = LojaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = LojaSerializer(stores, many=True)
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_detail(request, pk):
    """
    Retorna os detalhes JSON de uma loja específica identificada pela chave primária (PK).
    Substitui a renderização do template loja_detail.html.
    """
    store = get_object_or_404(Loja, pk=pk)
    serializer = LojaSerializer(store)
    return Response({"loja": serializer.data})

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_create(request):
    """
    Cadastra uma nova loja no banco de dados a partir de dados JSON enviados pelo frontend.
    Após a validação e salvamento bem-sucedido, garante a criação da configuração de insalubridade padrão.
    """
    serializer = LojaSerializer(data=request.data)
    if serializer.is_valid():
        store = serializer.save()
        # Garante que os registros padrão de insalubridade baseados na UF da loja sejam criados.
        obter_ou_criar_config_insalubridade_loja(store)
        return Response({
            "success": True,
            "message": "Loja cadastrada com sucesso.",
            "loja": LojaSerializer(store).data
        }, status=status.HTTP_201_CREATED)
    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(["PUT", "PATCH"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_update(request, pk):
    """
    Atualiza as informações de uma loja existente identificada pela chave primária (PK).
    Aceita requisições PUT (atualização total) ou PATCH (atualização parcial) com dados JSON.
    """
    store = get_object_or_404(Loja, pk=pk)
    serializer = LojaSerializer(store, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response({
            "success": True,
            "message": "Loja atualizada com sucesso.",
            "loja": serializer.data
        })
    return Response({
        "success": False,
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_delete(request, pk):
    """
    Exclui uma loja específica identificada por PK.
    Esta view lida com a confirmação de exclusão pela API de forma direta.
    """
    store = get_object_or_404(Loja, pk=pk)
    store_name = store.nome_referencia
    store.delete()
    return Response({
        "success": True,
        "message": f"Loja '{store_name}' excluída com sucesso."
    })


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def coordenador_list_create(request):
    """
    Lista todos os coordenadores cadastrados (GET) ou cria um novo coordenador (POST)
    recebendo as informações do formulário/modal do frontend.
    """
    if request.method == "POST":
        serializer = CoordenadorSerializer(data=request.data)
        if serializer.is_valid():
            coord = serializer.save()
            return Response(CoordenadorSerializer(coord).data, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    coordenadores = Coordenador.objects.all().order_by("nome")
    serializer = CoordenadorSerializer(coordenadores, many=True)
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def supervisor_list_create(request):
    """
    Lista todos os supervisores cadastrados (GET) ou cria um novo supervisor (POST)
    recebendo as informações do formulário/modal do frontend.
    """
    if request.method == "POST":
        serializer = SupervisorSerializer(data=request.data)
        if serializer.is_valid():
            sup = serializer.save()
            return Response(SupervisorSerializer(sup).data, status=status.HTTP_201_CREATED)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    supervisores = Supervisor.objects.all().order_by("nome")
    serializer = SupervisorSerializer(supervisores, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def store_filtro_opcoes(request):
    """
    Retorna as opções de filtro para lojas (nome de referência, cliente, centro de custo, status, supervisor, coordenador e código).
    Este endpoint resolve as opções de forma reativa e independente (estilo Excel),
    onde o cálculo para cada campo ignora a seleção do próprio campo.
    """
    busca_val = request.GET.get("busca", "").strip()
    cliente_val = request.GET.get("cliente", "").strip()
    status_val = request.GET.get("status", "").strip()
    cc_val = request.GET.get("centro_de_custo", "").strip()
    supervisor_val = request.GET.get("supervisor", "").strip()
    coordenador_val = request.GET.get("coordenador", "").strip()
    store_code_val = request.GET.get("codigo_loja", "").strip()

    # Função auxiliar para aplicar filtros nas consultas de opções
    def filtrar(qs, ignore_busca=False, ignore_cliente=False, ignore_status=False, ignore_cc=False, ignore_supervisor=False, ignore_coordenador=False, ignore_codigo=False):
        if busca_val and not ignore_busca:
            # Por que existe: Aplica o filtro de busca flexível por texto livre ao carregar as opções dinâmicas
            # dos filtros adicionais da tela de lojas (excel-like).
            q_obj = (
                Q(nome_referencia__icontains=busca_val) |
                Q(nome_totvs__icontains=busca_val) |
                Q(nome_geovictoria__icontains=busca_val)
            )
            qs = qs.filter(q_obj)
        if cliente_val and not ignore_cliente:
            cl = [c.strip() for c in cliente_val.split(",") if c.strip()]
            if cl:
                has_null = "null" in cl
                vals = [c for c in cl if c != "null"]
                q_obj = Q()
                if vals:
                    q_obj = Q(cliente__in=vals)
                if has_null:
                    q_obj = q_obj | Q(cliente__isnull=True) | Q(cliente="")
                qs = qs.filter(q_obj)
        if status_val and not ignore_status:
            sl = [s.strip() for s in status_val.split(",") if s.strip()]
            if sl:
                has_null = "null" in sl
                vals = [s for s in sl if s != "null"]
                q_obj = Q()
                if vals:
                    q_obj = Q(status__in=vals)
                if has_null:
                    q_obj = q_obj | Q(status__isnull=True) | Q(status="")
                qs = qs.filter(q_obj)
        if cc_val and not ignore_cc:
            ccl = [c.strip() for c in cc_val.split(",") if c.strip()]
            if ccl:
                has_null = "null" in ccl
                vals = [c for c in ccl if c != "null"]
                q_obj = Q()
                if vals:
                    q_obj = Q(centro_de_custo__in=vals)
                if has_null:
                    q_obj = q_obj | Q(centro_de_custo__isnull=True) | Q(centro_de_custo="")
                qs = qs.filter(q_obj)
        if supervisor_val and not ignore_supervisor:
            svl = [s.strip() for s in supervisor_val.split(",") if s.strip()]
            if svl:
                has_null = "null" in svl
                vals = [int(s) for s in svl if s != "null" and s.isdigit()]
                q_obj = Q()
                if vals:
                    q_obj = Q(supervisor_id__in=vals)
                if has_null:
                    q_obj = q_obj | Q(supervisor__isnull=True)
                qs = qs.filter(q_obj)
        if coordenador_val and not ignore_coordenador:
            cvl = [c.strip() for c in coordenador_val.split(",") if c.strip()]
            if cvl:
                has_null = "null" in cvl
                vals = [int(c) for c in cvl if c != "null" and c.isdigit()]
                q_obj = Q()
                if vals:
                    q_obj = Q(coordenador_id__in=vals)
                if has_null:
                    q_obj = q_obj | Q(coordenador__isnull=True)
                qs = qs.filter(q_obj)
        if store_code_val and not ignore_codigo:
            codel = [c.strip() for c in store_code_val.split(",") if c.strip()]
            if codel:
                has_null = "null" in codel
                vals = []
                for c in codel:
                    if c != "null" and c.isdigit():
                        vals.append(int(c))
                q_obj = Q()
                if vals:
                    q_obj = Q(codigo_loja__in=vals)
                if has_null:
                    q_obj = q_obj | Q(codigo_loja__isnull=True)
                qs = qs.filter(q_obj)
        return qs

    # 1. Opções de Busca (Nome de Referência)
    qs_nomes = filtrar(Loja.objects.all(), ignore_busca=True)
    nomes_set = set(qs_nomes.values_list("nome_referencia", flat=True))
    nomes_list = sorted(list(n.strip() for n in nomes_set if n and n.strip()))
    has_null_nome = qs_nomes.filter(Q(nome_referencia__isnull=True) | Q(nome_referencia="")).exists()
    if has_null_nome:
        nomes_list.append("null")

    # 2. Opções de Cliente / Regional
    qs_clientes = filtrar(Loja.objects.all(), ignore_cliente=True)
    clientes_set = set(qs_clientes.values_list("cliente", flat=True))
    clientes_list = sorted(list(c.strip() for c in clientes_set if c and c.strip()))
    has_null_cliente = qs_clientes.filter(Q(cliente__isnull=True) | Q(cliente="")).exists()
    if has_null_cliente:
        clientes_list.append("null")

    # 3. Opções de Centro de Custo
    qs_cc = filtrar(Loja.objects.all(), ignore_cc=True)
    cc_set = set(qs_cc.values_list("centro_de_custo", flat=True))
    cc_list = sorted(list(cc.strip() for cc in cc_set if cc and cc.strip()))
    has_null_cc = qs_cc.filter(Q(centro_de_custo__isnull=True) | Q(centro_de_custo="")).exists()
    if has_null_cc:
        cc_list.append("null")

    # 4. Opções de Status
    qs_status = filtrar(Loja.objects.all(), ignore_status=True)
    status_set = set(qs_status.values_list("status", flat=True))
    status_list = sorted(list(s.strip() for s in status_set if s and s.strip()))
    has_null_status = qs_status.filter(Q(status__isnull=True) | Q(status="")).exists()
    if has_null_status:
        status_list.append("null")

    # 5. Opções de Coordenador
    qs_coord = filtrar(Loja.objects.all(), ignore_coordenador=True)
    coords_in_stores = qs_coord.exclude(coordenador__isnull=True).values_list("coordenador_id", "coordenador__nome").distinct().order_by("coordenador__nome")
    coordenadores_list = [{"value": str(cid), "label": cnome} for cid, cnome in coords_in_stores]
    has_null_coord = qs_coord.filter(coordenador__isnull=True).exists()
    if has_null_coord:
        coordenadores_list.append({"value": "null", "label": "Sem Coordenador"})

    # 6. Opções de Supervisor
    qs_super = filtrar(Loja.objects.all(), ignore_supervisor=True)
    supers_in_stores = qs_super.exclude(supervisor__isnull=True).values_list("supervisor_id", "supervisor__nome").distinct().order_by("supervisor__nome")
    supervisores_list = [{"value": str(sid), "label": snome} for sid, snome in supers_in_stores]
    has_null_super = qs_super.filter(supervisor__isnull=True).exists()
    if has_null_super:
        supervisores_list.append({"value": "null", "label": "Sem Supervisor"})

    # 7. Opções de Código de Loja
    qs_codigos = filtrar(Loja.objects.all(), ignore_codigo=True)
    codigos_set = set(qs_codigos.exclude(codigo_loja__isnull=True).values_list("codigo_loja", flat=True))
    codigos_list = sorted(list(int(c) for c in codigos_set))
    codigos_formatted = [{"value": str(c), "label": str(c)} for c in codigos_list]
    has_null_codigo = qs_codigos.filter(codigo_loja__isnull=True).exists()
    if has_null_codigo:
        codigos_formatted.append({"value": "null", "label": "Sem Código"})

    return Response({
        "nomes": [{"value": n, "label": n} for n in nomes_list],
        "clientes": [{"value": c, "label": c} for c in clientes_list],
        "centros_custo": [{"value": cc, "label": cc} for cc in cc_list],
        "status": [{"value": s, "label": "Ativa" if s == "ATIVA" else "Inativa"} for s in status_list],
        "coordenadores": coordenadores_list,
        "supervisores": supervisores_list,
        "codigos": codigos_formatted,
    })


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def coordenador_detail_update_delete(request, pk):
    """
    Retorna, atualiza ou exclui um coordenador específico.
    
    Docstring explicativa: Esta view realiza operações individuais em um coordenador,
    permitindo a edição de seu nome, RE e região, além de possibilitar a exclusão.
    """
    coord = get_object_or_404(Coordenador, pk=pk)
    if request.method in ["PUT", "PATCH"]:
        serializer = CoordenadorSerializer(coord, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == "DELETE":
        coord.delete()
        return Response({"success": True, "message": "Coordenador excluído com sucesso."})

    serializer = CoordenadorSerializer(coord)
    return Response(serializer.data)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def supervisor_detail_update_delete(request, pk):
    """
    Retorna, atualiza ou exclui um supervisor específico.
    
    Docstring explicativa: Esta view realiza operações individuais em um supervisor,
    permitindo a edição de seu nome, RE e região, além de possibilitar a exclusão.
    """
    sup = get_object_or_404(Supervisor, pk=pk)
    if request.method in ["PUT", "PATCH"]:
        serializer = SupervisorSerializer(sup, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == "DELETE":
        sup.delete()
        return Response({"success": True, "message": "Supervisor excluído com sucesso."})

    serializer = SupervisorSerializer(sup)
    return Response(serializer.data)

