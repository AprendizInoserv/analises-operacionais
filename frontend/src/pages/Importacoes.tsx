import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { 
  Users, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Coins,
  UploadCloud,
  Loader2,
  TrendingDown,
  Store,
  ExternalLink
} from 'lucide-react';
import api from '../api/client';
import UploadCard from '../components/Importacoes/UploadCard';

interface ImportStatus {
  status: 'processing' | 'completed' | 'error' | 'not_found';
  progress: number;
  message: string;
  result: any;
  msg_type?: 'success' | 'warning' | 'error';
  titulo?: string;
}

/**
 * Página de Central de Importações.
 * 
 * Por que existe: Gerencia a seleção de arquivos e os envios multipart para a API do Django
 * (SRA Colaboradores, Planilha de Gestão, Folha SRD, Diárias, Prêmios e Turnover), realizando o polling de progresso 
 * e delegando o layout dos cards para o componente UploadCard.
 */
export default function Importacoes() {
  const { role, permissions } = useOutletContext<{ role?: string; permissions?: Record<string, any> }>();
  const [sraFile, setSraFile] = useState<File | null>(null);
  const [folhaFile, setFolhaFile] = useState<File | null>(null);
  const [turnoverFile, setTurnoverFile] = useState<File | null>(null);
  const [gper020File, setGper020File] = useState<File | null>(null);
  const [marcasFile, setMarcasFile] = useState<File | null>(null);
  
  // Novos estados para importação unificada de diárias
  const [diariaSistemaFile, setDiariaSistemaFile] = useState<File | null>(null);
  const [diariaManualFile, setDiariaManualFile] = useState<File | null>(null);
  
  // Novos estados para importação unificada de prêmios
  const [premioSistemaFile, setPremioSistemaFile] = useState<File | null>(null);
  const [premioManualFile, setPremioManualFile] = useState<File | null>(null);
  const [premioPeriodo, setPremioPeriodo] = useState<string>('');

  // Novos estados para importação de Gestão de Faltas (Assaí & Atacadão GeoVictoria)
  const [faltasPontoFile, setFaltasPontoFile] = useState<File | null>(null);
  const [faltasMarcasFile, setFaltasMarcasFile] = useState<File | null>(null);
  const [faltasPeriodo, setFaltasPeriodo] = useState<string>('2026-08');

  // Estados de controle do processo de importação
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Monitora o progresso do processamento de importação via polling
  const startPolling = (importId: string) => {
    setErrorMsg(null);

    const intervalId = setInterval(async () => {
      try {
        const response = await api.get<ImportStatus>(`/import-status/${importId}/`);
        const data = response.data;
        setImportStatus(data);

        if (data.status === 'completed') {
          clearInterval(intervalId);
          setLoading(false);
          // Limpa todos os arquivos da tela após conclusão com sucesso
          setSraFile(null);
          setFolhaFile(null);
          setTurnoverFile(null);
          setGper020File(null);
          setMarcasFile(null);
          setDiariaSistemaFile(null);
          setDiariaManualFile(null);
          setPremioSistemaFile(null);
          setPremioManualFile(null);
          setPremioPeriodo('');
        } else if (data.status === 'error') {
          clearInterval(intervalId);
          setLoading(false);
          setErrorMsg(data.message || 'Erro durante o processamento do arquivo.');
        }
      } catch (err) {
        console.error('Erro ao verificar status da importação:', err);
        clearInterval(intervalId);
        setLoading(false);
        setErrorMsg('Erro de comunicação ao checar o status.');
      }
    }, 1000);
  };

  // Faz o envio (upload) do arquivo para a API correspondente
  const handleUpload = async (tipo: 'sra' | 'folha' | 'turnover' | 'gper020' | 'marcas', file: File | null) => {
    if (!file) {
      alert('Selecione um arquivo primeiro.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportStatus({
      status: 'processing',
      progress: 0,
      message: 'Enviando arquivo para o servidor...',
      result: null,
      titulo: 'Progresso da Importação'
    });

    const formData = new FormData();
    formData.append('arquivo', file);

    let endpoint = '';
    if (tipo === 'sra') endpoint = '/colaboradores/importar/';
    else if (tipo === 'folha') endpoint = '/folhas/importar/';
    else if (tipo === 'turnover') endpoint = '/colaboradores/importar-turnover/';
    else if (tipo === 'gper020') endpoint = '/colaboradores/importar-gper020/';
    else if (tipo === 'marcas') endpoint = '/colaboradores/importar-marcas/';

    try {
      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.import_id) {
        startPolling(response.data.import_id);
      } else {
        setLoading(false);
        setErrorMsg('Servidor não retornou identificador de importação.');
        setImportStatus(null);
      }
    } catch (err: any) {
      console.error('Erro ao enviar arquivo:', err);
      setLoading(false);
      setImportStatus(null);
      setErrorMsg(err.response?.data?.error || 'Erro ao fazer upload do arquivo.');
    }
  };

  // Faz o envio da importação unificada de diárias (dois arquivos)
  const handleUploadDiariaUnificada = async () => {
    if (!diariaSistemaFile || !diariaManualFile) {
      alert('Selecione os arquivos da Base do Sistema e Base Manual.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportStatus({
      status: 'processing',
      progress: 0,
      message: 'Enviando arquivos de diárias para o servidor...',
      result: null,
      titulo: 'Progresso da Importação Unificada de Diárias'
    });

    const formData = new FormData();
    formData.append('arquivo_sistema', diariaSistemaFile);
    formData.append('arquivo_manual', diariaManualFile);

    try {
      const response = await api.post('/diarias/importar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.import_id) {
        startPolling(response.data.import_id);
      } else {
        setLoading(false);
        setErrorMsg('Servidor não retornou identificador de importação.');
        setImportStatus(null);
      }
    } catch (err: any) {
      console.error('Erro ao enviar arquivos de diárias:', err);
      setLoading(false);
      setImportStatus(null);
      setErrorMsg(err.response?.data?.error || 'Erro ao fazer upload da importação de diárias.');
    }
  };

  // Faz o envio da importação unificada de prêmios (dois arquivos + período)
  const handleUploadPremioUnificado = async () => {
    if (!premioSistemaFile || !premioManualFile) {
      alert('Selecione os arquivos da Base do Sistema e Base Manual.');
      return;
    }
    if (!premioPeriodo) {
      alert('Selecione o período de referência.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportStatus({
      status: 'processing',
      progress: 0,
      message: 'Enviando arquivos e período para o servidor...',
      result: null,
      titulo: 'Progresso da Importação Unificada de Prêmios'
    });

    const formData = new FormData();
    formData.append('arquivo_sistema', premioSistemaFile);
    formData.append('arquivo_manual', premioManualFile);
    formData.append('periodo', premioPeriodo);

    try {
      const response = await api.post('/premios/importar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && response.data.import_id) {
        startPolling(response.data.import_id);
      } else {
        setLoading(false);
        setErrorMsg('Servidor não retornou identificador de importação.');
        setImportStatus(null);
      }
    } catch (err: any) {
      console.error('Erro ao enviar arquivos de prêmio:', err);
      setLoading(false);
      setImportStatus(null);
      setErrorMsg(err.response?.data?.error || 'Erro ao fazer upload da importação de prêmios.');
    }
  };

  // Envio da importação de Fechamento GeoVictoria (Pontos + Marcas)
  const handleUploadFaltasGeoVictoria = async () => {
    if (!faltasPontoFile || !faltasMarcasFile) {
      alert('Selecione os arquivos de Ponto e de Marcas do GeoVictoria.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setImportStatus({
      status: 'processing',
      progress: 50,
      message: 'Cruzando batidas do GeoVictoria com quadros e aplicando regras...',
      result: null,
      titulo: 'Fechamento GeoVictoria (Assaí & Atacadão)'
    });

    const [anoStr, mesStr] = (faltasPeriodo || '2026-08').split('-');
    const formData = new FormData();
    formData.append('arquivo_ponto', faltasPontoFile);
    formData.append('arquivo_marcas', faltasMarcasFile);
    formData.append('ano', anoStr || '2026');
    formData.append('mes', mesStr || '8');
    formData.append('hec_minutos', '0');

    try {
      const response = await api.post('/api/fechamento-atacadao-assai/processar/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const res = response.data;
      setLoading(false);
      setImportStatus({
        status: 'completed',
        progress: 100,
        message: `Fechamento processado com sucesso! ${res.kpis?.total_lojas || 0} lojas calculadas. Total esperado: ${res.kpis?.total_esperado || 0}, Resultado: ${res.kpis?.resultado_total || 0}, Faltas operacionais: ${res.kpis?.faltas_operacionais || 0}.`,
        msg_type: 'success',
        result: res,
        titulo: 'Fechamento GeoVictoria Concluído'
      });
      setFaltasPontoFile(null);
      setFaltasMarcasFile(null);
    } catch (err: any) {
      console.error('Erro ao processar fechamento GeoVictoria:', err);
      setLoading(false);
      setImportStatus(null);
      setErrorMsg(err.response?.data?.erro || err.message || 'Erro ao processar arquivos do GeoVictoria.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Central de Importações</h1>
        <p className="text-sm text-neutral-500">Envie planilhas e arquivos do TOTVS para atualizar o banco de dados</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex gap-3 items-center">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid de Cards de Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* Card Colaboradores SRA */}
        <UploadCard
          title="Colaboradores (TOTVS - SRA)"
          description="Carga do cadastro de equipe ativa. Formato aceito: CSV exportado do sistema SRA."
          icon={
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
          }
          accept=".csv"
          file={sraFile}
          setFile={setSraFile}
          loading={loading}
          buttonText="Importar Colaboradores"
          onUpload={() => handleUpload('sra', sraFile)}
        />


        {permissions?.turnover?.create && (
          <>
            <UploadCard
              title="Rescisões / Turnover (TOTVS - SRG)"
              description="Carga de motivos de demissão e verbas da tabela SRG (sc575190.csv / rescisões)."
              icon={
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <TrendingDown className="h-6 w-6" />
                </div>
              }
              accept=".csv"
              file={turnoverFile}
              setFile={setTurnoverFile}
              loading={loading}
              buttonText="Importar Rescisões (SRG)"
              onUpload={() => handleUpload('turnover', turnoverFile)}
            />

            <UploadCard
              title="Valores de Rescisão - Totvs Liquido"
              description="Carga dos valores financeiros reais e líquidos pagos em rescisões (Relatório - Página 2)."
              icon={
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Coins className="h-6 w-6" />
                </div>
              }
              accept=".xml,.xlsx,.xls,.xlsm"
              file={gper020File}
              setFile={setGper020File}
              loading={loading}
              buttonText="Importar Valores"
              onUpload={() => handleUpload('gper020', gper020File)}
            />
          </>
        )}

        {role !== 'Gestão' && (
          <>
            {/* Card Folha de Pagamento SRD */}
            <UploadCard
              title="Folha de Pagamento (SRD)"
              description="Carga das verbas e pagamentos de proventos. Formato aceito: CSV de export da folha."
              icon={
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <FileText className="h-6 w-6" />
                </div>
              }
              accept=".csv"
              file={folhaFile}
              setFile={setFolhaFile}
              loading={loading}
              buttonText="Importar Folha SRD"
              onUpload={() => handleUpload('folha', folhaFile)}
            />

            {/* Card Relatório de Marcas (GeoVictoria) */}
            <UploadCard
              title="Relatório de Marcas (GeoVictoria)"
              description="Importação das marcações de ponto originais. Formato aceito: Excel (.xlsx, .xlsm, .xls) exportado do GeoVictoria."
              icon={
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
              }
              accept=".xlsx,.xlsm,.xls"
              file={marcasFile}
              setFile={setMarcasFile}
              loading={loading}
              buttonText="Importar Relatório de Marcas"
              onUpload={() => handleUpload('marcas', marcasFile)}
            />

            {/* Card Diárias Operacionais (Unificação de Bases) */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-6 shadow-sm flex flex-col justify-between space-y-4 xl:col-span-2 md:col-span-2 col-span-1 animate-fade-in">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Diárias (Unificação de Bases)</h3>
                <p className="text-xs text-neutral-400">
                  Importa e unifica as bases de diárias do Sistema (CSV) e Manual (Excel) no banco de dados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Lado esquerdo: Seleção de arquivos */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Base do Sistema (CSV)
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-450 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-neutral-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {diariaSistemaFile ? diariaSistemaFile.name : "Selecionar arquivo (.csv)"}
                      </span>
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setDiariaSistemaFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Base Manual (Excel)
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-450 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-neutral-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {diariaManualFile ? diariaManualFile.name : "Selecionar arquivo (.xlsx)"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xlsm,.xls"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setDiariaManualFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                {/* Lado direito: Envio */}
                <div className="space-y-3 flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={handleUploadDiariaUnificada}
                    disabled={loading || !diariaSistemaFile || !diariaManualFile}
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 dark:bg-white dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Importar e Unificar Diárias
                  </button>
                </div>
              </div>
            </div>

            {/* Card Prêmios Pagos (Unificação de Bases) */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs p-6 shadow-sm flex flex-col justify-between space-y-4 xl:col-span-2 md:col-span-2 col-span-1 animate-fade-in">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                  <Coins className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">Prêmios (Unificação de Bases)</h3>
                <p className="text-xs text-neutral-400">
                  Importa e unifica as bases de prêmios do Sistema e Manual para o período selecionado, substituindo os dados existentes no sistema.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Lado esquerdo: Seleção de arquivos */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Base do Sistema
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-450 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-neutral-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {premioSistemaFile ? premioSistemaFile.name : "Selecionar arquivo (.xlsx)"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xlsm,.xls"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setPremioSistemaFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Base Manual
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-450 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-neutral-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {premioManualFile ? premioManualFile.name : "Selecionar arquivo (.xlsx)"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xlsm,.xls"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setPremioManualFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                {/* Lado direito: Período e Envio */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Período de Referência
                    </label>
                    <input
                      type="month"
                      value={premioPeriodo}
                      disabled={loading}
                      onChange={(e) => setPremioPeriodo(e.target.value)}
                      className="w-full text-xs bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-neutral-700 dark:text-neutral-300 focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUploadPremioUnificado}
                    disabled={loading || !premioSistemaFile || !premioManualFile || !premioPeriodo}
                    className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 dark:bg-white dark:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-1"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Importar e Unificar Prêmios
                  </button>
                </div>
              </div>
            </div>

            {/* Card Gestão de Faltas - Fechamento Assaí & Atacadão (GeoVictoria) */}
            <div className="bg-white dark:bg-neutral-900 border border-teal-500/30 dark:border-teal-500/20 rounded-2xl shadow-xs p-6 shadow-sm flex flex-col justify-between space-y-4 xl:col-span-3 md:col-span-2 col-span-1 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-teal-500/10 text-teal-400 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-teal-500/20">
                Gestão de Faltas
              </div>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 shrink-0">
                  <Store className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  Assaí & Atacadão (GeoVictoria)
                </h3>
                <p className="text-xs text-neutral-400">
                  Importação dos relatórios de Ponto e Marcas exportados do GeoVictoria para classificação automática de faltas, coberturas e cálculo de resultados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Lado esquerdo: Seleção de arquivos */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Relatório de Ponto (GeoVictoria)
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-teal-500/50 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-teal-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {faltasPontoFile ? faltasPontoFile.name : "Controle de Ponto (.xlsx)"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setFaltasPontoFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Relatório de Marcas (PunchReport)
                    </label>
                    <label className="flex items-center gap-3 border border-dashed border-neutral-200 dark:border-neutral-800 hover:border-teal-500/50 rounded-xl p-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-850 transition-colors">
                      <UploadCloud className="h-4 w-4 text-teal-400 shrink-0" />
                      <span className="text-xs text-neutral-500 truncate max-w-full font-medium">
                        {faltasMarcasFile ? faltasMarcasFile.name : "Punch Report (.xlsx)"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        disabled={loading}
                        onChange={(e) => setFaltasMarcasFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                {/* Lado direito: Período e Ações */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
                      Mês / Ano de Apuração
                    </label>
                    <input
                      type="month"
                      value={faltasPeriodo}
                      disabled={loading}
                      onChange={(e) => setFaltasPeriodo(e.target.value)}
                      className="w-full text-xs bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-neutral-700 dark:text-neutral-300 focus:outline-hidden focus:ring-1 focus:ring-teal-500 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleUploadFaltasGeoVictoria}
                      disabled={loading || !faltasPontoFile || !faltasMarcasFile}
                      className="w-full py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      Processar Fechamento GeoVictoria
                    </button>

                    <Link
                      to="/faltas?client=assai_atacadao"
                      className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Abrir Painel Completo Assaí & Atacadão</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Gestão de Faltas - Carrefour & Protege (Parser e Fechamento) */}
            <div className="bg-white dark:bg-neutral-900 border border-blue-500/30 dark:border-blue-500/20 rounded-2xl shadow-xs p-6 shadow-sm flex flex-col justify-between space-y-4 xl:col-span-2 md:col-span-2 col-span-1 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-500/10 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-blue-500/20">
                Carrefour & Protege
              </div>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  Carrefour & Protege
                </h3>
                <p className="text-xs text-neutral-400">
                  Acesse o painel dedicado para inicializar ciclos de apuração, colar mensagens recebidas dos gerentes no WhatsApp ou exportar matrizes de fechamento.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  to="/faltas?client=carrefour"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Acessar Fechamento Carrefour</span>
                </Link>

                <Link
                  to="/faltas?client=protege"
                  className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Acessar Fechamento Protege</span>
                </Link>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Modal de Progresso e Resultado */}
      {importStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xs shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <div>
                <h3 className="font-bold text-lg text-neutral-900 dark:text-neutral-100">
                  {importStatus.titulo || 'Progresso do Processamento'}
                </h3>
                <p className="text-xs text-neutral-500">Acompanhamento de Importação de Arquivo</p>
              </div>
              {importStatus.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => setImportStatus(null)}
                  className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    {importStatus.message}
                  </span>
                  <span className="font-bold text-primary">{importStatus.progress}%</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-3.5 overflow-hidden">
                  <div 
                    className="bg-primary h-3.5 rounded-full transition-all duration-300"
                    style={{ width: `${importStatus.progress}%` }}
                  />
                </div>
              </div>

              {importStatus.status === 'completed' && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border flex gap-3 items-start ${
                    importStatus.msg_type === 'success' 
                      ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-300' 
                      : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    {importStatus.msg_type === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-bold text-sm">Importação Concluída</p>
                      <p className="text-xs leading-relaxed whitespace-pre-line">{importStatus.message}</p>
                    </div>
                  </div>

                  {importStatus.result?.alertas_status_multiplo?.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-red-800 dark:text-red-300">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>Matrículas (RE) com múltiplos status na planilha:</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto pr-1">
                        <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc pl-5">
                          {importStatus.result.alertas_status_multiplo.map((alerta: any, idx: number) => (
                            <li key={idx}>
                              RE <span className="font-semibold">{alerta.re}</span> ({alerta.nome}):{" "}
                              <span className="italic">{alerta.statuses.join(", ")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {importStatus.result?.excecoes?.length > 0 && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-purple-800 dark:text-purple-300">
                        <AlertCircle className="h-4 w-4 text-purple-500 shrink-0" />
                        <span>Colaboradores com cargo 'AUXILIAR ADMINISTRAT' desconsiderados nas telas ({importStatus.result.excecoes.length}):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto pr-1">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-purple-100 dark:border-purple-900/40 text-purple-700 dark:text-purple-400 font-semibold">
                              <th className="py-1 text-left">RE</th>
                              <th className="py-1 text-left">Nome</th>
                              <th className="py-1 text-left">Centro de Custo</th>
                            </tr>
                          </thead>
                          <tbody className="text-purple-800 dark:text-purple-300 divide-y divide-purple-100/50 dark:divide-purple-900/20">
                            {importStatus.result.excecoes.map((exc: any, idx: number) => (
                              <tr key={idx} className="hover:bg-purple-100/30 dark:hover:bg-purple-900/10">
                                <td className="py-1.5 font-semibold">{exc.re}</td>
                                <td className="py-1.5">{exc.nome}</td>
                                <td className="py-1.5">{exc.centro_custo || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {importStatus.result?.descrepancias_csv_para_sistema?.length > 0 && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>Colaboradores no CSV que não constam como demitidos no sistema ({importStatus.result.descrepancias_csv_para_sistema.length}):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto pr-1">
                        <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc pl-5">
                          {importStatus.result.descrepancias_csv_para_sistema.map((item: any, idx: number) => (
                            <li key={idx}>
                              RE <span className="font-semibold">{item.re}</span> ({item.nome}):{" "}
                              <span className="italic">{item.tipo_erro}</span> • Desligado em {item.dt_demissao_csv} no CSV (Motivo: {item.motivo})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {importStatus.result?.descrepancias_sistema_para_csv?.length > 0 && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-red-800 dark:text-red-300">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <span>Colaboradores demitidos no sistema que não constam no CSV ({importStatus.result.descrepancias_sistema_para_csv.length}):</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto pr-1">
                        <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-disc pl-5">
                          {importStatus.result.descrepancias_sistema_para_csv.map((item: any, idx: number) => (
                            <li key={idx}>
                              RE <span className="font-semibold">{item.re}</span> ({item.nome}):{" "}
                              Desligado em {item.data_demissao} • Cargo: {item.cargo}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
              <button
                type="button"
                disabled={importStatus.status === 'processing'}
                onClick={() => setImportStatus(null)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
