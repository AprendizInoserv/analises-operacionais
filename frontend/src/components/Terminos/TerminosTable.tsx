import { Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '../ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { formatDate } from '../../utils/formatters';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getStatusBadge } from '../../utils/badges';

export interface ColaboradorTermino {
  id: string;
  re: string;
  nome: string;
  data_admissao: string;
  termino_1: string;
  termino_2: string;
  status: string | null;
  centro_custo: string;
  geovictoria_atualizado_em?: string | null;
  loja_nome: string | null;
  loja_coordenador: string | null;
}

export interface TerminoState {
  tipoTermino: string;
  etapaAtual: number;
  statusControle: string;
  diasRestantes: number;
}

export interface TerminoHistory {
  id: string;
  etapa: number;
  acao: string;
  acao_display?: string;
  observacao: string;
  created_at: string;
  respondido_por: string;
}

export interface TerminoItem {
  colaborador: ColaboradorTermino;
  state: TerminoState;
  relevant_date: string;
  history: TerminoHistory[];
  faltas: number | string;
  atestados: number | string;
}

interface TerminosTableProps {
  terminos: TerminoItem[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  count: number;
  setCurrentPage: (page: number) => void;
  onOpenAcao: (item: TerminoItem) => void;
  ordenacao: string;
  setOrdenacao: (val: string) => void;
}

/**
 * Renderiza o status de controle de término como uma bolinha colorida com tooltip nativo.
 * 
 * Por que existe: Economiza espaço na coluna de Ação substituindo badges de texto
 * longos por bolinhas coloridas discretas com tooltip informativo.
 */
/**
 * Ícone do WhatsApp no estilo Lucide (desenho de contorno).
 * 
 * Por que existe: Exibe a identidade do WhatsApp de forma limpa e harmônica 
 * com o restante dos ícones da tabela.
 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

/**
 * Ícone do Trello no estilo Lucide (desenho de contorno).
 * 
 * Por que existe: Representa visualmente o Trello para identificar que a ação
 * irá copiar os dados formatados para colar na ferramenta Trello.
 */
function TrelloIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="M7 7h3v10H7z" />
      <path d="M14 7h3v6h-3z" />
    </svg>
  );
}

/**
 * Renderiza os status das decisões de término como duas bolinhas coloridas (uma para cada etapa) com tooltips em português.
 * 
 * Por que existe: Permite ao usuário identificar rapidamente em qual etapa o colaborador está,
 * se já foi tomada alguma decisão na 1ª etapa e qual é a situação de ambas.
 */
function renderDecisionDots(item: TerminoItem) {
  const decision1 = item.history.find((h) => h.etapa === 1);
  const decision2 = item.history.find((h) => h.etapa === 2);

  // 1ª Decisão (30 dias)
  let colorClass1 = 'bg-amber-500';
  let title1 = '1ª Decisão: Pendente (Etapa 1)';
  if (decision1) {
    if (decision1.acao === 'manter') {
      colorClass1 = 'bg-green-500';
      title1 = '1ª Decisão: Efetivado / Mantido';
    } else if (decision1.acao === 'termino') {
      colorClass1 = 'bg-red-500';
      title1 = '1ª Decisão: Dispensado / Término';
    } else if (decision1.acao === 'prorrogado') {
      colorClass1 = 'bg-blue-500';
      title1 = '1ª Decisão: Prorrogado';
    }
  }

  // 2ª Decisão (60 dias)
  let colorClass2 = 'bg-neutral-300 dark:bg-neutral-700';
  let title2 = '2ª Decisão: Não aplicável';
  if (decision2) {
    if (decision2.acao === 'manter') {
      colorClass2 = 'bg-green-500';
      title2 = '2ª Decisão: Efetivado / Mantido';
    } else if (decision2.acao === 'termino') {
      colorClass2 = 'bg-red-500';
      title2 = '2ª Decisão: Dispensado / Término';
    }
  } else if (decision1 && decision1.acao === 'prorrogado') {
    colorClass2 = 'bg-amber-500';
    title2 = '2ª Decisão: Pendente (Etapa 2)';
  } else if (!decision1 && item.state.etapaAtual === 2) {
    // Caso o primeiro prazo tenha expirado sem decisão registrada
    colorClass2 = 'bg-amber-500';
    title2 = '2ª Decisão: Pendente (Etapa 2)';
  }

  return (
    <div className="flex items-center gap-1.5 mr-1.5">
      <span
        className={`inline-block w-3.5 h-3.5 rounded-full ${colorClass1} cursor-help shadow-xs`}
        title={title1}
      />
      <span
        className={`inline-block w-3.5 h-3.5 rounded-full ${colorClass2} cursor-help shadow-xs`}
        title={title2}
      />
    </div>
  );
}

/**
 * Tabela de listagem dos Términos de Experiência.
 * 
 * Por que existe: Centraliza a renderização da lista de auxiliares que estão 
 * em período de experiência. Mostra a contagem de faltas/atestados, datas limite do 
 * primeiro e segundo períodos (com destaque visual se estiver pendente ou finalizado),
 * e a paginação da listagem.
 */
export default function TerminosTable({
  terminos,
  loading,
  currentPage,
  totalPages,
  count,
  setCurrentPage,
  onOpenAcao,
  ordenacao,
  setOrdenacao,
}: TerminosTableProps) {

  /**
   * Copia as informações do colaborador formatadas para envio via WhatsApp.
   * 
   * Por que existe: Facilita o envio rápido de dados formatados no padrão do WhatsApp.
   */
  const handleCopyWhatsApp = async (item: TerminoItem) => {
    const formattedDate = formatDate(item.relevant_date);
    const text = `*Colaborador:* ${item.colaborador.nome}\n*RE:* ${item.colaborador.re}\n*Data de Término Vigente:* ${formattedDate}`;
    const success = await copyTextToClipboard(text);
    if (success) {
      toast.success(`Informações de ${item.colaborador.nome} copiadas para WhatsApp!`);
    } else {
      toast.error('Erro ao copiar informações.');
    }
  };

  /**
   * Copia as informações do colaborador formatadas para inclusão no Trello.
   * 
   * Por que existe: Facilita a colagem rápida no Trello seguindo o padrão "[RE] [NOME] [DATA_LIMITE]".
   */
  const handleCopyTrello = async (item: TerminoItem) => {
    const formattedDate = formatDate(item.relevant_date);
    const cleanName = (item.colaborador.nome || '').trim().toUpperCase();
    const text = `${item.colaborador.re} ${cleanName} ${formattedDate}`;
    const success = await copyTextToClipboard(text);
    if (success) {
      toast.success(`Informações de ${item.colaborador.nome} copiadas no formato Trello!`);
    } else {
      toast.error('Erro ao copiar informações.');
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
              <th className="py-3 px-4 align-middle w-[20%]">RE / Colaborador</th>
              <th className="py-3 px-4 align-middle w-[15%]">Loja (TOTVS)</th>
              <th className="py-3 px-4 align-middle w-[13%]">Coordenador</th>
              <th className="py-3 px-4 align-middle w-[8%]">Situação Folha</th>
              <th
                onClick={() => setOrdenacao(ordenacao === 'ausencias' ? 'data' : 'ausencias')}
                className="py-3 px-4 text-center align-middle w-[9%] cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors select-none group/col"
                title="Clique para ordenar por total de ausências (faltas + atestados)"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Faltas / Atestados</span>
                  {ordenacao === 'ausencias' ? (
                    <span className="text-[10px] text-neutral-900 dark:text-neutral-100 font-bold">▼</span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 opacity-0 group-hover/col:opacity-100 transition-opacity">↕</span>
                  )}
                </div>
              </th>
              <th className="py-3 px-4 align-middle w-[9%]">1º Per. (30d)</th>
              <th className="py-3 px-4 align-middle w-[17%]">2º Per. (60d)</th>
              <th className="py-3 px-4 text-right sticky right-0 bg-neutral-100 dark:bg-neutral-800 z-20 border-b border-neutral-200 dark:border-neutral-800 align-middle w-[9%]">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-28 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Skeleton className="h-8 w-12 inline-block" />
                  </td>
                  <td className="py-3 px-4">
                    <Skeleton className="h-5 w-16" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16" />
                      <div className="flex gap-1">
                        <Skeleton className="w-2 h-2 rounded-full" />
                        <Skeleton className="w-2 h-2 rounded-full" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right sticky right-0 bg-white dark:bg-neutral-900 z-10">
                    <Skeleton className="h-8 w-12 ml-auto" />
                  </td>
                </tr>
              ))
            ) : terminos.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-neutral-400">
                  Não há vencimentos de experiência encontrados com os filtros aplicados.
                </td>
              </tr>
            ) : (
              terminos.map((item) => (
                <tr
                  key={item.colaborador.id}
                  className="group hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors"
                >
                  <td className="py-3 px-4 min-w-0">
                    <div className="flex items-center justify-between gap-2 w-full min-w-0">
                      <span 
                        className="font-semibold text-neutral-900 dark:text-neutral-100 truncate block"
                        title={item.colaborador.nome}
                      >
                        {item.colaborador.nome}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyWhatsApp(item)}
                          title="Copiar para WhatsApp"
                          className="text-neutral-400 hover:text-emerald-600 dark:text-neutral-500 dark:hover:text-emerald-400 transition-colors p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                          aria-label={`Copiar dados de ${item.colaborador.nome} para WhatsApp`}
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopyTrello(item)}
                          title="Copiar para o Trello"
                          className="text-neutral-400 hover:text-blue-500 dark:text-neutral-500 dark:hover:text-blue-400 transition-colors p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                          aria-label={`Copiar dados de ${item.colaborador.nome} para o Trello`}
                        >
                          <TrelloIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400 font-mono mt-0.5">
                      RE: {item.colaborador.re}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {item.colaborador.loja_nome || 'Centro Custo sem Loja'}
                    </div>
                    {!item.colaborador.loja_nome && (
                      <div className="text-[10px] text-neutral-400">
                        CC: {item.colaborador.centro_custo}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                    {item.colaborador.loja_coordenador || '-'}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(item.colaborador.status || '')}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs mr-2 ${
                        Number(item.faltas) > 0
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {item.faltas}
                    </span>
                    <span
                      className={`inline-flex items-center justify-center font-mono font-bold w-8 h-8 rounded-lg text-xs ${
                        Number(item.atestados) > 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}
                    >
                      {item.atestados}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 1
                          ? item.state.statusControle.toUpperCase().includes('ATRASADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : item.state.statusControle.toUpperCase().includes('PENDENTE')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.toUpperCase().includes('TÉRMINO') ||
                              item.state.statusControle.toUpperCase().includes('DISPENSADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      {formatDate(item.colaborador.termino_1)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div
                      className={`p-2 rounded text-xs font-mono inline-block ${
                        item.state.etapaAtual === 2
                          ? item.state.statusControle.toUpperCase().includes('ATRASADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : item.state.statusControle.toUpperCase().includes('PENDENTE') ||
                              item.state.statusControle.toUpperCase().includes('PRORROGADO')
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                            : item.state.statusControle.toUpperCase().includes('TÉRMINO') ||
                              item.state.statusControle.toUpperCase().includes('DISPENSADO')
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400'
                          : 'text-neutral-500 bg-neutral-100 dark:bg-neutral-800'
                      }`}
                    >
                      {formatDate(item.colaborador.termino_2)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right sticky right-0 bg-white dark:bg-neutral-900 group-hover:bg-neutral-50 dark:group-hover:bg-neutral-850 z-10 transition-colors">
                    <div className="flex items-center justify-end gap-2">
                      {renderDecisionDots(item)}
                      <button
                        onClick={() => onOpenAcao(item)}
                        title={
                          item.state.statusControle &&
                          !item.state.statusControle
                            .toUpperCase()
                            .includes('PENDENTE')
                            ? 'Alterar Decisão'
                            : 'Registrar Decisão'
                        }
                        className={`inline-flex items-center justify-center p-1.5 border rounded-md transition-all ${
                          item.state.statusControle &&
                          !item.state.statusControle
                            .toUpperCase()
                            .includes('PENDENTE')
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border-amber-500/20 dark:text-amber-400'
                            : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                        }`}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
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
            Mostrando {terminos.length} de {count} termos contratuais
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
