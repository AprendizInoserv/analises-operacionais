import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Store, 
  ClipboardList, 
  UserCheck, 
  CalendarDays, 
  UserX, 
  FileText, 
  Moon, 
  FileSpreadsheet, 
  Wand2, 
  Eraser, 
  Search, 
  FilterX, 
  Plus, 
  Trash2, 
  Edit3, 
  Settings, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Info,
  Calendar,
  X,
  ArrowLeft
} from 'lucide-react';
import { api } from '../../services/api';

export default function FechamentoButanta({ showToast, onVoltar }) {
  // Estado das abas da tabela (Turnos vs Resumo Diário)
  const [activeTableTab, setActiveTableTab] = useState('tabTurnos'); // 'tabTurnos' | 'tabDiario'

  // Filtros
  const [filtroShopping, setFiltroShopping] = useState('todos');
  const [filtroTurno, setFiltroTurno] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('');
  const [buscaTexto, setBuscaTexto] = useState('');

  // Dados do banco
  const [records, setRecords] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [shoppings, setShoppings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Leitor WhatsApp / Processador Inteligente
  const [rawText, setRawText] = useState('');
  const [targetShopping, setTargetShopping] = useState('Shopping Butantã');
  const [autoSplit, setAutoSplit] = useState(true);
  const [autoDate, setAutoDate] = useState(true);
  const [autoMerge, setAutoMerge] = useState(true);
  const [parsing, setParsing] = useState(false);

  // Modais
  const [modalReviewOpen, setModalReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [modalShoppingsOpen, setModalShoppingsOpen] = useState(false);
  const [novoShoppingNome, setNovoShoppingNome] = useState('');
  const [savingShopping, setSavingShopping] = useState(false);

  // Carregar Shoppings
  const carregarShoppings = async () => {
    try {
      const res = await api.getShoppingsButanta();
      if (res.success) {
        setShoppings(res.shoppings || []);
        if (res.shoppings && res.shoppings.length > 0 && !targetShopping) {
          setTargetShopping(res.shoppings[0].nome);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar shoppings:', e);
    }
  };

  // Carregar Registros e Resumo
  const carregarDados = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const filters = {
        month: filtroMes,
        search: buscaTexto,
        turno: filtroTurno,
        shopping: filtroShopping
      };

      const [recordsRes, summaryRes] = await Promise.all([
        api.getRecordsButanta(filters),
        api.getSummaryButanta(filtroMes, filtroShopping)
      ]);

      if (recordsRes.success) {
        setRecords(recordsRes.records || []);
      }
      if (summaryRes.success) {
        setKpis(summaryRes.kpis || {});
        setDailySummary(summaryRes.daily_summary || []);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
      if (!silent) showToast('Erro ao carregar dados do quadro: ' + e.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filtroMes, filtroShopping, filtroTurno, buscaTexto, showToast]);

  useEffect(() => {
    carregarShoppings();
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Reset de filtros
  const handleResetFilters = () => {
    setFiltroShopping('todos');
    setFiltroTurno('todos');
    setFiltroMes('');
    setBuscaTexto('');
  };

  // Processar mensagem
  const handleProcessarMensagem = async () => {
    if (!rawText.trim()) {
      showToast('Por favor, cole o texto da mensagem para análise.', 'warning');
      return;
    }

    setParsing(true);
    try {
      const res = await api.parseQuadroButanta(rawText, autoSplit, autoDate, targetShopping);
      if (!res.success) {
        showToast(res.error || 'Erro ao processar mensagem', 'error');
        return;
      }

      // Se houver linhas não reconhecidas ou avisos, abre o Modal de Revisão Inteligente
      if (res.has_warnings || (res.unexpected_items && res.unexpected_items.length > 0)) {
        setReviewData(res);
        setModalReviewOpen(true);
      } else {
        // Grava diretamente se tudo foi perfeitamente categorizado
        const saveRes = await api.saveRecordsButanta(res.records, autoMerge);
        if (saveRes.success) {
          showToast(`Quadro gravado com sucesso! (${saveRes.results?.length || 0} turnos adicionados)`, 'success');
          setRawText('');
          carregarDados(true);
        }
      }
    } catch (e) {
      showToast('Erro ao processar mensagem: ' + e.message, 'error');
    } finally {
      setParsing(false);
    }
  };

  // Confirmação de gravação no Modal de Revisão
  const handleConfirmarRevisao = async () => {
    if (!reviewData || !reviewData.records) return;

    try {
      const saveRes = await api.saveRecordsButanta(reviewData.records, autoMerge);
      if (saveRes.success) {
        showToast(`Quadro gravado com sucesso no SQLite! (${saveRes.results?.length || 0} turnos)`, 'success');
        setModalReviewOpen(false);
        setReviewData(null);
        setRawText('');
        carregarDados(true);
      }
    } catch (e) {
      showToast('Erro ao gravar dados revisados: ' + e.message, 'error');
    }
  };

  // Reclassificar item inesperado
  const handleAtualizarItemInesperado = (idx, novaCategoria, novaQtd) => {
    if (!reviewData) return;
    const novosInesperados = [...reviewData.unexpected_items];
    novosInesperados[idx].suggested_category = novaCategoria;
    if (novaQtd !== undefined) {
      novosInesperados[idx].detected_number = Math.max(0, parseInt(novaQtd) || 0);
    }

    const item = novosInesperados[idx];
    const recIndex = reviewData.records.findIndex(
      r => r.date === item.date && r.turno === item.turno && r.shopping === item.shopping
    );

    if (recIndex >= 0) {
      const novosRecords = [...reviewData.records];
      const rec = { ...novosRecords[recIndex] };
      const qtd = item.detected_number;

      if (novaCategoria === 'presentes') rec.presentes += qtd;
      else if (novaCategoria === 'folgas') rec.folgas += qtd;
      else if (novaCategoria === 'faltas') rec.faltas += qtd;
      else if (novaCategoria === 'atestados') rec.atestados += qtd;
      else if (novaCategoria === 'apoio_noite') rec.apoio_noite += qtd;
      else if (novaCategoria === 'banheirista_apoio') rec.banheirista_apoio += qtd;

      novosRecords[recIndex] = rec;
      setReviewData({
        ...reviewData,
        unexpected_items: novosInesperados,
        records: novosRecords
      });
    } else {
      setReviewData({
        ...reviewData,
        unexpected_items: novosInesperados
      });
    }
  };

  // Adicionar shopping
  const handleAddShopping = async (e) => {
    e?.preventDefault();
    const nome = novoShoppingNome.trim();
    if (!nome) {
      showToast('Informe o nome do shopping.', 'warning');
      return;
    }

    setSavingShopping(true);
    try {
      const res = await api.addShoppingButanta(nome);
      if (res.success) {
        showToast(res.message || 'Shopping cadastrado com sucesso!', 'success');
        setNovoShoppingNome('');
        await carregarShoppings();
        setTargetShopping(nome);
        setFiltroShopping(nome);
      }
    } catch (e) {
      showToast(e.message || 'Erro ao adicionar shopping', 'error');
    } finally {
      setSavingShopping(false);
    }
  };

  // Excluir shopping
  const handleDeleteShopping = async (shop) => {
    if (!window.confirm(`Tem certeza que deseja retirar o shopping "${shop.nome}"? Todos os registros vinculados serão excluídos.`)) {
      return;
    }

    try {
      const res = await api.deleteShoppingButanta(shop.id);
      if (res.success) {
        showToast(res.message, 'info');
        await carregarShoppings();
        carregarDados(true);
      }
    } catch (e) {
      showToast('Erro ao retirar shopping: ' + e.message, 'error');
    }
  };

  // Salvar registro manual
  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      if (editingRecord.id) {
        await api.updateRecordButanta(editingRecord.id, editingRecord);
        showToast('Registro atualizado com sucesso!', 'success');
      } else {
        await api.saveRecordsButanta([editingRecord], autoMerge);
        showToast('Novo registro adicionado com sucesso!', 'success');
      }
      setModalEditOpen(false);
      setEditingRecord(null);
      carregarDados(true);
    } catch (e) {
      showToast('Erro ao salvar registro: ' + e.message, 'error');
    }
  };

  // Excluir registro
  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Deseja realmente excluir este turno?')) return;
    try {
      await api.deleteRecordButanta(recordId);
      showToast('Registro excluído com sucesso.', 'info');
      carregarDados(true);
    } catch (e) {
      showToast('Erro ao excluir: ' + e.message, 'error');
    }
  };

  // Limpar todos os registros
  const handleLimparTodosRegistros = async () => {
    const confirmStr = prompt('ATENÇÃO: Digite "LIMPAR" para confirmar a exclusão de todos os registros do quadro de funcionários:');
    if (confirmStr !== 'LIMPAR') {
      if (confirmStr !== null) showToast('Ação cancelada.', 'info');
      return;
    }

    try {
      const res = await api.clearRecordsButanta();
      showToast(res.message || 'Registros removidos com sucesso.', 'info');
      carregarDados(true);
    } catch (e) {
      showToast('Erro ao limpar: ' + e.message, 'error');
    }
  };

  return (
    <div className="butanta-container animate-fade-in">
      {/* ============================================================= */}
      {/* 1. TOP HEADER BAR (EXATO DO PROJETO BUTTAN COM DARK PALETTE)   */}
      {/* ============================================================= */}
      <header className="butanta-app-header">
        <div className="butanta-header-brand">
          {onVoltar && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onVoltar}
              title="Voltar para a tela de Clientes (Início)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>
          )}

          <div className="butanta-brand-icon">
            <Store size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="butanta-brand-title">Quadro de Funcionários</h1>
              <span className="card-ref-badge badge-tag-active" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                Shopping Butantã • Ativo
              </span>
            </div>
            <p className="butanta-brand-subtitle">Gestor de Presenças, Escalas e Relatórios Diários • SQLite Local</p>
          </div>
        </div>

        <div className="butanta-header-actions">
          {/* Pill de seleção de Shopping */}
          <div className="butanta-shopping-pill" title="Shopping selecionado para visualização">
            <Store size={15} style={{ color: 'var(--accent-cyan)' }} />
            <select 
              value={filtroShopping} 
              onChange={(e) => setFiltroShopping(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
            >
              <option value="todos" style={{ background: '#0f172a' }}>Todos os Shoppings</option>
              {shoppings.map(s => (
                <option key={s.id} value={s.nome} style={{ background: '#0f172a' }}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* Botão Gerenciar Shoppings */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setModalShoppingsOpen(true)}
            title="Gerenciar Shoppings (Cadastrar Novo ou Retirar)"
          >
            <Store size={15} />
            <span>Shoppings (Gerenciar)</span>
          </button>

          {/* Status SQLite */}
          <div className="butanta-status-pill" title="Banco de dados SQLite operacional">
            <span className="butanta-pulse-dot"></span>
            <span>SQLite Conectado</span>
          </div>

          {/* Botão Novo Registro */}
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingRecord({
                data: new Date().toLocaleDateString('pt-BR'),
                shopping: filtroShopping !== 'todos' ? filtroShopping : (shoppings[0]?.nome || 'Shopping Butantã'),
                turno: 'Manhã',
                presentes: 0,
                folgas: 0,
                faltas: 0,
                atestados: 0,
                apoio_noite: 0,
                banheirista_apoio: 0,
                outros: [],
                observacoes: ''
              });
              setModalEditOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Novo Registro</span>
          </button>
        </div>
      </header>

      {/* ============================================================= */}
      {/* 2. KPI SUMMARY GRID (7 CARDS EXATOS DO BUTTAN)                 */}
      {/* ============================================================= */}
      <section className="butanta-kpi-grid">
        {/* Total de Registros */}
        <div className="butanta-kpi-card highlight">
          <div className="butanta-kpi-icon">
            <ClipboardList size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Total de Registros</span>
            <span className="butanta-kpi-value">{kpis?.total_registros || 0}</span>
          </div>
        </div>

        {/* Presentes */}
        <div className="butanta-kpi-card success">
          <div className="butanta-kpi-icon">
            <UserCheck size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Presentes</span>
            <span className="butanta-kpi-value" style={{ color: '#4ade80' }}>{kpis?.total_presentes || 0}</span>
          </div>
        </div>

        {/* Folgas */}
        <div className="butanta-kpi-card info">
          <div className="butanta-kpi-icon">
            <CalendarDays size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Folgas</span>
            <span className="butanta-kpi-value" style={{ color: '#60a5fa' }}>{kpis?.total_folgas || 0}</span>
          </div>
        </div>

        {/* Faltas */}
        <div className="butanta-kpi-card danger">
          <div className="butanta-kpi-icon">
            <UserX size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Faltas</span>
            <span className="butanta-kpi-value" style={{ color: '#f87171' }}>{kpis?.total_faltas || 0}</span>
          </div>
        </div>

        {/* Atestados */}
        <div className="butanta-kpi-card warning">
          <div className="butanta-kpi-icon">
            <FileText size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Atestados</span>
            <span className="butanta-kpi-value" style={{ color: '#fbbf24' }}>{kpis?.total_atestados || 0}</span>
          </div>
        </div>

        {/* Apoio Noite */}
        <div className="butanta-kpi-card purple">
          <div className="butanta-kpi-icon">
            <Moon size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Apoio Noite</span>
            <span className="butanta-kpi-value" style={{ color: '#c084fc' }}>{kpis?.total_apoio_noite || 0}</span>
          </div>
        </div>

        {/* Banheirista Apoio */}
        <div className="butanta-kpi-card teal">
          <div className="butanta-kpi-icon">
            <Users size={20} />
          </div>
          <div className="butanta-kpi-info">
            <span className="butanta-kpi-label">Banheirista Apoio</span>
            <span className="butanta-kpi-value" style={{ color: '#2dd4bf' }}>{kpis?.total_banheirista_apoio || 0}</span>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* 3. CARD DE ENTRADA DE TEXTO DO QUADRO (PROCESSADOR)            */}
      {/* ============================================================= */}
      <section className="butanta-card">
        <div className="butanta-card-header">
          <div className="butanta-card-title">
            <Wand2 size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Processador Inteligente de Mensagens</span>
          </div>
          <span className="badge-tag-active" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            Reconhecimento Automático + Revisão de Inesperados
          </span>
        </div>

        <div className="butanta-card-body">
          {/* Barra de seleção do Shopping deste Quadro */}
          <div className="butanta-input-shopping-bar">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
              <Store size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span>Shopping deste Quadro:</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <select 
                value={targetShopping}
                onChange={(e) => setTargetShopping(e.target.value)}
                className="form-select"
                style={{ flex: 1, padding: '7px 12px', fontSize: '0.875rem' }}
              >
                {shoppings.map(s => (
                  <option key={s.id} value={s.nome}>{s.nome}</option>
                ))}
              </select>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalShoppingsOpen(true)}
                title="Cadastrar novo shopping ou retirar unidades"
              >
                <Settings size={14} />
                <span>Gerenciar Shoppings</span>
              </button>
            </div>
          </div>

          {/* Textarea para colar mensagem */}
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
            Cole as mensagens de escala/presença recebidas (WhatsApp, e-mail ou relatórios):
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                handleProcessarMensagem();
              }
            }}
            rows={5}
            className="butanta-textarea"
            placeholder={`Exemplo de mensagem:\nBom dia segue o quadro da turma da manhã 03/12/25\n2 folga de escala\n3 folga de feriado\n2 banheirista apoio presente\n13 presente\n1 atestado médico`}
          />

          {/* Linha de Controles & Opções */}
          <div className="butanta-controls-row">
            <div className="butanta-options-group">
              <label className="butanta-checkbox-label" title="Identifica múltiplos turnos ou blocos colados de uma só vez">
                <input 
                  type="checkbox" 
                  checked={autoSplit}
                  onChange={(e) => setAutoSplit(e.target.checked)}
                />
                <span>Detectar múltiplos turnos</span>
              </label>

              <label className="butanta-checkbox-label" title="Preenche a data atual caso a mensagem não especifique uma data">
                <input 
                  type="checkbox" 
                  checked={autoDate}
                  onChange={(e) => setAutoDate(e.target.checked)}
                />
                <span>Data automática se omitida</span>
              </label>

              <label className="butanta-checkbox-label" title="Soma valores caso já exista registro para a mesma data e turno">
                <input 
                  type="checkbox" 
                  checked={autoMerge}
                  onChange={(e) => setAutoMerge(e.target.checked)}
                />
                <span>Mesclar por Data e Turno</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => setRawText('')}
                disabled={!rawText}
                title="Limpar caixa de texto"
              >
                <Eraser size={15} />
                <span>Limpar Texto</span>
              </button>

              <button 
                className="btn btn-primary btn-sm"
                onClick={handleProcessarMensagem}
                disabled={parsing || !rawText.trim()}
                title="Atalho: Ctrl + Enter"
              >
                <Wand2 size={15} className={parsing ? 'animate-spin' : ''} />
                <span>{parsing ? 'Processando...' : 'Processar & Adicionar'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================= */}
      {/* 4. SEÇÃO DE DADOS E VISUALIZAÇÃO DAS TABELAS (TABLE-CARD)      */}
      {/* ============================================================= */}
      <section className="butanta-card">
        {/* Toolbar da Tabela */}
        <div className="butanta-table-toolbar">
          {/* Abas de Navegação */}
          <div className="butanta-tabs-nav">
            <button 
              className={`butanta-tab-btn ${activeTableTab === 'tabTurnos' ? 'active' : ''}`}
              onClick={() => setActiveTableTab('tabTurnos')}
            >
              <Layers size={15} />
              <span>Tabela por Turno</span>
            </button>
            <button 
              className={`butanta-tab-btn ${activeTableTab === 'tabDiario' ? 'active' : ''}`}
              onClick={() => setActiveTableTab('tabDiario')}
            >
              <CalendarDays size={15} />
              <span>Resumo Diário (Consolidado)</span>
            </button>
          </div>

          {/* Filtros e Ações de Exportação */}
          <div className="butanta-toolbar-actions">
            <div className="butanta-filter-group">
              {/* Campo de Busca */}
              <div className="butanta-search-wrapper">
                <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  value={buscaTexto}
                  onChange={(e) => setBuscaTexto(e.target.value)}
                  placeholder="Buscar data, turno..." 
                />
              </div>

              {/* Filtro Shopping */}
              <select 
                value={filtroShopping} 
                onChange={(e) => setFiltroShopping(e.target.value)}
                className="form-select form-select-sm"
                style={{ width: '150px' }}
                title="Filtrar por Shopping"
              >
                <option value="todos">Todos os Shoppings</option>
                {shoppings.map(s => (
                  <option key={s.id} value={s.nome}>{s.nome}</option>
                ))}
              </select>

              {/* Filtro Turno (apenas se aba Turnos ativa) */}
              {activeTableTab === 'tabTurnos' && (
                <select 
                  value={filtroTurno} 
                  onChange={(e) => setFiltroTurno(e.target.value)}
                  className="form-select form-select-sm"
                  style={{ width: '130px' }}
                  title="Filtrar por Turno"
                >
                  <option value="todos">Todos os Turnos</option>
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noite">Noite</option>
                </select>
              )}

              {/* Filtro Mês */}
              <input 
                type="month" 
                value={filtroMes} 
                onChange={(e) => setFiltroMes(e.target.value)}
                className="form-input form-input-sm"
                style={{ width: '140px' }}
                title="Filtrar por Mês"
              />

              {/* Botão Resetar Filtros */}
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                title="Limpar Filtros"
                style={{ padding: '6px 8px' }}
              >
                <FilterX size={15} />
              </button>
            </div>

            {/* Grupo de Exportação & Limpeza */}
            <div className="butanta-export-group">
              <a 
                href={api.getDownloadButantaExcelUrl(filtroMes, filtroShopping)}
                className="btn btn-success btn-sm"
                title="Baixar Planilha Formatada no Excel"
                download
              >
                <FileSpreadsheet size={15} />
                <span>Excel (.xlsx)</span>
              </a>

              <a 
                href={api.getDownloadButantaCsvUrl(filtroMes, filtroShopping, activeTableTab === 'tabTurnos' ? 'detailed' : 'daily')}
                className="btn btn-secondary btn-sm"
                title="Exportar arquivo CSV com separador (;)"
                download
              >
                <Download size={15} />
                <span>CSV</span>
              </a>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleLimparTodosRegistros}
                title="Excluir todos os dados do banco"
                style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo da Aba 1: Tabela por Turno */}
        {activeTableTab === 'tabTurnos' && (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Shopping</th>
                  <th style={{ textAlign: 'center' }}>Turno</th>
                  <th style={{ textAlign: 'center' }}>Presentes</th>
                  <th style={{ textAlign: 'center' }}>Folgas</th>
                  <th style={{ textAlign: 'center' }}>Faltas</th>
                  <th style={{ textAlign: 'center' }}>Atestados</th>
                  <th style={{ textAlign: 'center' }}>Apoio Noite</th>
                  <th style={{ textAlign: 'center' }}>Banheirista</th>
                  <th>Outros / Ocorrências</th>
                  <th>Observações</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan="12" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  records.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {rec.data_formatada}
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          <Store size={14} />
                          {rec.shopping}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: rec.turno === 'Manhã' ? 'rgba(245, 158, 11, 0.15)' : rec.turno === 'Tarde' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: rec.turno === 'Manhã' ? '#fbbf24' : rec.turno === 'Tarde' ? '#38bdf8' : '#c084fc',
                          border: `1px solid ${rec.turno === 'Manhã' ? 'rgba(245, 158, 11, 0.3)' : rec.turno === 'Tarde' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                        }}>
                          {rec.turno}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#34d399', fontWeight: 700, fontSize: '0.925rem' }}>
                          {rec.presentes}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#60a5fa', fontWeight: 600 }}>
                          {rec.folgas}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {rec.faltas > 0 ? (
                          <span className="currency-cell highlight" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {rec.faltas}
                          </span>
                        ) : (
                          <span className="currency-cell" style={{ color: '#71717a' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {rec.atestados > 0 ? (
                          <span className="currency-cell" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            {rec.atestados}
                          </span>
                        ) : (
                          <span className="currency-cell" style={{ color: '#71717a' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: rec.apoio_noite > 0 ? '#c084fc' : '#71717a', fontWeight: rec.apoio_noite > 0 ? 700 : 400 }}>
                          {rec.apoio_noite}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: rec.banheirista_apoio > 0 ? '#2dd4bf' : '#71717a', fontWeight: rec.banheirista_apoio > 0 ? 700 : 400 }}>
                          {rec.banheirista_apoio}
                        </span>
                      </td>
                      <td>
                        {rec.outros && rec.outros.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {rec.outros.map((item, idx) => (
                              <span key={idx} className="badge-tag-future" style={{ fontSize: '0.75rem', padding: '2px 7px' }}>
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        {rec.observacoes || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingRecord({ ...rec });
                              setModalEditOpen(true);
                            }}
                            title="Editar turno"
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDeleteRecord(rec.id)}
                            title="Excluir turno"
                            style={{ padding: '5px 8px', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Conteúdo da Aba 2: Resumo Diário Consolidado */}
        {activeTableTab === 'tabDiario' && (
          <div>
            <div style={{ padding: '12px 18px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                Esta tabela soma automaticamente os turnos de cada dia (Manhã + Tarde + Noite). Use o botão "Excel" acima para exportar o relatório pronto.
              </span>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Shopping</th>
                    <th style={{ textAlign: 'center' }}>Visão</th>
                    <th style={{ textAlign: 'center' }}>Total Presentes</th>
                    <th style={{ textAlign: 'center' }}>Total Folgas</th>
                    <th style={{ textAlign: 'center' }}>Total Faltas</th>
                    <th style={{ textAlign: 'center' }}>Total Atestados</th>
                    <th style={{ textAlign: 'center' }}>Apoio Noite</th>
                    <th style={{ textAlign: 'center' }}>Banheirista</th>
                    <th>Outros do Dia</th>
                    <th>Observações Consolidadas</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                        Nenhum dado diário consolidado encontrado.
                      </td>
                    </tr>
                  ) : (
                    dailySummary.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {d.data_formatada}
                        </td>
                        <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{d.shopping}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-tag-active" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                            Consolidado
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="currency-cell" style={{ color: '#34d399', fontWeight: 700, fontSize: '0.925rem' }}>
                            {d.presentes}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="currency-cell" style={{ color: '#60a5fa', fontWeight: 600 }}>
                            {d.folgas}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {d.faltas > 0 ? (
                            <span className="currency-cell highlight" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                              {d.faltas}
                            </span>
                          ) : (
                            <span className="currency-cell" style={{ color: '#71717a' }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {d.atestados > 0 ? (
                            <span className="currency-cell" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
                              {d.atestados}
                            </span>
                          ) : (
                            <span className="currency-cell" style={{ color: '#71717a' }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="currency-cell" style={{ color: d.apoio_noite > 0 ? '#c084fc' : '#71717a', fontWeight: d.apoio_noite > 0 ? 700 : 400 }}>
                            {d.apoio_noite}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="currency-cell" style={{ color: d.banheirista_apoio > 0 ? '#2dd4bf' : '#71717a', fontWeight: d.banheirista_apoio > 0 ? 700 : 400 }}>
                            {d.banheirista_apoio}
                          </span>
                        </td>
                        <td>
                          {d.outros && d.outros.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {d.outros.map((item, oIdx) => (
                                <span key={oIdx} className="badge-tag-future" style={{ fontSize: '0.75rem', padding: '2px 7px' }}>
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          {d.observacoes || '-'}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Linha de Totais Gerais Consolidados (estilo regional Carrefour) */}
                  {dailySummary.length > 0 && (
                    <tr className="regional-header-row" style={{ borderTop: '2px solid var(--border-card)' }}>
                      <td colSpan="3" style={{ padding: '14px 16px', color: '#f8fafc', fontWeight: 700, letterSpacing: '0.04em' }}>
                        TOTAIS GERAIS CONSOLIDADOS
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#34d399', fontWeight: 800, fontSize: '0.95rem' }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.presentes || 0), 0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#60a5fa', fontWeight: 700 }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.folgas || 0), 0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#f87171', fontWeight: 800 }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.faltas || 0), 0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#fbbf24', fontWeight: 800 }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.atestados || 0), 0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#c084fc', fontWeight: 700 }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.apoio_noite || 0), 0)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="currency-cell" style={{ color: '#2dd4bf', fontWeight: 700 }}>
                          {dailySummary.reduce((acc, curr) => acc + (curr.banheirista_apoio || 0), 0)}
                        </span>
                      </td>
                      <td>-</td>
                      <td>-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/* 5. FOOTER INFORMATIVO (EXATO DO PROJETO BUTTAN)                */}
      {/* ============================================================= */}
      <footer style={{ textAlign: 'center', padding: '20px 0 10px', color: '#94a3b8', fontSize: '0.85rem' }}>
        <p>Quadro de Funcionários • Executando Localmente com Python & SQLite Seguro</p>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          Persistência local ativada • Seus dados ficam salvos com segurança no seu computador.
        </span>
      </footer>

      {/* ============================================================= */}
      {/* MODAL DE REVISÃO INTELIGENTE & ITENS NÃO RECONHECIDOS         */}
      {/* ============================================================= */}
      {modalReviewOpen && reviewData && (
        <div className="modal-overlay" onClick={() => setModalReviewOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <h3>
                <AlertTriangle size={22} color="#fbbf24" />
                <span>Revisão Inteligente do Quadro</span>
              </h3>
              <button className="close-btn" onClick={() => setModalReviewOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
              {reviewData.unexpected_items && reviewData.unexpected_items.length > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '14px 18px', marginBottom: '18px' }}>
                  <strong style={{ color: '#fbbf24', display: 'block', marginBottom: '4px' }}>
                    Linhas não reconhecidas ou inesperadas detectadas!
                  </strong>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', margin: 0 }}>
                    O analisador identificou informações que não se enquadram nas categorias padrão. Você pode definir a categoria correta para cada linha abaixo antes de salvar.
                  </p>
                </div>
              )}

              {/* Tabela de Itens Inesperados para Ajuste */}
              {reviewData.unexpected_items && reviewData.unexpected_items.length > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                    Itens que precisam de sua atenção / Edição rápida:
                  </h4>
                  <div className="table-container">
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Linha Original da Mensagem</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Qtd</th>
                          <th style={{ width: '220px' }}>Categoria de Destino</th>
                          <th style={{ width: '120px' }}>Turno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewData.unexpected_items.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#e2e8f0', fontWeight: 500 }}>{item.raw_text}</td>
                            <td style={{ textAlign: 'center' }}>
                              <input 
                                type="number" 
                                min="0"
                                value={item.detected_number}
                                onChange={(e) => handleAtualizarItemInesperado(idx, item.suggested_category, e.target.value)}
                                className="form-input form-input-sm"
                                style={{ width: '70px', textAlign: 'center' }}
                              />
                            </td>
                            <td>
                              <select 
                                value={item.suggested_category}
                                onChange={(e) => handleAtualizarItemInesperado(idx, e.target.value)}
                                className="form-select form-select-sm"
                              >
                                <option value="presentes">Presentes</option>
                                <option value="folgas">Folgas</option>
                                <option value="faltas">Faltas</option>
                                <option value="atestados">Atestados</option>
                                <option value="apoio_noite">Apoio Noite</option>
                                <option value="banheirista_apoio">Banheirista Apoio</option>
                                <option value="outros">Outros / Ocorrência</option>
                                <option value="ignorar">Ignorar Linha</option>
                              </select>
                            </td>
                            <td style={{ color: 'var(--accent-cyan)' }}>{item.turno}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Turnos identificados */}
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
                Turnos Processados Prontos para Gravar:
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {reviewData.records.map((r, idx) => (
                  <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                      {r.date} — {r.turno}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                      Presentes: <strong style={{ color: '#34d399' }}>{r.presentes}</strong> • Folgas: {r.folgas} • Faltas: <strong style={{ color: '#f87171' }}>{r.faltas}</strong><br />
                      Atestados: {r.atestados} • Apoio: {r.apoio_noite} • Banheirista: {r.banheirista_apoio}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalReviewOpen(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmarRevisao}>
                <CheckCircle2 size={16} />
                <span>Confirmar e Salvar no SQLite</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL DE EDIÇÃO / CRIAÇÃO MANUAL DE REGISTRO                  */}
      {/* ============================================================= */}
      {modalEditOpen && editingRecord && (
        <div className="modal-overlay" onClick={() => setModalEditOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3>
                <Edit3 size={22} color="var(--accent-teal)" />
                <span>{editingRecord.id ? 'Editar Registro de Turno' : 'Novo Registro de Turno'}</span>
              </h3>
              <button className="close-btn" onClick={() => setModalEditOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Data (DD/MM/AAAA) *</label>
                    <input 
                      type="text" 
                      value={editingRecord.data || editingRecord.data_formatada || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, data: e.target.value })}
                      placeholder="DD/MM/AAAA"
                      className="form-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Shopping *</label>
                    <select 
                      value={editingRecord.shopping || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, shopping: e.target.value })}
                      className="form-select"
                      required
                    >
                      {shoppings.map(s => (
                        <option key={s.id} value={s.nome}>{s.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Turno *</label>
                    <select 
                      value={editingRecord.turno || 'Manhã'}
                      onChange={(e) => setEditingRecord({ ...editingRecord, turno: e.target.value })}
                      className="form-select"
                      required
                    >
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noite">Noite</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label className="form-label">Presentes</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.presentes || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, presentes: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Folgas</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.folgas || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, folgas: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Faltas</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.faltas || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, faltas: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Atestados</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.atestados || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, atestados: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Apoio Noite</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.apoio_noite || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, apoio_noite: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label">Banheirista Apoio</label>
                    <input 
                      type="number" 
                      min="0"
                      value={editingRecord.banheirista_apoio || 0}
                      onChange={(e) => setEditingRecord({ ...editingRecord, banheirista_apoio: parseInt(e.target.value) || 0 })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Outras Ocorrências (separar por vírgula)</label>
                  <input 
                    type="text" 
                    value={Array.isArray(editingRecord.outros) ? editingRecord.outros.join(', ') : (editingRecord.outros || '')}
                    onChange={(e) => setEditingRecord({ ...editingRecord, outros: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Ex: 1 férias, 1 licença maternidade"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Observações</label>
                  <textarea 
                    value={editingRecord.observacoes || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, observacoes: e.target.value })}
                    rows={2}
                    className="form-textarea"
                    placeholder="Notas adicionais sobre o turno..."
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalEditOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL DE GERENCIAMENTO DE SHOPPINGS (ADICIONAR / RETIRAR)     */}
      {/* ============================================================= */}
      {modalShoppingsOpen && (
        <div className="modal-overlay" onClick={() => setModalShoppingsOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>
                <Store size={22} color="var(--accent-teal)" />
                <span>Gerenciar Shoppings Atendidos</span>
              </h3>
              <button className="close-btn" onClick={() => setModalShoppingsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Cadastre novos shoppings ou retire unidades do sistema. Todas as presenças e quadros ficam vinculados à unidade selecionada.
            </p>

            {/* Formulário para adicionar shopping */}
            <form onSubmit={handleAddShopping} style={{ marginBottom: '22px', background: '#121212', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-card)' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Cadastrar Novo Shopping:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={novoShoppingNome} 
                  onChange={(e) => setNovoShoppingNome(e.target.value)}
                  placeholder="Ex: Shopping Eldorado, Shopping Morumbi..."
                  className="form-input"
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingShopping || !novoShoppingNome.trim()}>
                  <Plus size={15} />
                  <span>{savingShopping ? 'Cadastrando...' : 'Cadastrar'}</span>
                </button>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                Informe apenas o nome do shopping para adicioná-lo ao banco SQLite.
              </span>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Shoppings Cadastrados ({shoppings.length})
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clique na lixeira para excluir</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {shoppings.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum shopping cadastrado.</div>
              ) : (
                shoppings.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161616', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Store size={15} color="var(--accent-cyan)" />
                        <span>{s.nome}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.total_registros || 0} turnos registrados
                      </div>
                    </div>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDeleteShopping(s)}
                      style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '5px 8px' }}
                      title="Retirar shopping e apagar seus registros"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalShoppingsOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
