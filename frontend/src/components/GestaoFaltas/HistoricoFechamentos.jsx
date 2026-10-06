import React, { useState, useEffect } from 'react';
import { 
  History, 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { api } from '../../services/api';

export default function HistoricoFechamentos({ 
  clientCode,
  onSelectFechamento, 
  showToast 
}) {
  const [fechamentos, setFechamentos] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const data = await api.getFechamentos();
      setFechamentos(data);
    } catch (err) {
      showToast('Erro ao carregar histórico: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const baixarExcel = (fechamento, titulo) => {
    const isProtege = fechamento?.cliente_nome?.toLowerCase().includes('protege') || clientCode === 'protege';
    const url = isProtege ? api.getDownloadProtegeExcelUrl(fechamento.id) : api.getDownloadExcelUrl(fechamento.id);
    window.open(url, '_blank');
    showToast(`Download de "${titulo}" iniciado!`, 'info');
  };

  const baixarAnoCompleto = (ano) => {
    const url = api.getDownloadAnoExcelUrl(ano);
    window.open(url, '_blank');
    showToast(`Gerando pasta de trabalho completa com todas as abas de ${ano}...`, 'info');
  };

  const fechamentosExibidos = fechamentos.filter(f => {
    if (clientCode === 'protege') {
      return f.cliente_nome?.toLowerCase().includes('protege');
    }
    if (clientCode === 'carrefour') {
      return f.cliente_nome?.toLowerCase().includes('carrefour');
    }
    if (clientCode === 'butanta') {
      return f.cliente_nome?.toLowerCase().includes('butant');
    }
    return true;
  });

  return (
    <div>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>
            <History size={26} color="#06b6d4" />
            <span>Histórico de Fechamentos Salvos no Banco</span>
          </h2>
          <p>
            Consulte todos os fechamentos passados arquivados no banco de dados, compare totais e baixe as planilhas oficiais.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={carregarHistorico}
          >
            <RefreshCw size={15} />
            <span>Atualizar</span>
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={() => baixarAnoCompleto(2026)}
          >
            <FolderArchive size={16} />
            <span>Exportar Ano 2026 Completo (Todas as Abas)</span>
          </button>
        </div>
      </div>

      <div className="glass-panel">
        {loading ? (
          <div className="loading-box">
            <div className="spinner"></div>
            <p>Carregando histórico do banco de dados...</p>
          </div>
        ) : fechamentosExibidos.length === 0 ? (
          <div className="empty-box">
            <p>Nenhum fechamento registrado no banco até o momento para este cliente.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Título / Ciclo</th>
                  <th>Período Oficial</th>
                  <th style={{ textAlign: 'center' }}>Total Faltas</th>
                  <th style={{ textAlign: 'right' }}>Desconto Total</th>
                  <th style={{ textAlign: 'center' }}>Lojas Preenchidas</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {fechamentosExibidos.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>
                      {f.cliente_nome}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {f.titulo}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {f.periodo_texto}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>
                      {f.total_faltas}
                    </td>
                    <td style={{ textAlign: 'right' }} className="currency-cell highlight">
                      R$ {parseFloat(f.total_desconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {f.lojas_respondidas} / {f.total_lojas}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {f.status === 'CONCLUIDO' ? (
                        <span className="card-badge badge-active">Concluído</span>
                      ) : (
                        <span className="card-badge badge-draft">Rascunho</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => onSelectFechamento(f)}
                          title="Abrir no Painel de Fechamento"
                        >
                          Visualizar
                        </button>

                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => baixarExcel(f, f.titulo)}
                          title="Baixar arquivo Excel (.xlsx)"
                        >
                          <Download size={14} />
                          <span>Excel</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
