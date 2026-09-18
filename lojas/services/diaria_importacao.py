import io
import re
from datetime import datetime, date
from decimal import Decimal
import pandas as pd
from django.db import transaction

from lojas.models import Diaria, Loja

def normalizar_nome(valor):
    """
    Normaliza strings para comparação (tudo maiúsculo e sem espaços extras).
    """
    if pd.isna(valor):
        return ""
    return str(valor).strip().upper()

def parse_data(valor):
    """
    Converte datas no formato DD/MM/YYYY para objetos datetime.date do Python.
    """
    if pd.isna(valor):
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    try:
        return datetime.strptime(texto, "%d/%m/%Y").date()
    except (ValueError, TypeError):
        return None

def limpar_valor_monetario(valor):
    """
    Converte valores numéricos ou formatados em Decimal do Python.
    """
    if pd.isna(valor):
        return Decimal("0.00")
    try:
        if isinstance(valor, (int, float, Decimal)):
            return Decimal(f"{valor:.2f}")
        texto = str(valor).strip()
        # Remove R$, pontos (milhares) e espaços
        texto = texto.replace("R$", "").replace(".", "").replace(" ", "")
        # Substitui a vírgula decimal por ponto
        texto = texto.replace(",", ".")
        return Decimal(texto)
    except:
        return Decimal("0.00")

def construir_mapa_lojas():
    """
    Cria um mapa de nomes normalizados de lojas para os seus respectivos IDs de Loja.
    Dá prioridade para o nome_totvs e depois nome_referencia.
    """
    mapa = {}
    
    # Prioridade 1: nome_totvs
    for loja in Loja.objects.exclude(nome_totvs=""):
        nome_norm = normalizar_nome(loja.nome_totvs)
        if nome_norm and nome_norm not in mapa:
            mapa[nome_norm] = loja
            
    # Prioridade 2: nome_referencia
    for loja in Loja.objects.all():
        nome_norm = normalizar_nome(loja.nome_referencia)
        if nome_norm and nome_norm not in mapa:
            mapa[nome_norm] = loja
            
    return mapa

def importar_diarias_de_texto(conteudo_csv, progress_callback=None):
    """
    Processa o conteúdo textual de um arquivo CSV de diárias,
    efetuando o UPSERT (inserção/atualização) no banco de dados.
    
    Docstring explicativa: Este serviço existe para realizar o parsing e a carga
    das diárias operacionais. Ele busca associar o Local a uma Loja física TOTVS
    cadastrada e garante que se o ID já existir, o registro será atualizado com os
    novos valores da planilha se houver diferenças.
    """
    if not conteudo_csv:
        return {"total": 0, "criados": 0, "atualizados": 0, "erros": 0}

    if progress_callback:
        progress_callback(10, "Lendo dados do arquivo CSV...")

    try:
        # Lê o CSV usando ';' como delimitador conforme estrutura do arquivo
        df = pd.read_csv(io.StringIO(conteudo_csv), sep=";", dtype=str)
    except Exception as e:
        raise ValueError(f"Erro ao processar estrutura do CSV: {str(e)}")

    # Trata nomes de colunas que podem vir com caracteres especiais ou espaços extras
    df.columns = df.columns.str.strip()

    # O ID da diária é a coluna '#' ou a primeira coluna
    coluna_id = None
    for col in df.columns:
        if "#" in col or col == "":
            coluna_id = col
            break
            
    if not coluna_id:
        # Fallback para a primeira coluna
        coluna_id = df.columns[0]

    # Validação de colunas necessárias
    colunas_obrigatorias = ["Diarista", "Local", "Data Serviço", "Turno", "Motivo", "Solicitante", "Valor", "Status", "Última Atualização"]
    for col in colunas_obrigatorias:
        if col not in df.columns:
            raise ValueError(f"Coluna obrigatória '{col}' não encontrada no CSV de diárias.")

    if progress_callback:
        progress_callback(30, "Carregando cadastro de lojas para conciliação...")

    # Carrega lojas e diárias existentes para evitar lookups N+1
    mapa_lojas = construir_mapa_lojas()
    diarias_existentes = {d.id_diaria: d for d in Diaria.objects.all()}

    para_criar = []
    para_atualizar = []
    
    stats = {
        "total": len(df),
        "criados": 0,
        "atualizados": 0,
        "erros": 0
    }

    total_linhas = len(df)
    
    for idx, (_, row) in enumerate(df.iterrows(), start=1):
        if progress_callback and idx % 200 == 0:
            progresso = 30 + int((idx / total_linhas) * 50)
            progress_callback(progresso, f"Processando linhas... {idx}/{total_linhas}")

        try:
            id_bruto = str(row[coluna_id]).strip()
            # Se for nulo ou vazio, ignora
            if not id_bruto or pd.isna(row[coluna_id]):
                continue
                
            # Garante que seja tratado como string limpa
            id_diaria = id_bruto.split(".")[0]  # evita floats como '1316.0'

            # Parse dos campos
            diarista = str(row["Diarista"]).strip()
            local_original = str(row["Local"]).strip()
            
            data_serv = parse_data(row["Data Serviço"])
            if not data_serv:
                # Pula diárias sem data válida
                continue

            turno = str(row["Turno"]).strip()
            motivo = str(row["Motivo"]).strip()
            solicitante = str(row["Solicitante"]).strip().upper()
            valor = limpar_valor_monetario(row["Valor"])
            status = str(row["Status"]).strip()
            
            data_atualizacao = parse_data(row["Última Atualização"])
            if not data_atualizacao:
                data_atualizacao = data_serv  # fallback se faltar

            justificativa = ""
            if "Justificativa" in row and pd.notna(row["Justificativa"]):
                justificativa = str(row["Justificativa"]).strip()

            # Resolve a loja relacional TOTVS
            local_normalizado = normalizar_nome(local_original)
            loja_resolvida = mapa_lojas.get(local_normalizado)

            dados = {
                "diarista": diarista[:255],
                "local": local_original[:255],
                "loja": loja_resolvida,
                "data_servico": data_serv,
                "turno": turno[:100],
                "motivo": motivo[:255],
                "solicitante": solicitante[:255],
                "valor": valor,
                "status": status[:100],
                "ultima_atualizacao": data_atualizacao,
                "justificativa": justificativa
            }

            # Verifica se já existe
            diaria_existente = diarias_existentes.get(id_diaria)
            if not diaria_existente:
                # Novo registro
                para_criar.append(Diaria(id_diaria=id_diaria, **dados))
                stats["criados"] += 1
            else:
                # Compara mudanças para evitar updates redundantes
                mudou = False
                for campo, valor_novo in dados.items():
                    if getattr(diaria_existente, campo) != valor_novo:
                        setattr(diaria_existente, campo, valor_novo)
                        mudou = True
                if mudou:
                    para_atualizar.append(diaria_existente)
                    stats["atualizados"] += 1

        except Exception as e:
            stats["erros"] += 1
            continue

    if progress_callback:
        progress_callback(85, "Gravando diárias no banco de dados...")

    # Gravação em lotes (transação atômica)
    with transaction.atomic():
        if para_criar:
            Diaria.objects.bulk_create(para_criar, batch_size=2000)
        if para_atualizar:
            Diaria.objects.bulk_update(
                para_atualizar,
                [
                    "diarista", "local", "loja", "data_servico", "turno",
                    "motivo", "solicitante", "valor", "status",
                    "ultima_atualizacao", "justificativa"
                ],
                batch_size=2000
            )

    if progress_callback:
        progress_callback(100, "Carga de diárias concluída com sucesso!")

    return stats


def converter_para_data(valor):
    """
    Converte datas em Timestamp do pandas, datetime, date ou strings formatadas
    para objetos datetime.date do Python.
    """
    if pd.isna(valor):
        return None
    if isinstance(valor, (datetime, pd.Timestamp)):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def importar_diarias_unificadas(conteudo_csv, arquivo_manual, progress_callback=None):
    """
    Realiza a leitura da base de diárias do sistema (CSV) e da base manual (Excel),
    aplica as regras de unificação e realiza o UPSERT (inserção/atualização) no banco de dados.

    Docstring explicativa: Este serviço unifica as diárias operacionais. Ele lê o CSV do
    sistema e os dados manuais da planilha de protocolos (mapeando colunas como Nr. Solicit.,
    Razao Social, Centro Custo, Dt. Emissao, Vlr. Despesa) e busca associar os registros
    a lojas TOTVS pelo Centro de Custo no banco.
    """
    if progress_callback:
        progress_callback(10, "Lendo arquivo do Sistema (CSV)...")

    # 1. Ler o arquivo do Sistema (CSV)
    try:
        df_sistema = pd.read_csv(io.StringIO(conteudo_csv), sep=";", dtype=str)
    except Exception as e:
        raise ValueError(f"Erro ao processar estrutura do CSV do Sistema: {str(e)}")

    df_sistema.columns = df_sistema.columns.str.strip()

    # O ID da diária é a coluna '#' ou a primeira coluna
    coluna_id_sis = None
    for col in df_sistema.columns:
        if "#" in col or col == "":
            coluna_id_sis = col
            break
    if not coluna_id_sis:
        coluna_id_sis = df_sistema.columns[0]

    # Validação de colunas necessárias do sistema
    colunas_obrigatorias_sis = ["Diarista", "Local", "Data Serviço", "Turno", "Motivo", "Solicitante", "Valor", "Status", "Última Atualização"]
    for col in colunas_obrigatorias_sis:
        if col not in df_sistema.columns:
            raise ValueError(f"Coluna obrigatória '{col}' não encontrada no CSV do Sistema.")

    # 2. Ler o arquivo Manual (Excel)
    if progress_callback:
        progress_callback(30, "Lendo arquivo Manual (Excel)...")

    try:
        df_manual = pd.read_excel(arquivo_manual)
    except Exception as e:
        raise ValueError(f"Erro ao processar o arquivo da Base Manual: {str(e)}")

    df_manual.columns = df_manual.columns.str.strip()

    # Validação de colunas da base manual
    col_id_man = next((c for c in df_manual.columns if c.lower().strip() in ["nr. solicit.", "nr.solicit.", "solicitacao", "solicitação"]), None)
    col_diarista_man = next((c for c in df_manual.columns if c.lower().strip() in ["razao social", "razão social", "diarista", "nome"]), None)
    col_local_man = next((c for c in df_manual.columns if c.lower().strip() in ["centro custo", "centro de custo", "cc"]), None)
    col_data_man = next((c for c in df_manual.columns if c.lower().strip() in ["dt. emissao", "dt. emissão", "dt.emissao", "data"]), None)
    col_valor_man = next((c for c in df_manual.columns if c.lower().strip() in ["vlr. despesa", "vlr.despesa", "valor despesa", "valor"]), None)

    if not col_id_man or not col_diarista_man or not col_local_man or not col_data_man or not col_valor_man:
        raise ValueError(
            "Colunas obrigatórias da Base Manual ('Nr. Solicit.', 'Razao Social', 'Centro Custo', 'Dt. Emissao', 'Vlr. Despesa') não foram encontradas."
        )

    if progress_callback:
        progress_callback(50, "Carregando cadastros relacionais...")

    # Carrega lojas e diárias existentes para evitar lookups N+1
    mapa_lojas_sistema = construir_mapa_lojas()
    
    from lojas.services.folha_constants import normalizar_centro_custo
    mapa_lojas_manual = {}
    for loja in Loja.objects.all():
        cc_norm = normalizar_centro_custo(loja.centro_de_custo)
        if cc_norm:
            mapa_lojas_manual[cc_norm] = loja

    diarias_existentes = {d.id_diaria: d for d in Diaria.objects.all()}

    processados_criar = {}
    processados_atualizar = {}

    stats = {
        "total_sistema": len(df_sistema),
        "total_manual": len(df_manual),
        "criados": 0,
        "atualizados": 0,
        "erros": 0
    }

    # 3. Processar registros do Sistema (CSV)
    for idx, (_, row) in enumerate(df_sistema.iterrows(), start=1):
        try:
            id_bruto = str(row[coluna_id_sis]).strip()
            if not id_bruto or pd.isna(row[coluna_id_sis]):
                continue
            id_diaria = id_bruto.split(".")[0]

            diarista = str(row["Diarista"]).strip()
            local_original = str(row["Local"]).strip()
            
            data_serv = parse_data(row["Data Serviço"])
            if not data_serv:
                continue

            turno = str(row["Turno"]).strip()
            motivo = str(row["Motivo"]).strip()
            solicitante = str(row["Solicitante"]).strip().upper()
            valor = limpar_valor_monetario(row["Valor"])
            status = str(row["Status"]).strip()
            
            data_atualizacao = parse_data(row["Última Atualização"])
            if not data_atualizacao:
                data_atualizacao = data_serv

            justificativa = ""
            if "Justificativa" in row and pd.notna(row["Justificativa"]):
                justificativa = str(row["Justificativa"]).strip()

            local_normalizado = normalizar_nome(local_original)
            loja_resolvida = mapa_lojas_sistema.get(local_normalizado)

            dados = {
                "diarista": diarista[:255],
                "local": local_original[:255],
                "loja": loja_resolvida,
                "data_servico": data_serv,
                "turno": turno[:100],
                "motivo": motivo[:255],
                "solicitante": solicitante[:255],
                "valor": valor,
                "status": status[:100],
                "ultima_atualizacao": data_atualizacao,
                "justificativa": justificativa,
                "order_type": "SISTEMA"
            }

            diaria_existente = diarias_existentes.get(id_diaria)
            if not diaria_existente:
                if id_diaria in processados_criar:
                    obj = processados_criar[id_diaria]
                    for campo, valor_novo in dados.items():
                        setattr(obj, campo, valor_novo)
                else:
                    obj = Diaria(id_diaria=id_diaria, **dados)
                    processados_criar[id_diaria] = obj
                    stats["criados"] += 1
            else:
                if id_diaria in processados_atualizar:
                    obj = processados_atualizar[id_diaria]
                    for campo, valor_novo in dados.items():
                        setattr(obj, campo, valor_novo)
                else:
                    mudou = False
                    for campo, valor_novo in dados.items():
                        if getattr(diaria_existente, campo) != valor_novo:
                            setattr(diaria_existente, campo, valor_novo)
                            mudou = True
                    if mudou:
                        processados_atualizar[id_diaria] = diaria_existente
                        stats["atualizados"] += 1
        except Exception:
            stats["erros"] += 1

    # 4. Processar registros Manuais (Excel)
    if progress_callback:
        progress_callback(75, "Processando registros da Base Manual...")

    for idx, (_, row) in enumerate(df_manual.iterrows(), start=1):
        try:
            id_val = row[col_id_man]
            if pd.isna(id_val):
                continue
            
            id_str = str(id_val).strip()
            if id_str.endswith(".0"):
                id_str = id_str[:-2]
            
            item_val = row.get("Item", "1")
            item_str = str(item_val).strip()
            if item_str.endswith(".0"):
                item_str = item_str[:-2]
            
            id_diaria = f"MAN-{id_str}-{item_str}"
            diarista = str(row[col_diarista_man]).strip()
            
            data_serv = converter_para_data(row[col_data_man])
            if not data_serv:
                continue

            valor = limpar_valor_monetario(row[col_valor_man])

            # Resolve a loja via Centro Custo
            cc_val = row[col_local_man]
            cc_norm = normalizar_centro_custo(cc_val)
            loja_resolvida = mapa_lojas_manual.get(cc_norm)

            if loja_resolvida:
                local_nome = loja_resolvida.nome_referencia
            else:
                local_nome = str(cc_val).strip() if pd.notna(cc_val) else ""

            # Deixa os demais dados vazios / padrão para manual
            dados = {
                "diarista": diarista[:255],
                "local": local_nome[:255],
                "loja": loja_resolvida,
                "data_servico": data_serv,
                "turno": "",
                "motivo": "",
                "solicitante": "",
                "valor": valor,
                "status": "Finalizado",
                "ultima_atualizacao": data_serv,
                "justificativa": "",
                "order_type": "MANUAL"
            }

            diaria_existente = diarias_existentes.get(id_diaria)
            if not diaria_existente:
                if id_diaria in processados_criar:
                    obj = processados_criar[id_diaria]
                    for campo, valor_novo in dados.items():
                        setattr(obj, campo, valor_novo)
                else:
                    obj = Diaria(id_diaria=id_diaria, **dados)
                    processados_criar[id_diaria] = obj
                    stats["criados"] += 1
            else:
                if id_diaria in processados_atualizar:
                    obj = processados_atualizar[id_diaria]
                    for campo, valor_novo in dados.items():
                        setattr(obj, campo, valor_novo)
                else:
                    mudou = False
                    for campo, valor_novo in dados.items():
                        if getattr(diaria_existente, campo) != valor_novo:
                            setattr(diaria_existente, campo, valor_novo)
                            mudou = True
                    if mudou:
                        processados_atualizar[id_diaria] = diaria_existente
                        stats["atualizados"] += 1
        except Exception:
            stats["erros"] += 1

    if progress_callback:
        progress_callback(90, "Gravando diárias no banco de dados...")

    para_criar = list(processados_criar.values())
    para_atualizar = list(processados_atualizar.values())

    # 5. Gravação em lotes (transação atômica)
    with transaction.atomic():
        if para_criar:
            Diaria.objects.bulk_create(para_criar, batch_size=2000)
        if para_atualizar:
            Diaria.objects.bulk_update(
                para_atualizar,
                [
                    "diarista", "local", "loja", "data_servico", "turno",
                    "motivo", "solicitante", "valor", "status",
                    "ultima_atualizacao", "justificativa", "order_type"
                ],
                batch_size=2000
            )

    if progress_callback:
        progress_callback(100, "Carga de diárias concluída com sucesso!")

    return stats
