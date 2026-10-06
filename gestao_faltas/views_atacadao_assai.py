"""Views da API REST para o Fechamento Atacadão e Assaí."""
import os
import json
import pickle
import tempfile
import urllib.parse
from datetime import date, datetime
from typing import Dict, Any, Optional
import pandas as pd
from django.conf import settings
from django.http import FileResponse, HttpResponse
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .services_atacadao.settings_fechamento import DEFAULT_QUADROS
from .models import QuadroLoja, DiariaManual, HistoricoProcessamento
from .serializers import QuadroLojaSerializer, DiariaManualSerializer, HistoricoProcessamentoSerializer
from .services_atacadao.ingestion import load_controle_ponto, load_punch_report
from .services_atacadao.normalizer import parse_quadros_text
from .services_atacadao.matcher import match_ponto_marcas
from .services_atacadao.calculator import (
    classify_daily_records,
    aggregate_store_daily,
    calculate_monthly_summary,
)
from .services_atacadao.audit import build_colaborador_audit_trail, catalog_all_inconsistencies
from .services_atacadao.export_excel import export_consolidated_excel
from .services_atacadao.export_pdf import export_store_pdf, sanitize_filename
from .services_atacadao.export_zip import create_batch_zip

# Cache de memória volátil para o último fechamento em sessão
_LAST_PROCESSED: Dict[str, Any] = {}

# Caminhos de persistência em disco no MEDIA_ROOT
CACHE_DIR = os.path.join(settings.MEDIA_ROOT, 'fechamento_atacadao_assai')
CACHE_JSON_PATH = os.path.join(CACHE_DIR, 'ultimo_fechamento.json')
CACHE_PKL_PATH = os.path.join(CACHE_DIR, 'ultimo_fechamento_dfs.pkl')


def restore_last_processed_if_needed() -> bool:
    """Restaura _LAST_PROCESSED a partir do cache serializado no disco caso a memória esteja vazia."""
    global _LAST_PROCESSED
    if _LAST_PROCESSED and 'summary' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED.get('summary'), pd.DataFrame):
        return True

    if os.path.exists(CACHE_PKL_PATH):
        try:
            with open(CACHE_PKL_PATH, 'rb') as f:
                data = pickle.load(f)
                if isinstance(data, dict) and 'summary' in data:
                    _LAST_PROCESSED = data
                    return True
        except Exception as e:
            print(f"Erro ao restaurar cache do último fechamento: {e}")

    return False


def _serialize_row_dates(rows):
    """Garante que campos de data em dicionários sejam convertidos para strings ISO."""
    clean_rows = []
    for r in rows:
        item = dict(r)
        for k, v in item.items():
            if isinstance(v, (date, datetime)):
                item[k] = v.strftime('%Y-%m-%d')
            elif pd.isna(v):
                item[k] = None
        clean_rows.append(item)
    return clean_rows


def get_fixed_quadros_map() -> Dict[str, int]:
    """
    Retorna o dicionário de quadros de lojas fixados.
    
    Regra de negócio:
    1. Lê os registros de QuadroLoja existentes no banco de dados.
    2. Para lojas de Assaí e Atacadão cadastradas no sistema (lojas.models.Loja),
       se o quadro da loja (Loja.quadro) estiver configurado e ainda NÃO existir
       em QuadroLoja, cria o registro em QuadroLoja correspondente com o valor de Loja.quadro,
       tornando-o FIXADO a partir desse momento.
    3. Registros já existentes em QuadroLoja NÃO são sobrescritos pelo sistema,
       garantindo que qualquer ajuste manual realizado pelo usuário seja permanentemente preservado.
    4. Aplica fallback para DEFAULT_QUADROS apenas para nomes residuais não cadastrados no banco.
    """
    from lojas.models import Loja
    from .services_atacadao.normalizer import normalize_store_name

    quadros_qs = QuadroLoja.objects.filter(ativo=True)
    quadros_map = {q.nome_loja: q.quadro_previsto for q in quadros_qs}

    # Inicializa / fixa lojas do cadastro geral de Lojas que ainda não possuem QuadroLoja
    try:
        lojas_db = Loja.objects.filter(cliente__iregex=r'ASSA|ATACAD')
        novos_quadros = []
        for l in lojas_db:
            try:
                q_val = int(float(str(l.quadro).strip()))
            except (ValueError, TypeError):
                continue
            if q_val <= 0:
                continue

            nomes = []
            if l.nome_geovictoria:
                nomes.append(normalize_store_name(l.nome_geovictoria))
            if l.nome_referencia:
                nomes.append(l.nome_referencia)

            for n in nomes:
                if n and n not in quadros_map:
                    operacao = 'ASSAI' if ('assai' in n.lower() or 'sendas' in n.lower()) else 'ATACADAO'
                    novos_quadros.append(
                        QuadroLoja(
                            nome_loja=n,
                            operacao=operacao,
                            quadro_previsto=q_val,
                            ativo=True
                        )
                    )
                    quadros_map[n] = q_val

        if novos_quadros:
            QuadroLoja.objects.bulk_create(novos_quadros, ignore_conflicts=True)
    except Exception as e_lojas:
        print(f"Aviso ao sincronizar quadros de Loja: {e_lojas}")

    # Fallback seguro para defaults se ainda houver lojas não mapeadas
    for k, v in DEFAULT_QUADROS.items():
        if k not in quadros_map:
            quadros_map[k] = v

    return quadros_map


def get_consolidated_diarias_map(ano: int, mes: int) -> Dict[Tuple[str, date], int]:
    """
    Consolida as diárias operacionais já cadastradas no sistema (lojas.models.Diaria)
    com eventuais lançamentos manuais específicos de DiariaManual.
    """
    from lojas.models import Diaria
    from .services_atacadao.normalizer import normalize_store_name

    diarias_map: Dict[Tuple[str, date], int] = {}

    try:
        # 1. Diárias do sistema (lojas.models.Diaria)
        diarias_qs = (
            Diaria.objects.filter(data_servico__year=ano, data_servico__month=mes)
            .exclude(status__istartswith='Rejeitado')
            .exclude(status__istartswith='Ausência')
            .select_related('loja')
        )

        for d in diarias_qs:
            dt = d.data_servico
            nomes = []
            if d.loja:
                if d.loja.nome_geovictoria:
                    nomes.append(normalize_store_name(d.loja.nome_geovictoria))
                if d.loja.nome_referencia:
                    nomes.append(d.loja.nome_referencia)
            if d.local:
                nomes.append(d.local)
                nomes.append(normalize_store_name(d.local))

            for n in nomes:
                if n:
                    k = (n, dt)
                    diarias_map[k] = diarias_map.get(k, 0) + 1
                    break
    except Exception as e_diarias:
        print(f"Aviso ao carregar diárias do sistema: {e_diarias}")

    # 2. Diárias manuais complementares
    try:
        for dm in DiariaManual.objects.filter(data__year=ano, data__month=mes):
            k = (dm.nome_loja, dm.data)
            diarias_map[k] = diarias_map.get(k, 0) + dm.quantidade
    except Exception as e_dm:
        print(f"Aviso ao carregar diárias manuais: {e_dm}")

    return diarias_map


def recalculate_active_closure_summary() -> Optional[Dict[str, Any]]:
    """Recalcula o resumo mensal e KPIs do fechamento ativo com os quadros fixados da base e diárias do sistema."""
    global _LAST_PROCESSED
    restore_last_processed_if_needed()
    if not _LAST_PROCESSED or 'daily' not in _LAST_PROCESSED:
        return None

    df_daily = _LAST_PROCESSED['daily']
    mes = _LAST_PROCESSED.get('mes', 8)
    ano = _LAST_PROCESSED.get('ano', 2026)
    hec_minutos = _LAST_PROCESSED.get('hec_minutos', 0)

    quadros_map = get_fixed_quadros_map()

    df_summary = calculate_monthly_summary(
        df_daily,
        quadros_map=quadros_map,
        ano=ano,
        mes=mes,
        hec_minutos_limite=hec_minutos
    )

    _LAST_PROCESSED['summary'] = df_summary

    # Atualiza cache PKL
    try:
        with open(CACHE_PKL_PATH, 'wb') as f:
            pickle.dump(_LAST_PROCESSED, f)
    except Exception as e_pkl:
        print(f"Aviso ao salvar PKL recalculado: {e_pkl}")

    kpis = {
        'total_lojas': int(len(df_summary)),
        'total_esperado': int(df_summary['total_esperado'].sum()) if not df_summary.empty else 0,
        'resultado_total': int(df_summary['resultado'].sum()) if not df_summary.empty else 0,
        'comparativo_total': int(df_summary['comparativo'].sum()) if not df_summary.empty else 0,
        'faltas_operacionais': int(df_summary['faltas_operacionais'].sum()) if not df_summary.empty else 0,
        'total_inconsistencias': len(_LAST_PROCESSED.get('inc', [])),
        'dias_uteis': int(df_summary['dias_uteis'].iloc[0]) if not df_summary.empty else 26,
    }

    payload = {
        'tem_fechamento': True,
        'kpis': kpis,
        'resumo_lojas': _serialize_row_dates(df_summary.to_dict(orient='records')),
        'inconsistencias': _serialize_row_dates(_LAST_PROCESSED['inc'].head(300).to_dict(orient='records')) if ('inc' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['inc'], pd.DataFrame)) else [],
        'amostra_diaria': _serialize_row_dates(df_daily.to_dict(orient='records')),
        'mes': mes,
        'ano': ano,
        'hec_minutos': hec_minutos,
        'atualizado_em': datetime.now().strftime("%d/%m/%Y às %H:%M:%S"),
    }

    try:
        with open(CACHE_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e_json:
        print(f"Aviso ao salvar JSON recalculado: {e_json}")

    return payload


class ProcessarFechamentoView(APIView):
    permission_classes = [AllowAny]
    """Executa o pipeline completo de fechamento das marcas e controle de ponto."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, *args, **kwargs):
        arquivo_ponto = request.FILES.get('arquivo_ponto')
        arquivo_marcas = request.FILES.get('arquivo_marcas')
        mes = int(request.data.get('mes', 8))
        ano = int(request.data.get('ano', 2026))
        hec_minutos = int(request.data.get('hec_minutos', 0))
        recalcular_apenas = str(request.data.get('recalcular', '')).lower() in ('true', '1')

        # Se solicitado apenas recálculo e já houver fechamento ativo carregado
        if recalcular_apenas:
            recalc = recalculate_active_closure_summary()
            if recalc:
                return Response(recalc)

        # Resolução dos arquivos padrão do servidor (busca em gestaoFaltas, BASE_DIR ou pasta pai)
        candidate_dirs = [
            os.path.join(settings.BASE_DIR, "gestaoFaltas"),
            str(settings.BASE_DIR),
            os.path.dirname(settings.BASE_DIR),
        ]
        ponto_path = None
        punch_path = None
        for d in candidate_dirs:
            p_ponto = os.path.join(d, "Controledeponto202609040928_14175f0c-daa3-414a-8055-b05011c0e94c.xlsx")
            p_punch = os.path.join(d, "PunchReport_1846_1415494_20260904T123837.xlsx")
            if not ponto_path and os.path.exists(p_ponto):
                ponto_path = p_ponto
            if not punch_path and os.path.exists(p_punch):
                punch_path = p_punch

        try:
            # 1. Ingestão
            ponto_source = arquivo_ponto if arquivo_ponto else ponto_path
            punch_source = arquivo_marcas if arquivo_marcas else punch_path

            if not ponto_source or not punch_source:
                return Response(
                    {"erro": "Bases padrão do servidor não foram encontradas e nenhum arquivo foi enviado. Utilize a Central de Importações para fazer o envio dos relatórios."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            df_ponto = load_controle_ponto(ponto_source)
            df_punch_raw, df_punch_daily = load_punch_report(punch_source)

            # 2. Cruzamento
            df_matched, df_matcher_inc = match_ponto_marcas(df_ponto, df_punch_daily)

            # 3. Classificação
            df_classified = classify_daily_records(df_matched)

            # 4. Diárias do sistema (lojas.models.Diaria) + manuais complementares
            diarias_map = get_consolidated_diarias_map(ano, mes)

            # 5. Agregação Diária
            df_daily = aggregate_store_daily(
                df_classified,
                diarias_map=diarias_map,
                hec_minutos_limite=hec_minutos
            )

            # 6. Quadros configurados e fixados (vindos do Quadro Loja / Loja.quadro)
            quadros_map = get_fixed_quadros_map()

            # 7. Resumo Mensal
            df_summary = calculate_monthly_summary(
                df_daily,
                quadros_map=quadros_map,
                ano=ano,
                mes=mes,
                hec_minutos_limite=hec_minutos
            )

            # 8. Auditoria e Inconsistências
            df_audit = build_colaborador_audit_trail(df_classified)
            df_inc = catalog_all_inconsistencies(df_ponto, df_classified, df_matcher_inc)

            # Salva na sessão em memória
            global _LAST_PROCESSED
            _LAST_PROCESSED = {
                'summary': df_summary,
                'daily': df_daily,
                'audit': df_audit,
                'inc': df_inc,
                'marcas': df_punch_daily,
                'ponto': df_ponto,
                'mes': mes,
                'ano': ano,
                'hec_minutos': hec_minutos,
            }

            # Salva cache binário dos DataFrames em disco
            os.makedirs(CACHE_DIR, exist_ok=True)

            try:
                with open(CACHE_PKL_PATH, 'wb') as f:
                    pickle.dump(_LAST_PROCESSED, f)
            except Exception as e_pkl:
                print(f"Aviso ao persistir cache binário: {e_pkl}")

            # Prepara KPIs de retorno
            kpis = {
                'total_lojas': int(len(df_summary)),
                'total_esperado': int(df_summary['total_esperado'].sum()) if not df_summary.empty else 0,
                'resultado_total': int(df_summary['resultado'].sum()) if not df_summary.empty else 0,
                'comparativo_total': int(df_summary['comparativo'].sum()) if not df_summary.empty else 0,
                'faltas_operacionais': int(df_summary['faltas_operacionais'].sum()) if not df_summary.empty else 0,
                'total_inconsistencias': int(len(df_inc)),
                'dias_uteis': int(df_summary['dias_uteis'].iloc[0]) if not df_summary.empty else 26,
            }

            # Serializa linhas com tratamento de datas
            resumo_lojas_list = _serialize_row_dates(df_summary.to_dict(orient='records'))
            inconsistencias_list = _serialize_row_dates(df_inc.head(300).to_dict(orient='records'))
            # Retorna todos os registros diários para que o usuário possa selecionar qualquer loja na aba detalhe
            amostra_diaria_list = _serialize_row_dates(df_daily.to_dict(orient='records'))

            payload = {
                'tem_fechamento': True,
                'kpis': kpis,
                'resumo_lojas': resumo_lojas_list,
                'inconsistencias': inconsistencias_list,
                'amostra_diaria': amostra_diaria_list,
                'mes': mes,
                'ano': ano,
                'hec_minutos': hec_minutos,
                'atualizado_em': datetime.now().strftime("%d/%m/%Y às %H:%M:%S"),
            }

            # Salva cache JSON em disco para restauração instantânea
            try:
                with open(CACHE_JSON_PATH, 'w', encoding='utf-8') as f:
                    json.dump(payload, f, ensure_ascii=False, indent=2)
            except Exception as e_json:
                print(f"Aviso ao persistir cache JSON: {e_json}")

            # Salva no Histórico do banco
            try:
                HistoricoProcessamento.objects.create(
                    mes_referencia=mes,
                    ano_referencia=ano,
                    total_lojas=kpis['total_lojas'],
                    total_esperado=kpis['total_esperado'],
                    resultado_total=kpis['resultado_total'],
                    comparativo_total=kpis['comparativo_total'],
                    faltas_operacionais=kpis['faltas_operacionais'],
                    total_inconsistencias=kpis['total_inconsistencias'],
                    status='CONCLUIDO',
                    dados_json=payload
                )
            except Exception as e_db:
                print(f"Aviso ao salvar histórico no banco: {e_db}")

            return Response(payload)

        except Exception as e:
            return Response(
                {"erro": f"Falha no processamento: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UltimoFechamentoView(APIView):
    permission_classes = [AllowAny]
    """Retorna os dados do fechamento do mês vigente persistido em disco ou banco."""

    def get(self, request, *args, **kwargs):
        # Tenta carregar do cache JSON em disco
        if os.path.exists(CACHE_JSON_PATH):
            try:
                with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                # Se o cache ainda estiver com total_esperado baixo devido ao matching antigo, recalcula automaticamente
                if data.get('kpis', {}).get('total_esperado', 0) <= 7514:
                    recalc = recalculate_active_closure_summary()
                    if recalc:
                        return Response(recalc)
                restore_last_processed_if_needed()
                return Response(data)
            except Exception as e:
                print(f"Erro ao ler cache JSON: {e}")

        # Tenta buscar do último registro do banco com dados_json
        ultimo_historico = HistoricoProcessamento.objects.filter(dados_json__isnull=False).order_by('-criado_em').first()
        if ultimo_historico and ultimo_historico.dados_json:
            restore_last_processed_if_needed()
            if ultimo_historico.dados_json.get('kpis', {}).get('total_esperado', 0) <= 7514:
                recalc = recalculate_active_closure_summary()
                if recalc:
                    return Response(recalc)
            return Response(ultimo_historico.dados_json)

        return Response({
            "tem_fechamento": False,
            "mensagem": "Nenhum fechamento ativo encontrado."
        }, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        """Limpa o fechamento ativo em cache para permitir novo processamento do zero."""
        global _LAST_PROCESSED
        _LAST_PROCESSED.clear()
        if os.path.exists(CACHE_JSON_PATH):
            try:
                os.remove(CACHE_JSON_PATH)
            except Exception:
                pass
        if os.path.exists(CACHE_PKL_PATH):
            try:
                os.remove(CACHE_PKL_PATH)
            except Exception:
                pass

        return Response({
            "mensagem": "Fechamento ativo limpo com sucesso."
        }, status=status.HTTP_200_OK)


class ExportarExcelView(APIView):
    permission_classes = [AllowAny]
    """Exporta a planilha Excel oficial de 7 abas do último fechamento processado."""

    def get(self, request, *args, **kwargs):
        global _LAST_PROCESSED
        restore_last_processed_if_needed()

        if not _LAST_PROCESSED or 'summary' not in _LAST_PROCESSED:
            return Response(
                {"erro": "Nenhum fechamento processado recentemente para exportar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        mes = _LAST_PROCESSED.get('mes', 8)
        ano = _LAST_PROCESSED.get('ano', 2026)

        tmp_dir = tempfile.gettempdir()
        filename = f"Fechamento_Consolidado_ATACADAO_ASSAI_{mes:02d}_{ano}.xlsx"
        output_path = os.path.join(tmp_dir, filename)

        export_consolidated_excel(
            summary_df=_LAST_PROCESSED['summary'],
            daily_df=_LAST_PROCESSED['daily'],
            audit_df=_LAST_PROCESSED['audit'].head(10000),  # Limita para performance do download
            inconsistencias_df=_LAST_PROCESSED['inc'],
            marcas_clean_df=_LAST_PROCESSED['marcas'],
            output_path=output_path
        )

        return FileResponse(
            open(output_path, 'rb'),
            as_attachment=True,
            filename=filename,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )


class ExportarZipView(APIView):
    permission_classes = [AllowAny]
    """Gera os PDFs individuais sanitizados de todas as lojas e retorna arquivo ZIP."""

    def get(self, request, *args, **kwargs):
        global _LAST_PROCESSED
        restore_last_processed_if_needed()

        if not _LAST_PROCESSED or 'summary' not in _LAST_PROCESSED:
            return Response(
                {"erro": "Nenhum fechamento processado recentemente para gerar PDFs."},
                status=status.HTTP_400_BAD_REQUEST
            )

        mes = _LAST_PROCESSED.get('mes', 8)
        ano = _LAST_PROCESSED.get('ano', 2026)
        df_summary = _LAST_PROCESSED['summary']
        df_daily = _LAST_PROCESSED['daily']

        tmp_dir = tempfile.mkdtemp()
        pdf_paths = []

        for _, s_row in df_summary.iterrows():
            loja_nome = s_row['loja']
            operacao = 'ASSAI' if ('assai' in loja_nome.lower() or 'sendas' in loja_nome.lower()) else 'ATACADAO'
            store_daily = df_daily[df_daily['loja'] == loja_nome]
            pdf_path = export_store_pdf(
                store_name=loja_nome,
                operacao=operacao,
                store_daily_df=store_daily,
                store_summary=s_row.to_dict(),
                output_dir=tmp_dir,
                mes=mes,
                ano=ano
            )
            pdf_paths.append(pdf_path)

        zip_filename = f"FECHAMENTO_ATACADAO_ASSAI_{mes:02d}_{ano}.zip"
        zip_output_path = os.path.join(tempfile.gettempdir(), zip_filename)
        create_batch_zip(pdf_paths, zip_output_path)

        return FileResponse(
            open(zip_output_path, 'rb'),
            as_attachment=True,
            filename=zip_filename,
            content_type='application/zip'
        )


class ExportarLojaPdfView(APIView):
    permission_classes = [AllowAny]
    """Gera e retorna o PDF individual oficial de uma loja específica."""

    def get(self, request, *args, **kwargs):
        loja_param = request.query_params.get('loja', '').strip()
        if not loja_param:
            return Response(
                {"erro": "Parâmetro 'loja' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST
            )

        global _LAST_PROCESSED
        restore_last_processed_if_needed()

        if not _LAST_PROCESSED or 'summary' not in _LAST_PROCESSED:
            return Response(
                {"erro": "Nenhum fechamento processado recentemente para gerar PDF."},
                status=status.HTTP_400_BAD_REQUEST
            )

        mes = _LAST_PROCESSED.get('mes', 8)
        ano = _LAST_PROCESSED.get('ano', 2026)
        df_summary = _LAST_PROCESSED['summary']
        df_daily = _LAST_PROCESSED['daily']

        # Localiza a loja no resumo
        matching_rows = df_summary[df_summary['loja'].str.lower() == loja_param.lower()]
        if matching_rows.empty:
            matching_rows = df_summary[df_summary['loja'].str.contains(re.escape(loja_param), case=False, na=False)]

        if matching_rows.empty:
            return Response(
                {"erro": f"Loja '{loja_param}' não encontrada no fechamento atual."},
                status=status.HTTP_404_NOT_FOUND
            )

        s_row = matching_rows.iloc[0]
        loja_nome = s_row['loja']
        operacao = 'ASSAI' if ('assai' in loja_nome.lower() or 'sendas' in loja_nome.lower()) else 'ATACADAO'
        store_daily = df_daily[df_daily['loja'] == loja_nome]

        tmp_dir = tempfile.mkdtemp()
        pdf_path = export_store_pdf(
            store_name=loja_nome,
            operacao=operacao,
            store_daily_df=store_daily,
            store_summary=s_row.to_dict(),
            output_dir=tmp_dir,
            mes=mes,
            ano=ano
        )

        clean_store = sanitize_filename(loja_nome)
        pdf_filename = f"Relatorio_Faltas_{clean_store}_{mes:02d}_{ano}.pdf"

        return FileResponse(
            open(pdf_path, 'rb'),
            as_attachment=True,
            filename=pdf_filename,
            content_type='application/pdf'
        )


class QuadroLojaViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    """CRUD de quadros previstos de lojas com suporte a carga em lote e recálculo automático."""
    queryset = QuadroLoja.objects.all()
    serializer_class = QuadroLojaSerializer

    def perform_create(self, serializer):
        super().perform_create(serializer)
        recalculate_active_closure_summary()

    def perform_update(self, serializer):
        super().perform_update(serializer)
        recalculate_active_closure_summary()

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        recalculate_active_closure_summary()

    @action(detail=False, methods=['post'], url_path='carga-lote')
    def carga_lote(self, request):
        """Recebe texto com tuplas, CSV ou JSON contendo (NOME_LOJA, QUADRO) e faz ingestão em lote."""
        texto = request.data.get('texto', '')
        itens_diretos = request.data.get('itens', None)
        substituir_tudo = bool(request.data.get('substituir_tudo', False))

        pares = []
        if isinstance(itens_diretos, list):
            for item in itens_diretos:
                if isinstance(item, dict) and 'nome_loja' in item and 'quadro_previsto' in item:
                    pares.append((str(item['nome_loja']), int(item['quadro_previsto'])))
                elif isinstance(item, (list, tuple)) and len(item) >= 2:
                    pares.append((str(item[0]), int(item[1])))

        if not pares and texto:
            pares = parse_quadros_text(texto)

        if not pares:
            return Response(
                {"erro": "Nenhum quadro válido foi identificado no texto enviado. Formato esperado: (\"NOME DA LOJA\", 18)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if substituir_tudo:
            QuadroLoja.objects.all().delete()

        criados = 0
        atualizados = 0
        for nome, q in pares:
            nome_clean = nome.strip()
            if not nome_clean:
                continue
            operacao = 'ASSAI' if ('assai' in nome_clean.lower() or 'sendas' in nome_clean.lower()) else 'ATACADAO'
            obj, created = QuadroLoja.objects.update_or_create(
                nome_loja=nome_clean,
                defaults={
                    'operacao': operacao,
                    'quadro_previsto': int(q),
                    'ativo': True
                }
            )
            if created:
                criados += 1
            else:
                atualizados += 1

        recalculate_active_closure_summary()

        return Response({
            "mensagem": f"Carga processada com sucesso: {criados} novos criados, {atualizados} atualizados.",
            "total_processados": len(pares),
            "criados": criados,
            "atualizados": atualizados,
            "total_cadastrados": QuadroLoja.objects.count()
        }, status=status.HTTP_200_OK)


class DiariaManualViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    """CRUD de lançamentos operacionais de diárias manuais."""
    queryset = DiariaManual.objects.all()
    serializer_class = DiariaManualSerializer


class HistoricoProcessamentoViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    """Histórico de fechamentos mensais realizados."""
    queryset = HistoricoProcessamento.objects.all()
    serializer_class = HistoricoProcessamentoSerializer
