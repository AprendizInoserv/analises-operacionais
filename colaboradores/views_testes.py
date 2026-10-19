from datetime import date, timedelta, datetime
import os
import mimetypes
from io import BytesIO
import pandas as pd

from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from usuarios.permissions import IsGestaoOrAdministrador
from lojas.models import Cargo
from .models import Colaborador, TestePromocao, HistoricoAcaoTeste
from .serializers import TestePromocaoSerializer, HistoricoAcaoTesteSerializer
from .services import geovictoria


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def testes_list(request):
    """
    Lista solicitações de teste de promoção (GET) ou cria uma nova solicitação (POST).
    
    Por que existe: Centraliza as operações principais do controle de testes de promoção,
    gerenciando a listagem com filtros rápidos de busca e o cadastro com upload obrigatório do anexo.
    """
    if request.method == "POST":
        colaborador_id = request.data.get("colaborador_id")
        data_inicio_str = request.data.get("data_inicio")
        cargo_teste = request.data.get("cargo_teste")
        anexo_file = request.FILES.get("anexo")

        if not colaborador_id or not data_inicio_str or not cargo_teste:
            return Response(
                {"error": "Os campos Colaborador, Data de Início e Cargo em Teste são obrigatórios."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not anexo_file:
            return Response(
                {"error": "O anexo da folha de teste é obrigatório para cadastrar o teste."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        colaborador = get_object_or_404(Colaborador, id=colaborador_id)

        try:
            data_inicio = datetime.strptime(data_inicio_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Formato de data de início inválido. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Evita duplicidade de testes ativos ou pendentes para o mesmo colaborador
        if TestePromocao.objects.filter(colaborador=colaborador, status__in=["pendente", "ativo"]).exists():
            return Response(
                {"error": "Este colaborador já possui um teste de promoção ativo ou pendente de aprovação."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        teste = TestePromocao.objects.create(
            colaborador=colaborador,
            data_inicio=data_inicio,
            cargo_teste=cargo_teste,
            status="pendente",
            anexo=anexo_file,
            criado_por=request.user.username if request.user.is_authenticated else "Sistema",
        )

        return Response(TestePromocaoSerializer(teste).data, status=status.HTTP_201_CREATED)

    # Lógica de listagem (GET)
    testes_qs = TestePromocao.objects.select_related("colaborador", "colaborador__loja", "colaborador__loja__supervisor").all()

    search_query = request.GET.get("search", "").strip()
    status_query = request.GET.get("status", "").strip()
    loja_query = request.GET.get("loja", "").strip()

    if search_query:
        testes_qs = testes_qs.filter(
            Q(colaborador__nome__icontains=search_query) | Q(colaborador__re__icontains=search_query)
        )

    if status_query:
        testes_qs = testes_qs.filter(status=status_query)

    if loja_query:
        testes_qs = testes_qs.filter(colaborador__loja_id=loja_query)

    # Ordenação decrescente por criação padrão
    testes_qs = testes_qs.order_by("-created_at")

    # Verifica se o frontend solicitou a lista completa sem paginação.
    # Por que existe: Permite que o frontend busque todos os registros de uma vez para realizar
    # filtros complexos (como o de cobrança) e paginação de forma global no cliente.
    no_page = request.GET.get("no_page", "").lower() == "true"
    if no_page:
        serializer = TestePromocaoSerializer(testes_qs, many=True)
        return Response(serializer.data)

    paginator = PageNumberPagination()
    paginator.page_size = 10
    page = paginator.paginate_queryset(testes_qs, request)
    if page is not None:
        serializer = TestePromocaoSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = TestePromocaoSerializer(testes_qs, many=True)
    return Response(serializer.data)


def _obter_info_folhas(data_inicio):
    """
    Calcula as folhas de pagamento (período de 20 a 19) correspondentes aos 4 meses de teste.
    """
    if not data_inicio:
        return []
    ano = data_inicio.year
    mes = data_inicio.month
    dia = data_inicio.day

    if dia >= 20:
        mes += 1
        if mes > 12:
            mes = 1
            ano += 1

    folhas = []
    for i in range(4):
        m = mes + i
        y = ano
        while m > 12:
            m -= 12
            y += 1
        folhas.append({"mes_ref": i + 1, "nome_folha": f"{m:02d}/{y}"})
    return folhas


def _obter_folha_calendario_real(hoje=None):
    if hoje is None:
        hoje = date.today()
    dia = hoje.day
    mes = hoje.month
    ano = hoje.year
    if dia >= 20:
        mes += 1
        if mes > 12:
            mes = 1
            ano += 1
    return f"{mes:02d}/{ano}"


def _converter_folha_para_numero(folha_str):
    if not folha_str or "/" not in folha_str:
        return 0
    try:
        m, y = map(int, folha_str.split("/"))
        return y * 12 + m
    except Exception:
        return 0


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def testes_exportar_excel(request):
    """
    Exporta a listagem de testes de promoção respeitando os filtros aplicados para um arquivo Excel (.xlsx).
    """
    testes_qs = (
        TestePromocao.objects
        .select_related(
            "colaborador",
            "colaborador__loja",
            "colaborador__loja__supervisor",
            "colaborador__loja__coordenador",
        )
        .prefetch_related("historico_acoes")
        .all()
    )

    ids_param = request.GET.get("ids", "").strip()
    if ids_param:
        ids_list = [i.strip() for i in ids_param.split(",") if i.strip().isdigit()]
        if ids_list:
            testes_qs = testes_qs.filter(id__in=ids_list)

    search_query = request.GET.get("search", "").strip()
    status_query = request.GET.get("status", "").strip()
    supervisor_query = request.GET.get("supervisor", "").strip()
    cobranca_query = request.GET.get("cobranca", "").strip()
    etapa_query = request.GET.get("etapa", "").strip()
    acao_query = request.GET.get("acao", "").strip() or request.GET.get("acao_pendente", "").strip()
    folha_query = request.GET.get("folha", "").strip()

    if search_query:
        testes_qs = testes_qs.filter(
            Q(colaborador__nome__icontains=search_query) | Q(colaborador__re__icontains=search_query)
        )

    if status_query:
        testes_qs = testes_qs.filter(status=status_query)

    if supervisor_query:
        testes_qs = testes_qs.filter(colaborador__loja__supervisor__nome=supervisor_query)

    testes_qs = testes_qs.order_by("-created_at")

    hoje = date.today()
    num_folha_hoje = _converter_folha_para_numero(_obter_folha_calendario_real(hoje))

    linhas_excel = []

    for teste in testes_qs:
        acoes = list(teste.historico_acoes.all())
        premios = [a for a in acoes if a.acao in ["pagar_premio", "pagar_premio_cancelar"]]
        mes_atual_num = 1 if teste.status == "pendente" else len(premios) + 1
        folhas = _obter_info_folhas(teste.data_inicio)
        folha_teste = next((f for f in folhas if f["mes_ref"] == mes_atual_num), None)
        nome_folha = folha_teste["nome_folha"] if (folha_teste and teste.status not in ["promovido", "cancelado"]) else "-"

        acao_resposta = next((a for a in acoes if a.acao == "registrar_resposta" and a.mes_referencia == mes_atual_num), None)
        ja_respondeu = acao_resposta is not None
        num_folha_teste = _converter_folha_para_numero(folha_teste["nome_folha"]) if folha_teste else 0
        falta_resposta = (num_folha_teste <= num_folha_hoje) and not ja_respondeu

        # Filtros de aplicação em memória
        if cobranca_query and cobranca_query != "todos":
            if teste.status != "ativo":
                continue
            if cobranca_query == "falta_resposta" and not falta_resposta:
                continue
            if cobranca_query == "em_dia" and falta_resposta:
                continue

        if etapa_query:
            if teste.status != "ativo":
                continue
            if etapa_query == "aguardando_resposta" and ja_respondeu:
                continue
            if etapa_query == "aguardando_acao" and not ja_respondeu:
                continue

        if acao_query:
            if teste.status != "ativo" or not acao_resposta:
                continue
            resp = acao_resposta.resposta_supervisor
            if acao_query == "pagar_premio":
                if resp not in ["pagar_premio", "pagar_premio_cancelar"]:
                    continue
            elif acao_query == "cancelar":
                if resp not in ["cancelar", "pagar_premio_cancelar"]:
                    continue
            elif resp != acao_query:
                continue

        if folha_query:
            if nome_folha != folha_query:
                continue

        # Montagem dos campos para a planilha
        colab = teste.colaborador
        loja_nome = colab.loja.nome_referencia if colab.loja else (colab.centro_custo or "-")
        supervisor_nome = colab.loja.supervisor.nome if (colab.loja and colab.loja.supervisor) else "-"
        coordenador_nome = colab.loja.coordenador.nome if (colab.loja and colab.loja.coordenador) else "-"
        data_ini_str = teste.data_inicio.strftime("%d/%m/%Y") if teste.data_inicio else "-"

        if teste.status in ["promovido", "cancelado"]:
            ciclo_str = "Finalizado"
        elif teste.status == "pendente":
            ciclo_str = "Aguardando Ativação"
        else:
            ciclo_str = f"Mês {mes_atual_num}"

        if teste.status == "ativo":
            if falta_resposta:
                situacao_cobranca = "Falta Resposta"
            elif ja_respondeu:
                situacao_cobranca = "Aguardando Ação"
            else:
                situacao_cobranca = "Em Dia"
        elif teste.status == "pendente":
            situacao_cobranca = "Pendente de Aprovação"
        else:
            situacao_cobranca = "Finalizado"

        resp_map = {
            "pagar_premio": "Pagar Prêmio",
            "promover": "Promover",
            "cancelar": "Cancelar",
            "pagar_premio_cancelar": "Pagar Prêmio e Cancelar",
        }
        resposta_sup_str = "-"
        if acao_resposta and acao_resposta.resposta_supervisor:
            resposta_sup_str = resp_map.get(acao_resposta.resposta_supervisor, acao_resposta.resposta_supervisor)

        ultima_obs = ""
        if acoes:
            acoes_ordenadas = sorted(acoes, key=lambda a: a.created_at, reverse=True)
            for a in acoes_ordenadas:
                if a.observacao:
                    ultima_obs = a.observacao
                    break

        linhas_excel.append({
            "RE": colab.re,
            "Colaborador": colab.nome,
            "Cargo Atual": colab.cargo or "-",
            "Cargo em Teste": teste.cargo_teste or "-",
            "Loja": loja_nome,
            "Supervisor": supervisor_nome,
            "Coordenador": coordenador_nome,
            "Data Início": data_ini_str,
            "Ciclo / Mês": ciclo_str,
            "Status": teste.get_status_display(),
            "Cobrança": situacao_cobranca,
            "Resposta Supervisor": resposta_sup_str,
            "Folha do Teste": nome_folha,
            "Última Observação": ultima_obs or "-",
            "Criado Por": teste.criado_por or "-",
            "Data Cadastro": teste.created_at.strftime("%d/%m/%Y %H:%M") if teste.created_at else "-",
        })

    colunas = [
        "RE",
        "Colaborador",
        "Cargo Atual",
        "Cargo em Teste",
        "Loja",
        "Supervisor",
        "Coordenador",
        "Data Início",
        "Ciclo / Mês",
        "Status",
        "Cobrança",
        "Resposta Supervisor",
        "Folha do Teste",
        "Última Observação",
        "Criado Por",
        "Data Cadastro",
    ]

    df = pd.DataFrame(linhas_excel, columns=colunas)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Testes de Promoção")
        worksheet = writer.sheets["Testes de Promoção"]

        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        for cell in worksheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        for row in worksheet.iter_rows(min_row=2, max_row=worksheet.max_row, min_col=1, max_col=worksheet.max_column):
            for cell in row:
                cell.border = thin_border

        for col in worksheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buffer.seek(0)
    data_hoje = hoje.strftime("%d_%m_%Y")
    filename = f"testes_promocao_{data_hoje}.xlsx"

    response = HttpResponse(
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def colaborador_ausencias_summary(request, pk):
    """
    Retorna o resumo consolidado e detalhado de ausências do colaborador vinculado ao teste,
    considerando o período de 1 ano recente ou a partir de sua data de admissão (o que for posterior).
    
    Por que existe: Centraliza a busca e consolidação de faltas e atestados do colaborador
    sob demanda (ao abrir o modal no frontend), evitando que consultas externas lentas à
    GeoVictoria travem a listagem principal de testes.
    """
    teste = get_object_or_404(TestePromocao, id=pk)
    colaborador = teste.colaborador

    if not colaborador.cpf:
        return Response(
            {"error": "CPF do colaborador não cadastrado na base de dados. Reimporte os dados da TOTVS."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        today = date.today()
        um_ano_atras = today - timedelta(days=365)
        # Inicia a contagem na admissão ou a 1 ano atrás (o que for mais recente/posterior)
        start_date = max(colaborador.data_admissao, um_ano_atras)

        # 1. Detalhamento Cronológico
        details = geovictoria.get_timeoff_details(
            colaborador.cpf,
            start_date,
            today,
        )

        # 2. Resumo Consolidado (Faltas e Atestados)
        summary = geovictoria.get_timeoff_summary(
            colaborador.cpf,
            start_date,
            today,
        )
        colab_summary = summary.get(colaborador.cpf, {"faltas": 0, "atestados": 0, "total": 0})

        return Response({
            "faltas": colab_summary.get("faltas", 0),
            "atestados": colab_summary.get("atestados", 0),
            "detalhes": details
        })
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def colaborador_ausencias_avulso(request, colaborador_id):
    """
    Retorna as ausências consolidadas e detalhadas de um colaborador específico antes de cadastrar o teste.
    
    Por que existe: Permite que a tela de cadastro consulte as ausências de 1 ano do funcionário
    assim que ele for selecionado no autocomplete, mostrando a informação atualizada para a tomada de decisão inicial.
    """
    colaborador = get_object_or_404(Colaborador, id=colaborador_id)

    if not colaborador.cpf:
        return Response(
            {"error": "CPF do colaborador não cadastrado na base de dados. Reimporte os dados da TOTVS."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        today = date.today()
        um_ano_atras = today - timedelta(days=365)
        # Inicia a contagem na admissão ou a 1 ano atrás (o que for mais recente/posterior)
        start_date = max(colaborador.data_admissao, um_ano_atras)

        # 1. Detalhamento Cronológico
        details = geovictoria.get_timeoff_details(
            colaborador.cpf,
            start_date,
            today,
        )

        # 2. Resumo Consolidado (Faltas e Atestados)
        summary = geovictoria.get_timeoff_summary(
            colaborador.cpf,
            start_date,
            today,
        )
        colab_summary = summary.get(colaborador.cpf, {"faltas": 0, "atestados": 0, "total": 0})

        return Response({
            "faltas": colab_summary.get("faltas", 0),
            "atestados": colab_summary.get("atestados", 0),
            "detalhes": details
        })
    except Exception as exc:
        return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def teste_aprovar(request, pk):
    """
    Aprova um teste de promoção pendente, alterando seu status para ativo.
    
    Por que existe: Permite ao analista de gestão oficializar a aprovação da solicitação,
    movendo o teste para o status ativo e registrando essa mudança de fase na timeline do histórico.
    """
    teste = get_object_or_404(TestePromocao, id=pk)

    if teste.status != "pendente":
        return Response(
            {"error": "Apenas testes com status Pendente de Aprovação podem ser aprovados."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    teste.status = "ativo"
    teste.save()

    # Cria o registro no histórico de ações
    HistoricoAcaoTeste.objects.create(
        teste=teste,
        acao="ativar",
        mes_referencia=0,  # 0 indica ativação inicial
        observacao="Solicitação de teste aprovada pelo coordenador.",
        solicitado_por="Coordenador",
        realizado_por=request.user.username if request.user.is_authenticated else "Sistema",
        data_acao=date.today(),
    )

    return Response(TestePromocaoSerializer(teste).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def teste_registrar_acao(request, pk):
    """
    Registra uma tomada de decisão mensal sobre o teste ativo (Pagar Prêmio, Promover, Cancelar).
    
    Por que existe: Implementa um fluxo mensal de duas etapas:
    1. Etapa de Resposta do Supervisor ('registrar_resposta').
    2. Etapa de Confirmação de Ação (executada pela gestão com base na resposta).
    A data é coletada automaticamente e o solicitante padrão é o supervisor da loja.
    """
    teste = get_object_or_404(TestePromocao, id=pk)

    if teste.status != "ativo":
        return Response(
            {"error": "Apenas testes ativos podem receber ações mensais de controle."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    acao = request.data.get("acao")
    observacao = request.data.get("observacao", "").strip()

    if not acao:
        return Response(
            {"error": "O campo Ação é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if acao not in ["registrar_resposta", "pagar_premio", "promover", "cancelar", "pagar_premio_cancelar"]:
        return Response(
            {"error": "Ação mensal inválida."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Conta prêmios pagos para determinar em qual mês de controle estamos (Mês 1, 2, 3 ou 4)
    premios_pagos = teste.historico_acoes.filter(acao__in=["pagar_premio", "pagar_premio_cancelar"]).count()
    mes_atual = premios_pagos + 1

    # Obter nome do supervisor do colaborador para preencher automaticamente
    supervisor_nome = "Supervisor"
    if teste.colaborador.loja and teste.colaborador.loja.supervisor:
        supervisor_nome = teste.colaborador.loja.supervisor.nome

    if acao == "registrar_resposta":
        resposta_supervisor = request.data.get("resposta_supervisor")
        
        # No primeiro mês a resposta é automaticamente pagar, a menos que seja explicitamente pagar_premio_cancelar
        if mes_atual == 1 and resposta_supervisor != "pagar_premio_cancelar":
            resposta_supervisor = "pagar_premio"

        if not resposta_supervisor:
            return Response(
                {"error": "A resposta do supervisor é obrigatória."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if resposta_supervisor not in ["pagar_premio", "promover", "cancelar", "pagar_premio_cancelar"]:
            return Response(
                {"error": "Resposta do supervisor inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validações das regras de negócios de meses para a resposta do supervisor
        if mes_atual == 1:
            if resposta_supervisor == "promover":
                return Response(
                    {"error": "Não é permitido promover o colaborador no primeiro mês de teste. O prêmio deve ser pago obrigatoriamente."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        elif mes_atual == 4:
            if resposta_supervisor == "pagar_premio":
                return Response(
                    {"error": "O teste de promoção atingiu o limite de 4 meses. Escolha Promover ou Cancelar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Exigência de observação para finalização (Promover, Cancelar ou Pagar Prêmio e Cancelar)
        if resposta_supervisor in ["promover", "cancelar", "pagar_premio_cancelar"] and not observacao:
            return Response(
                {"error": f"Para a resposta de {resposta_supervisor.replace('_', ' ').capitalize()} é obrigatório registrar uma observação."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Se já existe resposta do supervisor para o mês atual, atualiza; caso contrário, cria novo
        historico = teste.historico_acoes.filter(acao="registrar_resposta", mes_referencia=mes_atual).first()
        if historico:
            historico.resposta_supervisor = resposta_supervisor
            historico.observacao = observacao
            historico.realizado_por = request.user.username if request.user.is_authenticated else "Sistema"
            historico.data_acao = date.today()
            historico.save()
        else:
            historico = HistoricoAcaoTeste.objects.create(
                teste=teste,
                acao="registrar_resposta",
                resposta_supervisor=resposta_supervisor,
                mes_referencia=mes_atual,
                observacao=observacao,
                solicitado_por=supervisor_nome,
                realizado_por=request.user.username if request.user.is_authenticated else "Sistema",
                data_acao=date.today(),
            )

        return Response(TestePromocaoSerializer(teste).data, status=status.HTTP_200_OK)

    else:
        # Ação final: pagar_premio, promover, cancelar ou pagar_premio_cancelar
        # Valida se já existe resposta do supervisor para o mês atual
        resposta_reg = teste.historico_acoes.filter(acao="registrar_resposta", mes_referencia=mes_atual).first()
        if not resposta_reg:
            return Response(
                {"error": f"É necessário registrar a resposta do supervisor para o Mês {mes_atual} antes de aplicar a ação final."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Valida se a ação final condiz com a resposta registrada do supervisor
        if acao != resposta_reg.resposta_supervisor:
            return Response(
                {"error": f"A ação final de {acao.replace('_', ' ')} difere da resposta de {resposta_reg.resposta_supervisor.replace('_', ' ')} registrada pelo supervisor."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Registra a ação final executada
        historico = HistoricoAcaoTeste.objects.create(
            teste=teste,
            acao=acao,
            mes_referencia=mes_atual,
            observacao=observacao or f"Ação de {acao.replace('_', ' ')} executada conforme resposta do supervisor.",
            solicitado_por=supervisor_nome,
            realizado_por=request.user.username if request.user.is_authenticated else "Sistema",
            data_acao=date.today(),
        )

        # Atualiza o status final se for Promover ou Cancelar (ou Pagar Prêmio e Cancelar)
        if acao == "promover":
            teste.status = "promovido"
            teste.save()
        elif acao in ["cancelar", "pagar_premio_cancelar"]:
            teste.status = "cancelado"
            teste.save()

        return Response(TestePromocaoSerializer(teste).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def teste_anexo_download(request, pk):
    """
    Permite baixar ou visualizar a folha de teste anexada ao cadastro.
    
    Por que existe: Fornece o arquivo salvo em disco de forma controlada via HTTP,
    respeitando as regras de segurança e o caminho configurado no .env.
    """
    teste = get_object_or_404(TestePromocao, id=pk)

    if not teste.anexo:
        raise Http404("Nenhum arquivo anexado a este teste de promoção.")

    # Se o arquivo não existir fisicamente no local indicado
    file_path = teste.anexo.path
    if not os.path.exists(file_path):
        raise Http404("Arquivo físico do anexo não foi encontrado no servidor.")

    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"

    # Usar FileResponse para permitir que o navegador abra PDFs nativamente, em vez de forçar download sempre
    response = FileResponse(open(file_path, "rb"), content_type=content_type)
    # Define o Header para exibição inline se for PDF/imagem ou attachment para download
    filename = os.path.basename(file_path)
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def cargos_unicos_list(request):
    """
    Retorna a lista ordenada de funções/cargos distintos cadastrados na base de dados (lojas_cargo).
    
    Por que existe: Permite ao usuário escolher a função em teste a partir das funções parametrizadas.
    """
    cargos = Cargo.objects.values_list("nome", flat=True)
    cargos_limpos = sorted(
        set(
            c.strip().upper()
            for c in cargos
            if c and c.strip()
        )
    )
    return Response(cargos_limpos)


@api_view(["PATCH", "POST"])
@permission_classes([IsAuthenticated, IsGestaoOrAdministrador])
def teste_alterar_data_inicio(request, pk):
    """
    Altera a data de início de um teste de promoção.
    
    Por que existe: Permite corrigir erros de digitação ou reagendamentos de início
    do período de teste, recalculando o ciclo e registrando a alteração na linha do tempo.
    """
    teste = get_object_or_404(TestePromocao, id=pk)
    nova_data_str = request.data.get("data_inicio")
    motivo = request.data.get("motivo", "").strip()

    if not nova_data_str:
        return Response(
            {"error": "O campo data de início é obrigatório."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        nova_data = datetime.strptime(nova_data_str, "%Y-%m-%d").date()
    except ValueError:
        return Response(
            {"error": "Formato de data inválido. Use o formato AAAA-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data_anterior = teste.data_inicio
    teste.data_inicio = nova_data
    teste.save()

    # Registra no histórico a alteração da data
    data_ant_fmt = data_anterior.strftime("%d/%m/%Y")
    data_nova_fmt = nova_data.strftime("%d/%m/%Y")
    obs = f"Data de início alterada de {data_ant_fmt} para {data_nova_fmt}."
    if motivo:
        obs += f" Motivo: {motivo}"

    HistoricoAcaoTeste.objects.create(
        teste=teste,
        acao="alterar_data_inicio",
        mes_referencia=0,
        observacao=obs,
        solicitado_por="Gestão",
        realizado_por=request.user.username if request.user.is_authenticated else "Sistema",
        data_acao=date.today(),
    )

    return Response(TestePromocaoSerializer(teste).data, status=status.HTTP_200_OK)
