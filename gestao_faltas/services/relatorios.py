import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import io
from gestao_faltas.models import Fechamento, ItemFechamento

MESES_NOMES = [
    '', 'JANEIRO', 'FEVEREIRO', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

CURRENCY_FORMAT = '_-"R$"\\ * #,##0.00_-;\\-"R$"\\ * #,##0.00_-;_-"R$"\\ * "-"??_-;_-@_-'

def estilizar_planilha(ws, fechamento):
    # Cabeçalhos
    headers = [
        'LOJA', 'REGIÃO', 'DESCONTO POR FALTA', 'FALTAS COMPUTADAS', 
        'DESCONTO TOTAL', 'DATA', 'E-mail', 'ASSUNTO', 'CORPO'
    ]

    header_font = Font(name='Aptos Narrow', size=11, bold=True, color='000000')
    header_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid') # leve verde executivo
    data_font = Font(name='Aptos Narrow', size=11)
    
    thin_border = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    # Escrever cabeçalhos
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border

    ws.row_dimensions[1].height = 28

    periodo_str = f"{fechamento.data_inicio.strftime('%d/%m')} até {fechamento.data_fim.strftime('%d/%m')}"
    periodo_corpo_str = f"{fechamento.data_inicio.strftime('%d/%m')} à {fechamento.data_fim.strftime('%d/%m')}"

    # Recupera itens ordenados por região e ordem da loja
    itens = fechamento.itens.select_related('loja', 'loja__regiao').order_by('loja__regiao__ordem', 'ordem', 'loja__nome')

    # Identificar primeira loja de cada região para preencher email, assunto e corpo
    regioes_vistas = set()

    for idx, item in enumerate(itens, start=2):
        ws.row_dimensions[idx].height = 20
        reg_nome = item.loja.regiao.nome

        # Col A: LOJA
        c1 = ws.cell(row=idx, column=1, value=item.loja.nome)
        c1.font = data_font
        c1.border = thin_border

        # Col B: REGIÃO
        c2 = ws.cell(row=idx, column=2, value=reg_nome)
        c2.font = data_font
        c2.border = thin_border

        # Col C: DESCONTO POR FALTA
        c3 = ws.cell(row=idx, column=3, value=float(item.valor_falta_aplicado))
        c3.font = data_font
        c3.number_format = CURRENCY_FORMAT
        c3.border = thin_border

        # Col D: FALTAS COMPUTADAS
        c4 = ws.cell(row=idx, column=4, value=item.faltas_computadas)
        c4.font = data_font
        c4.alignment = Alignment(horizontal='center')
        c4.border = thin_border

        # Col E: DESCONTO TOTAL (Fórmula Exata do Excel: =D{row}*C{row})
        c5 = ws.cell(row=idx, column=5, value=f"=D{idx}*C{idx}")
        c5.font = data_font
        c5.number_format = CURRENCY_FORMAT
        c5.border = thin_border

        # Col F: DATA
        c6 = ws.cell(row=idx, column=6, value=item.status_data or 'ok')
        c6.font = data_font
        c6.alignment = Alignment(horizontal='center')
        c6.border = thin_border

        # Col G, H, I: Apenas na primeira loja de cada regional (conforme CARREFOUR 2026.xlsx)
        email_val = ""
        assunto_val = ""
        corpo_val = ""

        if reg_nome not in regioes_vistas:
            regioes_vistas.add(reg_nome)
            email_val = item.loja.regiao.emails_padrao or ""
            assunto_val = f"{fechamento.cliente.nome.upper()} {reg_nome} - Fechamento ({periodo_str})"
            if reg_nome in ['CAMPO GRANDE', 'JUIZ DE FORA']:
                assunto_val = f"{reg_nome} - Fechamento ({periodo_str})"
            corpo_val = f"Boa Tarde, tudo bem?\n\nSegue fechamento {periodo_corpo_str} conforme resumo abaixo."

        c7 = ws.cell(row=idx, column=7, value=email_val)
        c7.font = data_font
        c7.border = thin_border

        c8 = ws.cell(row=idx, column=8, value=assunto_val)
        c8.font = data_font
        c8.border = thin_border

        c9 = ws.cell(row=idx, column=9, value=corpo_val)
        c9.font = data_font
        c9.alignment = Alignment(wrap_text=True)
        c9.border = thin_border

    # Ajuste automático das larguras das colunas
    larguras_padrao = {
        'A': 24, # LOJA
        'B': 22, # REGIÃO
        'C': 22, # DESCONTO POR FALTA
        'D': 20, # FALTAS COMPUTADAS
        'E': 20, # DESCONTO TOTAL
        'F': 10, # DATA
        'G': 40, # E-mail
        'H': 45, # ASSUNTO
        'I': 55  # CORPO
    }
    for col_letter, width in larguras_padrao.items():
        ws.column_dimensions[col_letter].width = width


def gerar_excel_fechamento(fechamento):
    """Gera o arquivo Excel em memória para um único fechamento"""
    wb = openpyxl.Workbook()
    ws = wb.active
    
    nome_aba = MESES_NOMES[fechamento.mes_referencia] if 1 <= fechamento.mes_referencia <= 12 else 'Fechamento'
    ws.title = nome_aba

    estilizar_planilha(ws, fechamento)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def gerar_excel_ano_completo(cliente, ano):
    """Gera uma pasta de trabalho com todos os meses fechados do ano (idêntico ao CARREFOUR 2026.xlsx)"""
    wb = openpyxl.Workbook()
    # Remove aba padrão
    primeira = True

    fechamentos = Fechamento.objects.filter(
        cliente=cliente, 
        ano_referencia=ano
    ).order_by('mes_referencia')

    for fechamento in fechamentos:
        nome_aba = MESES_NOMES[fechamento.mes_referencia] if 1 <= fechamento.mes_referencia <= 12 else f"Mês {fechamento.mes_referencia}"
        if primeira:
            ws = wb.active
            ws.title = nome_aba
            primeira = False
        else:
            ws = wb.create_sheet(title=nome_aba)
        estilizar_planilha(ws, fechamento)

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
