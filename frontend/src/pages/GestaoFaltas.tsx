import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, 
  Store, 
  ShieldCheck, 
  UploadCloud, 
  FileSpreadsheet, 
  MessageSquare, 
  History, 
  ArrowLeft,
  CalendarCheck2,
  Sparkles,
  Download,
  Plus
} from 'lucide-react';
import CardsDashboard from '../components/GestaoFaltas/CardsDashboard';
import ClientHub from '../components/GestaoFaltas/ClientHub';
import HistoricoFechamentos from '../components/GestaoFaltas/HistoricoFechamentos';
import LojasConfig from '../components/GestaoFaltas/LojasConfig';
import WhatsAppModal from '../components/GestaoFaltas/WhatsAppModal';
import NetworkModal from '../components/GestaoFaltas/NetworkModal';
import Toast from '../components/GestaoFaltas/Toast';
import { gestaoFaltasApi as api } from '../services/gestaoFaltasApi';
import '../components/GestaoFaltas/gestaoFaltas.css';

export default function GestaoFaltas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientParam = searchParams.get('client');
  const viewParam = searchParams.get('view') || 'home';

  const [activeView, setActiveView] = useState<string>(viewParam);
  const [selectedClient, setSelectedClient] = useState<string | null>(clientParam);
  const [fechamentoAtivo, setFechamentoAtivo] = useState<any>(null);
  const [kpis, setKpis] = useState<any>(null);

  // Modais
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' }>({
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: 'success' });
    }, 4000);
  };

  const carregarKPIs = async () => {
    try {
      const data = await api.getKPIs();
      setKpis(data);
    } catch (e) {
      console.error('Erro ao carregar KPIs:', e);
    }
  };

  useEffect(() => {
    carregarKPIs();
  }, [activeView, selectedClient]);

  useEffect(() => {
    if (clientParam) {
      setSelectedClient(clientParam);
      setActiveView('client_hub');
    } else {
      setSelectedClient(null);
      if (viewParam && viewParam !== 'home') {
        setActiveView(viewParam);
      } else {
        setActiveView('home');
      }
    }
  }, [clientParam, viewParam]);

  const handleSelectClient = (clientCode: string) => {
    setSelectedClient(clientCode);
    setActiveView('client_hub');
    setSearchParams({ client: clientCode });
  };

  const handleVoltar = () => {
    setSelectedClient(null);
    setActiveView('home');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="gestao-faltas-root w-full space-y-6">
      {/* Top Banner Actions & Shortcuts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-600 dark:text-teal-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
              Gestão Operacional de Faltas & Fechamentos
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-medium">
                2026
              </span>
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Apuração automatizada, descontos financeiros, leitor WhatsApp e fechamentos Carrefour, Assaí, Atacadão e Protege.
            </p>
          </div>
        </div>

        {/* Global Import and Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-800 dark:text-white text-xs font-semibold border border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
            title="Abrir parser de mensagens do WhatsApp"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Parser WhatsApp</span>
          </button>

          <Link 
            to="/importacoes"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            title="Acessar Central de Importações para upload de arquivos"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Central de Importações</span>
          </Link>

          <button 
            onClick={() => {
              setActiveView('historico_banco');
              setSelectedClient(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-750 text-neutral-700 dark:text-neutral-200 text-xs font-medium border border-neutral-300 dark:border-neutral-700 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedClient ? (
        <ClientHub 
          clientCode={selectedClient}
          onVoltar={handleVoltar}
          showToast={showToast}
          onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
          fechamentoAtivo={fechamentoAtivo}
          setFechamentoAtivo={setFechamentoAtivo}
        />
      ) : (
        <>
          {activeView === 'home' && (
            <CardsDashboard 
              onSelectClient={handleSelectClient}
              setActiveView={setActiveView}
              kpis={kpis}
            />
          )}

          {activeView === 'historico_banco' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={handleVoltar}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar aos Clientes</span>
                </button>
              </div>
              <HistoricoFechamentos 
                showToast={showToast}
                onSelectFechamento={(f: any) => {
                  setFechamentoAtivo(f);
                  const code = f.cliente_nome?.toLowerCase().includes('protege') ? 'protege' : 'carrefour';
                  handleSelectClient(code);
                  showToast(`Fechamento "${f.titulo}" carregado com sucesso!`, 'info');
                }}
              />
            </div>
          )}

          {activeView === 'tarifas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  onClick={handleVoltar}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar aos Clientes</span>
                </button>
              </div>
              <LojasConfig showToast={showToast} clientCode="carrefour" />
            </div>
          )}
        </>
      )}

      {/* Modais Globais */}
      <WhatsAppModal 
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        fechamentoAtivo={fechamentoAtivo}
        showToast={showToast}
        onSuccess={() => {
          if (fechamentoAtivo) {
            api.getFechamento(fechamentoAtivo.id).then(setFechamentoAtivo);
          }
          carregarKPIs();
        }}
      />

      <NetworkModal 
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
        showToast={showToast}
      />

      {/* Toast Notificações */}
      {toast.message && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ message: '', type: 'success' })} 
        />
      )}
    </div>
  );
}
