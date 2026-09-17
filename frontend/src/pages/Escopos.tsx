import { useEffect, useState, useRef } from 'react';
import { Plus, Copy, AlertCircle, Download, Loader2 } from 'lucide-react';
import api, { getBackendPort } from '../api/client';
import { toast } from 'sonner';
import EscoposFilter from '../components/Escopos/EscoposFilter';
import EscoposTable, { type EscopoMensal, type Cargo } from '../components/Escopos/EscoposTable';
import EscopoFormModal from '../components/Escopos/EscopoFormModal';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

/**
 * Página de Gestão de Escopos Mensais (Orçados).
 * 
 * Por que existe: Gerencia a visualização e os planejamentos operacionais (quadro de funcionários
 * planejado por loja/mês). Carrega as opções de dependências (lojas e cargos) e distribui as
 * responsabilidades de exibição da tabela, filtragem e cadastro para subcomponentes menores.
 */
export default function Escopos() {
  // Listagem de escopos e paginação
  const [escopos, setEscopos] = useState<EscopoMensal[]>([]);
  const [loading, setLoading] = useState(true);
  const lastQueryId = useRef(0);
  const isFirstRender = useRef(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);

  // Opções globais para seletores
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  const [cargosOpcoes, setCargosOpcoes] = useState<Cargo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros ativos
  const [lojaFiltro, setLojaFiltro] = useState('');
  const [buscaLojaInput, setBuscaLojaInput] = useState('');
  const [anoFiltro, setAnoFiltro] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Controle de exibição do Modal de Criação
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [lojasSemEscopo, setLojasSemEscopo] = useState<LojaRef[]>([]);

  // Busca a lista de lojas ativas que não têm nenhum escopo cadastrado
  const fetchLojasSemEscopo = async () => {
    try {
      const response = await api.get('/escopos/lojas-sem-escopo/');
      if (response.data) {
        setLojasSemEscopo(response.data);
      }
    } catch (err) {
      console.error('Erro ao buscar lojas sem escopo:', err);
    }
  };

  // Carrega as dependências necessárias para filtros e modais ao montar a página
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const [lojasRes, cargosRes] = await Promise.all([
          api.get('/lojas/', { params: { sem_paginacao: 'true', status: 'ATIVA' } }),
          api.get('/cargos/'),
          fetchLojasSemEscopo()
        ]);

        if (lojasRes.data) {
          setLojasOpcoes(lojasRes.data.results || lojasRes.data || []);
        }
        if (cargosRes.data) {
          setCargosOpcoes(cargosRes.data);
        }
      } catch (err) {
        console.error('Erro ao carregar dados dependentes:', err);
        setErrorMsg('Erro ao conectar com as tabelas operacionais de lojas e cargos.');
      }
    };
    loadDependencies();
  }, []);

  // Busca os escopos cadastrados de acordo com os filtros
  const fetchEscopos = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const queryId = ++lastQueryId.current;
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const response = await api.get('/escopos/', {
        params: {
          page: targetPage,
          loja: lojaFiltro || undefined,
          busca_loja: buscaLojaInput || undefined,
          ano: anoFiltro || undefined,
          mes: mesFiltro || undefined
        }
      });

      if (queryId !== lastQueryId.current) return;

      if (response.data && response.data.results) {
        setEscopos(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 10) || 1);
      } else {
        setEscopos(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
      
      // Atualiza também as lojas sem escopo em segundo plano
      fetchLojasSemEscopo();
    } catch (err) {
      if (queryId !== lastQueryId.current) return;
      console.error('Erro ao buscar escopos:', err);
      setErrorMsg('Não foi possível carregar os escopos mensais das lojas.');
    } finally {
      if (queryId === lastQueryId.current) {
        setLoading(false);
      }
    }
  };

  // Efeito reativo: recarrega a lista apenas ao clicar em pesquisar/filtrar (disparando o fetchTrigger)
  useEffect(() => {
    fetchEscopos(true);
  }, [fetchTrigger]);

  // Recarrega se mudar a página corrente
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchEscopos();
  }, [currentPage]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFetchTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setLojaFiltro('');
    setBuscaLojaInput('');
    setAnoFiltro('');
    setMesFiltro('');
    setFetchTrigger(prev => prev + 1);
  };

  // Duplicar em lote os escopos do último mês para todas as lojas
  const handleDuplicarLote = async () => {
    if (!confirm('Deseja duplicar o ÚLTIMO mês de escopo cadastrado para o MÊS SEGUINTE em todas as lojas? Lojas que já possuírem escopo no mês seguinte serão ignoradas.')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/escopos/duplicar-proximo-mes/');
      toast.success(response.data.message || 'Duplicação em lote processada com sucesso!');
      fetchEscopos(true);
    } catch (err: any) {
      console.error('Erro ao duplicar escopos:', err);
      toast.error(err.response?.data?.error || 'Erro ao processar duplicação de escopos.');
      setLoading(false);
    }
  };

  // Excluir um escopo mensal inteiro
  const handleExcluirEscopo = async (escopoId: string, label: string) => {
    if (!confirm(`Tem certeza que deseja excluir o escopo completo de ${label}? Todos os itens de cargos vinculados serão deletados permanentemente.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.delete(`/escopos/${escopoId}/excluir/`);
      toast.success(response.data.message || 'Escopo mensal removido.');
      fetchEscopos(true);
    } catch (err: any) {
      console.error('Erro ao excluir escopo:', err);
      toast.error(err.response?.data?.error || 'Erro ao remover escopo mensal.');
      setLoading(false);
    }
  };

  // Exportar os itens do escopo mais recente para Excel (.xlsx)
  const handleExportarExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (lojaFiltro) params.append('loja', lojaFiltro);
      if (buscaLojaInput) params.append('busca_loja', buscaLojaInput);

      const response = await api.get(`/escopos/exportar/?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dataHoje = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `escopos_${dataHoje}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Planilha de escopos mais recentes exportada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar escopos para Excel:', err);
      // Fallback via abertura direta no navegador
      const params = new URLSearchParams();
      if (lojaFiltro) params.append('loja', lojaFiltro);
      if (buscaLojaInput) params.append('busca_loja', buscaLojaInput);
      const fallbackUrl = `http://${window.location.hostname}:${getBackendPort()}/escopos/exportar/?${params.toString()}`;
      window.open(fallbackUrl, '_blank');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Escopos Mensais</h1>
          <p className="text-sm text-neutral-500">Mapeamento operacional de funcionários e rubricas orçadas</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportarExcel}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar escopos filtrados para Excel (.xlsx)"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isExporting ? 'Exportando...' : 'Exportar Excel'}</span>
          </button>
          <button
            onClick={handleDuplicarLote}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            Duplicar Próximo Mês
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Novo Escopo
          </button>
        </div>
      </div>

      {/* Demonstrativo de lojas sem escopo cadastrado */}
      {lojasSemEscopo.length > 0 && (
        <div className="p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-xl space-y-2.5 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Demonstrativo: Lojas Ativas sem nenhum escopo criado</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {lojasSemEscopo.map((loja) => (
              <span 
                key={loja.id} 
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 dark:bg-amber-500/20 text-amber-800 dark:text-amber-350 border border-amber-500/20 dark:border-amber-550/30"
              >
                {loja.nome_referencia}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Painel de Filtros */}
      <EscoposFilter
        lojasOpcoes={lojasOpcoes}
        lojaFiltro={lojaFiltro}
        setLojaFiltro={setLojaFiltro}
        buscaLojaInput={buscaLojaInput}
        setBuscaLojaInput={setBuscaLojaInput}
        anoFiltro={anoFiltro}
        setAnoFiltro={setAnoFiltro}
        mesFiltro={mesFiltro}
        setMesFiltro={setMesFiltro}
        onSubmit={handleFilterSubmit}
        onClear={handleClearFilters}
      />

      {/* Erro de comunicação */}
      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabela de Listagem */}
      <EscoposTable
        escopos={escopos}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        count={count}
        setCurrentPage={setCurrentPage}
        cargosOpcoes={cargosOpcoes}
        onRefresh={() => fetchEscopos()}
        onDeleteEscopo={handleExcluirEscopo}
      />

      {/* Modal para criar novo escopo */}
      {showCreateModal && (
        <EscopoFormModal
          lojasOpcoes={lojasOpcoes}
          cargosOpcoes={cargosOpcoes}
          onClose={() => setShowCreateModal(false)}
          onRefresh={() => fetchEscopos(true)}
        />
      )}
    </div>
  );
}
