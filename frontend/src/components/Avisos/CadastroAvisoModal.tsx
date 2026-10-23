import { useState, useEffect } from 'react';
import { X, Calendar, Megaphone, Loader2, Save } from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';
import type { AvisoItem } from './AvisoModalDia';
export type { AvisoItem };
export type Aviso = AvisoItem;

interface CadastroAvisoModalProps {
  isOpen?: boolean;
  avisoParaEditar?: AvisoItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CadastroAvisoModal({
  isOpen = true,
  avisoParaEditar,
  onClose,
  onSuccess,
}: CadastroAvisoModalProps) {
  if (isOpen === false) return null;
  const hojeStr = new Date().toISOString().slice(0, 10);

  const [titulo, setTitulo] = useState(avisoParaEditar?.titulo || '');
  const [conteudo, setConteudo] = useState(avisoParaEditar?.conteudo || '');
  const [dataInicio, setDataInicio] = useState(avisoParaEditar?.data_inicio || hojeStr);
  const [dataFim, setDataFim] = useState(avisoParaEditar?.data_fim || hojeStr);
  const [ativo, setAtivo] = useState(avisoParaEditar ? avisoParaEditar.ativo : true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (avisoParaEditar) {
      setTitulo(avisoParaEditar.titulo);
      setConteudo(avisoParaEditar.conteudo);
      setDataInicio(avisoParaEditar.data_inicio);
      setDataFim(avisoParaEditar.data_fim || avisoParaEditar.data_inicio);
      setAtivo(avisoParaEditar.ativo);
    }
  }, [avisoParaEditar]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast.error('Informe o nome do aviso.');
      return;
    }

    if (!conteudo.trim()) {
      toast.error('Informe o conteúdo do aviso.');
      return;
    }

    if (!dataInicio) {
      toast.error('Selecione a data de início/exibição no calendário.');
      return;
    }

    try {
      setSalvando(true);
      const payload = {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        data_inicio: dataInicio,
        data_fim: dataFim || dataInicio,
        ativo,
      };

      if (avisoParaEditar) {
        await api.put(`/usuarios/api/avisos/${avisoParaEditar.id}/`, payload);
        toast.success('Aviso atualizado com sucesso!');
      } else {
        await api.post('/usuarios/api/avisos/', payload);
        toast.success('Aviso cadastrado e agendado com sucesso!');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar aviso:', err);
      const msg = err.response?.data?.error || 'Ocorreu um erro ao salvar o aviso.';
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        role="dialog"
      >
        {/* Cabeçalho */}
        <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-50">
                {avisoParaEditar ? 'Editar Aviso' : 'Novo Aviso / Comunicado'}
              </h3>
              <p className="text-xs text-neutral-500">
                Defina o nome, mensagem e agendamento via calendário
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Nome do Aviso <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Manutenção programada nos servidores"
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 dark:text-neutral-50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
              Conteúdo do Aviso <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Digite aqui o texto detalhado do comunicado que será exibido aos usuários..."
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 dark:text-neutral-50 leading-relaxed resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Data de Início (Calendário) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
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
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 dark:text-neutral-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1.5">
                Data de Término
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dataFim}
                  min={dataInicio}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-neutral-900 dark:text-neutral-50"
                />
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                Deixe igual à data de início para exibição em apenas um dia.
              </span>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-neutral-300"
              />
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                Aviso ativo para exibição
              </span>
            </label>
          </div>

          {/* Botões do Rodapé */}
          <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{salvando ? 'Salvando...' : avisoParaEditar ? 'Atualizar Aviso' : 'Salvar e Agendar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
