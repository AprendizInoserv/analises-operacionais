import { FileSpreadsheet, Loader2, CheckCircle2, Clock, XCircle, HelpCircle } from 'lucide-react';
import { formatCurrency as formatarReal } from '../../utils/formatters';

export interface PremioData {
  id: string;
  status: string;
  cost_center_name: string;
  loja_nome?: string;
  coordenador_nome?: string;
  supervisor_nome?: string;
  verb_name: string;
  reward_value: string;
  period: string;
  order_type: string;
  roteiro: string;
}

interface PremiosTableProps {
  premios: PremioData[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  onExportarExcel?: () => void;
  isExporting?: boolean;
}

// Retorna o badge estilizado de acordo com o status
const getStatusBadge = (statusStr: string) => {
  const lower = statusStr.toLowerCase();
  if (lower === 'pago' || lower === 'aprovado') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" />
        {statusStr}
      </span>
    );
  }
  if (lower === 'aguardando' || lower.includes('pendente')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse">
        <Clock className="h-3 w-3" />
        {statusStr}
      </span>
    );
  }
  if (lower === 'reprovado' || lower === 'recusado' || lower.includes('cancelado')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
        <XCircle className="h-3 w-3" />
        {statusStr}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
      <HelpCircle className="h-3 w-3" />
      {statusStr}
    </span>
  );
};

// Formata período do formato '202605' para '05/2026'
const formatPeriod = (periodStr: string) => {
  if (periodStr && periodStr.length === 6) {
    return `${periodStr.substring(4, 6)}/${periodStr.substring(0, 4)}`;
  }
  return periodStr;
};

/**
 * Tabela de listagem detalhada de Prêmios Pagos.
 * 
 * Por que existe: Consolida em formato de tabela todas as solicitações de prêmios
 * conciliadas com a base de dados do sistema, contendo skeletons de carregamento,
 * paginação e formatação visual dos valores e status de pagamento.
 */
export default function PremiosTable({
  premios,
  loading,
  currentPage,
  totalPages,
  setCurrentPage,
  onExportarExcel,
  isExporting = false,
}: PremiosTableProps) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-sm overflow-hidden">
      {/* Cabeçalho da Tabela */}
      <div className="p-5 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
        <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-purple-500" />
          Detalhamento das Solicitações de Prêmios
        </h3>
        {onExportarExcel && (
          <button
            type="button"
            onClick={onExportarExcel}
            disabled={loading || premios.length === 0 || isExporting}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar prêmios filtrados para Excel (.xlsx)"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{isExporting ? 'Exportando...' : 'Exportar para Excel'}</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        {loading && premios.length === 0 ? (
          <div className="py-20 text-center text-neutral-450">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-neutral-950 dark:text-white" />
            <span>Carregando tabela de prêmios...</span>
          </div>
        ) : premios.length === 0 ? (
          <div className="py-20 text-center text-neutral-450 italic text-sm">
            Nenhuma solicitação de prêmio localizada para os filtros especificados.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                <th className="py-4 px-6">Tipo de Prêmio</th>
                <th className="py-4 px-6">Centro de Custo</th>
                <th className="py-4 px-6">Loja</th>
                <th className="py-4 px-6">Coordenador</th>
                <th className="py-4 px-6">Supervisor</th>
                <th className="py-4 px-6 text-center">Período</th>
                <th className="py-4 px-6 text-center">Tipo Pedido</th>
                <th className="py-4 px-6 text-center">Roteiro</th>
                <th className="py-4 px-6 text-right">Valor</th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {premios.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                  <td className="py-4 px-6 font-semibold text-neutral-900 dark:text-neutral-100">{p.verb_name}</td>
                  <td className="py-4 px-6 text-neutral-600 dark:text-neutral-400 text-xs">{p.cost_center_name}</td>
                  <td className="py-4 px-6">
                    {p.loja_nome ? (
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{p.loja_nome}</span>
                    ) : (
                      <span className="text-red-400 italic text-xs">Não vinculada</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-neutral-750 dark:text-neutral-300 font-medium">
                    {p.coordenador_nome || '—'}
                  </td>
                  <td className="py-4 px-6 text-neutral-750 dark:text-neutral-300 font-medium">
                    {p.supervisor_nome || '—'}
                  </td>
                  <td className="py-4 px-6 text-center text-neutral-600 dark:text-neutral-400 font-medium">
                    {formatPeriod(p.period)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.order_type === 'SISTEMA' 
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' 
                        : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                    }`}>
                      {p.order_type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.roteiro === 'FOLHA' 
                        ? 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20' 
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}>
                      {p.roteiro}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-mono font-bold text-neutral-900 dark:text-neutral-100">
                    {formatarReal(parseFloat(p.reward_value))}
                  </td>
                  <td className="py-4 px-6 text-center">{getStatusBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-xs bg-neutral-50 dark:bg-neutral-850/20">
          <button
            type="button"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-neutral-700 dark:text-neutral-300"
          >
            Anterior
          </button>
          <span className="text-neutral-500 font-semibold">
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-neutral-700 dark:text-neutral-300"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
