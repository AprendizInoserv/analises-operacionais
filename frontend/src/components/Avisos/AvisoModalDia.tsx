import { useEffect, useState } from 'react';
import { Megaphone, X, Check, Calendar, UserCheck } from 'lucide-react';
import api from '../../api/client';

export interface AvisoItem {
  id: number;
  titulo: string;
  conteudo: string;
  data_inicio: string;
  data_fim: string;
  criado_por_nome: string;
  ativo: boolean;
  status: string;
}

/**
 * Modal exibido no centro da tela no primeiro acesso do usuário no dia
 * caso haja comunicados ou avisos agendados ativos para hoje.
 */
export default function AvisoModalDia() {
  const [avisosPendentes, setAvisosPendentes] = useState<AvisoItem[]>([]);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const buscarAvisosDeHoje = async () => {
      try {
        const response = await api.get('/usuarios/api/avisos/hoje/');
        const lista: AvisoItem[] = response.data?.avisos || [];

        if (lista.length === 0) return;

        const hojeStr = new Date().toISOString().slice(0, 10);

        // Filtra os avisos que o usuário ainda não confirmou/visualizou hoje
        const naoVistos = lista.filter((aviso) => {
          const storageKey = `aviso_visto_${aviso.id}_${hojeStr}`;
          return !localStorage.getItem(storageKey);
        });

        if (naoVistos.length > 0) {
          setAvisosPendentes(naoVistos);
          setIndiceAtual(0);
          setAberto(true);
        }
      } catch (err) {
        console.error('Erro ao verificar avisos do dia:', err);
      }
    };

    buscarAvisosDeHoje();
  }, []);

  const handleConfirmarLeitura = () => {
    if (avisosPendentes.length === 0) return;

    const avisoAtual = avisosPendentes[indiceAtual];
    const hojeStr = new Date().toISOString().slice(0, 10);
    const storageKey = `aviso_visto_${avisoAtual.id}_${hojeStr}`;
    localStorage.setItem(storageKey, 'true');

    if (indiceAtual + 1 < avisosPendentes.length) {
      setIndiceAtual(indiceAtual + 1);
    } else {
      setAberto(false);
    }
  };

  if (!aberto || avisosPendentes.length === 0) {
    return null;
  }

  const aviso = avisosPendentes[indiceAtual];
  const total = avisosPendentes.length;

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '';
    const partes = dataStr.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return dataStr;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden transform animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-aviso-titulo"
      >
        {/* Barra de destaque superior colorida */}
        <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

        {/* Cabeçalho */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Comunicado Importante
                </span>
                {total > 1 && (
                  <span className="text-[10px] font-medium text-neutral-400">
                    Aviso {indiceAtual + 1} de {total}
                  </span>
                )}
              </div>
              <h2 id="modal-aviso-titulo" className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mt-1 leading-snug">
                {aviso.titulo}
              </h2>
            </div>
          </div>
          <button
            onClick={handleConfirmarLeitura}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Fechar"
            aria-label="Fechar aviso"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com a Mensagem do Aviso */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="text-sm text-neutral-700 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed bg-neutral-50 dark:bg-neutral-850/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800">
            {aviso.conteudo}
          </div>

          {/* Rodapé informativo com Criador e Data */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1.5 font-medium">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <span>Aviso criado por: <strong className="text-neutral-800 dark:text-neutral-200 font-semibold">{aviso.criado_por_nome}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Calendar className="h-4 w-4 text-neutral-400" />
              <span>{formatarData(aviso.data_inicio)}</span>
            </div>
          </div>
        </div>

        {/* Rodapé com botão de confirmação */}
        <div className="p-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 flex items-center justify-end">
          <button
            type="button"
            onClick={handleConfirmarLeitura}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-98 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>{indiceAtual + 1 < total ? 'Próximo Aviso' : 'Entendido'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
