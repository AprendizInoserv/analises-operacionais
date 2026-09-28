import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Loader2, X } from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';
import SearchableSelect from '../ui/searchable-select';
import type { Cargo } from './EscoposTable';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

interface LojaRef {
  id: string;
  nome_referencia: string;
}

interface EscopoFormModalProps {
  lojasOpcoes: LojaRef[];
  cargosOpcoes: Cargo[];
  initialLojaId?: string;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * Modal de Cadastro de Novo Escopo Mensal.
 * 
 * Por que existe: Fornece um formulário em popup para planejar a quantidade de 
 * cargos e seus turnos para uma determinada loja e mês de competência.
 * Gerencia a adição/remoção dinâmica de postos de trabalho e envia os dados consolidados.
 */
export default function EscopoFormModal({
  lojasOpcoes,
  cargosOpcoes,
  initialLojaId = '',
  onClose,
  onRefresh,
}: EscopoFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(modalRef, onClose);

  // Estados locais do formulário
  const [loja, setLoja] = useState(initialLojaId);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [itens, setItens] = useState<{ cargo: string; turno: string; quantidade: number }[]>([
    { cargo: cargosOpcoes[0]?.id || '', turno: 'DIURNO', quantidade: 1 }
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Se cargosOpcoes carregar após o componente montar, preenche o primeiro cargo caso esteja vazio
  useEffect(() => {
    if (cargosOpcoes.length > 0) {
      setItens(prev => {
        if (prev.length === 1 && !prev[0].cargo) {
          return [{ ...prev[0], cargo: cargosOpcoes[0].id }];
        }
        return prev;
      });
    }
  }, [cargosOpcoes]);

  const turnosOpcoes = [
    { id: 'DIURNO', nome: 'Diurno' },
    { id: 'NOTURNO', nome: 'Noturno' },
    { id: 'MISTO', nome: 'Misto' }
  ];

  const mesesChoices = [
    { num: 1, nome: 'Janeiro' },
    { num: 2, nome: 'Fevereiro' },
    { num: 3, nome: 'Março' },
    { num: 4, nome: 'Abril' },
    { num: 5, nome: 'Maio' },
    { num: 6, nome: 'Junho' },
    { num: 7, nome: 'Julho' },
    { num: 8, nome: 'Agosto' },
    { num: 9, nome: 'Setembro' },
    { num: 10, nome: 'Outubro' },
    { num: 11, nome: 'Novembro' },
    { num: 12, nome: 'Dezembro' }
  ];

  // Adiciona um novo cargo na lista temporária do modal sugerindo um cargo ainda não utilizado com Diurno
  const handleAddItem = () => {
    const usedCargosComDiurno = new Set(itens.filter(i => i.turno === 'DIURNO').map(i => i.cargo));
    const nextCargo = cargosOpcoes.find(c => !usedCargosComDiurno.has(c.id))?.id || cargosOpcoes[0]?.id || '';
    setItens(prev => [...prev, { cargo: nextCargo, turno: 'DIURNO', quantidade: 1 }]);
  };

  // Remove um cargo específico da lista temporária do modal
  const handleRemoveItem = (index: number) => {
    if (itens.length <= 1) return;
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  // Atualiza campo específico de um item da lista temporária
  const handleItemChange = (index: number, field: 'cargo' | 'turno' | 'quantidade', value: any) => {
    setItens(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Salva o novo escopo no banco de dados
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!loja) {
      const msg = 'Selecione uma loja física para o escopo.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    if (itens.length === 0) {
      const msg = 'Adicione pelo menos um item operacional.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    const invalidItem = itens.some(i => !i.cargo || i.quantidade < 1);
    if (invalidItem) {
      const msg = 'Verifique se todos os itens possuem cargo selecionado e quantidade maior ou igual a 1.';
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    // Valida duplicidade de cargo e turno entre os itens adicionados
    const combos = new Set<string>();
    for (const item of itens) {
      const key = `${item.cargo}_${item.turno}`;
      if (combos.has(key)) {
        const cargoObj = cargosOpcoes.find(c => c.id === item.cargo);
        const cargoNome = cargoObj ? cargoObj.nome : `Cargo ${item.cargo}`;
        const msg = `O cargo "${cargoNome}" no turno "${item.turno}" foi adicionado mais de uma vez. Combine as quantidades na mesma linha.`;
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      combos.add(key);
    }

    setLoading(true);
    try {
      const payload = {
        loja,
        ano,
        mes,
        itens
      };

      const response = await api.post('/escopos/novo/', payload);
      if (response.data.success) {
        toast.success(response.data.message || 'Escopo mensal criado com sucesso!');
        onRefresh();
        onClose();
      } else {
        const errText = response.data.error || 'Erro ao registrar escopo.';
        setErrorMsg(errText);
        toast.error(errText);
      }
    } catch (err: any) {
      console.error('Erro ao criar escopo:', err);
      const errText =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        (typeof err.response?.data === 'string' ? err.response.data : null) ||
        'Erro de comunicação ao salvar novo escopo mensal.';
      setErrorMsg(errText);
      toast.error(errText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div 
        ref={modalRef} 
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
              Novo Escopo Mensal
            </h3>
            <p className="text-xs text-neutral-500">Criação planejada de postos e escala salarial para competência</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário com rolagem independente */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dados de Competência */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative z-20">
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                Loja Física *
              </label>
              <SearchableSelect
                options={lojasOpcoes.map((l) => ({ value: String(l.id), label: l.nome_referencia }))}
                value={loja}
                onChange={setLoja}
                placeholder="Selecione..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                Ano da Competência *
              </label>
              <select
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white min-h-[38px] cursor-pointer shadow-xs"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">
                Mês da Competência *
              </label>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value) || new Date().getMonth() + 1)}
                className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white min-h-[38px] cursor-pointer shadow-xs"
              >
                {mesesChoices.map(m => (
                  <option key={m.num} value={m.num}>{m.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Itens Operacionais */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Itens Operacionais do Escopo
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-850 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Cargo
              </button>
            </div>

            {/* Listagem dos Cargos */}
            <div className="space-y-3">
              {itens.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 sm:items-end bg-neutral-50 dark:bg-neutral-850/60 p-3.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800 shadow-xs">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Cargo / Função *
                    </label>
                    <select
                      value={item.cargo}
                      onChange={(e) => handleItemChange(index, 'cargo', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white min-h-[38px] cursor-pointer shadow-xs"
                    >
                      <option value="">Selecione o cargo...</option>
                      {cargosOpcoes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:w-36">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">
                      Turno *
                    </label>
                    <select
                      value={item.turno}
                      onChange={(e) => handleItemChange(index, 'turno', e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white min-h-[38px] cursor-pointer shadow-xs"
                    >
                      {turnosOpcoes.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:w-28">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1 text-center">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => handleItemChange(index, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-xs text-center text-neutral-800 dark:text-neutral-200 min-h-[38px] shadow-xs"
                    />
                  </div>

                  <div className="flex justify-end sm:justify-start">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={itens.length === 1}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer mb-0.5"
                      title={itens.length === 1 ? 'O escopo deve conter ao menos um cargo' : 'Remover linha'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              {itens.length === 0 && (
                <div className="text-center py-6 text-xs text-neutral-400 italic">
                  Nenhum cargo adicionado ainda. Clique em "Adicionar Cargo" acima.
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800 mt-6 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 rounded-full text-xs font-bold text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-full text-xs font-bold hover:bg-neutral-850 dark:hover:bg-neutral-100 shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Escopo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
