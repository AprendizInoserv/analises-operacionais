import { useState } from 'react';
import { X, Send, Calendar, Megaphone, Loader2 } from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';
import type { AvisoItem } from './AvisoModalDia';

interface ReenviarAvisoModalProps {
  isOpen?: boolean;
  aviso: AvisoItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReenviarAvisoModal({
  isOpen = true,
  aviso,
  onClose,
  onSuccess,
}: ReenviarAvisoModalProps) {
  if (isOpen === false || !aviso) return null;
  const hojeStr = new Date().toISOString().slice(0, 10);

  const [dataInicio, setDataInicio] = useState(hojeStr);
  const [dataFim, setDataFim] = useState(hojeStr);
  const [criarNovoRegistro, setCriarNovoRegistro] = useState(true);
  const [reenviando, setReenviando] = useState(false);

  const handleReenviar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dataInicio) {
      toast.error('Selecione a nova data para o reenvio do aviso.');
      return;
    }

    try {
      setReenviando(true);
      await api.post(`/usuarios/api/avisos/${aviso.id}/reenviar/`, {
        data_inicio: dataInicio,
        data_fim: dataFim || dataInicio,
        duplicar: criarNovoRegistro,
      });

      toast.success(
        criarNovoRegistro
          ? 'Novo aviso agendado com sucesso a partir do histórico!'
          : 'Aviso reagendado com sucesso!'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao reenviar aviso:', err);
      const msg = err.response?.data?.error || 'Não foi possível reenviar o aviso.';
      toast.error(msg);
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        role="dialog"
      >
        {/* Cabeçalho */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-50">
                Reenviar / Reagendar Aviso
              </h3>
              <p className="text-xs text-neutral-500">
                Escolha a nova data no calendário para exibir novamente este comunicado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informações do Aviso Selecionado */}
        <form onSubmit={handleReenviar} className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 space-y-1.5">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-amber-500 shrink-0" />
              <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-50">
                {aviso.titulo}
              </h4>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 line-clamp-3 leading-relaxed">
              {aviso.conteudo}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Nova Data de Início <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  if (dataFim && e.target.value > dataFim) {
                    setDataFim(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-neutral-900 dark:text-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Nova Data de Término
              </label>
              <input
                type="date"
                value={dataFim}
                min={dataInicio}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-neutral-900 dark:text-neutral-50"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={criarNovoRegistro}
                onChange={(e) => setCriarNovoRegistro(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300"
              />
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Preservar registro anterior no histórico (criar nova entrada com a nova data)
              </span>
            </label>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={reenviando}
              className="px-4 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={reenviando}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {reenviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{reenviando ? 'Reenviando...' : 'Confirmar Reenvio'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
