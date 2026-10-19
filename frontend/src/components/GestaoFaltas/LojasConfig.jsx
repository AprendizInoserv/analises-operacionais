import React, { useState, useEffect, useMemo } from 'react';
import { 
  Store, 
  Save, 
  Plus, 
  Search, 
  RefreshCw, 
  Percent, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Power, 
  PowerOff, 
  RotateCcw, 
  Building2, 
  ShieldCheck, 
  X,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { api } from '../../services/api';

export default function LojasConfig({ showToast, clientCode = 'carrefour' }) {
  const [lojas, setLojas] = useState([]);
  const [regioes, setRegioes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todas'); // 'todas', 'ativas', 'inativas'
  const [reajustePct, setReajustePct] = useState('');
  
  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 15;

  // Modal de Adicionar Loja da Base Oficial
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [candidatas, setCandidatas] = useState([]);
  const [loadingCandidatas, setLoadingCandidatas] = useState(false);
  const [buscaCandidata, setBuscaCandidata] = useState('');
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [novaTarifa, setNovaTarifa] = useState('150.00');
  const [regiaoSelecionadaId, setRegiaoSelecionadaId] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const nomeClienteFormatado = clientCode === 'protege' ? 'Grupo Protege' : (clientCode === 'carrefour' ? 'Carrefour' : clientCode);

  const carregarLojas = async () => {
    setLoading(true);
    try {
      const data = await api.getLojas({ cliente_codigo: clientCode });
      setLojas(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao carregar lojas: ' + (err.message || 'Falha de comunicação'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const carregarRegioes = async () => {
    try {
      const data = await api.getRegioes();
      if (Array.isArray(data)) {
        const regsCliente = data.filter(r => {
          if (clientCode === 'protege') return r.cliente_nome?.toLowerCase().includes('protege');
          if (clientCode === 'carrefour') return r.cliente_nome?.toLowerCase().includes('carrefour');
          return true;
        });
        setRegioes(regsCliente);
        if (regsCliente.length > 0) {
          setRegiaoSelecionadaId(regsCliente[0].id);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar regiões:', err);
    }
  };

  useEffect(() => {
    carregarLojas();
    carregarRegioes();
  }, [clientCode]);

  // Edição de tarifa no estado local
  const handlePriceChange = (lojaId, novoValor) => {
    setLojas(prev => prev.map(l => {
      if (l.id === lojaId) {
        return { ...l, desconto_por_falta: novoValor };
      }
      return l;
    }));
  };

  // Salvar tarifas no backend
  const salvarPrecos = async () => {
    setSaving(true);
    try {
      const payload = lojas.map(l => ({
        id: l.id,
        desconto_por_falta: parseFloat(l.desconto_por_falta) || 0
      }));
      await api.atualizarPrecosLote(payload);
      showToast('Tarifas de faltas salvas com sucesso no banco de dados!', 'success');
      carregarLojas();
    } catch (err) {
      showToast('Erro ao salvar tarifas: ' + (err.message || 'Falha'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Alternar Ativa / Inativa
  const handleToggleAtivo = async (loja) => {
    const acaoTexto = loja.ativo ? 'inativar' : 'reativar';
    try {
      const res = await api.toggleLojaAtivo(loja.id);
      setLojas(prev => prev.map(l => {
        if (l.id === loja.id) {
          return { ...l, ativo: res.ativo };
        }
        return l;
      }));
      if (res.ativo) {
        showToast(`Loja "${loja.nome}" reativada com sucesso para o fechamento ${nomeClienteFormatado}!`, 'success');
      } else {
        showToast(`Loja "${loja.nome}" inativada no fechamento ${nomeClienteFormatado}. Registros históricos preservados.`, 'info');
      }
    } catch (err) {
      showToast(`Erro ao ${acaoTexto} loja: ` + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Reajuste percentual em massa
  const aplicarReajusteGeral = () => {
    const pct = parseFloat(reajustePct);
    if (isNaN(pct) || pct === 0) {
      showToast('Informe uma porcentagem válida (ex: 5 para +5% ou -3 para -3%)', 'error');
      return;
    }
    const fator = 1 + (pct / 100);
    setLojas(prev => prev.map(l => {
      const valAtual = parseFloat(l.desconto_por_falta) || 0;
      const novoVal = (valAtual * fator).toFixed(4);
      return { ...l, desconto_por_falta: novoVal };
    }));
    showToast(`Reajuste de ${pct > 0 ? '+' : ''}${pct}% aplicado nos campos. Clique em Salvar Todas as Tarifas para persistir.`, 'info');
    setReajustePct('');
  };

  // Carrega lojas candidatas da base oficial
  const abrirModalAdicionar = async () => {
    setModalAddOpen(true);
    setLojaSelecionada(null);
    setBuscaCandidata('');
    setLoadingCandidatas(true);
    try {
      const data = await api.getCandidatasBaseOficial({ cliente_codigo: clientCode });
      setCandidatas(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Erro ao consultar base oficial de lojas: ' + (err.message || 'Falha'), 'error');
    } finally {
      setLoadingCandidatas(false);
    }
  };

  // Submete vínculo da loja candidata
  const handleConfirmarVinculo = async (reativarForcado = false) => {
    if (!lojaSelecionada) {
      showToast('Selecione uma loja da base oficial.', 'error');
      return;
    }

    // Validação estrita por cliente
    const cliUpper = (lojaSelecionada.cliente || '').toUpperCase();
    const nomeUpper = (lojaSelecionada.nome_referencia || '').toUpperCase();

    if (clientCode === 'carrefour') {
      if (cliUpper !== 'CARREFOUR' && !nomeUpper.includes('CARREFOUR')) {
        showToast('Somente filiais do cliente Carrefour podem ser vinculadas a este fechamento.', 'error');
        return;
      }
    } else if (clientCode === 'protege') {
      if (cliUpper !== 'PROTEGE' && !nomeUpper.includes('PROTEGE')) {
        showToast('Somente filiais do cliente Grupo Protege podem ser vinculadas a este fechamento.', 'error');
        return;
      }
    }

    if (lojaSelecionada.status_oficial !== 'ATIVA') {
      showToast(`A loja "${lojaSelecionada.nome_referencia}" está INATIVA na base oficial de lojas e não pode ser vinculada.`, 'error');
      return;
    }

    setSubmittingAdd(true);
    try {
      const payload = {
        loja_base_id: lojaSelecionada.id,
        cliente_codigo: clientCode,
        desconto_por_falta: parseFloat(novaTarifa) || 0,
        regiao_id: regiaoSelecionadaId || undefined,
        reativar: reativarForcado
      };

      const res = await api.adicionarLojaDaBase(payload);
      showToast(res.message || 'Loja vinculada com sucesso!', 'success');
      setModalAddOpen(false);
      carregarLojas();
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 409 && errData?.pode_reativar) {
        // Oferece reativação se já existia inativa
        const confirmar = window.confirm(`${errData.error}\nDeseja reativar esta loja agora no fechamento?`);
        if (confirmar) {
          await handleConfirmarVinculo(true);
          return;
        }
      } else {
        showToast('Erro: ' + (errData?.error || err.message || 'Falha ao vincular loja'), 'error');
      }
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Contagens e Filtros
  const totalLojas = lojas.length;
  const totalAtivas = lojas.filter(l => l.ativo).length;
  const totalInativas = lojas.filter(l => !l.ativo).length;

  const lojasFiltradas = useMemo(() => {
    return lojas.filter(l => {
      // Filtro por status
      if (filtroStatus === 'ativas' && !l.ativo) return false;
      if (filtroStatus === 'inativas' && l.ativo) return false;

      // Filtro por busca
      if (!busca) return true;
      const b = busca.toLowerCase();
      return (
        l.nome.toLowerCase().includes(b) ||
        (l.regiao_nome && l.regiao_nome.toLowerCase().includes(b)) ||
        (l.supervisor && l.supervisor.toLowerCase().includes(b)) ||
        (l.codigo_filial && String(l.codigo_filial).toLowerCase().includes(b))
      );
    });
  }, [lojas, filtroStatus, busca]);

  // Paginação
  const totalPaginas = Math.ceil(lojasFiltradas.length / itensPorPagina) || 1;
  const lojasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return lojasFiltradas.slice(inicio, inicio + itensPorPagina);
  }, [lojasFiltradas, paginaAtual]);

  // Reset de página quando o filtro mudar
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroStatus]);

  // Filtro de candidatas no modal restrito ao cliente selecionado
  const candidatasDoCliente = useMemo(() => {
    return candidatas.filter(c => {
      const cli = (c.cliente || '').toUpperCase();
      const nome = (c.nome_referencia || '').toUpperCase();
      if (clientCode === 'carrefour') {
        return cli === 'CARREFOUR' || nome.includes('CARREFOUR');
      }
      if (clientCode === 'protege') {
        return cli === 'PROTEGE' || nome.includes('PROTEGE');
      }
      return true;
    });
  }, [candidatas, clientCode]);

  const candidatasFiltradas = useMemo(() => {
    if (!buscaCandidata) return candidatasDoCliente;
    const b = buscaCandidata.toLowerCase();
    return candidatasDoCliente.filter(c => 
      c.nome_referencia.toLowerCase().includes(b) ||
      (c.cliente && c.cliente.toLowerCase().includes(b)) ||
      (c.centro_de_custo && c.centro_de_custo.toLowerCase().includes(b))
    );
  }, [candidatasDoCliente, buscaCandidata]);

  return (
    <div className="space-y-6">
      {/* Header do Módulo de Tarifas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              Lojas & Tarifas — {nomeClienteFormatado}
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-medium">
                {totalAtivas} ativas de {totalLojas}
              </span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Vínculo direto com a base oficial de lojas, ativação/inativação independente por fechamento e valor de desconto por falta.
            </p>
          </div>
        </div>

        {/* Ações do Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-semibold border border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
            onClick={carregarLojas}
            title="Recarregar lojas do banco"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recarregar</span>
          </button>

          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            onClick={abrirModalAdicionar}
            title="Adicionar uma filial da base oficial para este fechamento"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Loja da Base</span>
          </button>

          <button 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
            onClick={salvarPrecos}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Gravando...' : 'Salvar Todas as Tarifas'}</span>
          </button>
        </div>
      </div>

      {/* Assistente de Reajuste em Massa */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
              Reajuste Rápido Percentual (Convenção Coletiva / Dissídio):
            </span>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Aplica uma porcentagem sobre as tarifas de todas as lojas do fechamento de forma imediata na tela.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="number" 
            step="0.1"
            placeholder="Ex: 5.5 (%)" 
            value={reajustePct}
            onChange={(e) => setReajustePct(e.target.value)}
            className="w-28 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <button 
            className="px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition cursor-pointer"
            onClick={aplicarReajusteGeral}
          >
            Aplicar em Todas
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        {/* Pílulas de Status */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setFiltroStatus('todas')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
              filtroStatus === 'todas' 
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs' 
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Todas ({totalLojas})
          </button>
          <button
            onClick={() => setFiltroStatus('ativas')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
              filtroStatus === 'ativas' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
            }`}
          >
            Ativas ({totalAtivas})
          </button>
          <button
            onClick={() => setFiltroStatus('inativas')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
              filtroStatus === 'inativas' 
                ? 'bg-rose-600 text-white shadow-xs' 
                : 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
            }`}
          >
            Inativas ({totalInativas})
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Filtrar por nome, regional, código..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Tabela de Lojas & Tarifas */}
      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-neutral-400 gap-2">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-medium">Carregando lojas e tarifas do fechamento...</span>
          </div>
        ) : lojasPaginadas.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 text-xs">
            Nenhuma loja encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 text-neutral-600 dark:text-neutral-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Loja / Filial</th>
                  <th className="py-3 px-4">Regional</th>
                  <th className="py-3 px-4">Coordenação / Supervisão</th>
                  <th className="py-3 px-4 text-right">Tarifa / Falta (R$)</th>
                  <th className="py-3 px-4 text-center">Status no Fechamento</th>
                  <th className="py-3 px-4 text-center">Base Oficial</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {lojasPaginadas.map((loja, idx) => {
                  const numLinha = (paginaAtual - 1) * itensPorPagina + idx + 1;
                  return (
                    <tr 
                      key={loja.id}
                      className={`hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors ${
                        !loja.ativo ? 'opacity-65 bg-neutral-50/40 dark:bg-neutral-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-neutral-400">{numLinha}</td>
                      
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <span>{loja.nome}</span>
                          {loja.codigo_filial && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono">
                              Cód: {loja.codigo_filial}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 font-medium">
                        {loja.regiao_nome || '—'}
                      </td>

                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                        <div>{loja.coordenador_oficial || loja.coordenacao || '—'}</div>
                        <div className="text-[11px] text-neutral-400">{loja.supervisor_oficial || loja.supervisor || ''}</div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <span className="text-neutral-400 font-medium">R$</span>
                          <input 
                            type="number" 
                            step="0.01"
                            value={loja.desconto_por_falta}
                            onChange={(e) => handlePriceChange(loja.id, e.target.value)}
                            className="w-24 px-2 py-1 text-right font-mono font-semibold text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {loja.ativo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            Inativa
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {loja.loja_base_status ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            loja.loja_base_status === 'ATIVA' 
                              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300' 
                              : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                          }`}>
                            {loja.loja_base_status}
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-[10px] italic">Sem vínculo</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleAtivo(loja)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                            loja.ativo
                              ? 'bg-neutral-100 hover:bg-rose-100 text-neutral-700 hover:text-rose-700 dark:bg-neutral-800 dark:hover:bg-rose-950/60 dark:text-neutral-300 dark:hover:text-rose-400'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300'
                          }`}
                          title={loja.ativo ? "Inativar loja para este fechamento" : "Reativar loja para este fechamento"}
                        >
                          {loja.ativo ? (
                            <>
                              <PowerOff className="w-3 h-3" />
                              <span>Inativar</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Reativar</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Barra de Paginação */}
        {totalPaginas > 1 && (
          <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Mostrando {lojasPaginadas.length} de {lojasFiltradas.length} lojas filtradas
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={paginaAtual === 1}
                onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                className="p-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Página {paginaAtual} de {totalPaginas}
              </span>
              <button
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                className="p-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Próxima Página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Adicionar Loja da Base Oficial */}
      {modalAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div 
            className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Vincular Loja da Base Oficial — {nomeClienteFormatado}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Apenas filiais ativas pertencentes exclusivamente ao cliente {nomeClienteFormatado} são permitidas.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalAddOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Alerta de Restrição Estrita de Cliente */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-[11px]">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Filtro estrito ativado: listando somente filiais oficiais cadastradas para o cliente <strong>{nomeClienteFormatado}</strong>.
                </span>
              </div>

              {/* Busca de Candidatas */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input 
                  type="text" 
                  placeholder={`Pesquisar entre as filiais ${nomeClienteFormatado} na base oficial...`} 
                  value={buscaCandidata}
                  onChange={(e) => setBuscaCandidata(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              {/* Lista de Lojas Candidatas */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                {loadingCandidatas ? (
                  <div className="py-8 text-center text-neutral-400">
                    Carregando filiais {nomeClienteFormatado} da base oficial...
                  </div>
                ) : candidatasFiltradas.length === 0 ? (
                  <div className="py-8 text-center text-neutral-400">
                    Nenhuma loja do cliente {nomeClienteFormatado} encontrada na base oficial.
                  </div>
                ) : (
                  candidatasFiltradas.map((cand) => {
                    const isSelected = lojaSelecionada?.id === cand.id;
                    const isBloqueada = !cand.pode_adicionar;

                    return (
                      <div 
                        key={cand.id}
                        onClick={() => {
                          if (!isBloqueada) {
                            setLojaSelecionada(cand);
                          } else if (cand.motivo_bloqueio) {
                            showToast(cand.motivo_bloqueio, 'warning');
                          }
                        }}
                        className={`p-3 flex items-center justify-between transition-colors ${
                          isSelected 
                            ? 'bg-cyan-500/10 border-l-4 border-l-cyan-500' 
                            : isBloqueada 
                              ? 'opacity-50 bg-neutral-50/50 dark:bg-neutral-950/30 cursor-not-allowed' 
                              : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                            <span>{cand.nome_referencia}</span>
                            {cand.codigo_loja && (
                              <span className="font-mono text-[10px] text-neutral-400">#{cand.codigo_loja}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                            <span>Cliente: {cand.cliente || 'Geral'}</span>
                            <span>•</span>
                            <span>CC: {cand.centro_de_custo || '—'}</span>
                            {cand.coordenador_nome && <span>• Coord: {cand.coordenador_nome}</span>}
                          </div>
                        </div>

                        {/* Badges de Status */}
                        <div className="text-right">
                          {cand.status_oficial !== 'ATIVA' ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-400">
                              Inativa na Base Oficial
                            </span>
                          ) : cand.vinculada && cand.ativo_no_fechamento ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              Já Ativa no Fechamento
                            </span>
                          ) : cand.vinculada && !cand.ativo_no_fechamento ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400">
                              Inativa neste Fechamento (Reativar)
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                              Disponível
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Parâmetros do Vínculo */}
              {lojaSelecionada && (
                <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 space-y-3">
                  <div className="font-bold text-neutral-900 dark:text-white flex items-center justify-between">
                    <span>Configuração para: {lojaSelecionada.nome_referencia}</span>
                    <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">Status Oficial: ATIVA</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        Valor Desconto por Falta (R$)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={novaTarifa}
                        onChange={(e) => setNovaTarifa(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        placeholder="Ex: 150.00"
                      />
                    </div>

                    {regioes.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                          Regional de Fechamento
                        </label>
                        <select
                          value={regiaoSelecionadaId}
                          onChange={(e) => setRegiaoSelecionadaId(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        >
                          {regioes.map(r => (
                            <option key={r.id} value={r.id}>{r.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2 bg-neutral-50 dark:bg-neutral-850">
              <button 
                onClick={() => setModalAddOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button 
                disabled={!lojaSelecionada || submittingAdd}
                onClick={() => handleConfirmarVinculo(lojaSelecionada?.vinculada && !lojaSelecionada?.ativo_no_fechamento)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {submittingAdd 
                  ? 'Vinculando...' 
                  : (lojaSelecionada?.vinculada && !lojaSelecionada?.ativo_no_fechamento 
                    ? 'Reativar Loja no Fechamento' 
                    : 'Confirmar Vínculo da Loja')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
