import { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  RotateCw, 
  Edit3, 
  Trash2, 
  Power, 
  PowerOff,
  CheckCircle2, 
  CalendarClock, 
  Archive, 
  AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { toast } from 'sonner';
import CadastroAvisoModal, { type Aviso } from '../components/Avisos/CadastroAvisoModal';
import ReenviarAvisoModal from '../components/Avisos/ReenviarAvisoModal';

export default function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  
  // Modais
  const [modalCadastroOpen, setModalCadastroOpen] = useState(false);
  const [modalReenviarOpen, setModalReenviarOpen] = useState(false);
  const [avisoSelecionado, setAvisoSelecionado] = useState<Aviso | null>(null);

  const carregarAvisos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/usuarios/api/avisos/', {
        params: {
          status: filterStatus !== 'todos' ? filterStatus : undefined,
          q: searchTerm.trim() || undefined
        }
      });
      setAvisos(res.data || []);
    } catch (error) {
      console.error('Erro ao buscar avisos:', error);
      toast.error('Não foi possível carregar a lista de avisos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAvisos();
  }, [filterStatus]);

  // Busca textual sob demanda ou no submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    carregarAvisos();
  };

  const handleOpenCriar = () => {
    setAvisoSelecionado(null);
    setModalCadastroOpen(true);
  };

  const handleOpenEditar = (aviso: Aviso) => {
    setAvisoSelecionado(aviso);
    setModalCadastroOpen(true);
  };

  const handleOpenReenviar = (aviso: Aviso) => {
    setAvisoSelecionado(aviso);
    setModalReenviarOpen(true);
  };

  const handleToggleAtivo = async (aviso: Aviso) => {
    try {
      await api.put(`/usuarios/api/avisos/${aviso.id}/`, {
        ativo: !aviso.ativo
      });
      toast.success(aviso.ativo ? 'Aviso desativado com sucesso.' : 'Aviso ativado com sucesso.');
      carregarAvisos();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao atualizar status do aviso.');
    }
  };

  const handleExcluir = async (aviso: Aviso) => {
    if (!window.confirm(`Tem certeza que deseja excluir o aviso "${aviso.titulo}"?`)) {
      return;
    }
    try {
      await api.delete(`/usuarios/api/avisos/${aviso.id}/`);
      toast.success('Aviso removido do sistema.');
      carregarAvisos();
    } catch (error) {
      console.error('Erro ao excluir aviso:', error);
      toast.error('Não foi possível excluir o aviso.');
    }
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Contadores
  const contadores = useMemo(() => {
    return {
      total: avisos.length,
      ativos: avisos.filter(a => a.status === 'ativo').length,
      agendados: avisos.filter(a => a.status === 'agendado').length,
      expirados: avisos.filter(a => a.status === 'expirado').length,
    };
  }, [avisos]);

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Avisos e Comunicados
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Cadastre e agende avisos corporativos para exibição aos usuários no primeiro acesso do dia.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCriar}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Aviso
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Abas de Status */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterStatus === 'todos'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus('ativo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterStatus === 'ativo'
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ativos (Hoje)
          </button>
          <button
            onClick={() => setFilterStatus('agendado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterStatus === 'agendado'
                ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            Agendados
          </button>
          <button
            onClick={() => setFilterStatus('expirado')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterStatus === 'expirado'
                ? 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            Histórico (Expirados)
          </button>
          <button
            onClick={() => setFilterStatus('inativo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              filterStatus === 'inativo'
                ? 'bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Desativados
          </button>
        </div>

        {/* Busca por Texto */}
        <form onSubmit={handleSearch} className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar por título ou conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </form>
      </div>

      {/* Lista de Avisos */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-400">
          <Clock className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm">Carregando avisos cadastrados...</p>
        </div>
      ) : avisos.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Nenhum aviso encontrado
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || filterStatus !== 'todos'
              ? 'Tente ajustar os filtros ou a busca textual.'
              : 'Clique no botão acima para cadastrar o primeiro comunicado do sistema.'}
          </p>
          <button
            onClick={handleOpenCriar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Aviso Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {avisos.map((aviso) => {
            const isAtivo = aviso.status === 'ativo';
            const isAgendado = aviso.status === 'agendado';
            const isExpirado = aviso.status === 'expirado';

            return (
              <div
                key={aviso.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all bg-white dark:bg-neutral-900 ${
                  isAtivo
                    ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                    : isAgendado
                    ? 'border-sky-500/30'
                    : isExpirado
                    ? 'border-neutral-200 dark:border-neutral-800 opacity-90'
                    : 'border-neutral-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                <div>
                  {/* Cabeçalho do Card: Status Badge e Toggle */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                        isAtivo
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          : isAgendado
                          ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50'
                          : isExpirado
                          ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                      }`}
                    >
                      {isAtivo && <CheckCircle2 className="w-3 h-3" />}
                      {isAgendado && <CalendarClock className="w-3 h-3" />}
                      {isExpirado && <Archive className="w-3 h-3" />}
                      {!aviso.ativo ? 'Inativo' : isAtivo ? 'Vigente Hoje' : isAgendado ? 'Agendado' : 'Expirado'}
                    </span>

                    <button
                      onClick={() => handleToggleAtivo(aviso)}
                      title={aviso.ativo ? 'Desativar aviso' : 'Ativar aviso'}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        aviso.ativo
                          ? 'text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/50 dark:hover:bg-emerald-950/50'
                          : 'text-neutral-400 hover:bg-neutral-100 border-neutral-200 dark:border-neutral-800 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {aviso.ativo ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Título */}
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 mb-2">
                    {aviso.titulo}
                  </h3>

                  {/* Conteúdo */}
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-line line-clamp-4 leading-relaxed mb-4">
                    {aviso.conteudo}
                  </p>
                </div>

                {/* Rodapé do Card: Datas e Ações */}
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3">
                  <div className="flex flex-col gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span>
                        Período: <strong className="text-neutral-700 dark:text-neutral-300">{formatarData(aviso.data_inicio)}</strong> até <strong className="text-neutral-700 dark:text-neutral-300">{formatarData(aviso.data_fim)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Criado por: <strong className="text-neutral-700 dark:text-neutral-300">{aviso.criado_por_nome || 'Sistema'}</strong></span>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    {/* Botão de Reenviar / Reagendar para outra data */}
                    <button
                      onClick={() => handleOpenReenviar(aviso)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer"
                      title="Reenviar este aviso para uma nova data"
                    >
                      <RotateCw className="w-3 h-3" />
                      Reenviar
                    </button>

                    {/* Editar */}
                    <button
                      onClick={() => handleOpenEditar(aviso)}
                      className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors cursor-pointer"
                      title="Editar aviso"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Excluir */}
                    <button
                      onClick={() => handleExcluir(aviso)}
                      className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer"
                      title="Excluir aviso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      <CadastroAvisoModal
        isOpen={modalCadastroOpen}
        onClose={() => setModalCadastroOpen(false)}
        onSuccess={() => carregarAvisos()}
        avisoParaEditar={avisoSelecionado}
      />

      {/* Modal de Reenvio / Reagendamento */}
      <ReenviarAvisoModal
        isOpen={modalReenviarOpen}
        onClose={() => setModalReenviarOpen(false)}
        onSuccess={() => carregarAvisos()}
        aviso={avisoSelecionado}
      />
    </div>
  );
}
