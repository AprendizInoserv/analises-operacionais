import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Users, 
  Calendar, 
  ArrowDownToLine, 
  Filter, 
  Search, 
  Sparkles, 
  RefreshCw,
  Plus, 
  Trash2, 
  Store, 
  CheckCircle2, 
  Layers,
  HelpCircle,
  Clock,
  UserCheck,
  X
} from 'lucide-react';
import { api } from '../../services/api';

export default function DetalheGerador({ fechamentoAtivo, showToast }) {
  const [loading, setLoading] = useState(true);
  const [lojasResumo, setLojasResumo] = useState([]);
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState('');
  const [dadosDetalhe, setDadosDetalhe] = useState(null);
  const [busca, setBusca] = useState('');
  const [copiadoTipo, setCopiadoTipo] = useState(null);
  const [pagina, setPagina] = useState(1);
  const ITENS_POR_PAGINA = 50;

  // Estado para modal de gerenciar colaboradores
  const [modalColabsAberto, setModalColabsAberto] = useState(false);
  const [colaboradoresLoja, setColaboradoresLoja] = useState([]);
  const [novoColabNome, setNovoColabNome] = useState('');
  const [novoColabTurno, setNovoColabTurno] = useState('');
  const [salvandoColab, setSalvandoColab] = useState(false);

  // Carrega os dados da matriz do backend
  const carregarDetalhes = async (lojaId = null) => {
    if (!fechamentoAtivo) return;
    setLoading(true);
    try {
      const res = await api.getDetalheGerador(fechamentoAtivo.id, lojaId || null);
      setDadosDetalhe(res);
      setLojasResumo(res.resumo_lojas || []);
      setPagina(1);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar matriz de detalhes e datas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDetalhes(lojaSelecionadaId);
  }, [fechamentoAtivo, lojaSelecionadaId]);

  // Função para copiar texto para a área de transferência
  const copiarTexto = async (texto, tipo, mensagemSucesso) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoTipo(tipo);
      showToast(mensagemSucesso, 'success');
      setTimeout(() => setCopiadoTipo(null), 3000);
    } catch (err) {
      console.error(err);
      showToast('Não foi possível copiar automaticamente para a área de transferência.', 'error');
    }
  };

  // Filtragem das linhas da tabela
  const linhasFiltradas = useMemo(() => {
    if (!dadosDetalhe || !dadosDetalhe.linhas) return [];
    if (!busca.trim()) return dadosDetalhe.linhas;

    const termo = busca.toLowerCase();
    return dadosDetalhe.linhas.filter(r => 
      r.colaborador_nome?.toLowerCase().includes(termo) ||
      r.loja_nome?.toLowerCase().includes(termo) ||
      r.dia?.includes(termo) ||
      r.sigla?.toLowerCase().includes(termo) ||
      r.regional?.toLowerCase().includes(termo)
    );
  }, [dadosDetalhe, busca]);

  // Paginação
  const totalPaginas = Math.ceil(linhasFiltradas.length / ITENS_POR_PAGINA) || 1;
  const linhasPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    return linhasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [linhasFiltradas, pagina]);

  // Carrega colaboradores da loja selecionada para edição
  const abrirModalColaboradores = async () => {
    if (!lojaSelecionadaId) {
      showToast('Selecione uma loja específica para gerenciar seus colaboradores.', 'info');
      return;
    }
    setModalColabsAberto(true);
    try {
      const colabs = await api.getColaboradoresLoja(lojaSelecionadaId);
      setColaboradoresLoja(colabs);
    } catch (err) {
      showToast('Erro ao carregar colaboradores da filial', 'error');
    }
  };

  const handleAdicionarColaborador = async (e) => {
    e.preventDefault();
    if (!novoColabNome.trim() || !lojaSelecionadaId) return;

    setSalvandoColab(true);
    try {
      await api.criarColaborador({
        nome: novoColabNome.trim().toUpperCase(),
        loja: lojaSelecionadaId,
        turno: novoColabTurno.trim() || '1º Turno',
        status: 'ATIVO',
        cargo: 'Operador de Loja / Limpeza',
        salario: 1850.00
      });
      setNovoColabNome('');
      setNovoColabTurno('');
      const colabs = await api.getColaboradoresLoja(lojaSelecionadaId);
      setColaboradoresLoja(colabs);
      showToast('Colaborador adicionado com sucesso! A matriz foi recalculada.', 'success');
      carregarDetalhes(lojaSelecionadaId);
    } catch (err) {
      showToast('Erro ao adicionar colaborador', 'error');
    } finally {
      setSalvandoColab(false);
    }
  };

  const handleRemoverColaborador = async (colabId, nome) => {
    if (!window.confirm(`Deseja remover o colaborador "${nome}" desta loja?`)) return;
    try {
      await api.excluirColaborador(colabId);
      setColaboradoresLoja(prev => prev.filter(c => c.id !== colabId));
      showToast(`Colaborador ${nome} removido.`, 'info');
      carregarDetalhes(lojaSelecionadaId);
    } catch (err) {
      showToast('Erro ao remover colaborador', 'error');
    }
  };

  const lojaAtualInfo = useMemo(() => {
    if (!lojaSelecionadaId) return null;
    return lojasResumo.find(l => String(l.loja_id) === String(lojaSelecionadaId));
  }, [lojasResumo, lojaSelecionadaId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner de Contexto do Exemplocarrefour.pdf */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderLeft: '4px solid var(--accent-teal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge-tag-active" style={{ fontSize: '0.75rem' }}>
                Conforme Exemplocarrefour.pdf
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                • Painel Oficial de Escalas e Detalhes
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              Gerador de Detalhe & Repetição de Datas (Coluna M)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, maxWidth: '850px' }}>
              Geração automática dos dias do ciclo (Dia 20 ao Dia 19). Cada data se repete na <strong>Coluna M</strong> proporcionalmente 
              ao número de colaboradores ativos de cada loja, substituindo o processo manual de arrasto do Excel.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => carregarDetalhes(lojaSelecionadaId)}
              disabled={loading}
              title="Recarregar matriz"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Atualizar</span>
            </button>

            <a 
              href={fechamentoAtivo ? api.getDownloadDetalheExcelUrl(fechamentoAtivo.id, lojaSelecionadaId) : '#'}
              className="btn btn-primary btn-sm"
              target="_blank"
              rel="noreferrer"
              title="Baixar planilha formatada com a aba 'Detalhe' exatamente como exigido pelo Carrefour"
            >
              <FileSpreadsheet size={16} />
              <span>Exportar Detalhe (.xlsx)</span>
            </a>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Controles */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Seletor de Loja */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} style={{ color: 'var(--accent-teal)' }} />
              <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Filial / Loja:
              </label>
              <select 
                value={lojaSelecionadaId} 
                onChange={(e) => setLojaSelecionadaId(e.target.value)}
                className="select-custom"
                style={{ minWidth: '260px' }}
              >
                <option value="">Todas as Lojas (Consolidado - 19 filiais)</option>
                {lojasResumo.map(l => (
                  <option key={l.loja_id} value={l.loja_id}>
                    {l.loja_nome} ({l.total_colaboradores} colaboradores • {l.total_linhas} linhas)
                  </option>
                ))}
              </select>
            </div>

            {/* Caixa de Busca */}
            <div className="search-box-wrap" style={{ position: 'relative', width: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text"
                placeholder="Buscar funcionário, data..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="input-custom"
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Botões de Cópia Rápida para o Excel */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 1. COPIAR COLUNA M (DATAS) */}
            <button 
              className={`btn btn-sm ${copiadoTipo === 'datas' ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => {
                if (dadosDetalhe?.coluna_m_datas) {
                  copiarTexto(
                    dadosDetalhe.coluna_m_datas, 
                    'datas', 
                    'Coluna M copiada! Abra o Excel e cole (Ctrl+V) direto na Coluna M.'
                  );
                }
              }}
              title="Copia somente as datas repetidas prontas para colar na Coluna M do Carrefour"
            >
              {copiadoTipo === 'datas' ? <Check size={16} /> : <Copy size={16} />}
              <span><strong>Copiar Datas (Coluna M)</strong></span>
            </button>

            {/* 2. COPIAR COLUNA J (NOMES) */}
            <button 
              className={`btn btn-sm ${copiadoTipo === 'nomes' ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => {
                if (dadosDetalhe?.coluna_j_nomes) {
                  copiarTexto(
                    dadosDetalhe.coluna_j_nomes, 
                    'nomes', 
                    'Nomes dos funcionários copiados para a área de transferência!'
                  );
                }
              }}
              title="Copia os nomes dos colaboradores na ordem exata"
            >
              {copiadoTipo === 'nomes' ? <Check size={16} /> : <Copy size={16} />}
              <span>Copiar Nomes (Coluna J)</span>
            </button>

            {/* 3. COPIAR TABELA COMPLETA (TSV) */}
            <button 
              className={`btn btn-sm ${copiadoTipo === 'tsv' ? 'btn-success' : 'btn-secondary'}`}
              onClick={() => {
                if (dadosDetalhe?.tsv_completo) {
                  copiarTexto(
                    dadosDetalhe.tsv_completo, 
                    'tsv', 
                    'Tabela Detalhe completa copiada em formato TSV! Cole direto na célula E2 do Excel.'
                  );
                }
              }}
              title="Copia todas as colunas (E até S) com separador TAB pronto para o Excel"
            >
              {copiadoTipo === 'tsv' ? <Check size={16} /> : <Layers size={16} />}
              <span>Copiar Tabela Completa</span>
            </button>

            {/* 4. GERENCIAR COLABORADORES */}
            {lojaSelecionadaId && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={abrirModalColaboradores}
                title="Cadastrar ou ajustar colaboradores desta loja"
              >
                <Users size={16} style={{ color: 'var(--accent-teal)' }} />
                <span>Colaboradores ({lojaAtualInfo?.total_colaboradores || 0})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Métricas & Indicador Proporcional da Regra */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(89, 159, 166, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)' }}>
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Período do Ciclo</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {dadosDetalhe?.total_dias || 31} dias
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {dadosDetalhe?.periodo || '20 a 19 de cada mês'}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Efetivo Ativo</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>
              {lojaAtualInfo ? `${lojaAtualInfo.total_colaboradores} colaboradores` : `${dadosDetalhe?.total_colaboradores || 0} no total`}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {lojaAtualInfo ? `${lojaAtualInfo.loja_nome}` : 'Distribuídos em 19 lojas'}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(89, 159, 166, 0.3)' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(89, 159, 166, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-teal)' }}>
            <RepeatIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-teal)', fontWeight: '600' }}>Repetições na Coluna M</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {lojaAtualInfo ? `${lojaAtualInfo.repeticoes_por_data}x por dia` : 'Varia por filial'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {lojaAtualInfo ? `1 para cada um dos ${lojaAtualInfo.total_colaboradores} colabs` : '1 repetição por colaborador'}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Linhas Geradas</div>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#a78bfa' }}>
              {linhasFiltradas.length.toLocaleString('pt-BR')} linhas
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {lojaAtualInfo ? `${lojaAtualInfo.total_colaboradores} colabs × ${dadosDetalhe?.total_dias} dias` : 'Soma de todas as lojas'}
            </div>
          </div>
        </div>
      </div>

      {/* Caixa de Explicação Didática da Regra do PDF */}
      <div style={{ 
        background: 'rgba(23, 23, 23, 0.8)', 
        border: '1px solid rgba(89, 159, 166, 0.2)', 
        borderRadius: '8px', 
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <HelpCircle size={20} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Entenda a lógica descrita no PDF: </strong>
          No Excel, para montar a aba Detalhe, você contava quantos colaboradores tinha na loja (ex: 4 colaboradores) e precisava arrastar as datas de 20 a 19 fazendo cada dia se repetir 4 vezes. 
          Aqui, <strong>o sistema já monta toda a matriz calculada</strong>: a data na <strong>Coluna M</strong> se repete exatamente uma vez por colaborador, gerando todas as linhas automaticamente. 
          Basta clicar em <strong>"Copiar Datas (Coluna M)"</strong> ou <strong>"Exportar Detalhe (.xlsx)"</strong>!
        </div>
      </div>

      {/* Tabela de Dados Interativa */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ 
          padding: '14px 20px', 
          borderBottom: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(23, 23, 23, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--accent-teal)' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              Visualização da Planilha Detalhe (Colunas E a S)
            </h3>
            <span className="badge-tag-future" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
              {linhasFiltradas.length} registros
            </span>
          </div>

          {/* Paginação Superior */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Página {pagina} de {totalPaginas}
            </span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              style={{ padding: '3px 8px' }}
            >
              Anterior
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              style={{ padding: '3px 8px' }}
            >
              Próxima
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div style={{ overflowX: 'auto', maxHeight: '560px' }}>
          <table className="custom-table" style={{ width: '100%', fontSize: '0.825rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#121212' }}>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                <th>Nome da Loja (E)</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Sigla (F)</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Centro (G)</th>
                <th>Regional (H)</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Formato (I)</th>
                <th>Nome do Funcionário (J)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Turno (K)</th>
                {/* DESTAQUE PARA A COLUNA M */}
                <th style={{ 
                  textAlign: 'center', 
                  background: 'rgba(89, 159, 166, 0.25)', 
                  color: 'var(--accent-teal)',
                  borderLeft: '2px solid var(--accent-teal)',
                  borderRight: '2px solid var(--accent-teal)',
                  fontWeight: '700'
                }}>
                  Dia (Coluna M) ★
                </th>
                <th style={{ width: '95px', textAlign: 'center' }}>Presente (N)</th>
                <th>Quem cobriu falta (O)</th>
                <th>Observações (P)</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Status (Q)</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Desconto (R)</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Mês (S)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="15" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Gerando matriz proporcional de datas e colaboradores...</span>
                    </div>
                  </td>
                </tr>
              ) : linhasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan="15" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Nenhum registro encontrado para o filtro aplicado.
                  </td>
                </tr>
              ) : (
                linhasPaginadas.map((row, idx) => {
                  const globalIdx = (pagina - 1) * ITENS_POR_PAGINA + idx + 1;
                  return (
                    <tr key={`${row.loja_id}-${row.colaborador_id}-${row.dia_iso}-${idx}`}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{globalIdx}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{row.loja_nome}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.sigla}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.centro}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.regional}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.725rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
                          {row.formato}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600', color: '#e2e8f0' }}>{row.colaborador_nome}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{row.turno || '1º'}</td>
                      
                      {/* CÉLULA DA COLUNA M COM DESTAQUE VISUAL */}
                      <td style={{ 
                        textAlign: 'center', 
                        background: 'rgba(89, 159, 166, 0.08)',
                        borderLeft: '1px solid rgba(89, 159, 166, 0.3)',
                        borderRight: '1px solid rgba(89, 159, 166, 0.3)',
                        fontWeight: '700',
                        color: 'var(--accent-teal)'
                      }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(89, 159, 166, 0.18)',
                          fontSize: '0.8rem'
                        }}>
                          {row.dia}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          background: row.presente === 'Presente' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: row.presente === 'Presente' ? '#10b981' : '#ef4444'
                        }}>
                          {row.presente}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.quem_cobriu || '-'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.observacoes || 'Presente'}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.status}</td>
                      <td style={{ textAlign: 'right', fontWeight: '500', color: row.desconto > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                        R$ {row.desconto.toFixed(2).replace('.', ',')}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{row.mes}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Tabela */}
        <div style={{ 
          padding: '12px 20px', 
          borderTop: '1px solid var(--border-color)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Mostrando <strong>{linhasPaginadas.length}</strong> de <strong>{linhasFiltradas.length.toLocaleString('pt-BR')}</strong> registros gerados
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Página {pagina} de {totalPaginas}</span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              style={{ padding: '3px 8px' }}
            >
              Anterior
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              style={{ padding: '3px 8px' }}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Gerenciamento de Colaboradores da Filial */}
      {modalColabsAberto && (
        <div className="modal-overlay" onClick={() => setModalColabsAberto(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} style={{ color: 'var(--accent-teal)' }} />
                <h3>Colaboradores: {lojaAtualInfo?.loja_nome}</h3>
              </div>
              <button className="close-btn" onClick={() => setModalColabsAberto(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Estes são os colaboradores ativos cadastrados nesta filial. Cada um deles recebe uma linha para cada dia do fechamento (repetição proporcional na <strong>Coluna M</strong>).
              </p>

              {/* Formulário para Adicionar Colaborador */}
              <form onSubmit={handleAdicionarColaborador} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input 
                  type="text"
                  placeholder="Nome completo do novo colaborador..."
                  value={novoColabNome}
                  onChange={(e) => setNovoColabNome(e.target.value)}
                  className="input-custom"
                  style={{ flex: 2, textTransform: 'uppercase' }}
                  required
                />
                <input 
                  type="text"
                  placeholder="Turno (ex: 1º Turno)"
                  value={novoColabTurno}
                  onChange={(e) => setNovoColabTurno(e.target.value)}
                  className="input-custom"
                  style={{ flex: 1 }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm" 
                  disabled={salvandoColab}
                  style={{ flexShrink: 0 }}
                >
                  <Plus size={16} />
                  <span>{salvandoColab ? 'Adicionando...' : 'Adicionar'}</span>
                </button>
              </form>

              {/* Lista dos Colaboradores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {colaboradoresLoja.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    Nenhum colaborador cadastrado nesta loja.
                  </div>
                ) : (
                  colaboradoresLoja.map((colab, i) => (
                    <div 
                      key={colab.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '24px' }}>
                          #{i + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {colab.nome}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {colab.cargo || 'Operador'} • {colab.turno || '1º Turno'}
                          </div>
                        </div>
                      </div>

                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleRemoverColaborador(colab.id, colab.nome)}
                        style={{ color: '#ef4444', padding: '4px 8px' }}
                        title="Remover colaborador da loja"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalColabsAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Ícone personalizado de repetição
function RepeatIcon({ size = 20, ...props }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="m17 2 4 4-4 4"/>
      <path d="M3 11v-1a4 4 0 0 1 4-4h14"/>
      <path d="m7 22-4-4 4-4"/>
      <path d="M21 13v1a4 4 0 0 1-4 4H3"/>
    </svg>
  );
}
