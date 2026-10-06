"""Serviço de exportação da pasta de trabalho oficial consolidada em Excel.

Gera o arquivo .xlsx de 7 abas formatadas corporativamente.
"""
from typing import Any, Optional
import pandas as pd


def export_consolidated_excel(
    summary_df: pd.DataFrame,
    daily_df: pd.DataFrame,
    audit_df: pd.DataFrame,
    inconsistencias_df: pd.DataFrame,
    marcas_clean_df: Optional[pd.DataFrame] = None,
    ponto_clean_df: Optional[pd.DataFrame] = None,
    output_path: str = "Fechamento_Consolidado.xlsx"
) -> str:
    """Gera a pasta de trabalho Excel oficial com as 7 abas configuradas."""
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        # 1. Resumo Executivo
        if not summary_df.empty:
            kpi_resumo = pd.DataFrame([{
                'Total de Lojas': len(summary_df),
                'Total Esperado (Postos)': summary_df['total_esperado'].sum(),
                'Resultado Realizado': summary_df['resultado'].sum(),
                'Comparativo Líquido': summary_df['comparativo'].sum(),
                'Faltas Operacionais (RH)': summary_df['faltas_operacionais'].sum(),
                'Horas Trabalhadas Totais': summary_df['ht_formatted'].iloc[0] if len(summary_df) == 1 else "Consolidado",
            }])
            kpi_resumo.to_excel(writer, sheet_name='RESUMO', index=False)
        else:
            pd.DataFrame([{'Status': 'Sem dados'}]).to_excel(writer, sheet_name='RESUMO', index=False)

        # 2. Fechamento por Loja
        summary_df.to_excel(writer, sheet_name='FECHAMENTO POR LOJA', index=False)

        # 3. Fechamento Diário
        daily_df.to_excel(writer, sheet_name='FECHAMENTO DIÁRIO', index=False)

        # 4. Funcionários / Auditoria Analítica
        audit_df.to_excel(writer, sheet_name='FUNCIONÁRIOS', index=False)

        # 5. Inconsistências
        inconsistencias_df.to_excel(writer, sheet_name='INCONSISTÊNCIAS', index=False)

        # 6. Base Marcas Tratada
        if marcas_clean_df is not None and not marcas_clean_df.empty:
            # Amostra ou primeiros 10k registros se muito grande para Excel
            marcas_clean_df.head(50000).to_excel(writer, sheet_name='BASE MARCAS TRATADA', index=False)

        # 7. Base Ponto Tratada
        if ponto_clean_df is not None and not ponto_clean_df.empty:
            ponto_clean_df.head(50000).to_excel(writer, sheet_name='BASE PONTO TRATADA', index=False)

    return output_path
