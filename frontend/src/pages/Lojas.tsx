import { useEffect, useState, useRef } from 'react';
import { Plus, AlertCircle, Download, Loader2 } from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/searchable-select';
import LojasTable, { type Loja, type Responsavel } from '../components/Lojas/LojasTable';
import CadastroLojaModal from '../components/Lojas/CadastroLojaModal';
import InsalubridadeModal from '../components/Lojas/InsalubridadeModal';
import GerenciarResponsaveisModal from '../components/Lojas/GerenciarResponsaveisModal';

/**
 * Página de Gestão de Lojas.
 * 
 * Por que existe: Permite listar todas as lojas cadastradas no sistema com 
 * paginação e busca dinâmica na API do Django. Oferece filtros inteligentes e reativos,
 * além de orquestrar os componentes de visualização de tabela e os modais de cadastro
 * e parametrização financeira de insalubridade.
 */
export default function Lojas() {
  // Estados para listagem e paginação
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const lastQueryId = useRef(0);
  const isFirstRender = useRef(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [count, setCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Estados dos Filtros
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [coordenadorFiltro, setCoordenadorFiltro] = useState('');
  const [supervisorFiltro, setSupervisorFiltro] = useState('');
  const [codigoLojaFiltro, setCodigoLojaFiltro] = useState('');
  
  // Estados para as opções dinâmicas dos filtros (estilo Excel)
  const [clientesOpcoes, setClientesOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [centrosCustoOpcoes, setCentrosCustoOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [statusOpcoes, setStatusOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [coordenadoresOpcoes, setCoordenadoresOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [supervisoresOpcoes, setSupervisoresOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [codigosOpcoes, setCodigosOpcoes] = useState<{ value: string; label: string }[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Estados dos Modais
  const [showCadastroModal, setShowCadastroModal] = useState(false);
  const [showInsalubridadeModal, setShowInsalubridadeModal] = useState(false);
  const [showResponsaveisModal, setShowResponsaveisModal] = useState(false);
  
  // Estado da loja sendo criada/editada/configurada
  const [selectedLoja, setSelectedLoja] = useState<Loja | null>(null);

  // Listagem de Coordenadores e Supervisores do banco para repassar aos componentes
  const [coordenadores, setCoordenadores] = useState<Responsavel[]>([]);
  const [supervisores, setSupervisores] = useState<Responsavel[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega as lojas apenas ao inicializar ou quando o gatilho de busca explícito (fetchTrigger) for acionado
  useEffect(() => {
    fetchLojas(true);
  }, [fetchTrigger]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchLojas();
  }, [currentPage]);

  // Carrega coordenadores e supervisores para os selects
  useEffect(() => {
    fetchCoordenadores();
    fetchSupervisores();
  }, []);

  // Busca dinamicamente do backend as opções válidas para todos os filtros (Nome, Cliente, Centro de Custo, Status)
  // De acordo com o comportamento do Excel, cada filtro é calculado considerando todos os outros filtros ativos.
  useEffect(() => {
    const fetchFiltroOpcoes = async () => {
      setLoadingOpcoes(true);
      try {
        const response = await api.get('/lojas/filtro-opcoes/', {
          params: {
            busca: busca || undefined,
            cliente: cliente || undefined,
            status: statusFiltro || undefined,
            centro_de_custo: centroCusto || undefined,
            coordenador: coordenadorFiltro || undefined,
            supervisor: supervisorFiltro || undefined,
            codigo_loja: codigoLojaFiltro || undefined,
          }
        });
        
        if (response.data) {
          setClientesOpcoes(response.data.clientes || []);
          setCentrosCustoOpcoes(response.data.centros_custo || []);
          setStatusOpcoes(response.data.status || []);
          setCoordenadoresOpcoes(response.data.coordenadores || []);
          setSupervisoresOpcoes(response.data.supervisores || []);
          setCodigosOpcoes(response.data.codigos || []);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtros para lojas:', err);
      } finally {
        setLoadingOpcoes(false);
      }
    };

    fetchFiltroOpcoes();
  }, [cliente, statusFiltro, centroCusto, coordenadorFiltro, supervisorFiltro, codigoLojaFiltro, fetchTrigger]);

  const fetchCoordenadores = async () => {
    try {
      const response = await api.get('/lojas/api/coordenadores/');
      setCoordenadores(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar coordenadores:', err);
    }
  };

  const fetchSupervisores = async () => {
    try {
      const response = await api.get('/lojas/api/supervisores/');
      setSupervisores(response.data || []);
    } catch (err) {
      console.error('Erro ao buscar supervisores:', err);
    }
  };

  const fetchLojas = async (resetPage = false) => {
    setLoading(true);
    setErrorMsg(null);
    const queryId = ++lastQueryId.current;
    const targetPage = resetPage ? 1 : currentPage;
    if (resetPage) {
      setCurrentPage(1);
    }

    try {
      const response = await api.get('/lojas/', {
        params: {
          page: targetPage,
          busca: busca || undefined,
          cliente: cliente || undefined,
          status: statusFiltro || undefined,
          centro_de_custo: centroCusto || undefined,
          coordenador: coordenadorFiltro || undefined,
          supervisor: supervisorFiltro || undefined,
          codigo_loja: codigoLojaFiltro || undefined,
        }
      });

      if (queryId !== lastQueryId.current) return;

      if (response.data && response.data.results) {
        setLojas(response.data.results);
        setCount(response.data.count);
        setTotalPages(Math.ceil(response.data.count / 25) || 1);
      } else {
        setLojas(response.data || []);
        setCount(response.data ? response.data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      if (queryId !== lastQueryId.current) return;
      console.error('Erro ao buscar lojas:', err);
      setErrorMsg('Não foi possível carregar as lojas do servidor.');
    } finally {
      if (queryId === lastQueryId.current) {
        setLoading(false);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFetchTrigger(prev => prev + 1);
  };

  const handleClearFilters = () => {
    setBusca('');
    setCliente('');
    setStatusFiltro('');
    setCentroCusto('');
    setCoordenadorFiltro('');
    setSupervisorFiltro('');
    setCodigoLojaFiltro('');
    setFetchTrigger(prev => prev + 1);
  };

  // Abre modal para cadastrar nova loja
  const handleOpenCadastroNovo = () => {
    setSelectedLoja(null);
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Abre modal para editar loja existente
  const handleOpenEdicao = (loja: Loja) => {
    setSelectedLoja(loja);
    setErrorMsg(null);
    setShowCadastroModal(true);
  };

  // Cadastra coordenador na hora (repassado via prop ao CadastroLojaModal)
  const handleAddCoordenador = async (nome: string): Promise<string | undefined> => {
    try {
      const response = await api.post('/lojas/api/coordenadores/', { nome });
      const newCoord = response.data;
      setCoordenadores(prev => [...prev, newCoord].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast.success(`Coordenador "${newCoord.nome}" cadastrado com sucesso!`);
      return newCoord.id;
    } catch (err: any) {
      console.error('Erro ao criar coordenador:', err);
      toast.error('Erro ao cadastrar coordenador. Verifique se o nome já existe.');
      return undefined;
    }
  };

  // Cadastra supervisor na hora (repassado via prop ao CadastroLojaModal)
  const handleAddSupervisor = async (nome: string): Promise<string | undefined> => {
    try {
      const response = await api.post('/lojas/api/supervisores/', { nome });
      const newSup = response.data;
      setSupervisores(prev => [...prev, newSup].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast.success(`Supervisor "${newSup.nome}" cadastrado com sucesso!`);
      return newSup.id;
    } catch (err: any) {
      console.error('Erro ao criar supervisor:', err);
      toast.error('Erro ao cadastrar supervisor. Verifique se o nome já existe.');
      return undefined;
    }
  };

  // Callback após cadastro ou edição ser salvo com sucesso
  const handleCadastroSaveSuccess = () => {
    setShowCadastroModal(false);
    fetchLojas();
    setFetchTrigger(prev => prev + 1);
  };

  // Deleta uma loja
  const handleDeleteLoja = async (loja: Loja) => {
    if (!window.confirm(`Tem certeza de que deseja excluir a loja "${loja.nome_referencia}"? Esta ação é irreversível.`)) {
      return;
    }

    try {
      await api.delete(`/lojas/${loja.id}/excluir/`);
      toast.success('Loja excluída com sucesso!');
      fetchLojas();
      setFetchTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Erro ao excluir loja:', err);
      toast.error('Erro ao excluir loja. Verifique as permissões.');
    }
  };

  // Abre modal de configuração de insalubridade
  const handleOpenInsalubridade = (loja: Loja) => {
    setSelectedLoja(loja);
    setErrorMsg(null);
    setShowInsalubridadeModal(true);
  };

  // Exportar listagem de lojas filtradas para Excel (.xlsx)
  const handleExportarExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (busca) params.append('busca', busca);
      if (cliente) params.append('cliente', cliente);
      if (statusFiltro) params.append('status', statusFiltro);
      if (centroCusto) params.append('centro_de_custo', centroCusto);
      if (coordenadorFiltro) params.append('coordenador', coordenadorFiltro);
      if (supervisorFiltro) params.append('supervisor', supervisorFiltro);
      if (codigoLojaFiltro) params.append('codigo_loja', codigoLojaFiltro);

      const response = await api.get(`/lojas/exportar/?${params.toString()}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const dataHoje = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `lojas_${dataHoje}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Planilha de lojas exportada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar lojas para Excel:', err);
      toast.error('Não foi possível exportar a planilha de lojas.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Lojas do Grupo</h1>
          <p className="text-sm text-neutral-500">Visualização de cadastros de filiais e parametrização financeira</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-full text-xs font-bold text-neutral-800 dark:text-white transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar lojas filtradas para planilha Excel (.xlsx)"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin text-neutral-500" /> : <Download className="h-4 w-4 text-neutral-500" />}
            {isExporting ? 'Exportando...' : 'Exportar Planilha'}
          </button>
          <button
            onClick={() => setShowResponsaveisModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-full text-xs font-bold text-neutral-800 dark:text-white transition-all shadow-xs cursor-pointer"
          >
            Gerenciar Responsáveis
          </button>
          <button
            onClick={handleOpenCadastroNovo}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Nova Loja
          </button>
        </div>
      </div>

      {/* Bloco de Filtros */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Busca por Nome
            </label>
            <input
              type="text"
              placeholder="Pesquisar por nome (TOTVS, Gestão, Geo)..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Código da Loja
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Códigos" },
                ...codigosOpcoes
              ]}
              value={codigoLojaFiltro}
              onChange={setCodigoLojaFiltro}
              placeholder="Todos os Códigos"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Cliente / Regional
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Clientes" },
                ...clientesOpcoes
              ]}
              value={cliente}
              onChange={setCliente}
              placeholder="Todos os Clientes"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Centro de Custo
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Centros" },
                ...centrosCustoOpcoes
              ]}
              value={centroCusto}
              onChange={setCentroCusto}
              placeholder="Todos os Centros"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Coordenador
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Coordenadores" },
                ...coordenadoresOpcoes
              ]}
              value={coordenadorFiltro}
              onChange={setCoordenadorFiltro}
              placeholder="Todos os Coordenadores"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Supervisor
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Supervisores" },
                ...supervisoresOpcoes
              ]}
              value={supervisorFiltro}
              onChange={setSupervisorFiltro}
              placeholder="Todos os Supervisores"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Status da Loja
            </label>
            <SearchableSelect
              options={[
                { value: "", label: "Todos os Status" },
                ...statusOpcoes
              ]}
              value={statusFiltro}
              onChange={setStatusFiltro}
              placeholder="Todos os Status"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 flex-wrap">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors cursor-pointer"
          >
            Limpar Filtros
          </button>
          <button
            type="button"
            onClick={handleExportarExcel}
            disabled={isExporting}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Exportar lojas filtradas para planilha Excel (.xlsx)"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? 'Exportando...' : 'Exportar Planilha'}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity cursor-pointer"
          >
            Buscar Filiais
          </button>
        </div>
      </form>

      {/* Erro de comunicação de listagem */}
      {errorMsg && !showCadastroModal && !showInsalubridadeModal && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Listagem em Tabela */}
      <LojasTable
        lojas={lojas}
        loading={loading}
        coordenadores={coordenadores}
        supervisores={supervisores}
        currentPage={currentPage}
        totalPages={totalPages}
        count={count}
        setCurrentPage={setCurrentPage}
        onEdit={handleOpenEdicao}
        onDelete={handleDeleteLoja}
        onInsalubridade={handleOpenInsalubridade}
      />

      {/* Modal de Cadastro/Edição de Loja */}
      {showCadastroModal && (
        <CadastroLojaModal
          loja={selectedLoja}
          coordenadores={coordenadores}
          supervisores={supervisores}
          onClose={() => setShowCadastroModal(false)}
          onSaveSuccess={handleCadastroSaveSuccess}
          onAddCoordenador={handleAddCoordenador}
          onAddSupervisor={handleAddSupervisor}
        />
      )}

      {/* Modal de Configuração de Insalubridade */}
      {showInsalubridadeModal && selectedLoja && (
        <InsalubridadeModal
          loja={selectedLoja}
          onClose={() => setShowInsalubridadeModal(false)}
        />
      )}

      {/* Modal de Gerenciamento de Responsáveis */}
      {showResponsaveisModal && (
        <GerenciarResponsaveisModal
          onClose={() => setShowResponsaveisModal(false)}
          onRefresh={() => {
            fetchCoordenadores();
            fetchSupervisores();
            fetchLojas();
            setFetchTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
