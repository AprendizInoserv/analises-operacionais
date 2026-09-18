import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../../api/client';
import SearchableSelect from '../ui/searchable-select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';

interface TerminosFilterProps {
  reFiltro: string;
  setReFiltro: (val: string) => void;
  nomeFiltro: string;
  setNomeFiltro: (val: string) => void;
  coordenador: string;
  setCoordenador: (val: string) => void;
  statusFiltro: string;
  setStatusFiltro: (val: string) => void;
  dataFiltro: string;
  setDataFiltro: (val: string) => void;
  dataFim: string;
  setDataFim: (val: string) => void;
  etapaFiltro: string;
  setEtapaFiltro: (val: string) => void;
  acaoFiltro: string;
  setAcaoFiltro: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClear: () => void;
  fetchTrigger?: number;
}

/**
 * Painel de Filtros de busca inteligentes (Excel-like) para os vencimentos de termos.
 * 
 * Por que existe: Isola toda a complexidade visual e de carregamento reativo das
 * opções válidas de RE, Nome, Coordenadores, Situação Folha e Prazos. Evita o inchaço e a poluição 
 * do arquivo principal de termos.
 */
export default function TerminosFilter({
  reFiltro,
  setReFiltro,
  nomeFiltro,
  setNomeFiltro,
  coordenador,
  setCoordenador,
  statusFiltro,
  setStatusFiltro,
  dataFiltro,
  setDataFiltro,
  dataFim,
  setDataFim,
  etapaFiltro,
  setEtapaFiltro,
  acaoFiltro,
  setAcaoFiltro,
  onSubmit,
  onClear,
  fetchTrigger,
}: TerminosFilterProps) {
  // Opções dinâmicas carregadas da API
  const [coordenadoresOpcoes, setCoordenadoresOpcoes] = useState<string[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);

  // Efeito para carregar as opções disponíveis de acordo com os filtros selecionados (filtro cruzado reativo)
  // Nota: removemos reFiltro e nomeFiltro das dependências para evitar chamadas de API a cada letra digitada.
  useEffect(() => {
    const fetchFiltroOpcoes = async () => {
      setLoadingOpcoes(true);
      try {
        const response = await api.get('/colaboradores/filtro-opcoes/', {
          params: {
            is_termino: 'true',
            coordenador: coordenador || undefined,
            data_filtro: dataFiltro || undefined,
            data_fim: dataFim || undefined,
          },
        });

        if (response.data) {
          setCoordenadoresOpcoes(response.data.coordenadores || []);
        }
      } catch (err) {
        console.error('Erro ao buscar opções de filtros para termos:', err);
      } finally {
        setLoadingOpcoes(false);
      }
    };

    fetchFiltroOpcoes();
  }, [coordenador, dataFiltro, dataFim, fetchTrigger]);

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-5 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Matrícula */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Matrícula (RE)
          </label>
          <input
            type="text"
            placeholder="Ex: 10023, 10024..."
            value={reFiltro}
            onChange={(e) => setReFiltro(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          />
        </div>

        {/* Nome do Colaborador */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Nome do Colaborador
          </label>
          <input
            type="text"
            placeholder="Pesquisar por nome..."
            value={nomeFiltro}
            onChange={(e) => setNomeFiltro(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white"
          />
        </div>

        {/* Coordenador */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Coordenador da Loja
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todos os Coordenadores' },
              ...coordenadoresOpcoes.map((c) => ({ value: c, label: c })),
            ]}
            value={coordenador}
            onChange={setCoordenador}
            placeholder="Todos os Coordenadores"
            multiple={true}
            loading={loadingOpcoes}
          />
        </div>

        {/* Situação Folha (TOTVS) */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Situação Folha (TOTVS)
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todas as Situações' },
              { value: 'ativo', label: 'Ativo (Normal)' },
              { value: 'A', label: 'Afastado (A)' },
              { value: 'F', label: 'Férias (F)' },
            ]}
            value={statusFiltro}
            onChange={setStatusFiltro}
            placeholder="Todas as Situações"
            multiple={true}
          />
        </div>

        {/* Término a Partir de */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Término a Partir de
          </label>
          <Popover>
            <PopoverTrigger className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-455" />
              {dataFiltro ? (
                format(parseISO(dataFiltro), 'dd/MM/yyyy')
              ) : (
                <span>Selecione a data</span>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              align="start"
            >
              <Calendar
                mode="single"
                selected={dataFiltro ? parseISO(dataFiltro) : undefined}
                onSelect={(date) => {
                  setDataFiltro(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Término Até */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Término Até
          </label>
          <Popover>
            <PopoverTrigger className="w-full justify-start text-left font-normal h-8 text-neutral-750 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 text-sm inline-flex items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
              <CalendarDays className="mr-2 h-4 w-4 text-neutral-455" />
              {dataFim ? (
                format(parseISO(dataFim), 'dd/MM/yyyy')
              ) : (
                <span>Selecione a data</span>
              )}
            </PopoverTrigger>
            <PopoverContent
              className="w-72 p-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
              align="start"
            >
              <Calendar
                mode="single"
                selected={dataFim ? parseISO(dataFim) : undefined}
                onSelect={(date) => {
                  setDataFim(date ? format(date, 'yyyy-MM-dd') : '');
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Fase do Término */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Fase do Término
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todos os Términos' },
              { value: '1', label: '1º Término (30 dias)' },
              { value: '2', label: '2º Término (60 dias)' },
            ]}
            value={etapaFiltro}
            onChange={setEtapaFiltro}
            placeholder="Todos os Términos"
          />
        </div>

        {/* Decisão / Ação Tomada */}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Decisão / Ação Tomada
          </label>
          <SearchableSelect
            options={[
              { value: '', label: 'Todas as Ações' },
              { value: 'pendente', label: 'Pendente (Sem Decisão)' },
              { value: 'manter', label: 'Efetivado (Manter)' },
              { value: 'termino', label: 'Dispensado (Término)' },
              { value: 'prorrogado', label: 'Prorrogado' },
            ]}
            value={acaoFiltro}
            onChange={setAcaoFiltro}
            placeholder="Todas as Ações"
          />
        </div>


      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClear}
          className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 text-sm font-semibold transition-colors"
        >
          Limpar Filtros
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs transition-opacity"
        >
          Buscar Prazos
        </button>
      </div>
    </form>
  );
}
