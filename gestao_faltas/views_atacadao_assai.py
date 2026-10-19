"""Views da API REST para o Fechamento Atacadão e Assaí."""
import os
import re
import json
import pickle
import unicodedata
import tempfile
import urllib.parse
from datetime import date, datetime
from typing import Dict, Any, Optional, List, Tuple
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


def restore_last_processed_from_dados(dados: dict) -> bool:
    """Restaura a sessão em memória _LAST_PROCESSED a partir dos dados serializados de um fechamento histórico."""
    global _LAST_PROCESSED
    if not dados:
        return False
    try:
        summary_list = dados.get('resumo_lojas', [])
        daily_list = dados.get('amostra_diaria', [])
        inc_list = dados.get('inconsistencias', [])

        _LAST_PROCESSED = {
            'summary': pd.DataFrame(summary_list) if summary_list else pd.DataFrame(),
            'daily': pd.DataFrame(daily_list) if daily_list else pd.DataFrame(),
            'inc': pd.DataFrame(inc_list) if inc_list else pd.DataFrame(),
            'audit': pd.DataFrame(),
            'marcas': pd.DataFrame(),
            'ponto': pd.DataFrame(),
            'classified': pd.DataFrame(),
            'mes': dados.get('mes', 8),
            'ano': dados.get('ano', 2026),
            'hec_minutos': dados.get('hec_minutos', 0),
        }
        return True
    except Exception as e:
        print(f"Aviso ao restaurar _LAST_PROCESSED a partir de dados históricos: {e}")
        return False


def get_meses_disponiveis() -> List[Dict[str, int]]:
    """Retorna lista ordenada dos meses/anos com fechamentos persistidos no histórico ou cache."""
    disponiveis = set()
    try:
        from .models import HistoricoProcessamento
        for h in HistoricoProcessamento.objects.filter(dados_json__isnull=False).values('mes_referencia', 'ano_referencia'):
            disponiveis.add((h['mes_referencia'], h['ano_referencia']))
    except Exception as e_h:
        print(f"Aviso ao listar meses disponíveis do histórico: {e_h}")

    if os.path.exists(CACHE_JSON_PATH):
        try:
            with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                c = json.load(f)
                if c.get('mes') and c.get('ano'):
                    disponiveis.add((int(c['mes']), int(c['ano'])))
        except Exception:
            pass

    sorted_items = sorted(list(disponiveis), key=lambda x: (x[1], x[0]), reverse=True)
    return [{'mes': m, 'ano': a} for m, a in sorted_items]


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


def _clean_str_for_matching(s: Any) -> str:
    """Normaliza texto para cruzamento insensível a acentos, pontuações e maiúsculas/minúsculas."""
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', str(s)).encode('ASCII', 'ignore').decode('ASCII').upper().strip()
    s = re.sub(r'[^A-Z0-9]', ' ', s)
    return ' '.join(s.split())


def build_store_lookup() -> List[Dict[str, Any]]:
    """
    Constrói a tabela de consulta em memória das lojas oficiais cadastradas (lojas.models.Loja),
    indexando todas as integrações configuradas:
    - nome_referencia (nome oficial da base de lojas)
    - nome_geovictoria
    - nome_totvs
    - nome_financeiro
    - nome_findme
    - nome_metricas
    - codigo_loja
    """
    from lojas.models import Loja
    lojas_db = list(Loja.objects.select_related('coordenador', 'supervisor').all())
    db_lookup = []
    for l in lojas_db:
        integracoes_limpas = []
        integracoes_core = []
        for field in [l.nome_referencia, l.nome_geovictoria, l.nome_totvs, l.nome_financeiro, l.nome_findme, l.nome_metricas]:
            if field:
                norm_f = _clean_str_for_matching(field)
                if norm_f:
                    integracoes_limpas.append(norm_f)
                    core_f = re.sub(r'^(VINICIUS|BRUNA|SENDAS)\s+', '', norm_f).strip()
                    if core_f and core_f != norm_f:
                        integracoes_core.append(core_f)

        db_lookup.append({
            'loja_obj': l,
            'nome_referencia': l.nome_referencia,
            'cliente': (l.cliente or '').upper(),
            'coordenador': l.coordenador.nome if l.coordenador else '',
            'supervisor': l.supervisor.nome if l.supervisor else '',
            'integrations': integracoes_limpas,
            'integrations_core': integracoes_core,
            'codigo': str(l.codigo_loja) if l.codigo_loja else '',
        })
    return db_lookup


def find_store_match(report_name: str, db_lookup: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Localiza a loja oficial correspondente ao nome vindo do relatório/planilha através das integrações da base.
    Se não houver correspondência, retorna None.
    """
    if not report_name:
        return None
    n_rep = _clean_str_for_matching(report_name)
    if not n_rep:
        return None
    n_rep_core = re.sub(r'^(VINICIUS|BRUNA|SENDAS)\s+', '', n_rep).strip()

    # Pass 1: Correspondência exata em qualquer integração cadastrada ou nome de referência
    for item in db_lookup:
        if n_rep in item['integrations']:
            return item

    # Pass 2: Correspondência exata ignorando prefixo comum de supervisor (ex: 'Vinicius - ')
    for item in db_lookup:
        if n_rep in item['integrations_core'] or (n_rep_core and (n_rep_core in item['integrations'] or n_rep_core in item['integrations_core'])):
            return item

    # Pass 3: Contenção de string (mínimo de 6 caracteres para evitar falsos positivos)
    best_item = None
    best_len = 0
    for item in db_lookup:
        for cand in item['integrations'] + item['integrations_core']:
            if len(n_rep) >= 6 and len(cand) >= 6:
                if n_rep == cand or n_rep in cand or cand in n_rep:
                    c_len = min(len(n_rep), len(cand))
                    if c_len > best_len:
                        best_len = c_len
                        best_item = item

    return best_item


def enrich_resumo_lojas(resumo_lojas: list) -> list:
    """
    Enriquece a lista resumo_lojas relacionando o nome que vem do relatório com a base oficial de lojas
    a partir das integrações de cada loja (nome_geovictoria, nome_totvs, nome_financeiro, nome_findme, etc.):
    - Se encontrar correspondência na base, define 'loja' e 'nome_referencia' com o nome oficial da base (Loja.nome_referencia).
    - Caso o nome esteja diferente ou não conste na base, mantém o nome exato que vem do relatório.
    - Preserva o nome do relatório em 'loja_original'.
    - Vincula cliente, coordenação e supervisão.
    """
    if not resumo_lojas:
        return []
    try:
        db_lookup = build_store_lookup()
        enriched = []
        for row in resumo_lojas:
            r = dict(row)
            loja_original = r.get('loja_original') or r.get('loja') or ''
            matched = find_store_match(loja_original, db_lookup)

            if matched:
                nome_oficial = matched['nome_referencia']
                r['loja'] = nome_oficial
                r['nome_referencia'] = nome_oficial
                r['loja_original'] = loja_original

                if 'ASSA' in matched['cliente'] or 'SENDAS' in matched['cliente']:
                    cli = 'ASSAÍ'
                elif 'ATACAD' in matched['cliente']:
                    cli = 'ATACADÃO'
                elif 'ASSAI' in loja_original.upper() or 'SENDAS' in loja_original.upper():
                    cli = 'ASSAÍ'
                else:
                    cli = 'ATACADÃO'

                coord = matched['coordenador'] if matched['coordenador'] else 'Não Informado'
                sup = matched['supervisor'] if matched['supervisor'] else 'Não Informado'
            else:
                # Caso o nome esteja diferente ou não conste na base, mantém o nome que vem do relatório
                r['loja'] = loja_original
                r['nome_referencia'] = loja_original
                r['loja_original'] = loja_original
                cli = 'ASSAÍ' if ('assai' in loja_original.lower() or 'sendas' in loja_original.lower()) else 'ATACADÃO'
                coord = r.get('coordenacao') or 'Não Informado'
                sup = r.get('supervisao') or 'Não Informado'

            r['cliente'] = cli
            r['coordenacao'] = coord
            r['supervisao'] = sup
            enriched.append(r)
        return enriched
    except Exception as e_enrich:
        print(f"Aviso ao enriquecer resumo_lojas com dados de Loja: {e_enrich}")
        for r in resumo_lojas:
            loja_orig = r.get('loja_original') or r.get('loja', '')
            r.setdefault('loja_original', loja_orig)
            r.setdefault('nome_referencia', r.get('loja', loja_orig))
            if 'cliente' not in r:
                r['cliente'] = 'ASSAÍ' if ('assai' in loja_orig.lower() or 'sendas' in loja_orig.lower()) else 'ATACADÃO'
            if 'coordenacao' not in r:
                r['coordenacao'] = 'Não Informado'
            if 'supervisao' not in r:
                r['supervisao'] = 'Não Informado'
        return resumo_lojas


def enrich_amostra_diaria(amostra_diaria: list, store_map: Optional[Dict[str, str]] = None) -> list:
    """
    Garante que os registros diários de amostra_diaria tenham 'loja', 'nome_referencia' e 'loja_original'
    alinhados com o mapeamento da base de lojas oficial.
    """
    if not amostra_diaria:
        return []
    if store_map is None:
        store_map = {}
    enriched = []
    for item in amostra_diaria:
        d = dict(item)
        orig = d.get('loja_original') or d.get('loja', '')
        oficial = store_map.get(orig, orig)
        d['loja'] = oficial
        d['nome_referencia'] = oficial
        d['loja_original'] = orig
        enriched.append(d)
    return enriched


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

    # Re-agrega df_daily a partir de classified se disponível para garantir abonos e diárias atualizadas
    if 'classified' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['classified'], pd.DataFrame):
        df_classified = _LAST_PROCESSED['classified']
        diarias_map = get_consolidated_diarias_map(ano, mes)
        df_daily = aggregate_store_daily(
            df_classified,
            diarias_map=diarias_map,
            hec_minutos_limite=hec_minutos
        )
        _LAST_PROCESSED['daily'] = df_daily

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
        'total_atestados_abonados': int(df_summary['atestados_abonados'].sum()) if ('atestados_abonados' in df_summary.columns and not df_summary.empty) else 0,
        'total_inconsistencias': len(_LAST_PROCESSED.get('inc', [])),
        'dias_uteis': int(df_summary['dias_uteis'].iloc[0]) if not df_summary.empty else 26,
    }

    resumo_lojas_list = enrich_resumo_lojas(_serialize_row_dates(df_summary.to_dict(orient='records')))
    store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in resumo_lojas_list}
    amostra_diaria_list = enrich_amostra_diaria(_serialize_row_dates(df_daily.to_dict(orient='records')), store_map)

    payload = {
        'tem_fechamento': True,
        'kpis': kpis,
        'resumo_lojas': resumo_lojas_list,
        'inconsistencias': _serialize_row_dates(_LAST_PROCESSED['inc'].head(300).to_dict(orient='records')) if ('inc' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['inc'], pd.DataFrame)) else [],
        'amostra_diaria': amostra_diaria_list,
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
                'classified': df_classified,
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
                'total_atestados_abonados': int(df_summary['atestados_abonados'].sum()) if ('atestados_abonados' in df_summary.columns and not df_summary.empty) else 0,
                'total_inconsistencias': int(len(df_inc)),
                'dias_uteis': int(df_summary['dias_uteis'].iloc[0]) if not df_summary.empty else 26,
            }

            # Serializa linhas com tratamento de datas e enriquece com Cliente, Supervisão e Coordenação
            resumo_lojas_list = enrich_resumo_lojas(_serialize_row_dates(df_summary.to_dict(orient='records')))
            store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in resumo_lojas_list}
            inconsistencias_list = _serialize_row_dates(df_inc.head(300).to_dict(orient='records'))
            # Retorna todos os registros diários alinhados com o nome de referência oficial da base
            amostra_diaria_list = enrich_amostra_diaria(_serialize_row_dates(df_daily.to_dict(orient='records')), store_map)

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
    """Retorna os dados do fechamento do mês solicitado (ou vigente) persistido em disco ou banco."""

    def get(self, request, *args, **kwargs):
        mes_param = request.query_params.get('mes')
        ano_param = request.query_params.get('ano')
        meses_disp = get_meses_disponiveis()

        # 1. Se mês e ano forem explicitamente solicitados
        if mes_param and ano_param:
            try:
                mes_int = int(mes_param)
                ano_int = int(ano_param)
            except (ValueError, TypeError):
                return Response(
                    {"erro": "Parâmetros 'mes' e 'ano' devem ser inteiros válidos."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # A. Verifica se o mês coincide com o cache do mês ativo em disco
            if os.path.exists(CACHE_JSON_PATH):
                try:
                    with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if data.get('mes') == mes_int and data.get('ano') == ano_int:
                        if data.get('resumo_lojas'):
                            data['resumo_lojas'] = enrich_resumo_lojas(data['resumo_lojas'])
                            store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in data['resumo_lojas']}
                            if data.get('amostra_diaria'):
                                data['amostra_diaria'] = enrich_amostra_diaria(data['amostra_diaria'], store_map)
                        data['meses_disponiveis'] = meses_disp
                        restore_last_processed_if_needed()
                        return Response(data)
                except Exception as e:
                    print(f"Aviso ao ler cache para mês específico: {e}")

            # B. Busca no histórico do banco de dados para a competência solicitada
            historico = HistoricoProcessamento.objects.filter(
                mes_referencia=mes_int,
                ano_referencia=ano_int,
                dados_json__isnull=False
            ).order_by('-criado_em').first()

            if historico and historico.dados_json:
                dados = dict(historico.dados_json)
                if dados.get('resumo_lojas'):
                    dados['resumo_lojas'] = enrich_resumo_lojas(dados['resumo_lojas'])
                    store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in dados['resumo_lojas']}
                    if dados.get('amostra_diaria'):
                        dados['amostra_diaria'] = enrich_amostra_diaria(dados['amostra_diaria'], store_map)
                dados['meses_disponiveis'] = meses_disp
                restore_last_processed_from_dados(dados)
                return Response(dados)

            # C. Não há fechamento salvo para o mês/ano solicitado
            return Response({
                "tem_fechamento": False,
                "mes": mes_int,
                "ano": ano_int,
                "meses_disponiveis": meses_disp,
                "mensagem": f"Nenhum fechamento processado encontrado para {mes_int:02d}/{ano_int}."
            }, status=status.HTTP_200_OK)

        # 2. Sem parâmetros de mês/ano: busca o ativo em disco ou mais recente do banco
        if os.path.exists(CACHE_JSON_PATH):
            try:
                with open(CACHE_JSON_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if data.get('kpis', {}).get('total_esperado', 0) <= 7514:
                    recalc = recalculate_active_closure_summary()
                    if recalc:
                        recalc['meses_disponiveis'] = meses_disp
                        return Response(recalc)
                if data.get('resumo_lojas'):
                    data['resumo_lojas'] = enrich_resumo_lojas(data['resumo_lojas'])
                    store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in data['resumo_lojas']}
                    if data.get('amostra_diaria'):
                        data['amostra_diaria'] = enrich_amostra_diaria(data['amostra_diaria'], store_map)
                data['meses_disponiveis'] = meses_disp
                restore_last_processed_if_needed()
                return Response(data)
            except Exception as e:
                print(f"Erro ao ler cache JSON: {e}")

        ultimo_historico = HistoricoProcessamento.objects.filter(dados_json__isnull=False).order_by('-criado_em').first()
        if ultimo_historico and ultimo_historico.dados_json:
            restore_last_processed_if_needed()
            if ultimo_historico.dados_json.get('kpis', {}).get('total_esperado', 0) <= 7514:
                recalc = recalculate_active_closure_summary()
                if recalc:
                    recalc['meses_disponiveis'] = meses_disp
                    return Response(recalc)
            dados = dict(ultimo_historico.dados_json)
            if dados.get('resumo_lojas'):
                dados['resumo_lojas'] = enrich_resumo_lojas(dados['resumo_lojas'])
                store_map = {r.get('loja_original', r.get('loja')): r.get('loja') for r in dados['resumo_lojas']}
                if dados.get('amostra_diaria'):
                    dados['amostra_diaria'] = enrich_amostra_diaria(dados['amostra_diaria'], store_map)
            dados['meses_disponiveis'] = meses_disp
            restore_last_processed_from_dados(dados)
            return Response(dados)

        return Response({
            "tem_fechamento": False,
            "meses_disponiveis": meses_disp,
            "mensagem": "Nenhum fechamento ativo encontrado."
        }, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        """Limpa o fechamento ativo em cache para permitir novo processamento do zero."""
        global _LAST_PROCESSED
        mes_param = request.query_params.get('mes')
        ano_param = request.query_params.get('ano')
        if mes_param and ano_param:
            try:
                m_int = int(mes_param)
                a_int = int(ano_param)
                HistoricoProcessamento.objects.filter(mes_referencia=m_int, ano_referencia=a_int).delete()
            except Exception:
                pass

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
            "mensagem": "Fechamento limpo com sucesso."
        }, status=status.HTTP_200_OK)


class ExportarExcelView(APIView):
    permission_classes = [AllowAny]
    """Exporta a planilha Excel oficial de 7 abas do último fechamento processado."""

    def get(self, request, *args, **kwargs):
        global _LAST_PROCESSED
        restore_last_processed_if_needed()

        mes_param = request.query_params.get('mes')
        ano_param = request.query_params.get('ano')
        if mes_param and ano_param:
            try:
                mes_int = int(mes_param)
                ano_int = int(ano_param)
                if not (_LAST_PROCESSED and _LAST_PROCESSED.get('mes') == mes_int and _LAST_PROCESSED.get('ano') == ano_int):
                    h = HistoricoProcessamento.objects.filter(
                        mes_referencia=mes_int,
                        ano_referencia=ano_int,
                        dados_json__isnull=False
                    ).order_by('-criado_em').first()
                    if h and h.dados_json:
                        restore_last_processed_from_dados(h.dados_json)
            except Exception as e_h:
                print(f"Aviso ao buscar historico para exportação Excel: {e_h}")

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
            audit_df=_LAST_PROCESSED['audit'].head(10000) if 'audit' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['audit'], pd.DataFrame) else pd.DataFrame(),
            inconsistencias_df=_LAST_PROCESSED['inc'] if 'inc' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['inc'], pd.DataFrame) else pd.DataFrame(),
            marcas_clean_df=_LAST_PROCESSED['marcas'] if 'marcas' in _LAST_PROCESSED and isinstance(_LAST_PROCESSED['marcas'], pd.DataFrame) else pd.DataFrame(),
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

        mes_param = request.query_params.get('mes')
        ano_param = request.query_params.get('ano')
        if mes_param and ano_param:
            try:
                mes_int = int(mes_param)
                ano_int = int(ano_param)
                if not (_LAST_PROCESSED and _LAST_PROCESSED.get('mes') == mes_int and _LAST_PROCESSED.get('ano') == ano_int):
                    h = HistoricoProcessamento.objects.filter(
                        mes_referencia=mes_int,
                        ano_referencia=ano_int,
                        dados_json__isnull=False
                    ).order_by('-criado_em').first()
                    if h and h.dados_json:
                        restore_last_processed_from_dados(h.dados_json)
            except Exception as e_h:
                print(f"Aviso ao buscar historico para exportação ZIP: {e_h}")

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
            operacao = 'ASSAI' if ('assai' in str(loja_nome).lower() or 'sendas' in str(loja_nome).lower()) else 'ATACADAO'
            store_daily = df_daily[df_daily['loja'] == loja_nome] if not df_daily.empty and 'loja' in df_daily.columns else pd.DataFrame()
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

        mes_param = request.query_params.get('mes')
        ano_param = request.query_params.get('ano')
        if mes_param and ano_param:
            try:
                mes_int = int(mes_param)
                ano_int = int(ano_param)
                if not (_LAST_PROCESSED and _LAST_PROCESSED.get('mes') == mes_int and _LAST_PROCESSED.get('ano') == ano_int):
                    h = HistoricoProcessamento.objects.filter(
                        mes_referencia=mes_int,
                        ano_referencia=ano_int,
                        dados_json__isnull=False
                    ).order_by('-criado_em').first()
                    if h and h.dados_json:
                        restore_last_processed_from_dados(h.dados_json)
            except Exception as e_h:
                print(f"Aviso ao buscar historico para exportação PDF de loja: {e_h}")

        if not _LAST_PROCESSED or 'summary' not in _LAST_PROCESSED:
            return Response(
                {"erro": "Nenhum fechamento processado recentemente para gerar PDF."},
                status=status.HTTP_400_BAD_REQUEST
            )

        mes = _LAST_PROCESSED.get('mes', 8)
        ano = _LAST_PROCESSED.get('ano', 2026)
        df_summary = _LAST_PROCESSED['summary']
        df_daily = _LAST_PROCESSED['daily']

        # Localiza a loja no resumo (pelo nome original ou pelo nome de referência da base)
        matching_rows = df_summary[df_summary['loja'].str.lower() == loja_param.lower()]
        if matching_rows.empty:
            matching_rows = df_summary[df_summary['loja'].str.contains(re.escape(loja_param), case=False, na=False)]

        if matching_rows.empty:
            # Tenta resolver comparando pela base de lojas ou integrações
            try:
                db_lookup = build_store_lookup()
                param_match = find_store_match(loja_param, db_lookup)
                if param_match:
                    for _, s_row in df_summary.iterrows():
                        s_match = find_store_match(s_row['loja'], db_lookup)
                        if s_match and s_match['nome_referencia'] == param_match['nome_referencia']:
                            matching_rows = df_summary[df_summary['loja'] == s_row['loja']]
                            break
            except Exception as e_pdf_match:
                print(f"Aviso ao resolver loja para PDF: {e_pdf_match}")

        if matching_rows.empty:
            return Response(
                {"erro": f"Loja '{loja_param}' não encontrada no fechamento atual."},
                status=status.HTTP_404_NOT_FOUND
            )

        s_row = matching_rows.iloc[0]
        loja_nome = s_row['loja']
        operacao = 'ASSAI' if ('assai' in str(loja_nome).lower() or 'sendas' in str(loja_nome).lower()) else 'ATACADAO'
        store_daily = df_daily[df_daily['loja'] == loja_nome] if not df_daily.empty and 'loja' in df_daily.columns else pd.DataFrame()

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

    @action(detail=False, methods=['get'], url_path='meses-disponiveis')
    def meses_disponiveis(self, request):
        """Retorna a lista de competências (mês/ano) que possuem fechamento gravado."""
        return Response(get_meses_disponiveis())
