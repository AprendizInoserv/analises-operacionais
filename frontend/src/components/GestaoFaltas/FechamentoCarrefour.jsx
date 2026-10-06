import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  FileSpreadsheet, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Minus,
  CheckCheck,
  Mail
} from 'lucide-react';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import EmailsRegionaisModal from './EmailsRegionaisModal';

const MESES = [
  { val: 1, nome: 'Janeiro' },
  { val: 2, nome: 'Fevereiro' },
  { val: 3, nome: 'Março' },
  { val: 4, nome: 'Abril' },
  { val: 5, nome: 'Maio' },
  { val: 6, nome: 'Junho' },
  { val: 7, nome: 'Julho' },
  { val: 8, nome: 'Agosto' },
  { val: 9, nome: 'Setembro' },
  { val: 10, nome: 'Outubro' },
  { val: 11, nome: 'Novembro' },
  { val: 12, nome: 'Dezembro' },
];

export default function FechamentoCarrefour({ 
  showToast, 
  fechamentoAtivo, 
  setFechamentoAtivo,
  onNavigateToDetalhe
}) {
  const [mes, setMes] = useState(9); // Setembro
  const [ano, setAno] = useState(2026);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [modalEmailsOpen, setModalEmailsOpen] = useState(false);
  
  // Ref para verificar se o usuário está digitando ativamente no momento (para não sobrescrever no auto-refresh)
  const isTypingRef = useRef(false);

  // Carrega ou inicializa o fechamento para o mês/ano selecionado
  const carregarFechamento = async (mesSel = mes, anoSel = ano, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.inicializarFechamento(null, anoSel, mesSel);
      setFechamentoAtivo(data);
      setItens(data.itens || []);
    } catch (err) {
      if (!silent) showToast('Erro ao carregar fechamento: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Recarregar toda vez que a pessoa entra na aba ou muda mês/ano
  useEffect(() => {
    carregarFechamento(mes, ano);
  }, [mes, ano]);

  // Sincronização em tempo real para múltiplos usuários simultâneos no Wi-Fi:
  // 1. Recarrega quando o usuário clica ou foca na janela/aba
  // 2. Faz polling suave a cada 6 segundos caso o usuário não esteja digitando
  useEffect(() => {
    const handleFocus = () => {
      if (!isTypingRef.current) {
        carregarFechamento(mes, ano, true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isTypingRef.current) {
        carregarFechamento(mes, ano, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (!isTypingRef.current) {
        carregarFechamento(mes, ano, true);
      }
    }, 6000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [mes, ano]);

  // Atualiza quantidade de faltas no estado local
  const handleFaltasChange = (itemId, novaQtd) => {
    isTypingRef.current = true;
    const qtd = Math.max(0, parseInt(novaQtd) || 0);
    setItens(prev => prev.map(item => {
      if (item.id === itemId) {
        const descTotal = (qtd * parseFloat(item.valor_falta_aplicado)).toFixed(2);
        return {
          ...item,
          faltas_computadas: qtd,
          desconto_total: descTotal,
          respondido_whatsapp: true,
        };
      }
      return item;
    }));

    // Libera a trava de digitação após 1.5s
    setTimeout(() => {
      isTypingRef.current = false;
    }, 1500);
  };

  // Ajusta faltas com botão + ou -
  const ajustarFaltas = (itemId, delta) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    const atual = parseInt(item.faltas_computadas) || 0;
    handleFaltasChange(itemId, atual + delta);
  };

  // Salvar no backend
  const salvarAlteracoes = async () => {
    if (!fechamentoAtivo) return;
    setSaving(true);
    try {
      const payload = itens.map(item => ({
        id: item.id,
        faltas_computadas: item.faltas_computadas,
        valor_falta_aplicado: item.valor_falta_aplicado,
        status_data: item.status_data || 'ok',
        respondido_whatsapp: item.respondido_whatsapp,
        observacao: item.observacao || ''
      }));
      const res = await api.atualizarItensFechamento(fechamentoAtivo.id, payload);
      setFechamentoAtivo(res.fechamento);
      showToast('Fechamento salvo com sucesso no banco de dados!', 'success');
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setSaving(false);
      isTypingRef.current = false;
    }
  };

  // Concluir Fechamento com confetes
  const concluirFechamento = async () => {
    await salvarAlteracoes();
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      showToast('Fechamento concluído com sucesso!', 'success');
    } catch (e) {}
  };

  // Baixar Excel oficial
  const baixarExcel = () => {
    if (!fechamentoAtivo) return;
    const url = api.getDownloadExcelUrl(fechamentoAtivo.id);
    window.open(url, '_blank');
    showToast('Download do Excel iniciado!', 'info');
  };

  // Totais calculados
  const totalFaltasCalculadas = itens.reduce((acc, curr) => acc + (parseInt(curr.faltas_computadas) || 0), 0);
  const totalDescontoCalculado = itens.reduce((acc, curr) => acc + (parseFloat(curr.desconto_total) || 0), 0);
  const totalRespondidas = itens.filter(i => i.respondido_whatsapp).length;

  // Agrupamento por Regional
  const itensFiltrados = itens.filter(item => 
    item.loja_nome?.toLowerCase().includes(filtroTexto.toLowerCase()) ||
    item.loja_regiao?.toLowerCase().includes(filtroTexto.toLowerCase())
  );

  const regionaisMap = {};
  itensFiltrados.forEach(item => {
    const reg = item.loja_regiao || 'Outros';
    if (!regionaisMap[reg]) {
      regionaisMap[reg] = [];
    }
    regionaisMap[reg].push(item);
  });

  return (
    <div>
      {/* Top Controls: Period Bar */}
      <div className="period-bar">
        {/* Lado esquerdo: Seleção e visualização dos períodos */}
        <div className="period-left">
          <div className="period-pill">
            <Calendar size={16} color="var(--accent-teal)" />
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map(m => (
                <option key={m.val} value={m.val}>Mês: {m.nome}</option>
              ))}
            </select>
          </div>

          <div className="period-pill">
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              <option value={2026}>Ano: 2026</option>
              <option value={2027}>Ano: 2027</option>
            </select>
          </div>

          {fechamentoAtivo && (
            <div className="period-dates-badge">
              Período Oficial: {fechamentoAtivo.periodo_texto}
            </div>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981', marginLeft: '6px' }}>
            <span className="pulse-dot"></span>
            <span>Tempo Real</span>
          </div>
        </div>

        {/* Lado direito: Somente Exportar e Salvar (removidos Atualizar, Leitor WhatsApp e Ver E-mails pois já estão nas abas acima) */}
        <div className="period-actions">
          {onNavigateToDetalhe && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onNavigateToDetalhe}
              title="Abrir gerador de escalas e repetição de datas por colaborador (Exemplocarrefour.pdf)"
            >
              <FileSpreadsheet size={16} style={{ color: 'var(--accent-teal)' }} />
              <span>Detalhe (Datas & Escalas)</span>
            </button>
          )}

          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setModalEmailsOpen(true)}
            title="Abrir gerador de e-mails das regionais"
          >
            <Mail size={16} color="var(--accent-teal)" />
            <span>Gerador de E-mails</span>
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={baixarExcel}
            title="Exportar planilha Excel oficial do período"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar Fechamento (.xlsx)</span>
          </button>

          <button 
            className="btn btn-success btn-sm"
            onClick={salvarAlteracoes}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row for Current Closing */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-icon">
            <CheckCheck size={24} />
          </div>
          <div className="kpi-info">
            <h4>Lojas Respondidas</h4>
            <div className="kpi-value">{totalRespondidas} / {itens.length}</div>
            <div className="kpi-sub">
              {totalRespondidas === itens.length ? 'Todas lojas preenchidas!' : `${itens.length - totalRespondidas} pendentes`}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>
            <AlertCircle size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total de Faltas</h4>
            <div className="kpi-value">{totalFaltasCalculadas} faltas</div>
            <div className="kpi-sub">Computadas neste ciclo mensal</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.15)' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div className="kpi-info">
            <h4>Desconto Total</h4>
            <div className="kpi-value" style={{ color: '#f87171' }}>
              R$ {totalDescontoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="kpi-sub">Calculado por loja (Fórmula Excel =D*C)</div>
          </div>
        </div>
      </div>

      {/* Search and Table */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Lojas do Carrefour & Apuração de Ausências
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Altere as faltas diretamente nos campos ou use o leitor de WhatsApp nas abas acima.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Buscar loja ou regional..." 
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="form-input"
              style={{ width: '240px', padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-box">
            <div className="spinner"></div>
            <p>Carregando lojas e faltas do Carrefour em tempo real...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Loja</th>
                  <th>Região</th>
                  <th style={{ textAlign: 'right' }}>Tarifa Unitária (R$)</th>
                  <th style={{ textAlign: 'center' }}>Faltas Computadas</th>
                  <th style={{ textAlign: 'right' }}>Desconto Total (R$)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(regionaisMap).map(regional => {
                  const itemsDaRegional = regionaisMap[regional];
                  const subtotalFaltas = itemsDaRegional.reduce((acc, curr) => acc + (parseInt(curr.faltas_computadas) || 0), 0);
                  const subtotalDesc = itemsDaRegional.reduce((acc, curr) => acc + (parseFloat(curr.desconto_total) || 0), 0);

                  return (
                    <React.Fragment key={regional}>
                      <tr className="regional-header-row">
                        <td colSpan={7}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>REGIONAL: {regional} ({itemsDaRegional.length} lojas)</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                              Subtotal: <strong>{subtotalFaltas} faltas</strong> | Desconto: <strong>R$ {subtotalDesc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                            </span>
                          </div>
                        </td>
                      </tr>

                      {itemsDaRegional.map(item => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: '600' }}>{item.loja_nome}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{item.loja_regiao}</td>
                          <td style={{ textAlign: 'right' }} className="currency-cell">
                            R$ {parseFloat(item.valor_falta_aplicado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px 8px', borderRadius: '4px' }}
                                onClick={() => ajustarFaltas(item.id, -1)}
                              >
                                <Minus size={12} />
                              </button>
                              
                              <input 
                                type="number" 
                                min="0"
                                value={item.faltas_computadas}
                                onChange={(e) => handleFaltasChange(item.id, e.target.value)}
                                className="input-faltas"
                              />

                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px 8px', borderRadius: '4px' }}
                                onClick={() => ajustarFaltas(item.id, 1)}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }} className={`currency-cell ${item.desconto_total > 0 ? 'highlight' : ''}`}>
                            R$ {parseFloat(item.desconto_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.respondido_whatsapp ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                padding: '3px 8px', 
                                borderRadius: '999px', 
                                background: 'rgba(16, 185, 129, 0.15)', 
                                color: '#34d399', 
                                fontSize: '0.75rem', 
                                fontWeight: '600' 
                              }}>
                                <CheckCircle2 size={12} />
                                Respondido
                              </span>
                            ) : (
                              <span style={{ 
                                padding: '3px 8px', 
                                borderRadius: '999px', 
                                background: 'rgba(100, 116, 139, 0.2)', 
                                color: '#a1a1aa', 
                                fontSize: '0.75rem', 
                                fontWeight: '600' 
                              }}>
                                Pendente
                              </span>
                            )}
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Obs..." 
                              value={item.observacao || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItens(prev => prev.map(i => i.id === item.id ? { ...i, observacao: val } : i));
                              }}
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            className="btn btn-secondary"
            onClick={salvarAlteracoes}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Salvando...' : 'Salvar Rascunho'}</span>
          </button>

          <button 
            className="btn btn-primary"
            onClick={concluirFechamento}
            disabled={saving}
          >
            <CheckCheck size={16} />
            <span>Concluir Fechamento</span>
          </button>
        </div>
      </div>

      <EmailsRegionaisModal
        isOpen={modalEmailsOpen}
        onClose={() => setModalEmailsOpen(false)}
        fechamentoAtivo={fechamentoAtivo}
        showToast={showToast}
        isModal={true}
      />
    </div>
  );
}
