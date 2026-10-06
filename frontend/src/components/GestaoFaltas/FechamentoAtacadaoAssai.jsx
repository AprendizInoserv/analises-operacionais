import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileArchive,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Search,
  Users,
  Calendar,
  Clock,
  ChevronRight,
  TrendingUp,
  Settings,
  PlusCircle,
  Building2,
  Info,
  Trash2,
  FileText,
  ListPlus
} from 'lucide-react';
import { api } from '../../services/api';
import './FechamentoAtacadaoAssai.css';

export default function FechamentoAtacadaoAssai({ showToast }) {
  // Parâmetros de Entrada
  const [mes, setMes] = useState(8);
  const [ano, setAno] = useState(2026);
  const [hecMinutos, setHecMinutos] = useState(0);

  // Arquivos
  const [arquivoPonto, setArquivoPonto] = useState(null);
  const [arquivoMarcas, setArquivoMarcas] = useState(null);

  // Estado do Processamento com persistência local
  const [loading, setLoading] = useState(false);
  const [etapaStatus, setEtapaStatus] = useState('');
  const [resultadoProcessamento, setResultadoProcessamento] = useState(() => {
    try {
      const cached = localStorage.getItem('fechamento_atacadao_assai_cache');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  // Filtros e Navegação
  const [activeTab, setActiveTab] = useState('lojas'); // 'lojas', 'inconsistencias', 'diario'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoja, setSelectedLoja] = useState(() => {
    try {
      const cached = localStorage.getItem('fechamento_atacadao_assai_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.resumo_lojas && parsed.resumo_lojas.length > 0) {
          return parsed.resumo_lojas[0].loja;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  // Modais
  const [isQuadroModalOpen, setIsQuadroModalOpen] = useState(false);
  const [isDiariaModalOpen, setIsDiariaModalOpen] = useState(false);
  const [quadrosList, setQuadrosList] = useState([]);
  const [diariasList, setDiariasList] = useState([]);

  // Gestão de Quadros
  const [quadroModalTab, setQuadroModalTab] = useState('carga'); // 'carga', 'individual', 'lista'
  const [textoCargaQuadros, setTextoCargaQuadros] = useState('');
  const [substituirQuadros, setSubstituirQuadros] = useState(false);
  const [loadingCarga, setLoadingCarga] = useState(false);
  const [filtroBuscaQuadro, setFiltroBuscaQuadro] = useState('');

  // Nova diária manual
  const [novaDiaria, setNovaDiaria] = useState({
    nome_loja: '',
    data: '2026-08-01',
    quantidade: 1,
    observacao: '',
    usuario_responsavel: 'Operador'
  });

  // Novo quadro manual
  const [novoQuadro, setNovoQuadro] = useState({
    nome_loja: '',
    operacao: 'ATACADAO',
    quadro_previsto: 14,
    ativo: true
  });

  const carregarQuadros = async () => {
    try {
      const data = await api.getQuadrosAtacadaoAssai();
      setQuadrosList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEnviarCargaQuadros = async () => {
    if (!textoCargaQuadros.trim()) {
      showToast('Cole o texto com a lista de lojas e quadros antes de processar.', 'warning');
      return;
    }
    setLoadingCarga(true);
    try {
      const resp = await api.enviarCargaQuadrosAtacadaoAssai(textoCargaQuadros, substituirQuadros);
      showToast(resp.mensagem || 'Carga de quadros processada com sucesso!', 'success');
      await carregarQuadros();
      setTextoCargaQuadros('');
      setQuadroModalTab('lista');
    } catch (err) {
      showToast('Erro ao processar carga: ' + err.message, 'error');
    } finally {
      setLoadingCarga(false);
    }
  };

  const inserirExemploCarga = () => {
    setTextoCargaQuadros(`("ASSAI APARECIDA DE GOIANIA 348", 18),
("ASSAI ARACATUBA 174", 14),
("ATACADAO ANCHIETA 269", 14),
("ATACADAO CAMBUCI 680", 16)`);
  };

  const carregarDiarias = async () => {
    try {
      const data = await api.getDiariasAtacadaoAssai();
      setDiariasList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const carregarUltimoFechamento = async () => {
    try {
      const data = await api.getUltimoFechamentoAtacadaoAssai();
      if (data && (data.tem_fechamento || data.kpis)) {
        setResultadoProcessamento(data);
        localStorage.setItem('fechamento_atacadao_assai_cache', JSON.stringify(data));
        if (data.mes) setMes(data.mes);
        if (data.ano) setAno(data.ano);
        if (data.resumo_lojas && data.resumo_lojas.length > 0) {
          setSelectedLoja(prev => prev || data.resumo_lojas[0].loja);
        }
      } else {
        localStorage.removeItem('fechamento_atacadao_assai_cache');
        setResultadoProcessamento(null);
        setSelectedLoja(null);
      }
    } catch (e) {
      console.warn('Nenhum fechamento ativo prévio no servidor:', e);
    }
  };

  useEffect(() => {
    carregarQuadros();
    carregarDiarias();
    carregarUltimoFechamento();
  }, []);

  const handleLimparFechamento = async () => {
    if (!window.confirm('Deseja realmente limpar o fechamento ativo em tela para iniciar um novo processamento?')) return;
    try {
      await api.limparFechamentoAtacadaoAssai();
    } catch (e) {
      console.warn('Erro ao limpar fechamento no backend:', e);
    }
    localStorage.removeItem('fechamento_atacadao_assai_cache');
    setResultadoProcessamento(null);
    setSelectedLoja(null);
    setArquivoPonto(null);
    setArquivoMarcas(null);
    showToast('Fechamento ativo limpo.', 'info');
  };

  const handleProcessar = async (usarPadrao = false) => {
    setLoading(true);
    setEtapaStatus('Iniciando processamento determinístico...');
    try {
      const formData = new FormData();
      formData.append('mes', mes);
      formData.append('ano', ano);
      formData.append('hec_minutos', hecMinutos);

      if (!usarPadrao) {
        if (!arquivoPonto || !arquivoMarcas) {
          showToast('Selecione ambos os arquivos de Ponto e Marcas, ou utilize as bases padrão do servidor.', 'warning');
          setLoading(false);
          return;
        }
        formData.append('arquivo_ponto', arquivoPonto);
        formData.append('arquivo_marcas', arquivoMarcas);
      }

      setEtapaStatus('Cruzando batidas com espelhos e aplicando hierarquia N1-N4...');
      const resp = await api.processarAtacadaoAssai(formData);

      setResultadoProcessamento(resp);
      try {
        localStorage.setItem('fechamento_atacadao_assai_cache', JSON.stringify(resp));
      } catch (eCache) {
        console.warn('Aviso: falha ao salvar cache no localStorage:', eCache);
      }

      if (resp.resumo_lojas && resp.resumo_lojas.length > 0) {
        setSelectedLoja(resp.resumo_lojas[0].loja);
      }
      showToast('Fechamento Atacadão e Assaí processado com 100% de precisão!', 'success');
    } catch (err) {
      showToast('Erro ao processar: ' + (err.message || 'Falha na comunicação com o backend'), 'error');
    } finally {
      setLoading(false);
      setEtapaStatus('');
    }
  };

  const handleEditarQuadroRapido = async (loja, quadroAtual) => {
    const input = window.prompt(`Informe o número de pessoas (postos previstos) no quadro da loja "${loja}":`, quadroAtual || 14);
    if (input === null) return;
    const novoQuadro = parseInt(input, 10);
    if (isNaN(novoQuadro) || novoQuadro < 0) {
      showToast('Por favor, informe um número inteiro válido.', 'warning');
      return;
    }

    try {
      await api.salvarQuadroAtacadaoAssai({
        nome_loja: loja,
        quadro_previsto: novoQuadro,
        ativo: true
      });
      showToast(`Quadro de "${loja}" atualizado para ${novoQuadro} postos. Recalculando...`, 'success');
      await carregarUltimoFechamento();
      await carregarQuadros();
    } catch (e) {
      showToast('Erro ao atualizar quadro: ' + e.message, 'error');
    }
  };

  const handleSalvarQuadro = async (e) => {
    e.preventDefault();
    try {
      await api.salvarQuadroAtacadaoAssai(novoQuadro);
      showToast('Quadro salvo com sucesso', 'success');
      carregarQuadros();
      setNovoQuadro({
        nome_loja: '',
        operacao: 'ATACADAO',
        quadro_previsto: 14,
        ativo: true
      });
      setIsQuadroModalOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCriarDiaria = async (e) => {
    e.preventDefault();
    try {
      await api.criarDiariaAtacadaoAssai(novaDiaria);
      showToast('Diária operacional registrada com sucesso', 'success');
      carregarDiarias();
      setNovaDiaria({
        nome_loja: '',
        data: '2026-08-01',
        quantidade: 1,
        observacao: '',
        usuario_responsavel: 'Operador'
      });
      setIsDiariaModalOpen(false);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleExcluirDiaria = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta diária?')) return;
    try {
      await api.excluirDiariaAtacadaoAssai(id);
      showToast('Diária excluída com sucesso', 'success');
      carregarDiarias();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Filtragem das lojas
  const lojasFiltradas = resultadoProcessamento?.resumo_lojas?.filter(l =>
    l.loja.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Dados diários da loja selecionada
  const diarioLojaSelecionada = resultadoProcessamento?.amostra_diaria?.filter(d =>
    d.loja === selectedLoja
  ) || [];

  return (
    <div className="faa-container">
      {/* 1. Header do Módulo com Parâmetros */}
      <div className="faa-header-card">
        <div className="faa-header-left">
          <div className="faa-brand-icon">
            <Building2 size={28} />
          </div>
          <div className="faa-header-title-box">
            <h2>
              Fechamento de Faltas — Atacadão & Assaí
              <span className="faa-status-pill">
                <span className="pulse-dot"></span>
                Motor 2.0
              </span>
            </h2>
            <p>
              Ingestão das batidas biométricas (PunchReport) e espelhos de ponto (GeoVictoria) com cruzamento determinístico N1-N4.
            </p>
          </div>
        </div>

        <div className="faa-header-controls">
          {/* Seletor Mês/Ano */}
          <div className="faa-control-pill">
            <Calendar size={15} color="var(--accent-teal)" />
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              <option value={8}>Agosto (08)</option>
              <option value={9}>Setembro (09)</option>
              <option value={10}>Outubro (10)</option>
            </select>
            <span>/</span>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          {/* Parâmetro HEC = DIA */}
          <div className="faa-control-pill">
            <Clock size={15} color="var(--accent-teal)" />
            <span>HEC = DIA:</span>
            <select value={hecMinutos} onChange={(e) => setHecMinutos(Number(e.target.value))}>
              <option value={0}>Desativado (0)</option>
              <option value={440}>440 min (7h20)</option>
              <option value={500}>500 min (8h20)</option>
            </select>
          </div>

          {/* Botões Auxiliares */}
          <button
            onClick={() => setIsQuadroModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            <Settings size={15} />
            <span>Quadros ({quadrosList.length})</span>
          </button>
          <button
            onClick={() => setIsDiariaModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            <PlusCircle size={15} />
            <span>Diárias Manuais ({diariasList.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Área de Upload e Execução */}
      <div className="faa-upload-grid">
        {/* Box 1: Relatório de Marcas */}
        <div className={`faa-upload-card ${arquivoMarcas ? 'loaded' : ''}`}>
          <div className="faa-upload-icon-box">
            <UploadCloud size={24} />
          </div>
          <div className="faa-upload-info">
            <h4>1. Relatório de Marcas (PunchReport)</h4>
            <p>Arquivo .xlsx contendo batidas dos relógios biométricos (aba Con Marcas).</p>
            <div className="faa-file-input-wrapper">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setArquivoMarcas(e.target.files[0] || null)}
              />
            </div>
            {arquivoMarcas && (
              <div className="faa-file-loaded-badge">
                <CheckCircle2 size={14} /> {arquivoMarcas.name}
              </div>
            )}
          </div>
        </div>

        {/* Box 2: Controle de Ponto */}
        <div className={`faa-upload-card ${arquivoPonto ? 'loaded' : ''}`}>
          <div className="faa-upload-icon-box">
            <FileSpreadsheet size={24} />
          </div>
          <div className="faa-upload-info">
            <h4>2. Controle de Ponto (Espelho)</h4>
            <p>Arquivo .xlsx com escalas, turnos e permissões GeoVictoria (cabeçalho Linha 2).</p>
            <div className="faa-file-input-wrapper">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setArquivoPonto(e.target.files[0] || null)}
              />
            </div>
            {arquivoPonto && (
              <div className="faa-file-loaded-badge">
                <CheckCircle2 size={14} /> {arquivoPonto.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Barra de Execução */}
      <div className="faa-action-banner">
        <div className="faa-action-note">
          <Info size={18} />
          <span>Os arquivos originais nunca são modificados. Todo o cruzamento é determinístico, auditável e sem arredondamentos.</span>
        </div>

        <div className="faa-action-buttons">
          <button
            onClick={() => handleProcessar(true)}
            disabled={loading}
            className="btn btn-secondary"
            title="Utiliza as bases reais presentes na raiz do sistema para teste imediato"
          >
            <RotateCcw size={15} />
            <span>Processar Bases Padrão do Servidor</span>
          </button>

          <button
            onClick={() => handleProcessar(false)}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                <span>{etapaStatus || 'Processando...'}</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Processar Fechamento</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Resultados do Fechamento */}
      {resultadoProcessamento && (
        <div>
          {/* Barra de Fechamento Vigente Carregado */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '10px',
            padding: '12px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(52, 211, 153, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle2 size={18} color="#34d399" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.92rem', color: '#f1f5f9', fontWeight: 700 }}>
                    Fechamento do Mês Vigente Carregado
                  </span>
                  <span style={{
                    fontSize: '0.78rem',
                    color: '#38bdf8',
                    fontWeight: 700,
                    background: 'rgba(56, 189, 248, 0.14)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    {String(resultadoProcessamento.mes || mes).padStart(2, '0')}/{resultadoProcessamento.ano || ano}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                  {resultadoProcessamento.atualizado_em ? (
                    <span>Último processamento gravado em: <strong>{resultadoProcessamento.atualizado_em}</strong></span>
                  ) : (
                    <span>Dados consolidados em memória e disco</span>
                  )}
                  <span> • {resultadoProcessamento.kpis?.total_lojas || 0} filiais ativas</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={carregarUltimoFechamento}
                className="btn btn-secondary btn-sm"
                title="Recarregar dados do fechamento do servidor"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <RotateCcw size={14} />
                <span>Atualizar</span>
              </button>
              <button
                onClick={handleLimparFechamento}
                className="btn btn-secondary btn-sm"
                title="Limpar o fechamento ativo em tela para enviar novos arquivos"
                style={{ fontSize: '0.78rem', padding: '6px 12px', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }}
              >
                <Trash2 size={14} />
                <span>Limpar Fechamento</span>
              </button>
            </div>
          </div>

          {/* Cards Executivos de KPIs */}
          <div className="faa-kpis-grid">
            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Lojas Atendidas</span>
                <div className="faa-kpi-icon teal"><Building2 size={16} /></div>
              </div>
              <div className="faa-kpi-value">{resultadoProcessamento.kpis.total_lojas}</div>
              <div className="faa-kpi-sub">Filiais apuradas</div>
            </div>

            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Total Esperado</span>
                <div className="faa-kpi-icon blue"><Calendar size={16} /></div>
              </div>
              <div className="faa-kpi-value blue">{resultadoProcessamento.kpis.total_esperado}</div>
              <div className="faa-kpi-sub">{resultadoProcessamento.kpis.dias_uteis} dias úteis</div>
            </div>

            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Resultado Realizado</span>
                <div className="faa-kpi-icon emerald"><CheckCircle2 size={16} /></div>
              </div>
              <div className="faa-kpi-value emerald">{resultadoProcessamento.kpis.resultado_total}</div>
              <div className="faa-kpi-sub">Presenças + Outras Folgas</div>
            </div>

            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Comparativo</span>
                <div className="faa-kpi-icon amber"><TrendingUp size={16} /></div>
              </div>
              <div className={`faa-kpi-value ${resultadoProcessamento.kpis.comparativo_total > 0 ? 'amber' : 'emerald'}`}>
                {resultadoProcessamento.kpis.comparativo_total}
              </div>
              <div className="faa-kpi-sub">Esperado - Resultado</div>
            </div>

            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Faltas Operacionais</span>
                <div className="faa-kpi-icon rose"><AlertTriangle size={16} /></div>
              </div>
              <div className="faa-kpi-value rose">{resultadoProcessamento.kpis.faltas_operacionais}</div>
              <div className="faa-kpi-sub">Gestão RH / Escalas</div>
            </div>

            <div className="faa-kpi-card">
              <div className="faa-kpi-top">
                <span className="faa-kpi-label">Inconsistências</span>
                <div className="faa-kpi-icon amber"><Info size={16} /></div>
              </div>
              <div className="faa-kpi-value amber">{resultadoProcessamento.kpis.total_inconsistencias}</div>
              <div className="faa-kpi-sub">Alertas catalogados</div>
            </div>
          </div>

          {/* 5. Toolbar de Navegação e Exportação */}
          <div className="faa-toolbar">
            <div className="faa-tabs-nav">
              <button
                onClick={() => setActiveTab('lojas')}
                className={`faa-tab-btn ${activeTab === 'lojas' ? 'active' : ''}`}
              >
                <Building2 size={16} />
                <span>Fechamento por Loja ({resultadoProcessamento.resumo_lojas?.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('inconsistencias')}
                className={`faa-tab-btn ${activeTab === 'inconsistencias' ? 'active' : ''}`}
              >
                <AlertTriangle size={16} />
                <span>Inconsistências ({resultadoProcessamento.inconsistencias?.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('diario')}
                className={`faa-tab-btn ${activeTab === 'diario' ? 'active' : ''}`}
              >
                <Calendar size={16} />
                <span>Detalhamento Diário ({selectedLoja || 'Selecione uma filial'})</span>
              </button>
            </div>

            <div className="faa-export-group">
              <a
                href={api.getDownloadAtacadaoAssaiExcelUrl()}
                className="btn btn-secondary btn-sm"
                download
                title="Download da planilha oficial consolidada com 7 abas"
              >
                <FileSpreadsheet size={16} color="#34d399" />
                <span style={{ color: '#34d399' }}>Baixar Excel (7 Abas)</span>
              </a>

              <a
                href={api.getDownloadAtacadaoAssaiZipUrl()}
                className="btn btn-secondary btn-sm"
                download
                title="Download do pacote ZIP contendo os relatórios em PDF de todas as lojas"
              >
                <FileArchive size={16} color="#38bdf8" />
                <span style={{ color: '#38bdf8' }}>Baixar Todos os PDFs (ZIP)</span>
              </a>
            </div>
          </div>

          {/* Aba 1: Tabela de Fechamento por Loja */}
          {activeTab === 'lojas' && (
            <div className="faa-table-card">
              <div className="faa-filter-bar">
                <div className="faa-search-box">
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Filtrar por filial..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Exibindo {lojasFiltradas.length} de {resultadoProcessamento.resumo_lojas?.length} filiais
                </span>
              </div>

              <div className="faa-table-container">
                <table className="faa-table">
                  <thead>
                    <tr>
                      <th>Loja / Filial</th>
                      <th style={{ textAlign: 'center' }}>Quadro</th>
                      <th style={{ textAlign: 'center' }}>Dias</th>
                      <th style={{ textAlign: 'center' }}>Esperado</th>
                      <th style={{ textAlign: 'center' }}>Presenças</th>
                      <th style={{ textAlign: 'center' }}>Folgas</th>
                      <th style={{ textAlign: 'center' }}>Outras</th>
                      <th style={{ textAlign: 'center' }}>Atestados</th>
                      <th style={{ textAlign: 'center' }}>Diárias</th>
                      <th style={{ textAlign: 'center', color: '#34d399' }}>Resultado</th>
                      <th style={{ textAlign: 'center', color: '#fbbf24' }}>Comparativo</th>
                      <th style={{ textAlign: 'center', color: '#fb7185' }}>Faltas RH</th>
                      <th style={{ textAlign: 'right' }}>HT Total</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lojasFiltradas.map((r, idx) => {
                      const isAssai = r.loja.toLowerCase().includes('assai') || r.loja.toLowerCase().includes('sendas');
                      return (
                        <tr
                          key={idx}
                          className={selectedLoja === r.loja ? 'selected' : ''}
                        >
                          <td>
                            <div className="faa-loja-cell">
                              <span className={`faa-badge-op ${isAssai ? 'assai' : 'atacadao'}`}>
                                {isAssai ? 'ASSAÍ' : 'ATACADÃO'}
                              </span>
                              <span style={{ fontWeight: 600 }}>{r.loja}</span>
                            </div>
                          </td>
                          <td 
                            className="faa-num-cell bold"
                            style={{
                              cursor: 'pointer',
                              color: r.quadro > 0 ? '#38bdf8' : '#fb7185',
                              background: r.quadro === 0 ? 'rgba(251, 113, 133, 0.12)' : 'transparent',
                              borderRadius: '4px',
                              padding: '4px 6px'
                            }}
                            onClick={() => handleEditarQuadroRapido(r.loja, r.quadro)}
                            title="Clique para editar/definir o número de pessoas (quadro) desta filial"
                          >
                            <span style={{ marginRight: '3px' }}>{r.quadro}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>✏️</span>
                          </td>
                          <td className="faa-num-cell">{r.dias_uteis}</td>
                          <td className="faa-num-cell blue">{r.total_esperado}</td>
                          <td className="faa-num-cell bold">{r.presencas}</td>
                          <td className="faa-num-cell">{r.folgas}</td>
                          <td className="faa-num-cell">{r.outras_folgas}</td>
                          <td className="faa-num-cell">{r.atestados}</td>
                          <td className="faa-num-cell">{r.diarias}</td>
                          <td className="faa-num-cell emerald">{r.resultado}</td>
                          <td className="faa-num-cell amber">{r.comparativo}</td>
                          <td className="faa-num-cell rose">{r.faltas_operacionais}</td>
                          <td className="faa-num-cell mono" style={{ textAlign: 'right' }}>{r.ht_formatted}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <a
                              href={api.getDownloadLojaPdfUrl(r.loja)}
                              className="faa-btn-icon"
                              title={`Baixar Relatório PDF Oficial da loja ${r.loja}`}
                              download
                              style={{ color: '#38bdf8', marginRight: '6px', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <FileText size={15} />
                            </a>
                            <button
                              onClick={() => {
                                setSelectedLoja(r.loja);
                                setActiveTab('diario');
                              }}
                              className="faa-btn-icon"
                              title="Ver diário completo da loja"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba 2: Painel de Inconsistências */}
          {activeTab === 'inconsistencias' && (
            <div className="faa-table-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} color="#fbbf24" />
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Inconsistências & Divergências Auditadas ({resultadoProcessamento.inconsistencias?.length})
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Batidas sem espelho, pontos sem marcas, turnos especiais e marcações em férias. Nenhuma linha é descartada.
                    </p>
                  </div>
                </div>
              </div>

              {resultadoProcessamento.inconsistencias?.length === 0 ? (
                <div className="empty-box">
                  <CheckCircle2 size={36} color="#34d399" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Nenhuma inconsistência ou ambiguidade encontrada nas bases!
                  </p>
                </div>
              ) : (
                <div className="faa-table-container">
                  <table className="faa-table">
                    <thead>
                      <tr>
                        <th>Tipo de Ocorrência</th>
                        <th>RE</th>
                        <th>CPF</th>
                        <th>Data</th>
                        <th>Filial</th>
                        <th>Detalhamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadoProcessamento.inconsistencias.map((inc, i) => (
                        <tr key={i}>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.14)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.3)'
                            }}>
                              {inc.tipo}
                            </span>
                          </td>
                          <td className="faa-num-cell mono">{inc.re || '-'}</td>
                          <td className="faa-num-cell mono">{inc.cpf || '-'}</td>
                          <td className="faa-num-cell mono">{inc.data || '-'}</td>
                          <td style={{ fontWeight: 600 }}>{inc.loja || '-'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{inc.detalhe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Aba 3: Detalhamento Diário */}
          {activeTab === 'diario' && (
            <div className="faa-table-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} color="var(--accent-teal)" />
                    Detalhamento Diário — {selectedLoja || 'Selecione uma Loja'}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Espelho oficial das 11 colunas dia a dia do fechamento
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filial:</span>
                  <select
                    value={selectedLoja || ''}
                    onChange={(e) => setSelectedLoja(e.target.value)}
                    style={{
                      background: '#1c1c1c',
                      color: 'var(--text-primary)',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.825rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {resultadoProcessamento.resumo_lojas?.map((l, i) => (
                      <option key={i} value={l.loja}>{l.loja}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="faa-table-container">
                <table className="faa-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th style={{ textAlign: 'center' }}>Dia</th>
                      <th style={{ textAlign: 'center' }}>Presença</th>
                      <th style={{ textAlign: 'center' }}>Folga</th>
                      <th style={{ textAlign: 'center' }}>Outras Folgas</th>
                      <th style={{ textAlign: 'center' }}>Atestados</th>
                      <th style={{ textAlign: 'center' }}>Diárias</th>
                      <th style={{ textAlign: 'center' }}>HEC = DIA</th>
                      <th style={{ textAlign: 'center', color: '#34d399' }}>Resultado</th>
                      <th style={{ textAlign: 'center', color: '#fb7185' }}>Falta RH</th>
                      <th style={{ textAlign: 'right' }}>HT</th>
                      <th style={{ textAlign: 'right' }}>HEC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diarioLojaSelecionada.map((dia, idx) => (
                      <tr key={idx}>
                        <td className="faa-num-cell mono">{dia.data}</td>
                        <td className="faa-num-cell" style={{ color: 'var(--text-secondary)' }}>{dia.dia_semana}</td>
                        <td className="faa-num-cell bold">{dia.presenca}</td>
                        <td className="faa-num-cell">{dia.folga}</td>
                        <td className="faa-num-cell">{dia.outras_folgas}</td>
                        <td className="faa-num-cell">{dia.atestado}</td>
                        <td className="faa-num-cell">{dia.diarias}</td>
                        <td className="faa-num-cell">{dia.hec_dia}</td>
                        <td className="faa-num-cell emerald">{dia.resultado}</td>
                        <td className="faa-num-cell rose">{dia.falta_operacional}</td>
                        <td className="faa-num-cell mono" style={{ textAlign: 'right' }}>{dia.ht_formatted}</td>
                        <td className="faa-num-cell mono" style={{ textAlign: 'right' }}>{dia.hec_formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Gerenciamento de Quadros */}
      {isQuadroModalOpen && (
        <div className="faa-modal-backdrop" onClick={() => setIsQuadroModalOpen(false)}>
          <div className="faa-modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="faa-modal-header">
              <h3><Settings size={20} color="var(--accent-teal)" /> Configuração de Quadros por Loja</h3>
              <button onClick={() => setIsQuadroModalOpen(false)} className="btn-close-modal">✕</button>
            </div>

            {/* Abas do Modal */}
            <div className="faa-modal-tabs">
              <button
                type="button"
                onClick={() => setQuadroModalTab('carga')}
                className={`faa-modal-tab-btn ${quadroModalTab === 'carga' ? 'active' : ''}`}
              >
                <UploadCloud size={15} />
                <span>Carga em Lote</span>
              </button>
              <button
                type="button"
                onClick={() => setQuadroModalTab('individual')}
                className={`faa-modal-tab-btn ${quadroModalTab === 'individual' ? 'active' : ''}`}
              >
                <PlusCircle size={15} />
                <span>Cadastro Manual</span>
              </button>
              <button
                type="button"
                onClick={() => setQuadroModalTab('lista')}
                className={`faa-modal-tab-btn ${quadroModalTab === 'lista' ? 'active' : ''}`}
              >
                <Building2 size={15} />
                <span>Lojas Cadastradas ({quadrosList.length})</span>
              </button>
            </div>

            {/* Aba 1: Carga em Lote */}
            {quadroModalTab === 'carga' && (
              <div>
                <div className="faa-note-box">
                  <Info size={16} />
                  <div>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                      Formato de Carga em Lote:
                    </strong>
                    Cole sua lista no formato <code>("NOME DA LOJA", QUADRO),</code> ou em linhas CSV/texto. O número após a vírgula é o quadro previsto.
                  </div>
                </div>

                <div className="faa-form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0 }}>Lista de Lojas e Quadros</label>
                    <button
                      type="button"
                      onClick={inserirExemploCarga}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-teal)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Inserir Exemplo
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    className="faa-textarea-code"
                    placeholder={`("ASSAI APARECIDA DE GOIANIA 348", 18),
("ASSAI ARACATUBA 174", 14),
("ATACADAO ANCHIETA 269", 14),
("ATACADAO CAMBUCI 680", 16)`}
                    value={textoCargaQuadros}
                    onChange={(e) => setTextoCargaQuadros(e.target.value)}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: (textoCargaQuadros.match(/\(\s*["'][^"'\n]+["']\s*,\s*\d+\s*\)/g) || []).length > 0 ? '#34d399' : 'var(--text-muted)' }}>
                      {(textoCargaQuadros.match(/\(\s*["'][^"'\n]+["']\s*,\s*\d+\s*\)/g) || []).length > 0
                        ? `✓ ${(textoCargaQuadros.match(/\(\s*["'][^"'\n]+["']\s*,\s*\d+\s*\)/g) || []).length} lojas identificadas no texto`
                        : 'Aguardando inserção de tuplas ("LOJA", QUADRO)...'}
                    </span>

                    <label className="faa-checkbox-label">
                      <input
                        type="checkbox"
                        checked={substituirQuadros}
                        onChange={(e) => setSubstituirQuadros(e.target.checked)}
                      />
                      <span>Substituir base existente</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button type="button" onClick={() => setIsQuadroModalOpen(false)} className="btn btn-secondary btn-sm">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleEnviarCargaQuadros}
                    disabled={loadingCarga || !textoCargaQuadros.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {loadingCarga ? 'Processando Carga...' : 'Processar Carga de Quadros'}
                  </button>
                </div>
              </div>
            )}

            {/* Aba 2: Cadastro Individual */}
            {quadroModalTab === 'individual' && (
              <form onSubmit={handleSalvarQuadro}>
                <div className="faa-form-group">
                  <label>Nome da Filial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Atacadao Anchieta 269"
                    value={novoQuadro.nome_loja}
                    onChange={(e) => setNovoQuadro({ ...novoQuadro, nome_loja: e.target.value })}
                  />
                </div>

                <div className="faa-form-row">
                  <div className="faa-form-group">
                    <label>Operação</label>
                    <select
                      value={novoQuadro.operacao}
                      onChange={(e) => setNovoQuadro({ ...novoQuadro, operacao: e.target.value })}
                    >
                      <option value="ATACADAO">Atacadão</option>
                      <option value="ASSAI">Assaí</option>
                    </select>
                  </div>
                  <div className="faa-form-group">
                    <label>Quadro Previsto (Postos)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={novoQuadro.quadro_previsto}
                      onChange={(e) => setNovoQuadro({ ...novoQuadro, quadro_previsto: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button type="button" onClick={() => setIsQuadroModalOpen(false)} className="btn btn-secondary btn-sm">
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Salvar Quadro
                  </button>
                </div>
              </form>
            )}

            {/* Aba 3: Lojas Cadastradas */}
            {quadroModalTab === 'lista' && (
              <div>
                <div className="faa-search-box" style={{ width: '100%', marginBottom: '12px' }}>
                  <Search size={15} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Buscar filial por nome ou código..."
                    value={filtroBuscaQuadro}
                    onChange={(e) => setFiltroBuscaQuadro(e.target.value)}
                  />
                </div>

                <div className="faa-list-box" style={{ maxHeight: '320px', marginTop: 0 }}>
                  {quadrosList
                    .filter(q => q.nome_loja.toLowerCase().includes(filtroBuscaQuadro.toLowerCase()))
                    .map((q) => {
                      const isAssai = q.operacao === 'ASSAI' || q.nome_loja.toLowerCase().includes('assai');
                      return (
                        <div key={q.id} className="faa-list-item">
                          <div className="faa-list-item-info">
                            <span className="faa-list-item-title">{q.nome_loja}</span>
                            <span className="faa-list-item-sub">
                              <span className={`faa-badge-op ${isAssai ? 'assai' : 'atacadao'}`} style={{ marginRight: '6px' }}>
                                {isAssai ? 'ASSAÍ' : 'ATACADÃO'}
                              </span>
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--accent-teal)' }}>
                            {q.quadro_previsto} postos
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Lançamento de Diárias Manuais */}
      {isDiariaModalOpen && (
        <div className="faa-modal-backdrop" onClick={() => setIsDiariaModalOpen(false)}>
          <div className="faa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="faa-modal-header">
              <h3><PlusCircle size={20} color="var(--accent-teal)" /> Lançamento Operacional de Diárias</h3>
              <button onClick={() => setIsDiariaModalOpen(false)} className="btn-close-modal">✕</button>
            </div>

            <form onSubmit={handleCriarDiaria}>
              <div className="faa-form-group">
                <label>Filial</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Atacadao Anchieta"
                  value={novaDiaria.nome_loja}
                  onChange={(e) => setNovaDiaria({ ...novaDiaria, nome_loja: e.target.value })}
                />
              </div>

              <div className="faa-form-row">
                <div className="faa-form-group">
                  <label>Data</label>
                  <input
                    type="date"
                    required
                    value={novaDiaria.data}
                    onChange={(e) => setNovaDiaria({ ...novaDiaria, data: e.target.value })}
                  />
                </div>
                <div className="faa-form-group">
                  <label>Quantidade de Diárias</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={novaDiaria.quantidade}
                    onChange={(e) => setNovaDiaria({ ...novaDiaria, quantidade: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="faa-form-group">
                <label>Motivo / Observação</label>
                <input
                  type="text"
                  placeholder="Ex: Cobertura de falta de colaborador"
                  value={novaDiaria.observacao}
                  onChange={(e) => setNovaDiaria({ ...novaDiaria, observacao: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsDiariaModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Registrar Diária
                </button>
              </div>
            </form>

            <div className="faa-list-box">
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Histórico de Diárias Registradas ({diariasList.length}):
              </h4>
              {diariasList.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nenhuma diária manual cadastrada.</p>
              ) : (
                <div>
                  {diariasList.map((d) => (
                    <div key={d.id} className="faa-list-item">
                      <div className="faa-list-item-info">
                        <span className="faa-list-item-title">{d.nome_loja}</span>
                        <span className="faa-list-item-sub">{d.data} • {d.quantidade} diária(s) {d.observacao && `• ${d.observacao}`}</span>
                      </div>
                      <button
                        onClick={() => handleExcluirDiaria(d.id)}
                        className="faa-btn-icon"
                        style={{ color: '#fb7185' }}
                        title="Excluir diária"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
