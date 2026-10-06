"""Serviço de exportação de PDFs individuais por loja.

Gera o relatório em formato PDF profissional no padrão oficial com 11 colunas,
cabeçalho executivo, cartões de KPI e totalizadores diários usando ReportLab.
"""
import os
import re
from datetime import datetime, date
from typing import Dict, Any, Optional
import pandas as pd

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate,
        Table,
        TableStyle,
        Paragraph,
        Spacer,
        KeepTogether,
    )
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    colors = None
    landscape = None
    A4 = None
    inch = None
    getSampleStyleSheet = None
    ParagraphStyle = None
    SimpleDocTemplate = None
    Table = None
    TableStyle = None
    Paragraph = None
    Spacer = None
    KeepTogether = None
    canvas = None


def sanitize_filename(filename: str) -> str:
    """Remove caracteres inválidos para nomes de arquivos no Windows."""
    clean = re.sub(r'[\\/*?:"<>|]', '_', str(filename or 'SEM_NOME'))
    clean = clean.strip().replace('  ', ' ')
    return clean if clean else 'SEM_NOME'


if REPORTLAB_AVAILABLE:
    class NumberedCanvas(canvas.Canvas):
        """Canvas com numeração de páginas profissional e rodapé de auditoria."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_number(num_pages)
                super().showPage()
            super().save()

        def draw_page_number(self, page_count):
            self.saveState()
            self.setFont("Helvetica", 7)
            self.setFillColor(colors.HexColor("#64748b"))
            # Linha fina no rodapé
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(20, 22, 822, 22)

            # Texto do rodapé
            timestamp = datetime.now().strftime("%d/%m/%Y às %H:%M:%S")
            footer_left = f"Sistema de Gestão de Faltas — Motor 2.0  •  Emissão: {timestamp}  •  Documento Confidencial Operacional"
            footer_right = f"Página {self._pageNumber} de {page_count}"

            self.drawString(20, 12, footer_left)
            self.drawRightString(822, 12, footer_right)
            self.restoreState()
else:
    NumberedCanvas = None


def export_store_pdf(
    store_name: str,
    operacao: str,
    store_daily_df: pd.DataFrame,
    store_summary: Dict[str, Any],
    output_dir: str = "relatorios_pdf",
    mes: Optional[int] = None,
    ano: Optional[int] = None,
) -> str:
    """Gera o arquivo PDF individual da loja sanitizado para Windows."""
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("A biblioteca 'reportlab' é necessária para exportação em PDF. Instale-a com: pip install reportlab")

    os.makedirs(output_dir, exist_ok=True)
    clean_store = sanitize_filename(store_name)
    pdf_filename = f"relatorio_{clean_store}.pdf"
    output_path = os.path.join(output_dir, pdf_filename)

    mes_val = mes or 8
    ano_val = ano or 2026

    # Configuração de Página: A4 Paisagem (841.89 x 595.27 pt)
    # Margens estreitas para caber os 31 dias + cabeçalho em 1 página
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=20,
        rightMargin=20,
        topMargin=16,
        bottomMargin=26,
    )

    story = []

    # Estilos de texto
    styles = getSampleStyleSheet()

    title_left_style = ParagraphStyle(
        'TitleLeft',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=14,
        textColor=colors.HexColor('#0f172a')
    )

    sub_left_style = ParagraphStyle(
        'SubLeft',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#475569')
    )

    title_right_style = ParagraphStyle(
        'TitleRight',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=11.5,
        alignment=2,  # Direita
        textColor=colors.HexColor('#0f172a')
    )

    sub_right_style = ParagraphStyle(
        'SubRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        alignment=2,
        textColor=colors.HexColor('#64748b')
    )

    # 1. Top Header Banner (2 colunas: Título à esquerda, Competência à direita)
    meses_pt = [
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    nome_mes = meses_pt[mes_val] if 1 <= mes_val <= 12 else f"Mês {mes_val}"

    p_title = Paragraph("<b>FECHAMENTO OPERACIONAL DE FALTAS</b>", title_left_style)
    p_sub = Paragraph(f"Relatório Oficial de Efetividade e Apuração de Presenças  •  Rede {operacao.upper()}", sub_left_style)
    p_comp = Paragraph(f"<b>COMPETÊNCIA: {nome_mes.upper()} / {ano_val}</b>", title_right_style)
    p_status = Paragraph(f"Apuração: <b>{mes_val:02d}/{ano_val}</b>  |  Validação 100% Determinística", sub_right_style)

    header_table = Table(
        [[[p_title, p_sub], [p_comp, p_status]]],
        colWidths=[480, 321.89]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))

    # 2. Faixa de Identificação da Loja (Dark Navy bar)
    quadro_val = store_summary.get('quadro', 0)
    dias_uteis_val = store_summary.get('dias_uteis', 26)
    total_esperado_val = store_summary.get('total_esperado', 0)

    store_bar_data = [[
        Paragraph(
            f"<font color='white'><b>FILIAL:</b> {store_name.upper()}  &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>OPERAÇÃO:</b> {operacao.upper()}  &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>QUADRO PREVISTO:</b> {quadro_val} POSTOS  &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>DIAS ÚTEIS:</b> {dias_uteis_val}  &nbsp;&nbsp;|&nbsp;&nbsp; "
            f"<b>TOTAL ESPERADO:</b> {total_esperado_val} DIAS</font>",
            ParagraphStyle('BarText', fontName='Helvetica', fontSize=8, leading=10, textColor=colors.white)
        )
    ]]
    store_bar = Table(store_bar_data, colWidths=[801.89])
    store_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#0f172a')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(store_bar)
    story.append(Spacer(1, 4))

    # 3. Cartões Resumo / KPIs da Loja (Grid de 9 métricas consolidadas)
    presencas_tot = store_summary.get('presencas', 0)
    folgas_tot = store_summary.get('folgas', 0)
    outras_folgas_tot = store_summary.get('outras_folgas', 0)
    atestados_tot = store_summary.get('atestados', 0)
    diarias_tot = store_summary.get('diarias', 0)
    hec_dia_tot = store_summary.get('hec_dia', 0)
    resultado_tot = store_summary.get('resultado', 0)
    comparativo_tot = store_summary.get('comparativo', 0)
    faltas_op_tot = store_summary.get('faltas_operacionais', 0)
    ht_tot = store_summary.get('ht_formatted', '00:00')
    hec_tot = store_summary.get('hec_formatted', '00:00')

    kpi_headers = [
        "Esperado", "Presenças", "Folgas", "Outras Folgas",
        "Atestados", "Diárias", "HEC=DIA", "Resultado", "Comparativo", "Faltas RH"
    ]
    kpi_values = [
        str(total_esperado_val),
        str(presencas_tot),
        str(folgas_tot),
        str(outras_folgas_tot),
        str(atestados_tot),
        str(diarias_tot),
        str(hec_dia_tot),
        str(resultado_tot),
        str(comparativo_tot),
        str(faltas_op_tot)
    ]

    col_w = 801.89 / 10
    kpi_table_data = [
        [Paragraph(f"<font color='#475569'><b>{h}</b></font>", ParagraphStyle('KPIH', fontName='Helvetica-Bold', fontSize=6.5, alignment=1)) for h in kpi_headers],
        [Paragraph(f"<b>{v}</b>", ParagraphStyle('KPIV', fontName='Helvetica-Bold', fontSize=9, alignment=1, textColor=colors.HexColor('#0f172a'))) for v in kpi_values]
    ]
    kpi_table = Table(kpi_table_data, colWidths=[col_w] * 10)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        # Destaque no Resultado e Comparativo
        ('BACKGROUND', (7, 0), (7, 1), colors.HexColor('#ecfdf5')),  # Verde claro
        ('BACKGROUND', (8, 0), (8, 1), colors.HexColor('#fef3c7') if comparativo_tot > 0 else colors.HexColor('#ecfdf5')),
        ('BACKGROUND', (9, 0), (9, 1), colors.HexColor('#ffe4e6') if faltas_op_tot > 0 else colors.HexColor('#f8fafc')),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 4))

    # 4. Tabela Diária Detalhada (11 Colunas Oficiais)
    # Colunas: Data, Dia, Presença, Folga, Outras Folgas, Atestados, Diárias, HEC=DIA, Resultado, Falta RH, HT/HEC
    col_widths = [68, 38, 68, 55, 78, 68, 58, 68, 72, 72, 156.89]

    header_cols = [
        "Data", "Dia", "Presença", "Folga", "Outras Folgas",
        "Atestados", "Diárias", "HEC=DIA", "Resultado", "Falta RH", "HT / HEC"
    ]

    cell_h_style = ParagraphStyle(
        'THeader',
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        alignment=1,
        textColor=colors.white
    )

    cell_body_center = ParagraphStyle(
        'TBodyCenter',
        fontName='Helvetica',
        fontSize=6.5,
        leading=8,
        alignment=1,
        textColor=colors.HexColor('#1e293b')
    )

    cell_body_bold = ParagraphStyle(
        'TBodyBold',
        fontName='Helvetica-Bold',
        fontSize=6.5,
        leading=8,
        alignment=1,
        textColor=colors.HexColor('#0f172a')
    )

    table_rows = []
    # Linha de cabeçalho
    table_rows.append([Paragraph(h, cell_h_style) for h in header_cols])

    # Linhas de dados diários
    total_pres = 0
    total_fol = 0
    total_out = 0
    total_ate = 0
    total_dia = 0
    total_hec_dia = 0
    total_res = 0
    total_faltas = 0

    if not store_daily_df.empty:
        # Garante ordenação cronológica
        sorted_daily = store_daily_df.sort_values(by='data') if 'data' in store_daily_df.columns else store_daily_df

        for _, r in sorted_daily.iterrows():
            d_val = r.get('data')
            if isinstance(d_val, (date, datetime)):
                data_str = d_val.strftime('%d/%m/%Y')
            else:
                data_str = str(d_val)[:10]

            dia_str = str(r.get('dia_semana', ''))[:3].upper()

            pres = int(r.get('presenca', 0))
            fol = int(r.get('folga', 0))
            out_f = int(r.get('outras_folgas', 0))
            ate = int(r.get('atestado', 0))
            dia = int(r.get('diarias', 0))
            h_dia = int(r.get('hec_dia', 0))
            res = int(r.get('resultado', 0))
            f_op = int(r.get('falta_operacional', 0))

            ht_f = str(r.get('ht_formatted', '00:00'))
            hec_f = str(r.get('hec_formatted', '00:00'))
            ht_hec_str = f"HT: {ht_f}  |  HEC: {hec_f}"

            total_pres += pres
            total_fol += fol
            total_out += out_f
            total_ate += ate
            total_dia += dia
            total_hec_dia += h_dia
            total_res += res
            total_faltas += f_op

            table_rows.append([
                Paragraph(data_str, cell_body_center),
                Paragraph(dia_str, cell_body_bold if dia_str in ['DOM', 'SAB'] else cell_body_center),
                Paragraph(str(pres), cell_body_center),
                Paragraph(str(fol), cell_body_center),
                Paragraph(str(out_f), cell_body_center),
                Paragraph(str(ate), cell_body_center),
                Paragraph(str(dia), cell_body_center),
                Paragraph(str(h_dia), cell_body_center),
                Paragraph(str(res), cell_body_bold),
                Paragraph(str(f_op), cell_body_bold if f_op > 0 else cell_body_center),
                Paragraph(ht_hec_str, cell_body_center),
            ])

    # Linha Totalizadora Final
    total_ht_str = f"HT: {ht_tot}  |  HEC: {hec_tot}"
    total_row_style = ParagraphStyle(
        'TTotal',
        fontName='Helvetica-Bold',
        fontSize=7,
        leading=8.5,
        alignment=1,
        textColor=colors.white
    )

    table_rows.append([
        Paragraph("TOTAL", total_row_style),
        Paragraph("-", total_row_style),
        Paragraph(str(total_pres), total_row_style),
        Paragraph(str(total_fol), total_row_style),
        Paragraph(str(total_out), total_row_style),
        Paragraph(str(total_ate), total_row_style),
        Paragraph(str(total_dia), total_row_style),
        Paragraph(str(total_hec_dia), total_row_style),
        Paragraph(str(total_res), total_row_style),
        Paragraph(str(total_faltas), total_row_style),
        Paragraph(total_ht_str, total_row_style),
    ])

    daily_table = Table(table_rows, colWidths=col_widths, repeatRows=1)

    t_style = [
        # Cabeçalho da tabela
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('INNERGRID', (0, 0), (-1, -1), 0.35, colors.HexColor('#cbd5e1')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#0f172a')),
        # Totalizador final
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
    ]

    # Cores alternadas das linhas de dados
    num_rows = len(table_rows)
    for row_idx in range(1, num_rows - 1):
        bg = colors.HexColor('#ffffff') if row_idx % 2 == 1 else colors.HexColor('#f8fafc')
        t_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), bg))

    daily_table.setStyle(TableStyle(t_style))
    story.append(daily_table)

    # Constrói o PDF usando o NumberedCanvas para rodapé dinâmico
    doc.build(story, canvasmaker=NumberedCanvas)

    return output_path
