import { useEffect, useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  CalendarDays,
  Loader2
} from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';
import { Skeleton } from '../ui/skeleton';
import SearchableSelect from '../ui/searchable-select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import { formatCurrency } from '../../utils/formatters';

export interface Cargo {
  id: string;
  nome: string;
}

export interface DetalhamentoCusto {
  base_total: string;
  insal_fixa?: string;
  insalubridade_fixa_total?: string;
  insal_ban?: string;
  insalubridade_banheirista_total?: string;
  adic_not?: string;
  adicional_noturno_total?: string;
  dsr?: string;
  dsr_total?: string;
  total: string;
}

export interface ItemEscopo {
  id: string;
  escopo_mensal: string;
  cargo: string;
  cargo_nome: string;
  turno: string;
  turno_display: string;
  quantidade: number;
  dsr_valor_fixo?: string;
  detalhamento: DetalhamentoCusto | null;
}

export interface EscopoMensal {
  id: string;
  loja: string;
  loja_nome: string;
  ano: number;
  mes: number;
  itens_com_estimativa: ItemEscopo[];
  total_estimativa_escopo: string;
}

interface EscoposTableProps {
  escopos: EscopoMensal[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  count: number;
  setCurrentPage: (page: number) => void;
  cargosOpcoes: Cargo[];
  onRefresh: () => void;
  onDeleteEscopo: (escopoId: string, label: string) => void;
}

const obterInsalubridadeFixa = (det: any) => det.insal_fixa || det.insalubridade_fixa_total || "0.00";
const obterInsalubridadeBanheirista = (det: any) => det.insal_ban || det.insalubridade_banheirista_total || "0.00";
const obterAdicionalNoturno = (det: any) => det.adic_not || det.adicional_noturno_total || "0.00";
const obterDsr = (det: any) => det.dsr || det.dsr_total || "0.00";

/**
 * Tabela de Escopos Mensais com Edição Inline.
 * 
 * Por que existe: Exibe a lista de escopos planejados de cada posto de trabalho e
 * permite adicionar, editar e remover itens operacionais diretamente na tabela.
 * Cuida também dos skeletons de carregamento e paginação.
 */
export default function EscoposTable({
  escopos,
  loading,
  currentPage,
  totalPages,
  count,
  setCurrentPage,
  cargosOpcoes,
  onRefresh,
  onDeleteEscopo,
}: EscoposTableProps) {
  // Cópia local dos escopos para suportar a adição de placeholders sem alterar o estado do pai
  const [localEscopos, setLocalEscopos] = useState<EscopoMensal[]>(escopos);
  
  // Estado de controle de qual item está sendo editado inline ('escopoId_itemId')
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editCargo, setEditCargo] = useState('');
  const [editTurno, setEditTurno] = useState('DIURNO');
  const [editQuantidade, setEditQuantidade] = useState(1);
  const [editDsr, setEditDsr] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  const turnosOpcoes = [
    { id: 'DIURNO', nome: 'Diurno' },
    { id: 'NOTURNO', nome: 'Noturno' },
    { id: 'MISTO', nome: 'Misto' }
  ];

  // Sincroniza a cópia local sempre que a lista do pai for atualizada
  useEffect(() => {
    setLocalEscopos(escopos);
    setEditingItemId(null);
  }, [escopos]);

  // Ativa a linha em edição inline
  const handleStartEdit = (escopoId: string, item: ItemEscopo) => {
    setEditingItemId(`${escopoId}_${item.id}`);
    setEditCargo(item.cargo);
    setEditTurno(item.turno);
    setEditQuantidade(item.quantidade);
    setEditDsr(item.dsr_valor_fixo || (item.detalhamento ? obterDsr(item.detalhamento) : '0.00'));
  };

  // Cancela a edição inline (removendo placeholders se existirem)
  const handleCancelEdit = (escopoId: string, item: ItemEscopo) => {
    setEditingItemId(null);
    if (!item.id) {
      setLocalEscopos(prev => prev.map(esc => {
        if (esc.id === escopoId) {
          return {
            ...esc,
            itens_com_estimativa: esc.itens_com_estimativa.filter(i => i.id !== '')
          };
        }
        return esc;
      }));
    }
  };

  // Salva o item editado/criado via API
  const handleSaveItem = async (escopoId: string, itemId: string) => {
    if (!editCargo) {
      toast.error('Selecione um cargo válido.');
      return;
    }
    if (editQuantidade < 1) {
      toast.error('A quantidade deve ser maior ou igual a 1.');
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        id: itemId || undefined,
        escopo_id: escopoId,
        cargo_id: editCargo,
        turno: editTurno,
        quantidade: editQuantidade,
        dsr_valor_fixo: editDsr ? editDsr.replace(',', '.') : '0.00',
      };

      const response = await api.post('/escopos/api/item/save/', payload);
      if (response.data.success) {
        setEditingItemId(null);
        toast.success('Item salvo com sucesso!');
        onRefresh();
      } else {
        toast.error(response.data.error || 'Erro ao salvar o item.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar item:', err);
      toast.error(err.response?.data?.error || 'Erro de comunicação para salvar o item do escopo.');
    } finally {
      setSavingItem(false);
    }
  };

  // Remove o item operacional do escopo
  const handleExcluirItem = async (itemId: string) => {
    if (!confirm('Remover este item e seus cálculos do escopo mensal?')) {
      return;
    }

    try {
      const response = await api.post(`/escopos/api/item/${itemId}/delete/`);
      if (response.data.success) {
        toast.success('Item removido com sucesso!');
        onRefresh();
      }
    } catch (err: any) {
      console.error('Erro ao excluir item:', err);
      toast.error(err.response?.data?.error || 'Erro ao excluir o item do escopo.');
    }
  };

  // Insere um placeholder na lista local para permitir cadastrar um novo item direto na tabela
  const handleAddNewItemPlaceholder = (escopoId: string) => {
    if (editingItemId) {
      toast.error('Salve ou cancele a alteração pendente antes de adicionar um novo item.');
      return;
    }

    setLocalEscopos(prev => prev.map(esc => {
      if (esc.id === escopoId) {
        const hasPlaceholder = esc.itens_com_estimativa.some(i => i.id === '');
        if (hasPlaceholder) return esc;

        const placeholder: ItemEscopo = {
          id: '',
          escopo_mensal: escopoId,
          cargo: '',
          cargo_nome: '',
          turno: 'DIURNO',
          turno_display: 'Diurno',
          quantidade: 1,
          dsr_valor_fixo: '0.00',
          detalhamento: null
        };

        return {
          ...esc,
          itens_com_estimativa: [...esc.itens_com_estimativa, placeholder]
        };
      }
      return esc;
    }));

    setEditingItemId(`${escopoId}_`);
    setEditCargo(cargosOpcoes[0]?.id || '');
    setEditTurno('DIURNO');
    setEditQuantidade(1);
    setEditDsr('0.00');
  };


  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 animate-pulse">
            <div className="flex justify-between items-center border-b border-neutral-100 dark:border-neutral-850 pb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-neutral-100 dark:border-neutral-850">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (localEscopos.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <CalendarDays className="h-10 w-10 mx-auto text-neutral-300 mb-2" />
        <p>Nenhum escopo encontrado para a seleção de filtros atual.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {localEscopos.map((esc) => {
        const labelCompetencia = `${String(esc.mes).padStart(2, '0')}/${esc.ano}`;
        return (
          <div 
            key={esc.id} 
            className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden"
          >
            {/* Cabeçalho do Bloco da Loja */}
            <div className="flex items-center justify-between p-5 border-b border-neutral-100 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-850">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-100">
                  {esc.loja_nome}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                  {labelCompetencia}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDeleteEscopo(esc.id, `${esc.loja_nome} (${labelCompetencia})`)}
                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                Excluir Escopo
              </button>
            </div>

            {/* Tabela de Cargos do Escopo */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-850 bg-neutral-50 dark:bg-neutral-850/50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Cargo / Função</th>
                    <th className="py-3.5 px-5">Turno</th>
                    <th className="py-3.5 px-5 w-24">Quantidade</th>
                    <th className="py-3.5 px-5 text-right">Salário Base</th>
                    <th className="py-3.5 px-5 text-right">Insal. Fixa</th>
                    <th className="py-3.5 px-5 text-right">Insal. Banho</th>
                    <th className="py-3.5 px-5 text-right">Adic. Noturno</th>
                    <th className="py-3.5 px-5 text-right">DSR Var.</th>
                    <th className="py-3.5 px-5 text-right">Total</th>
                    <th className="py-3.5 px-5 w-20 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-850">
                  {esc.itens_com_estimativa.map((item) => {
                    const isEditing = editingItemId === `${esc.id}_${item.id}`;

                    if (isEditing) {
                      return (
                        <tr key={item.id || 'placeholder'} className="bg-neutral-50/50 dark:bg-neutral-850/30">
                          {/* Seleção do Cargo em edição */}
                          <td className="py-3 px-5 align-middle">
                            <SearchableSelect
                              options={[
                                { value: '', label: 'Selecione...' },
                                ...cargosOpcoes.map((c) => ({ value: c.id, label: c.nome })),
                              ]}
                              value={editCargo}
                              onChange={setEditCargo}
                              placeholder="Selecione..."
                            />
                          </td>
                          {/* Seleção do Turno em edição */}
                          <td className="py-3 px-5 align-middle">
                            <SearchableSelect
                              options={turnosOpcoes.map((t) => ({ value: t.id, label: t.nome }))}
                              value={editTurno}
                              onChange={setEditTurno}
                              placeholder="Selecione..."
                            />
                          </td>
                          {/* Campo de Quantidade */}
                          <td className="py-3 px-5 align-middle">
                            <input
                              type="number"
                              min={1}
                              value={editQuantidade}
                              onChange={(e) => setEditQuantidade(parseInt(e.target.value) || 1)}
                              className="w-full p-1.5 border border-neutral-200 dark:border-neutral-850 rounded bg-white dark:bg-neutral-900 text-xs text-center"
                            />
                          </td>
                          {/* Colunas vazias durante edição para manter alinhamento */}
                          <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                          <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                          <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                          <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                          {/* Campo de DSR Variável Fixo (R$) para o cargo */}
                          <td className="py-3 px-5 align-middle">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editDsr}
                              onChange={(e) => setEditDsr(e.target.value)}
                              placeholder="0.00"
                              className="w-full p-1.5 border border-neutral-200 dark:border-neutral-850 rounded bg-white dark:bg-neutral-900 text-xs text-right font-mono"
                            />
                          </td>
                          <td className="py-3 px-5 text-right text-neutral-400 align-middle">-</td>
                          <td className="py-3 px-5 align-middle text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                disabled={savingItem}
                                onClick={() => handleSaveItem(esc.id, item.id)}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 rounded transition-colors disabled:opacity-50"
                                title="Salvar item"
                              >
                                {savingItem ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelEdit(esc.id, item)}
                                className="p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                                title="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-neutral-855 dark:text-neutral-200">{item.cargo_nome}</td>
                        <td className="py-3.5 px-5 text-neutral-600">{item.turno_display}</td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold">{item.quantidade}</td>
                        
                        {item.detalhamento ? (
                          <>
                            <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(item.detalhamento.base_total)}</td>
                            <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterInsalubridadeFixa(item.detalhamento))}</td>
                            <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterInsalubridadeBanheirista(item.detalhamento))}</td>
                            <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterAdicionalNoturno(item.detalhamento))}</td>
                            <td className="py-3.5 px-5 text-right text-neutral-700 font-mono">{formatCurrency(obterDsr(item.detalhamento))}</td>
                            <td className="py-3.5 px-5 text-right font-bold text-neutral-900 dark:text-neutral-100 font-mono">{formatCurrency(item.detalhamento.total)}</td>
                          </>
                        ) : (
                          <td colSpan={6} className="py-3.5 px-5 text-center text-red-500 font-semibold bg-red-500/5">
                            Sem tabela salarial para o cargo nesta competência.
                          </td>
                        )}

                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(esc.id, item)}
                              className="p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                              title="Editar item"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirItem(item.id)}
                              className="p-1 text-red-500 hover:bg-red-55 dark:hover:bg-red-950/20 rounded transition-colors"
                              title="Remover item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {esc.itens_com_estimativa.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-neutral-400 italic">
                        Escopo sem cargos registrados. Clique em "Novo Item" abaixo para registrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé do Bloco com Botão de Novo Item e Valor Estimado */}
            <div className="p-4 border-t border-neutral-100 dark:border-neutral-850 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/30 dark:bg-neutral-850/10">
              <button
                type="button"
                onClick={() => handleAddNewItemPlaceholder(esc.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-850 text-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Item
              </button>

              <div className="text-right">
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                  Total da Estimativa do Escopo
                </span>
                <strong className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100 font-mono">
                  {formatCurrency(esc.total_estimativa_escopo)}
                </strong>
              </div>
            </div>
          </div>
        );
      })}

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="py-4 px-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between shadow-sm">
          <span className="text-xs text-neutral-500">
            Mostrando {localEscopos.length} de {count} escopos
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
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                  }}
                  text="Próxima"
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
