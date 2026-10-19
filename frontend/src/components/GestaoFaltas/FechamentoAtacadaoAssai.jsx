import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  PlusCircle,
  Building2,
  Info,
  Trash2,
  FileText,
  ListPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';
import SearchableSelect from '../ui/searchable-select';
import './FechamentoAtacadaoAssai.css';

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

const ANOS = [2024, 2025, 2026, 2027, 2028];

export default function FechamentoAtacadaoAssai({ showToast }) {
  // Parâmetros de Entrada
  const [mes, setMes] = useState(() => {
    try {
      const cached = localStorage.getItem('fechamento_atacadao_assai_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.mes) return Number(parsed.mes);
      }
    } catch (e) {}
    return 9;
  });
  const [ano, setAno] = useState(() => {
    try {
      const cached = localStorage.getItem('fechamento_atacadao_assai_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.ano) return Number(parsed.ano);
      }
    } catch (e) {}
    return 2026;
  });
  const [hecMinutos, setHecMinutos] = useState(0);
  const [mesesDisponiveis, setMesesDisponiveis] = useState([]);
  const [buscandoMes, setBuscandoMes] = useState(false);

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
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroCoordenacao, setFiltroCoordenacao] = useState('');
  const [filtroSupervisao, setFiltroSupervisao] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'loja', direction: 'asc' });

  // Paginação e busca para inconsistências, diário e quadros
  const [buscaInc, setBuscaInc] = useState('');
  const [paginaInc, setPaginaInc] = useState(1);
  const [paginaDiario, setPaginaDiario] = useState(1);
  const [paginaQuadros, setPaginaQuadros] = useState(1);
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

  const carregarFechamento = async (mesSel = mes, anoSel = ano, silent = false) => {
    if (!silent) setBuscandoMes(true);
    try {
      const data = await api.getUltimoFechamentoAtacadaoAssai(mesSel, anoSel);
      if (data?.meses_disponiveis) {
        setMesesDisponiveis(data.meses_disponiveis);
      }
      if (data && (data.tem_fechamento || data.kpis)) {
        setResultadoProcessamento(data);
        try {
          localStorage.setItem('fechamento_atacadao_assai_cache', JSON.stringify(data));
        } catch (eCache) {}
        if (data.resumo_lojas && data.resumo_lojas.length > 0) {
          setSelectedLoja(prev => {
            const existe = data.resumo_lojas.some(r => r.loja === prev);
            return existe ? prev : data.resumo_lojas[0].loja;
          });
        }
      } else {
        setResultadoProcessamento(null);
        setSelectedLoja(null);
      }
    } catch (e) {
      console.warn('Nenhum fechamento ativo prévio no servidor:', e);
      if (!silent) showToast('Erro ao carregar fechamento: ' + e.message, 'error');
    } finally {
      if (!silent) setBuscandoMes(false);
    }
  };

  const carregarUltimoFechamento = () => carregarFechamento(mes, ano);

  useEffect(() => {
    carregarQuadros();
    carregarDiarias();
  }, []);

  useEffect(() => {
    carregarFechamento(mes, ano);
  }, [mes, ano]);

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
    await carregarFechamento(mes, ano, true);
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
      if (resp.meses_disponiveis) {
        setMesesDisponiveis(resp.meses_disponiveis);
      } else {
        await carregarFechamento(mes, ano, true);
      }
      showToast('Fechamento Atacadão e Assaí processado com 100% de precisão!', 'success');
    } catch (err) {
      showToast('Erro ao processar: ' + (err.message || 'Falha na comunicação com o backend'), 'error');
    } finally {
      setLoading(false);
      setEtapaStatus('');
    }
  };

  const handleEditarQuadroRapido = async (loja, quadroAtual, lojaOriginal) => {
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
      if (lojaOriginal && lojaOriginal !== loja) {
        await api.salvarQuadroAtacadaoAssai({
          nome_loja: lojaOriginal,
          quadro_previsto: novoQuadro,
          ativo: true
        });
      }
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

  // Opções dinâmicas a partir dos dados reais do fechamento (sem duplicar nem inventar valores)
  const clientesOpcoes = useMemo(() => {
    if (!resultadoProcessamento?.resumo_lojas) return [];
    const set = new Set();
    resultadoProcessamento.resumo_lojas.forEach(r => {
      if (r.cliente) set.add(r.cliente);
    });
    return Array.from(set).sort().map(c => ({ value: c, label: c }));
  }, [resultadoProcessamento]);

  const coordenacoesOpcoes = useMemo(() => {
    if (!resultadoProcessamento?.resumo_lojas) return [];
    const set = new Set();
    resultadoProcessamento.resumo_lojas.forEach(r => {
      if (r.coordenacao && r.coordenacao !== 'Não Informado') set.add(r.coordenacao);
    });
    return Array.from(set).sort().map(c => ({ value: c, label: c }));
  }, [resultadoProcessamento]);

  const supervisoresOpcoes = useMemo(() => {
    if (!resultadoProcessamento?.resumo_lojas) return [];
    const set = new Set();
    resultadoProcessamento.resumo_lojas.forEach(r => {
      if (r.supervisao && r.supervisao !== 'Não Informado') set.add(r.supervisao);
    });
    return Array.from(set).sort().map(s => ({ value: s, label: s }));
  }, [resultadoProcessamento]);

  const matchesFilter = (val, filterString) => {
    if (!filterString) return true;
    const selectedList = filterString.split(',').filter(Boolean);
    if (selectedList.length === 0) return true;
    return selectedList.includes(val);
  };

  // Filtragem combinada das lojas: busca por nome (referência oficial ou relatório) + Cliente + Coordenação + Supervisão
  const lojasFiltradas = useMemo(() => {
    if (!resultadoProcessamento?.resumo_lojas) return [];
    return resultadoProcessamento.resumo_lojas.filter(l => {
      const nomeRef = (l.nome_referencia || l.loja || '').toLowerCase();
      const nomeOrig = (l.loja_original || '').toLowerCase();
      const st = searchTerm.toLowerCase();
      const matchNome = !searchTerm || nomeRef.includes(st) || nomeOrig.includes(st);
      const matchCliente = matchesFilter(l.cliente, filtroCliente);
      const matchCoord = matchesFilter(l.coordenacao, filtroCoordenacao);
      const matchSup = matchesFilter(l.supervisao, filtroSupervisao);
      return matchNome && matchCliente && matchCoord && matchSup;
    });
  }, [resultadoProcessamento, searchTerm, filtroCliente, filtroCoordenacao, filtroSupervisao]);

  // Reset de página ao alterar qualquer filtro ou busca
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filtroCliente, filtroCoordenacao, filtroSupervisao]);

  const handleLimparFiltros = () => {
    setSearchTerm('');
    setFiltroCliente('');
    setFiltroCoordenacao('');
    setFiltroSupervisao('');
    setPaginaAtual(1);
  };

  const temFiltroAtivo = Boolean(searchTerm || filtroCliente || filtroCoordenacao || filtroSupervisao);

  // Ordenação das lojas
  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedLojas = useMemo(() => {
    const list = [...lojasFiltradas];
    if (!sortConfig.key) return list;
    list.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'pt-BR', { numeric: true, sensitivity: 'base' });
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return list;
  }, [lojasFiltradas, sortConfig]);

  const ITENS_POR_PAGINA = 10;
  const totalPaginas = Math.max(1, Math.ceil(sortedLojas.length / ITENS_POR_PAGINA));

  // Proteção: garante página válida mesmo após exclusão/alteração/filtro
  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [totalPaginas, paginaAtual]);

  const paginatedLojas = useMemo(() => {
    const start = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return sortedLojas.slice(start, start + ITENS_POR_PAGINA);
  }, [sortedLojas, paginaAtual]);

  // Inconsistências filtradas e paginadas
  const inconsistenciasFiltradas = useMemo(() => {
    if (!resultadoProcessamento?.inconsistencias) return [];
    if (!buscaInc) return resultadoProcessamento.inconsistencias;
    const term = buscaInc.toLowerCase();
    return resultadoProcessamento.inconsistencias.filter(inc =>
      (inc.re && String(inc.re).toLowerCase().includes(term)) ||
      (inc.cpf && String(inc.cpf).toLowerCase().includes(term)) ||
      (inc.loja && String(inc.loja).toLowerCase().includes(term)) ||
      (inc.tipo && String(inc.tipo).toLowerCase().includes(term)) ||
      (inc.detalhe && String(inc.detalhe).toLowerCase().includes(term))
    );
  }, [resultadoProcessamento, buscaInc]);

  const totalPaginasInc = Math.max(1, Math.ceil(inconsistenciasFiltradas.length / ITENS_POR_PAGINA));

  useEffect(() => {
    setPaginaInc(1);
  }, [buscaInc]);

  useEffect(() => {
    if (paginaInc > totalPaginasInc) {
      setPaginaInc(totalPaginasInc);
    }
  }, [totalPaginasInc, paginaInc]);

  const paginatedInconsistencias = useMemo(() => {
    const start = (paginaInc - 1) * ITENS_POR_PAGINA;
    return inconsistenciasFiltradas.slice(start, start + ITENS_POR_PAGINA);
  }, [inconsistenciasFiltradas, paginaInc]);

  // Objeto de dados da loja atualmente selecionada
  const selectedLojaObj = useMemo(() => {
    return resultadoProcessamento?.resumo_lojas?.find(l =>
      l.loja === selectedLoja || l.nome_referencia === selectedLoja || l.loja_original === selectedLoja
    );
  }, [resultadoProcessamento, selectedLoja]);

  // Dados diários da loja selecionada e paginados
  const diarioLojaSelecionada = useMemo(() => {
    return resultadoProcessamento?.amostra_diaria?.filter(d =>
      d.loja === selectedLoja ||
      d.nome_referencia === selectedLoja ||
      d.loja_original === selectedLoja ||
      (selectedLojaObj && (
        d.loja === selectedLojaObj.loja ||
        d.loja === selectedLojaObj.nome_referencia ||
        d.loja === selectedLojaObj.loja_original
      ))
    ) || [];
  }, [resultadoProcessamento, selectedLoja, selectedLojaObj]);

  const totalPaginasDiario = Math.max(1, Math.ceil(diarioLojaSelecionada.length / ITENS_POR_PAGINA));

  useEffect(() => {
    setPaginaDiario(1);
  }, [selectedLoja]);

  useEffect(() => {
    if (paginaDiario > totalPaginasDiario) {
      setPaginaDiario(totalPaginasDiario);
    }
  }, [totalPaginasDiario, paginaDiario]);

  const paginatedDiario = useMemo(() => {
    const start = (paginaDiario - 1) * ITENS_POR_PAGINA;
    return diarioLojaSelecionada.slice(start, start + ITENS_POR_PAGINA);
  }, [diarioLojaSelecionada, paginaDiario]);

  // Quadros filtrados e paginados
  const quadrosFiltrados = useMemo(() => {
    if (!quadrosList) return [];
    if (!filtroBuscaQuadro) return quadrosList;
    const term = filtroBuscaQuadro.toLowerCase();
    return quadrosList.filter(q => q.nome_loja.toLowerCase().includes(term));
  }, [quadrosList, filtroBuscaQuadro]);

  const totalPaginasQuadros = Math.max(1, Math.ceil(quadrosFiltrados.length / ITENS_POR_PAGINA));

  useEffect(() => {
    setPaginaQuadros(1);
  }, [filtroBuscaQuadro]);

  useEffect(() => {
    if (paginaQuadros > totalPaginasQuadros) {
      setPaginaQuadros(totalPaginasQuadros);
    }
  }, [totalPaginasQuadros, paginaQuadros]);

  const paginatedQuadros = useMemo(() => {
    const start = (paginaQuadros - 1) * ITENS_POR_PAGINA;
    return quadrosFiltrados.slice(start, start + ITENS_POR_PAGINA);
  }, [quadrosFiltrados, paginaQuadros]);

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
          <div className="faa-control-pill" title="Selecione o mês e ano do fechamento">
            <Calendar size={15} color="var(--accent-teal)" />
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              aria-label="Mês de Referência"
            >
              {MESES.map(m => {
                const temDados = mesesDisponiveis.some(item => item.mes === m.val && item.ano === ano);
                return (
                  <option key={m.val} value={m.val}>
                    {m.nome} ({String(m.val).padStart(2, '0')}){temDados ? ' ✓' : ''}
                  </option>
                );
              })}
            </select>
            <span>/</span>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              aria-label="Ano de Referência"
            >
              {ANOS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {buscandoMes && (
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-teal)', marginLeft: '4px' }}>
                Carregando...
              </span>
            )}
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
          <span>Os arquivos originais nunca são modificados. Abono de 1 atestado/mês ativo exclusivamente para o cliente Assaí (contabilizado em presença).</span>
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
      {resultadoProcessamento ? (
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
                    Fechamento de {MESES.find(m => m.val === (resultadoProcessamento.mes || mes))?.nome || mes} de {resultadoProcessamento.ano || ano} Carregado
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
                    <span>Processamento gravado em: <strong>{resultadoProcessamento.atualizado_em}</strong></span>
                  ) : (
                    <span>Dados consolidados em memória e disco</span>
                  )}
                  <span> • {resultadoProcessamento.kpis?.total_lojas || 0} filiais ativas</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => carregarFechamento(mes, ano)}
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
              <div className="faa-kpi-sub">
                {resultadoProcessamento.kpis.total_atestados_abonados > 0 
                  ? `Presenças (${resultadoProcessamento.kpis.total_atestados_abonados} abonos Assaí) + Folgas`
                  : 'Presenças + Outras Folgas'}
              </div>
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
                <span>Detalhamento Diário ({selectedLojaObj?.nome_referencia || selectedLoja || 'Selecione uma filial'})</span>
              </button>
            </div>

            <div className="faa-export-group">
              <a
                href={api.getDownloadAtacadaoAssaiExcelUrl(resultadoProcessamento?.mes || mes, resultadoProcessamento?.ano || ano)}
                className="btn btn-secondary btn-sm"
                download
                title="Download da planilha oficial consolidada com 7 abas"
              >
                <FileSpreadsheet size={16} color="#34d399" />
                <span style={{ color: '#34d399' }}>Baixar Excel (7 Abas)</span>
              </a>

              <a
                href={api.getDownloadAtacadaoAssaiZipUrl(resultadoProcessamento?.mes || mes, resultadoProcessamento?.ano || ano)}
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
              {/* 1. Título e Informações */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={18} color="var(--accent-teal)" />
                    Fechamento Consolidado por Loja
                    <span className="faa-badge-op assai" style={{ fontSize: '0.68rem', padding: '1px 8px' }}>Atacadão & Assaí</span>
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Quadro previsto, apuração de presenças e folgas, atestados abonados e saldo comparativo de faltas
                  </p>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Total apurado: <strong>{resultadoProcessamento.resumo_lojas?.length || 0}</strong> filiais
                </div>
              </div>

              {/* 2. Busca e Filtros */}
              <div className="faa-filters-card" style={{ margin: '16px 20px 14px' }}>
                <div className="faa-filters-grid">
                  {/* Busca por Nome */}
                  <div className="faa-filter-field">
                    <label>Busca por Nome</label>
                    <div className="faa-input-search-wrap">
                      <Search size={15} className="faa-search-icon" />
                      <input
                        type="text"
                        placeholder="Pesquisar por filial..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="faa-input-search"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="faa-input-clear-btn"
                          title="Limpar busca"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtro Cliente */}
                  <div className="faa-filter-field">
                    <label>Cliente / Operação</label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "Todos os Clientes" },
                        ...clientesOpcoes
                      ]}
                      value={filtroCliente}
                      onChange={setFiltroCliente}
                      placeholder="Todos os Clientes"
                      multiple={true}
                    />
                  </div>

                  {/* Filtro Supervisão */}
                  <div className="faa-filter-field">
                    <label>Supervisão</label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "Todas as Supervisões" },
                        ...supervisoresOpcoes
                      ]}
                      value={filtroSupervisao}
                      onChange={setFiltroSupervisao}
                      placeholder="Todas as Supervisões"
                      multiple={true}
                    />
                  </div>

                  {/* Filtro Coordenação */}
                  <div className="faa-filter-field">
                    <label>Coordenação</label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "Todas as Coordenações" },
                        ...coordenacoesOpcoes
                      ]}
                      value={filtroCoordenacao}
                      onChange={setFiltroCoordenacao}
                      placeholder="Todas as Coordenações"
                      multiple={true}
                    />
                  </div>
                </div>

                <div className="faa-filters-footer">
                  <div className="faa-filters-stats">
                    <span>
                      Mostrando <strong>{lojasFiltradas.length}</strong> de <strong>{resultadoProcessamento.resumo_lojas?.length}</strong> filiais
                    </span>
                    {temFiltroAtivo && (
                      <span className="faa-filter-tag">
                        <Filter size={11} /> Filtros ativos
                      </span>
                    )}
                  </div>

                  {temFiltroAtivo && (
                    <button
                      type="button"
                      onClick={handleLimparFiltros}
                      className="faa-btn-clear-filters"
                    >
                      <RotateCcw size={12} />
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Ações Existentes */}
              <div className="faa-actions-bar" style={{ margin: '0 20px 14px' }}>
                <div className="faa-actions-group-left">
                  <button
                    onClick={() => setIsQuadroModalOpen(true)}
                    className="btn btn-secondary btn-sm"
                    title="Configurar quadros de funcionários previstos por loja"
                  >
                    <Settings size={14} color="var(--accent-teal)" />
                    <span>Configurar Quadros</span>
                  </button>
                  <button
                    onClick={() => setIsDiariaModalOpen(true)}
                    className="btn btn-secondary btn-sm"
                    title="Lançar nova diária operacional avulsa"
                  >
                    <PlusCircle size={14} color="var(--accent-teal)" />
                    <span>Lançar Diárias</span>
                  </button>
                  <button
                    onClick={carregarUltimoFechamento}
                    className="btn btn-secondary btn-sm"
                    title="Recarregar dados do fechamento do servidor"
                  >
                    <RotateCcw size={14} />
                    <span>Atualizar</span>
                  </button>
                </div>

                <div className="faa-actions-group-right">
                  <a
                    href={api.getDownloadAtacadaoAssaiExcelUrl()}
                    className="btn btn-secondary btn-sm"
                    download
                    title="Download da planilha oficial consolidada com 7 abas"
                  >
                    <FileSpreadsheet size={15} color="#34d399" />
                    <span style={{ color: '#34d399', fontWeight: 600 }}>Baixar Excel (7 Abas)</span>
                  </a>

                  <a
                    href={api.getDownloadAtacadaoAssaiZipUrl()}
                    className="btn btn-secondary btn-sm"
                    download
                    title="Download do pacote ZIP contendo os relatórios em PDF de todas as lojas"
                  >
                    <FileArchive size={15} color="#38bdf8" />
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>Baixar PDFs (ZIP)</span>
                  </a>
                </div>
              </div>

              {/* 4. Tabela (10 linhas por página) */}
              <div className="faa-table-container">
                {paginatedLojas.length === 0 ? (
                  <div className="faa-empty-state-box">
                    <Search size={36} color="var(--text-muted)" />
                    <div className="faa-empty-state-title">Nenhuma filial encontrada</div>
                    <div className="faa-empty-state-desc">
                      Nenhuma loja corresponde aos filtros selecionados. Tente ajustar os termos de pesquisa ou limpar os filtros.
                    </div>
                    {temFiltroAtivo && (
                      <button
                        type="button"
                        onClick={handleLimparFiltros}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '6px' }}
                      >
                        <RotateCcw size={14} />
                        Limpar Filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="faa-table">
                    <thead>
                      <tr>
                        <th className="faa-th-sortable" onClick={() => handleSort('loja')}>
                          <span className="faa-th-content">
                            Loja / Filial
                            {sortConfig.key === 'loja' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('quadro')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Quadro
                            {sortConfig.key === 'quadro' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('dias_uteis')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Dias
                            {sortConfig.key === 'dias_uteis' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('total_esperado')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Esperado
                            {sortConfig.key === 'total_esperado' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('presencas')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Presenças
                            {sortConfig.key === 'presencas' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('folgas')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Folgas
                            {sortConfig.key === 'folgas' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('outras_folgas')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Outras
                            {sortConfig.key === 'outras_folgas' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('atestados')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Atestados
                            {sortConfig.key === 'atestados' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center' }} className="faa-th-sortable" onClick={() => handleSort('diarias')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Diárias
                            {sortConfig.key === 'diarias' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center', color: '#34d399' }} className="faa-th-sortable" onClick={() => handleSort('resultado')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Resultado
                            {sortConfig.key === 'resultado' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center', color: '#fbbf24' }} className="faa-th-sortable" onClick={() => handleSort('comparativo')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Comparativo
                            {sortConfig.key === 'comparativo' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'center', color: '#fb7185' }} className="faa-th-sortable" onClick={() => handleSort('faltas_operacionais')}>
                          <span className="faa-th-content" style={{ justifyContent: 'center' }}>
                            Faltas RH
                            {sortConfig.key === 'faltas_operacionais' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                            ) : (
                              <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                            )}
                          </span>
                        </th>
                        <th style={{ textAlign: 'right' }}>HT Total</th>
                        <th style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLojas.map((r, idx) => {
                        const nomePrincipal = r.nome_referencia || r.loja;
                        const isAssai = r.cliente === 'ASSAÍ' || nomePrincipal.toLowerCase().includes('assai') || nomePrincipal.toLowerCase().includes('sendas');
                        const nomeRelatorioDiferente = r.loja_original && r.loja_original !== nomePrincipal;
                        const isSelected = selectedLoja === r.loja || selectedLoja === r.nome_referencia || selectedLoja === r.loja_original;

                        return (
                          <tr
                            key={idx}
                            className={isSelected ? 'selected' : ''}
                          >
                            <td>
                              <div className="faa-loja-cell">
                                <span className={`faa-badge-op ${isAssai ? 'assai' : 'atacadao'}`}>
                                  {isAssai ? 'ASSAÍ' : 'ATACADÃO'}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{nomePrincipal}</div>
                                  {nomeRelatorioDiferente && (
                                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                      Relatório: {r.loja_original}
                                    </div>
                                  )}
                                  {(r.supervisao || r.coordenacao) && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {r.supervisao && r.supervisao !== 'Não Informado' && <span>Sup: {r.supervisao}</span>}
                                      {r.supervisao && r.supervisao !== 'Não Informado' && r.coordenacao && r.coordenacao !== 'Não Informado' && <span> • </span>}
                                      {r.coordenacao && r.coordenacao !== 'Não Informado' && <span>Coord: {r.coordenacao}</span>}
                                    </div>
                                  )}
                                </div>
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
                              onClick={() => handleEditarQuadroRapido(r.loja, r.quadro, r.loja_original)}
                              title="Clique para editar/definir o número de pessoas (quadro) desta filial"
                            >
                              <span style={{ marginRight: '3px' }}>{r.quadro}</span>
                              <span style={{ fontSize: '0.65rem', opacity: 0.75 }}>✏️</span>
                            </td>
                            <td className="faa-num-cell">{r.dias_uteis}</td>
                            <td className="faa-num-cell blue">{r.total_esperado}</td>
                            <td 
                              className="faa-num-cell bold"
                              title={r.atestados_abonados > 0 ? `${r.atestados_abonados} atestado(s) abonado(s) contabilizado(s) em presença (Regra Assaí)` : undefined}
                            >
                              <span>{r.presencas}</span>
                              {r.atestados_abonados > 0 && (
                                <span 
                                  style={{ fontSize: '0.65rem', color: '#38bdf8', marginLeft: '3px', fontWeight: 'bold' }} 
                                  title={`${r.atestados_abonados} atestado(s) abonado(s) para presença (Regra Assaí)`}
                                >
                                  ★
                                </span>
                              )}
                            </td>
                            <td className="faa-num-cell">{r.folgas}</td>
                            <td className="faa-num-cell">{r.outras_folgas}</td>
                            <td 
                              className="faa-num-cell"
                              title={r.atestados_abonados > 0 ? `${r.atestados_abonados} de ${r.atestados} atestados foram abonados para presença` : undefined}
                            >
                              {r.atestados}
                            </td>
                            <td className="faa-num-cell">{r.diarias}</td>
                            <td className="faa-num-cell emerald">{r.resultado}</td>
                            <td className="faa-num-cell amber">{r.comparativo}</td>
                            <td className="faa-num-cell rose">{r.faltas_operacionais}</td>
                            <td className="faa-num-cell mono" style={{ textAlign: 'right' }}>{r.ht_formatted}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <a
                                href={api.getDownloadLojaPdfUrl(r.loja_original || r.loja, resultadoProcessamento?.mes || mes, resultadoProcessamento?.ano || ano)}
                                className="faa-btn-icon"
                                title={`Baixar Relatório PDF Oficial da loja ${nomePrincipal}`}
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
                )}
              </div>

              {/* 5. Paginação abaixo */}
              <div className="faa-pagination-bar">
                <div className="faa-pagination-info">
                  {sortedLojas.length === 0 ? (
                    <span>Nenhum registro para exibir</span>
                  ) : (
                    <span>
                      Mostrando <strong>{(paginaAtual - 1) * ITENS_POR_PAGINA + 1}</strong> a <strong>{Math.min(paginaAtual * ITENS_POR_PAGINA, sortedLojas.length)}</strong> de <strong>{sortedLojas.length}</strong> filiais
                      {sortedLojas.length !== (resultadoProcessamento.resumo_lojas?.length || 0) && (
                        <span style={{ color: 'var(--text-muted)' }}> (filtrado de {resultadoProcessamento.resumo_lojas?.length} total)</span>
                      )}
                    </span>
                  )}
                </div>

                <div className="faa-pagination-controls">
                  <button
                    type="button"
                    onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                    disabled={paginaAtual <= 1}
                    className="faa-pagination-btn"
                    title="Ir para a página anterior"
                  >
                    <ChevronLeft size={16} />
                    <span>Anterior</span>
                  </button>

                  <div className="faa-pagination-page-indicator">
                    Página {paginaAtual} de {totalPaginas}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                    disabled={paginaAtual >= totalPaginas}
                    className="faa-pagination-btn"
                    title="Ir para a próxima página"
                  >
                    <span>Próxima</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba 2: Painel de Inconsistências */}
          {activeTab === 'inconsistencias' && (
            <div className="faa-table-card">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} color="#fbbf24" />
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Inconsistências & Divergências Auditadas ({inconsistenciasFiltradas.length})
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Batidas sem espelho, pontos sem marcas, turnos especiais e marcações em férias. Nenhuma linha é descartada.
                    </p>
                  </div>
                </div>

                <div className="faa-input-search-wrap" style={{ width: '280px' }}>
                  <Search size={14} className="faa-search-icon" />
                  <input
                    type="text"
                    placeholder="Pesquisar inconsistência..."
                    value={buscaInc}
                    onChange={(e) => setBuscaInc(e.target.value)}
                    className="faa-input-search"
                  />
                  {buscaInc && (
                    <button
                      type="button"
                      onClick={() => setBuscaInc('')}
                      className="faa-input-clear-btn"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {paginatedInconsistencias.length === 0 ? (
                <div className="empty-box">
                  <CheckCircle2 size={36} color="#34d399" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {buscaInc ? 'Nenhuma inconsistência encontrada para esta busca.' : 'Nenhuma inconsistência ou ambiguidade encontrada nas bases!'}
                  </p>
                </div>
              ) : (
                <>
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
                        {paginatedInconsistencias.map((inc, i) => (
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

                  <div className="faa-pagination-bar">
                    <div className="faa-pagination-info">
                      Mostrando <strong>{(paginaInc - 1) * ITENS_POR_PAGINA + 1}</strong> a <strong>{Math.min(paginaInc * ITENS_POR_PAGINA, inconsistenciasFiltradas.length)}</strong> de <strong>{inconsistenciasFiltradas.length}</strong> ocorrências
                    </div>

                    <div className="faa-pagination-controls">
                      <button
                        type="button"
                        onClick={() => setPaginaInc(prev => Math.max(1, prev - 1))}
                        disabled={paginaInc <= 1}
                        className="faa-pagination-btn"
                      >
                        <ChevronLeft size={16} />
                        <span>Anterior</span>
                      </button>

                      <div className="faa-pagination-page-indicator">
                        Página {paginaInc} de {totalPaginasInc}
                      </div>

                      <button
                        type="button"
                        onClick={() => setPaginaInc(prev => Math.min(totalPaginasInc, prev + 1))}
                        disabled={paginaInc >= totalPaginasInc}
                        className="faa-pagination-btn"
                      >
                        <span>Próxima</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
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
                    Detalhamento Diário — {selectedLojaObj?.nome_referencia || selectedLoja || 'Selecione uma Loja'}
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
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-card)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.825rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {resultadoProcessamento.resumo_lojas?.map((l, i) => {
                      const display = l.nome_referencia || l.loja;
                      return (
                        <option key={i} value={l.loja}>
                          {display}
                        </option>
                      );
                    })}
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
                    {paginatedDiario.map((dia, idx) => (
                      <tr key={idx}>
                        <td className="faa-num-cell mono">{dia.data}</td>
                        <td className="faa-num-cell" style={{ color: 'var(--text-secondary)' }}>{dia.dia_semana}</td>
                        <td 
                          className="faa-num-cell bold"
                          title={dia.atestados_abonados > 0 ? `${dia.atestados_abonados} atestado(s) abonado(s) para presença neste dia (Regra Assaí)` : undefined}
                        >
                          <span>{dia.presenca}</span>
                          {dia.atestados_abonados > 0 && (
                            <span 
                              style={{ fontSize: '0.65rem', color: '#38bdf8', marginLeft: '3px', fontWeight: 'bold' }} 
                              title={`${dia.atestados_abonados} atestado(s) abonado(s) para presença neste dia (Regra Assaí)`}
                            >
                              ★
                            </span>
                          )}
                        </td>
                        <td className="faa-num-cell">{dia.folga}</td>
                        <td className="faa-num-cell">{dia.outras_folgas}</td>
                        <td 
                          className="faa-num-cell"
                          title={dia.atestados_abonados > 0 ? `${dia.atestados_abonados} de ${dia.atestado} atestado(s) abonado(s) para presença neste dia` : undefined}
                        >
                          {dia.atestado}
                        </td>
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

              <div className="faa-pagination-bar">
                <div className="faa-pagination-info">
                  Mostrando <strong>{(paginaDiario - 1) * ITENS_POR_PAGINA + 1}</strong> a <strong>{Math.min(paginaDiario * ITENS_POR_PAGINA, diarioLojaSelecionada.length)}</strong> de <strong>{diarioLojaSelecionada.length}</strong> dias apurados
                </div>

                <div className="faa-pagination-controls">
                  <button
                    type="button"
                    onClick={() => setPaginaDiario(prev => Math.max(1, prev - 1))}
                    disabled={paginaDiario <= 1}
                    className="faa-pagination-btn"
                  >
                    <ChevronLeft size={16} />
                    <span>Anterior</span>
                  </button>

                  <div className="faa-pagination-page-indicator">
                    Página {paginaDiario} de {totalPaginasDiario}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPaginaDiario(prev => Math.min(totalPaginasDiario, prev + 1))}
                    disabled={paginaDiario >= totalPaginasDiario}
                    className="faa-pagination-btn"
                  >
                    <span>Próxima</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px dashed var(--border-card)',
          borderRadius: '12px',
          padding: '36px 24px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <Info size={40} style={{ color: 'var(--accent-teal)', marginBottom: '14px', opacity: 0.9 }} />
          <h4 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 600 }}>
            Nenhum fechamento salvo para {MESES.find(m => m.val === mes)?.nome || mes}/{ano}
          </h4>
          <p style={{ margin: '0 auto 18px auto', fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '580px', lineHeight: 1.5 }}>
            Para gerar e consolidar o fechamento deste período, anexe os arquivos de PunchReport e Espelhos acima e clique em <strong>"Iniciar Processamento"</strong>.
          </p>

          {mesesDisponiveis && mesesDisponiveis.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border-card)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: 500 }}>
                Ou selecione abaixo um mês com fechamento gravado para visualização imediata:
              </span>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {mesesDisponiveis.map(m => (
                  <button
                    key={`${m.mes}-${m.ano}`}
                    type="button"
                    onClick={() => {
                      setMes(m.mes);
                      setAno(m.ano);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.82rem', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title={`Visualizar fechamento gravado de ${m.label}`}
                  >
                    <Calendar size={14} style={{ color: 'var(--accent-teal)' }} />
                    <span>{m.label} ({m.total_lojas} filiais)</span>
                  </button>
                ))}
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

                <div className="faa-list-box" style={{ maxHeight: '360px', marginTop: 0 }}>
                  {paginatedQuadros.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Nenhuma filial encontrada com esse nome.
                    </div>
                  ) : (
                    paginatedQuadros.map((q) => {
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
                    })
                  )}
                </div>

                <div className="faa-pagination-bar" style={{ padding: '10px 0 0', marginTop: '10px' }}>
                  <div className="faa-pagination-info" style={{ fontSize: '0.75rem' }}>
                    Mostrando <strong>{(paginaQuadros - 1) * ITENS_POR_PAGINA + 1}</strong> a <strong>{Math.min(paginaQuadros * ITENS_POR_PAGINA, quadrosFiltrados.length)}</strong> de <strong>{quadrosFiltrados.length}</strong>
                  </div>

                  <div className="faa-pagination-controls">
                    <button
                      type="button"
                      onClick={() => setPaginaQuadros(prev => Math.max(1, prev - 1))}
                      disabled={paginaQuadros <= 1}
                      className="faa-pagination-btn"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      <ChevronLeft size={14} />
                      <span>Anterior</span>
                    </button>

                    <div className="faa-pagination-page-indicator" style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: '70px' }}>
                      {paginaQuadros} / {totalPaginasQuadros}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPaginaQuadros(prev => Math.min(totalPaginasQuadros, prev + 1))}
                      disabled={paginaQuadros >= totalPaginasQuadros}
                      className="faa-pagination-btn"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      <span>Próxima</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
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
