import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Copy, 
  Check, 
  ExternalLink, 
  Users, 
  X,
  Search,
  Send,
  Building2,
  Save,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';

export default function GeradorEmails({ 
  clientCode = 'protege', 
  isOpen, 
  onClose, 
  fechamentoAtivo, 
  showToast,
  isModal = true
}) {
  const isProtege = clientCode === 'protege' || fechamentoAtivo?.cliente?.codigo === 'protege';
  const clientName = isProtege ? 'Grupo Protege' : 'Carrefour';

  const [loading, setLoading] = useState(false);
  const [copiadoCampo, setCopiadoCampo] = useState(null);
  const [dadosRaw, setDadosRaw] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('unidades'); // 'unidades' | 'consolidado'
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [busca, setBusca] = useState('');
  const [salvandoId, setSalvandoId] = useState(null);

  // Estados de edição em memória
  const [itensEditados, setItensEditados] = useState({});
  const [consolidadoEditado, setConsolidadoEditado] = useState(null);

  // Tecla ESC para fechar modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModal && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose]);

  useEffect(() => {
    if (fechamentoAtivo && (isOpen || isOpen === undefined)) {
      carregarEmails();
    }
  }, [fechamentoAtivo, isOpen, clientCode]);

  const carregarEmails = async () => {
    if (!fechamentoAtivo) return;
    setLoading(true);
    try {
      let data = null;
      if (isProtege) {
        data = await api.getResumoEmailsProtege(fechamentoAtivo.id);
      } else {
        data = await api.getResumoRegionais(fechamentoAtivo.id);
      }
      setDadosRaw(data);

      // Normaliza itens
      const mapa = {};
      if (isProtege && data?.lojas) {
        data.lojas.forEach(l => {
          mapa[l.loja_id] = {
            destinatarios: l.destinatarios || '',
            assunto: l.assunto || '',
            corpo: l.corpo || '',
          };
        });
        if (data.lojas.length > 0) {
          setSelecionadoId(data.lojas[0].loja_id);
        }
      } else if (!isProtege && data?.regionais) {
        data.regionais.forEach(r => {
          mapa[r.regiao_id] = {
            destinatarios: r.emails || '',
            assunto: r.assunto || '',
            corpo: r.corpo || '',
          };
        });
        if (data.regionais.length > 0) {
          setSelecionadoId(data.regionais[0].regiao_id);
        }
      }
      setItensEditados(mapa);

      // Normaliza consolidado
      if (data?.consolidado) {
        setConsolidadoEditado({
          destinatarios: data.consolidado.destinatarios || '',
          assunto: data.consolidado.assunto || '',
          corpo: data.consolidado.corpo || '',
        });
      }
    } catch (err) {
      showToast?.(`Erro ao carregar e-mails do ${clientName}: ` + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copiarParaAreaDeTransferencia = (texto, identificador, label = 'Conteúdo') => {
    if (!texto) {
      showToast?.('Nenhum texto para copiar.', 'error');
      return;
    }
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoCampo(identificador);
      showToast?.(`${label} copiado para a área de transferência!`, 'success');
      setTimeout(() => setCopiadoCampo(null), 2500);
    }).catch(() => {
      showToast?.('Erro ao copiar para a área de transferência.', 'error');
    });
  };

  const abrirClienteEmail = (destinatarios, assunto, corpo) => {
    const to = encodeURIComponent(destinatarios || '');
    const subject = encodeURIComponent(assunto || '');
    const body = encodeURIComponent(corpo || '');
    const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
  };

  const salvarEmailsPadraoBanco = async (regiaoId, emails) => {
    if (!emails || !emails.trim()) {
      showToast?.('Informe ao menos um e-mail para salvar como padrão.', 'error');
      return;
    }
    setSalvandoId(regiaoId);
    try {
      await api.atualizarRegiao(regiaoId, { emails_padrao: emails.trim() });
      showToast?.('E-mails padrão da regional atualizados com sucesso no banco!', 'success');
    } catch (err) {
      showToast?.('Erro ao salvar e-mails da regional: ' + err.message, 'error');
    } finally {
      setSalvandoId(null);
    }
  };

  if (isOpen !== undefined && !isOpen) return null;

  // Lista normalizada de itens
  const itensLista = isProtege 
    ? (dadosRaw?.lojas || []).map(l => ({
        id: l.loja_id,
        nome: l.loja_nome.replace('PROTEGE ', ''),
        nomeCompleto: l.loja_nome,
        subtitulo: l.contato ? `Contato: ${l.contato}` : (l.cargo || 'Filial Operacional'),
        faltas: l.faltas,
        destinatariosPadrao: l.destinatarios || '',
        assuntoPadrao: l.assunto || '',
        corpoPadrao: l.corpo || '',
        extraInfo: `Contato: ${l.contato || 'Não informado'} • Cargo: ${l.cargo || 'AUX. DE LIMPEZA'}`,
        totalDesconto: l.desconto_total,
        raw: l
      }))
    : (dadosRaw?.regionais || []).map(r => ({
        id: r.regiao_id,
        nome: r.regiao_nome,
        nomeCompleto: `REGIONAL: ${r.regiao_nome}`,
        subtitulo: `${r.total_lojas} ${r.total_lojas === 1 ? 'filial vinculada' : 'filiais vinculadas'}`,
        faltas: r.total_faltas,
        destinatariosPadrao: r.emails || '',
        assuntoPadrao: r.assunto || '',
        corpoPadrao: r.corpo || '',
        extraInfo: `Regional: ${r.regiao_nome} • ${r.total_lojas} filiais monitoradas • Desconto Total: R$ ${parseFloat(r.total_desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalDesconto: r.total_desconto,
        raw: r
      }));

  const itensFiltrados = itensLista.filter(item => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return item.nome.toLowerCase().includes(b) || 
           item.subtitulo.toLowerCase().includes(b) ||
           (item.destinatariosPadrao && item.destinatariosPadrao.toLowerCase().includes(b));
  });

  const itemAtual = itensLista.find(i => i.id === selecionadoId) || itensLista[0];
  const dadosItemEditado = itemAtual ? (itensEditados[itemAtual.id] || {
    destinatarios: itemAtual.destinatariosPadrao,
    assunto: itemAtual.assuntoPadrao,
    corpo: itemAtual.corpoPadrao
  }) : null;

  const accentColor = isProtege ? 'var(--accent-cyan)' : 'var(--accent-teal)';
  const gradientHeader = isProtege 
    ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' 
    : 'linear-gradient(135deg, #0d9488, #14b8a6)';

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 24px', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '10px', 
            background: gradientHeader, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            <Mail size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Gerador de E-mails - {clientName}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {fechamentoAtivo?.titulo || fechamentoAtivo?.periodo_texto || 'Fechamento de Faltas'} • Modelo Oficial com Resumo e Apuração
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isModal && onClose && (
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={onClose}
              title="Voltar ao fechamento operacional"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Voltar ao Fechamento</span>
            </button>
          )}

          {isModal && onClose && (
            <button 
              className="btn-icon" 
              onClick={onClose} 
              title="Fechar tela de e-mails"
              style={{
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Abas de visualização */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
        <button
          onClick={() => setAbaAtiva('unidades')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'unidades' ? `2px solid ${accentColor}` : '2px solid transparent',
            color: abaAtiva === 'unidades' ? accentColor : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Building2 size={16} />
          <span>
            {isProtege 
              ? `Por Filial / Contato (${itensLista.length})` 
              : `Por Regional (${itensLista.length} Regionais)`
            }
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva('consolidado')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: abaAtiva === 'consolidado' ? `2px solid ${accentColor}` : '2px solid transparent',
            color: abaAtiva === 'consolidado' ? accentColor : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <Users size={16} />
          <span>Resumo Consolidado Geral</span>
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
        {loading ? (
          <div className="loading-box" style={{ padding: '60px 0', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Formatando e-mails dinâmicos do {clientName}...</p>
          </div>
        ) : abaAtiva === 'unidades' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '20px', minHeight: '460px' }}>
            {/* Coluna Esquerda: Lista de Unidades/Regionais */}
            <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder={isProtege ? "Buscar filial ou contato..." : "Buscar regional ou filial..."}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
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

              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '440px', paddingRight: '4px' }}>
                {itensFiltrados.map(item => {
                  const isSelected = item.id === itemAtual?.id;
                  const temFaltas = item.faltas > 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelecionadoId(item.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        background: isSelected 
                          ? (isProtege ? 'rgba(56, 189, 248, 0.15)' : 'rgba(89, 159, 166, 0.2)') 
                          : 'rgba(255,255,255,0.02)',
                        border: isSelected ? `1px solid ${accentColor}` : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                          fontWeight: isSelected ? 700 : 500, 
                          fontSize: '0.85rem',
                          color: isSelected ? accentColor : 'var(--text-primary)'
                        }}>
                          {item.nome}
                        </span>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          background: temFaltas ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: temFaltas ? '#f87171' : '#34d399'
                        }}>
                          {item.faltas} {item.faltas === 1 ? 'falta' : 'faltas'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.subtitulo}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coluna Direita: Detalhes e Editor do E-mail */}
            {itemAtual && dadosItemEditado && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Banner do Item */}
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {itemAtual.nomeCompleto}
                    </div>
                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      {itemAtual.extraInfo}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!isProtege && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => salvarEmailsPadraoBanco(itemAtual.id, dadosItemEditado.destinatarios)}
                        disabled={salvandoId === itemAtual.id}
                        title="Salvar estes e-mails como padrão permanente desta regional"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Save size={14} color="#10b981" />
                        <span>{salvandoId === itemAtual.id ? 'Salvando...' : 'Salvar Padrão'}</span>
                      </button>
                    )}

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const completo = `Para: ${dadosItemEditado.destinatarios}\nAssunto: ${dadosItemEditado.assunto}\n\n${dadosItemEditado.corpo}`;
                        copiarParaAreaDeTransferencia(completo, `completo-${itemAtual.id}`, 'E-mail completo');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      {copiadoCampo === `completo-${itemAtual.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>Copiar Tudo</span>
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => abrirClienteEmail(
                        dadosItemEditado.destinatarios,
                        dadosItemEditado.assunto,
                        dadosItemEditado.corpo
                      )}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Send size={14} />
                      <span>Abrir no Outlook</span>
                    </button>
                  </div>
                </div>

                {/* Campo Destinatários */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {isProtege ? 'DESTINATÁRIOS (E-MAILS DE CONTATO)' : 'DESTINATÁRIOS (REGIONAIS CARREFOUR)'}
                    </label>
                    <button 
                      style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => copiarParaAreaDeTransferencia(dadosItemEditado.destinatarios, `dest-${itemAtual.id}`, 'Destinatários')}
                    >
                      {copiadoCampo === `dest-${itemAtual.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>Copiar e-mails</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={dadosItemEditado.destinatarios}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItensEditados(prev => ({
                        ...prev,
                        [itemAtual.id]: { ...prev[itemAtual.id], destinatarios: val }
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Campo Assunto */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      ASSUNTO DO E-MAIL
                    </label>
                    <button 
                      style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => copiarParaAreaDeTransferencia(dadosItemEditado.assunto, `ass-${itemAtual.id}`, 'Assunto')}
                    >
                      {copiadoCampo === `ass-${itemAtual.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>Copiar assunto</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={dadosItemEditado.assunto}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItensEditados(prev => ({
                        ...prev,
                        [itemAtual.id]: { ...prev[itemAtual.id], assunto: val }
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  />
                </div>

                {/* Campo Corpo do E-mail */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      CORPO DO E-MAIL
                    </label>
                    <button 
                      style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => copiarParaAreaDeTransferencia(dadosItemEditado.corpo, `corpo-${itemAtual.id}`, 'Corpo do e-mail')}
                    >
                      {copiadoCampo === `corpo-${itemAtual.id}` ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                      <span>Copiar corpo</span>
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={dadosItemEditado.corpo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItensEditados(prev => ({
                        ...prev,
                        [itemAtual.id]: { ...prev[itemAtual.id], corpo: val }
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Aba Consolidado */
          consolidadoEditado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ 
                padding: '14px 18px', 
                borderRadius: '8px', 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    E-mail de Fechamento Consolidado Geral
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Resumo geral unificado com todas as unidades e totais apurados no período para envio e validação global.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const completo = `Para: ${consolidadoEditado.destinatarios}\nAssunto: ${consolidadoEditado.assunto}\n\n${consolidadoEditado.corpo}`;
                      copiarParaAreaDeTransferencia(completo, 'completo-cons', 'E-mail completo');
                    }}
                  >
                    {copiadoCampo === 'completo-cons' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    <span>Copiar Tudo</span>
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => abrirClienteEmail(
                      consolidadoEditado.destinatarios,
                      consolidadoEditado.assunto,
                      consolidadoEditado.corpo
                    )}
                  >
                    <Send size={14} />
                    <span>Abrir no Outlook</span>
                  </button>
                </div>
              </div>

              {/* Destinatários Gerais */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    DESTINATÁRIOS GERAIS
                  </label>
                  <button 
                    style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => copiarParaAreaDeTransferencia(consolidadoEditado.destinatarios, 'dest-cons', 'Destinatários')}
                  >
                    {copiadoCampo === 'dest-cons' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>Copiar e-mails</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={consolidadoEditado.destinatarios}
                  onChange={(e) => setConsolidadoEditado(prev => ({ ...prev, destinatarios: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Assunto Geral */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    ASSUNTO
                  </label>
                  <button 
                    style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => copiarParaAreaDeTransferencia(consolidadoEditado.assunto, 'ass-cons', 'Assunto')}
                  >
                    {copiadoCampo === 'ass-cons' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>Copiar assunto</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={consolidadoEditado.assunto}
                  onChange={(e) => setConsolidadoEditado(prev => ({ ...prev, assunto: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Corpo Consolidado */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    CORPO DO E-MAIL (RESUMO COMPLETO)
                  </label>
                  <button 
                    style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => copiarParaAreaDeTransferencia(consolidadoEditado.corpo, 'corpo-cons', 'Corpo do e-mail')}
                  >
                    {copiadoCampo === 'corpo-cons' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>Copiar corpo</span>
                  </button>
                </div>
                <textarea
                  rows={12}
                  value={consolidadoEditado.corpo}
                  onChange={(e) => setConsolidadoEditado(prev => ({ ...prev, corpo: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        padding: '16px 24px', 
        borderTop: '1px solid var(--border-color)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {isProtege 
            ? '* O texto segue a diretriz da planilha oficial da Protege (faturamento automático em 24h sem divergência apontada).'
            : '* Resumo regional oficial baseado no fechamento operacional Carrefour (Ciclo 20 a 19).'
          }
        </div>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            {isModal ? 'Fechar' : 'Voltar ao Fechamento'}
          </button>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className="modal-content glass-panel" 
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '1020px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
      {content}
    </div>
  );
}
