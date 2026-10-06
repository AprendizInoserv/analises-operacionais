import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Calendar, 
  FileSpreadsheet, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Minus,
  MessageSquare,
  Mail,
  Download,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import WhatsAppModal from './WhatsAppModal';
import EmailsProtegeModal from './EmailsProtegeModal';

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

export default function FechamentoProtege({ 
  showToast, 
  fechamentoAtivo, 
  setFechamentoAtivo 
}) {
  const [mes, setMes] = useState(8); // Agosto por padrão
  const [ano, setAno] = useState(2026);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos' | 'respondidos' | 'pendentes' | 'com_faltas' | 'sem_faltas'
  
  // Modais
  const [modalWhatsAppOpen, setModalWhatsAppOpen] = useState(false);
  const [modalEmailsOpen, setModalEmailsOpen] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);

  const isTypingRef = useRef(false);

  // Carrega ou inicializa o fechamento Protege
  const carregarFechamento = async (mesSel = mes, anoSel = ano, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.inicializarFechamento(null, anoSel, mesSel, 'protege');
      setFechamentoAtivo(data);
      setItens(data.itens || []);
    } catch (err) {
      if (!silent) showToast('Erro ao carregar fechamento Protege: ' + err.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    carregarFechamento(mes, ano);
  }, [mes, ano]);

  // Sincronização periódica suave caso outro usuário atualize
  useEffect(() => {
    const handleFocus = () => {
      if (!isTypingRef.current) carregarFechamento(mes, ano, true);
    };
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(() => {
      if (!isTypingRef.current) carregarFechamento(mes, ano, true);
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [mes, ano]);

  // Atualiza quantidade de faltas
  const handleFaltasChange = (itemId, novaQtd) => {
    isTypingRef.current = true;
    const qtd = Math.max(0, parseInt(novaQtd) || 0);
    setItens(prev => prev.map(item => {
      if (item.id === itemId) {
        const descTotal = (qtd * parseFloat(item.valor_falta_aplicado || 0)).toFixed(2);
        const novoCargo = qtd === 0 ? 'SEM FALTAS' : (item.cargo === 'SEM FALTAS' ? 'AUX. DE LIMPEZA' : item.cargo);
        return {
          ...item,
          faltas_computadas: qtd,
          desconto_total: descTotal,
          cargo: novoCargo,
          respondido_whatsapp: true,
        };
      }
      return item;
    }));

    setTimeout(() => {
      isTypingRef.current = false;
    }, 1500);
  };

  const ajustarFaltas = (itemId, delta) => {
    const item = itens.find(i => i.id === itemId);
    if (!item) return;
    const atual = parseInt(item.faltas_computadas) || 0;
    handleFaltasChange(itemId, atual + delta);
  };

  const handleCargoChange = (itemId, novoCargo) => {
    isTypingRef.current = true;
    setItens(prev => prev.map(item => item.id === itemId ? { ...item, cargo: novoCargo } : item));
    setTimeout(() => { isTypingRef.current = false; }, 1500);
  };

  const handleDataChange = (itemId, novaData) => {
    isTypingRef.current = true;
    setItens(prev => prev.map(item => item.id === itemId ? { ...item, status_data: novaData } : item));
    setTimeout(() => { isTypingRef.current = false; }, 1500);
  };

  const handleTarifaChange = (itemId, novaTarifa) => {
    isTypingRef.current = true;
    const tarifa = parseFloat(novaTarifa) || 0;
    setItens(prev => prev.map(item => {
      if (item.id === itemId) {
        const descTotal = (item.faltas_computadas * tarifa).toFixed(2);
        return { ...item, valor_falta_aplicado: tarifa, desconto_total: descTotal };
      }
      return item;
    }));
    setTimeout(() => { isTypingRef.current = false; }, 1500);
  };

  const toggleWhatsAppStatus = (itemId) => {
    setItens(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, respondido_whatsapp: !item.respondido_whatsapp };
      }
      return item;
    }));
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
        cargo: item.cargo || (item.faltas_computadas === 0 ? 'SEM FALTAS' : 'AUX. DE LIMPEZA'),
        status_data: item.status_data || 'ok',
        respondido_whatsapp: item.respondido_whatsapp,
        observacao: item.observacao || ''
      }));
      const res = await api.atualizarItensFechamento(fechamentoAtivo.id, payload);
      setFechamentoAtivo(res.fechamento);
      showToast('Fechamento da Protege salvo com sucesso no banco de dados!', 'success');
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    } catch (err) {
      showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
      setSaving(false);
      isTypingRef.current = false;
    }
  };

  // Baixar Excel oficial Protege
  const baixarExcelProtege = () => {
    if (!fechamentoAtivo) return;
    const url = api.getDownloadProtegeExcelUrl(fechamentoAtivo.id);
    window.open(url, '_blank');
    showToast('Planilha oficial da Protege gerada para download!', 'info');
  };

  const copiarEmails = (emails, id) => {
    if (!emails) return;
    navigator.clipboard.writeText(emails);
    setCopiadoId(id);
    showToast('E-mails da filial copiados!', 'success');
    setTimeout(() => setCopiadoId(null), 2000);
  };

  // Cálculos de totais da tabela
  const totalFaltas = itens.reduce((acc, curr) => acc + (parseInt(curr.faltas_computadas) || 0), 0);
  const totalDesconto = itens.reduce((acc, curr) => acc + (parseFloat(curr.desconto_total) || 0), 0);
  const totalRespondidas = itens.filter(i => i.respondido_whatsapp).length;
  const totalPendentes = itens.length - totalRespondidas;

  // Filtro
  const itensFiltrados = itens.filter(item => {
    // Filtro por texto
    const matchTexto = 
      item.loja_nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      (item.loja_supervisor && item.loja_supervisor.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      (item.cargo && item.cargo.toLowerCase().includes(filtroTexto.toLowerCase()));

    if (!matchTexto) return false;

    if (filtroStatus === 'respondidos') return item.respondido_whatsapp;
    if (filtroStatus === 'pendentes') return !item.respondido_whatsapp;
    if (filtroStatus === 'com_faltas') return item.faltas_computadas > 0;
    if (filtroStatus === 'sem_faltas') return item.faltas_computadas === 0;
    return true;
  });

  return (
    <div>
      {/* Barra de Seleção de Mês e Ações Principais */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* Seletor de Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '10px', 
              background: 'linear-gradient(135deg, #0284c7, #38bdf8)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <ShieldCheck size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={mes}
                  onChange={(e) => setMes(parseInt(e.target.value))}
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: '700',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer'
                  }}
                >
                  {MESES.map(m => (
                    <option key={m.val} value={m.val} style={{ background: '#1e293b' }}>
                      {m.nome}
                    </option>
                  ))}
                </select>

                <select
                  value={ano}
                  onChange={(e) => setAno(parseInt(e.target.value))}
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: '700',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value={2026} style={{ background: '#1e293b' }}>2026</option>
                  <option value={2025} style={{ background: '#1e293b' }}>2025</option>
                </select>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Ciclo Mensal Operacional • {itens.length} Filiais Protege Monitoradas
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setModalWhatsAppOpen(true)}
              title="Colar respostas recebidas no WhatsApp"
            >
              <MessageSquare size={16} color="#06b6d4" />
              <span>Leitor WhatsApp</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setModalEmailsOpen(true)}
              title="Gerar e-mails para envio às filiais Protege"
            >
              <Mail size={16} color="#38bdf8" />
              <span>Gerador de E-mails</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={baixarExcelProtege}
              title="Exportar planilha oficial idêntica ao faltas_protege.xlsx"
            >
              <Download size={16} color="#10b981" />
              <span>Exportar Excel</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={salvarAlteracoes}
              disabled={saving}
              style={{ minWidth: '150px' }}
            >
              {saving ? <div className="spinner-sm"></div> : <Save size={16} />}
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', 
          gap: '14px', 
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total de Faltas & Atestados
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: totalFaltas > 0 ? '#f87171' : '#34d399', marginTop: '2px' }}>
              {totalFaltas}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Apuradas em {itens.length} filiais
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Status das Respostas
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '2px' }}>
              {totalRespondidas} / {itens.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: totalPendentes > 0 ? '#f59e0b' : '#34d399' }}>
              {totalPendentes > 0 ? `${totalPendentes} filiais pendentes` : '100% das filiais checadas'}
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total de Desconto em R$
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              R$ {totalDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {totalDesconto > 0 ? 'Tarifa por falta aplicada' : 'Sem desconto financeiro fixado'}
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
              Status do Fechamento
            </div>
            <div style={{ marginTop: '6px' }}>
              <span className={`badge ${fechamentoAtivo?.status === 'CONCLUIDO' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                {fechamentoAtivo?.status === 'CONCLUIDO' ? 'Concluído / Validado' : 'Rascunho / Em Andamento'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ref: {fechamentoAtivo?.titulo || 'Mês'}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filtrar por filial, contato ou cargo..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'todos', label: 'Todas' },
              { id: 'com_faltas', label: 'Com Faltas' },
              { id: 'sem_faltas', label: 'Sem Faltas' },
              { id: 'respondidos', label: 'Respondidas' },
              { id: 'pendentes', label: 'Pendentes' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroStatus(f.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: filtroStatus === f.id ? 'var(--accent-cyan)' : 'var(--border-color)',
                  background: filtroStatus === f.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: filtroStatus === f.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: filtroStatus === f.id ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
          Mostrando {itensFiltrados.length} de {itens.length} filiais
        </div>
      </div>

      {/* Tabela de Lojas e Faltas Protege */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-box" style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Carregando dados das filiais Protege...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th>FILIAL / UNIDADE</th>
                  <th style={{ width: '170px', textAlign: 'center' }}>FALTAS / ATESTADOS</th>
                  <th style={{ width: '180px' }}>CARGO</th>
                  <th style={{ width: '120px' }}>DATA / STATUS</th>
                  <th>CONTATO RESPONSÁVEL</th>
                  <th>E-MAILS DE CONTATOS</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>TARIFA ($)</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>DESCONTO</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>WHATSAPP</th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item, index) => {
                  const faltasNum = parseInt(item.faltas_computadas) || 0;
                  const temFaltas = faltasNum > 0;
                  return (
                    <tr 
                      key={item.id}
                      style={{ 
                        background: item.respondido_whatsapp ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
                        transition: 'background 0.2s'
                      }}
                    >
                      {/* Índice */}
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {index + 1}
                      </td>

                      {/* Nome da Loja */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {item.loja_nome}
                          </span>
                        </div>
                      </td>

                      {/* Input de Faltas com +/- */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ width: '26px', height: '26px', borderRadius: '4px' }}
                            onClick={() => ajustarFaltas(item.id, -1)}
                            disabled={faltasNum <= 0}
                          >
                            <Minus size={13} />
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={item.faltas_computadas}
                            onChange={(e) => handleFaltasChange(item.id, e.target.value)}
                            style={{
                              width: '54px',
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: '0.95rem',
                              padding: '4px',
                              borderRadius: '6px',
                              border: temFaltas ? '1px solid #ef4444' : '1px solid var(--border-color)',
                              background: temFaltas ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                              color: temFaltas ? '#f87171' : 'var(--text-primary)'
                            }}
                          />

                          <button
                            type="button"
                            className="btn-icon"
                            style={{ width: '26px', height: '26px', borderRadius: '4px' }}
                            onClick={() => ajustarFaltas(item.id, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td>
                        <input
                          type="text"
                          value={item.cargo || ''}
                          onChange={(e) => handleCargoChange(item.id, e.target.value)}
                          placeholder="AUX. DE LIMPEZA"
                          style={{
                            width: '100%',
                            fontSize: '0.8rem',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </td>

                      {/* Data / Status */}
                      <td>
                        <input
                          type="text"
                          value={item.status_data || ''}
                          onChange={(e) => handleDataChange(item.id, e.target.value)}
                          placeholder="ok"
                          style={{
                            width: '100%',
                            fontSize: '0.8rem',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'var(--text-secondary)'
                          }}
                        />
                      </td>

                      {/* Contato Responsável */}
                      <td>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {item.loja_supervisor || 'Não cadastrado'}
                        </span>
                      </td>

                      {/* E-mails de Contato */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span 
                            style={{ 
                              fontSize: '0.78rem', 
                              color: 'var(--text-muted)', 
                              maxWidth: '180px', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                            title={item.loja_emails || 'Sem e-mail'}
                          >
                            {item.loja_emails || '—'}
                          </span>
                          {item.loja_emails && (
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ width: '22px', height: '22px' }}
                              onClick={() => copiarEmails(item.loja_emails, item.id)}
                              title="Copiar e-mails desta filial"
                            >
                              {copiadoId === item.id ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Tarifa Unitária */}
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={item.valor_falta_aplicado || 0}
                          onChange={(e) => handleTarifaChange(item.id, e.target.value)}
                          style={{
                            width: '75px',
                            textAlign: 'right',
                            fontSize: '0.8rem',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </td>

                      {/* Desconto Total */}
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>
                        R$ {parseFloat(item.desconto_total || 0).toFixed(2)}
                      </td>

                      {/* Status WhatsApp */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => toggleWhatsAppStatus(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={item.respondido_whatsapp ? 'Marcado como respondido. Clique para alternar.' : 'Pendente de resposta. Clique para marcar como respondido.'}
                        >
                          <span className={`badge ${item.respondido_whatsapp ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                            {item.respondido_whatsapp ? 'Respondido' : 'Pendente'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      <WhatsAppModal
        isOpen={modalWhatsAppOpen}
        onClose={() => setModalWhatsAppOpen(false)}
        fechamentoAtivo={fechamentoAtivo}
        onSuccess={() => carregarFechamento(mes, ano)}
        showToast={showToast}
      />

      <EmailsProtegeModal
        isOpen={modalEmailsOpen}
        onClose={() => setModalEmailsOpen(false)}
        fechamentoAtivo={fechamentoAtivo}
        showToast={showToast}
      />
    </div>
  );
}
