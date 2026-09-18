import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';

interface LojaRef {
  id: string;
  nome_totvs: string;
}

interface ColaboradoresFilterProps {
  activeTab: 'ativos' | 'demitidos';

  // Valores de filtros
  reBusca: string;
  setReBusca: (val: string) => void;
  cpfBusca: string;
  setCpfBusca: (val: string) => void;
  nomeBusca: string;
  setNomeBusca: (val: string) => void;
  cargoFiltro: string;
  setCargoFiltro: (val: string) => void;
  lojaFiltro: string;
  setLojaFiltro: (val: string) => void;
  statusFiltro: string;
  setStatusFiltro: (val: string) => void;

  // Chip de Divergência de Ponto
  divergenteQuery: string;
  setDivergenteQuery: (val: string) => void;

  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  fetchTrigger?: number;
}

/**
 * Componente do painel de filtros e chips de auditoria de colaboradores.
 * 
 * Por que existe: Gerencia os filtros de busca reativos estilo Excel, incluindo
 * buscas cruzadas automáticas da API e o botão rápido de auditoria para identificar
 * divergências de ponto eletrônico (GeoVictoria vs TOTVS).
 */
export default function ColaboradoresFilter({
  activeTab,
  reBusca,
  setReBusca,
  cpfBusca,
  setCpfBusca,
  nomeBusca,
  setNomeBusca,
  cargoFiltro,
  setCargoFiltro,
  lojaFiltro,
  setLojaFiltro,
  statusFiltro,
  setStatusFiltro,
  divergenteQuery,
  setDivergenteQuery,
  onSubmit,
  onClear,
  fetchTrigger,
}: ColaboradoresFilterProps) {
  // Cache de opções dinâmicas obtidas da API
  const [lojasOpcoes, setLojasOpcoes] = useState<LojaRef[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);

  // Efeito reativo para recalcular e atualizar as opções válidas dos filtros (excel-like)
  useEffect(() => {
    const fetchFiltroOpcoes = async () => {
      setLoadingOpcoes(true);
      try {
        const response = await api.get('/colaboradores/filtro-opcoes/', {
          params: {
            is_demitido: activeTab === 'demitidos' ? 'true' : undefined,
            loja: lojaFiltro || undefined,
            status: activeTab === 'ativos' ? statusFiltro || undefined : undefined,
            cargo: cargoFiltro || undefined,
            divergente: activeTab === 'ativos' ? divergenteQuery || undefined : undefined,
          },
        });

        if (response.data) {
          setLojasOpcoes(response.data.lojas || []);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtros:', err);
      } finally {
        setLoadingOpcoes(false);
      }
    };

    fetchFiltroOpcoes();
  }, [
    activeTab,
    lojaFiltro,
    statusFiltro,
    cargoFiltro,
    divergenteQuery,
    fetchTrigger,
  ]);

  const toggleDivergente = () => {
    setDivergenteQuery(divergenteQuery === 'S' ? '' : 'S');
  };

  const clearQuickFilters = () => {
    setDivergenteQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Chips de Filtros Rápidos (Auditoria) */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider mr-1">
          Auditoria Rápida:
        </span>
        <button
          type="button"
          onClick={clearQuickFilters}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
            !divergenteQuery
              ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white'
              : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Todos
        </button>

        {activeTab === 'ativos' && (
          <button
            type="button"
            onClick={toggleDivergente}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
              divergenteQuery === 'S'
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Divergência de Ponto (GeoVictoria)
          </button>
        )}
      </div>

      {/* Formulário Completo de Filtros */}
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Loja TOTVS
            </label>
            <SearchableSelect
              options={[
                { value: '', label: 'Todas as Lojas' },
                ...lojasOpcoes.map((l) => ({
                  value: String(l.id),
                  label: l.nome_totvs,
                })),
              ]}
              value={lojaFiltro}
              onChange={setLojaFiltro}
              placeholder="Todas as Lojas"
              multiple={true}
              loading={loadingOpcoes}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Matrícula (RE)
            </label>
            <input
              type="text"
              placeholder="Ex: 10023, 10024..."
              value={reBusca}
              onChange={(e) => setReBusca(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              CPF
            </label>
            <input
              type="text"
              placeholder="Ex: 12345678900"
              value={cpfBusca}
              onChange={(e) => setCpfBusca(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Nome do Colaborador
            </label>
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={nomeBusca}
              onChange={(e) => setNomeBusca(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Cargo / Função
            </label>
            <input
              type="text"
              placeholder="Ex: Auxiliar..."
              value={cargoFiltro}
              onChange={(e) => setCargoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
            />
          </div>

          {activeTab === 'ativos' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Situação Folha (TOTVS)
              </label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'ativo', label: 'Ativo (Normal)' },
                  { value: 'A', label: 'Afastado' },
                  { value: 'F', label: 'Férias' },
                ]}
                value={statusFiltro}
                onChange={setStatusFiltro}
                placeholder="Todos"
                multiple={true}
                loading={loadingOpcoes}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClear}
            className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
          >
            Limpar
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
          >
            Pesquisar
          </button>
        </div>
      </form>
    </div>
  );
}
