import { Settings2, Edit2, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';

export interface Loja {
  id: string;
  nome_referencia: string;
  cliente: string;
  quadro: string;
  status: string;
  centro_de_custo: string;
  codigo_loja: string | null;
  dispensa_divergencia_ponto: boolean;
  cnpj?: string;
  cep?: string;
  rua?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  sub_regiao?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordenador?: string; // ID do coordenador relacional
  supervisor?: string; // ID do supervisor relacional
  coordenador_nome?: string;
  supervisor_nome?: string;
  nome_totvs?: string;
  nome_geovictoria?: string;
  nome_financeiro?: string;
  nome_findme?: string;
  nome_metricas?: string;
}

export interface Responsavel {
  id: string;
  nome: string;
  re?: string;
  regiao?: string;
  coordenador?: string;
  coordenador_nome?: string;
  orcamento_diarias?: string;
  orcamento_premios?: string;
}

interface LojasTableProps {
  lojas: Loja[];
  loading: boolean;
  coordenadores: Responsavel[];
  supervisores: Responsavel[];
  currentPage: number;
  totalPages: number;
  count: number;
  setCurrentPage: (page: number) => void;
  onEdit: (loja: Loja) => void;
  onDelete: (loja: Loja) => void;
  onInsalubridade: (loja: Loja) => void;
}

/**
 * Tabela de listagem das Lojas do Grupo.
 * 
 * Por que existe: Exibe as lojas cadastradas em uma tabela responsiva com 
 * efeito skeleton de loading. Gerencia a barra de paginação e emite eventos 
 * ao clicar em parametrizar insalubridade, editar dados cadastrais ou excluir a filial.
 */
export default function LojasTable({
  lojas,
  loading,
  coordenadores,
  supervisores,
  currentPage,
  totalPages,
  count,
  setCurrentPage,
  onEdit,
  onDelete,
  onInsalubridade,
}: LojasTableProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
              <th className="py-4 px-6">Cód. Loja</th>
              <th className="py-4 px-6">Nome de Referência</th>
              <th className="py-4 px-6">Cliente/Regional</th>
              <th className="py-4 px-6">Centro de Custo</th>
              <th className="py-4 px-6">Coordenador</th>
              <th className="py-4 px-6">Supervisor</th>
              <th className="py-4 px-6">Status</th>
              <th className="py-4 px-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-12" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-40" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-4 px-6">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="py-4 px-6 text-right">
                    <Skeleton className="h-8 w-24 ml-auto" />
                  </td>
                </tr>
              ))
            ) : lojas.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-neutral-400">
                  Nenhuma loja encontrada com os filtros selecionados.
                </td>
              </tr>
            ) : (
              lojas.map((loja) => (
                <tr
                  key={loja.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors"
                >
                  <td className="py-4 px-6 font-mono text-neutral-600">
                    {loja.codigo_loja || '-'}
                  </td>
                  <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">
                    {loja.nome_referencia}
                  </td>
                  <td className="py-4 px-6">{loja.cliente}</td>
                  <td className="py-4 px-6 font-mono text-neutral-600">
                    {loja.centro_de_custo}
                  </td>
                  <td className="py-4 px-6">
                    {coordenadores.find((c) => c.id === loja.coordenador)
                      ?.nome || '—'}
                  </td>
                  <td className="py-4 px-6">
                    {supervisores.find((s) => s.id === loja.supervisor)
                      ?.nome || '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        loja.status === 'ATIVA'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                      }`}
                    >
                      {loja.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => onInsalubridade(loja)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-md transition-colors text-neutral-700 dark:text-neutral-300"
                      title="Configurar Insalubridade"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Insalubridade
                    </button>
                    <button
                      onClick={() => onEdit(loja)}
                      className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors inline-block text-neutral-750 dark:text-neutral-300"
                      title="Editar Loja"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(loja)}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-md transition-colors inline-block text-red-650"
                      title="Excluir Loja"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="py-4 px-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Mostrando {lojas.length} de {count} filiais cadastradas
          </span>
          <Pagination className="w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(currentPage - 1);
                  }}
                  text="Anterior"
                  className={
                    currentPage === 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-3">
                  Página {currentPage} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages)
                      setCurrentPage(currentPage + 1);
                  }}
                  text="Próxima"
                  className={
                    currentPage === totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
