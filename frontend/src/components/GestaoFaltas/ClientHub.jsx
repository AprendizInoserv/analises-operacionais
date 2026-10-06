import React, { useState } from 'react';
import { 
  Building2, 
  CalendarCheck2, 
  MessageSquare, 
  Mail, 
  Store, 
  History, 
  FileSpreadsheet, 
  ArrowLeft,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Clock,
  Plus
} from 'lucide-react';
import FechamentoCarrefour from './FechamentoCarrefour';
import FechamentoProtege from './FechamentoProtege';
import FechamentoButanta from './FechamentoButanta';
import FechamentoAtacadaoAssai from './FechamentoAtacadaoAssai';
import DetalheGerador from './DetalheGerador';
import LojasConfig from './LojasConfig';
import EmailsRegionaisModal from './EmailsRegionaisModal';
import EmailsProtegeModal from './EmailsProtegeModal';
import HistoricoFechamentos from './HistoricoFechamentos';
import { api } from '../../services/api';

export default function ClientHub({ 
  clientCode, 
  onVoltar, 
  showToast, 
  onOpenWhatsAppModal,
  fechamentoAtivo, 
  setFechamentoAtivo 
}) {
  const [activeTab, setActiveTab] = useState('fechamento');

  // Metadados dos clientes
  const clientsInfo = {
    carrefour: {
      name: 'Carrefour',
      title: 'Carrefour - Fechamento Operacional de Faltas',
      subtitle: 'Ciclo Operacional: Dia 20 ao Dia 19 • 19 Filiais Ativas • Fórmulas Excel Oficiais',
      icon: Building2,
      badge: 'Ativo • 2026',
      badgeClass: 'badge-tag-active',
      isCarrefour: true,
      isProtege: false
    },
    protege: {
      name: 'Grupo Protege',
      title: 'Grupo Protege - Fechamento Operacional de Faltas',
      subtitle: '16 Filiais Operacionais • Faltas & Atestados • Modelo Oficial Protege',
      icon: ShieldCheck,
      badge: 'Ativo • 2026',
      badgeClass: 'badge-tag-active',
      isCarrefour: false,
      isProtege: true
    },
    assai_atacadao: {
      name: 'Assaí & Atacadão',
      title: 'Assaí & Atacadão - Fechamento Operacional Automatizado',
      subtitle: 'Ingestão GeoVictoria • Cruzamento Multinível • Relatórios Oficiais & PDFs',
      icon: Store,
      badge: 'Ativo • 2026',
      badgeClass: 'badge-tag-active',
      isCarrefour: false,
      isProtege: false,
      isAtacadaoAssai: true
    },
    dia: {
      name: 'Supermercados Dia',
      title: 'Rede Dia - Fechamento de Faltas e Escalas',
      subtitle: 'Gestão de Ausências e Horas Trabalhadas • Próxima Fase',
      icon: ShoppingCart,
      badge: 'Em Implantação',
      badgeClass: 'badge-tag-future',
      isCarrefour: false,
      isProtege: false,
      isButanta: false
    },
    butanta: {
      name: 'Shopping Butantã',
      title: 'Shopping Butantã - Gestão Operacional de Presenças & Faltas',
      subtitle: 'Acompanhamento Diário por Turnos • Leitor Inteligente WhatsApp • Apoio Noite & Banheirista • Relatórios Oficiais Excel',
      icon: Store,
      badge: 'Ativo • 2026',
      badgeClass: 'badge-tag-active',
      isCarrefour: false,
      isProtege: false,
      isButanta: true
    }
  };

  const client = clientsInfo[clientCode] || clientsInfo.carrefour;
  const ClientIcon = client.icon;

  const tabsCarrefour = [
    { id: 'fechamento', label: 'Fechamento Mensal (20 a 19)', icon: CalendarCheck2 },
    { id: 'detalhe', label: 'Detalhe (Datas & Escalas)', icon: FileSpreadsheet },
    { id: 'whatsapp', label: 'Leitor WhatsApp (Parser)', icon: MessageSquare },
    { id: 'emails', label: 'E-mails por Regional', icon: Mail },
    { id: 'tarifas', label: 'Lojas & Tarifas ($/falta)', icon: Store },
    { id: 'historico', label: 'Histórico no Banco', icon: History },
  ];

  const tabsProtege = [
    { id: 'fechamento', label: 'Fechamento Mensal Protege', icon: CalendarCheck2 },
    { id: 'whatsapp', label: 'Leitor WhatsApp (Parser)', icon: MessageSquare },
    { id: 'emails', label: 'Gerador de E-mails', icon: Mail },
    { id: 'tarifas', label: 'Filiais & Contatos ($)', icon: Store },
    { id: 'historico', label: 'Histórico no Banco', icon: History },
  ];

  const tabsButanta = [
    { id: 'quadro', label: 'Quadro & Presenças', icon: CalendarCheck2 },
    { id: 'leitor', label: 'Leitor WhatsApp (Parser)', icon: MessageSquare },
    { id: 'shoppings', label: 'Shoppings Atendidos', icon: Store },
    { id: 'exportacoes', label: 'Exportações Excel & CSV', icon: FileSpreadsheet },
    { id: 'historico', label: 'Histórico no Banco', icon: History },
  ];

  if (client.isButanta) {
    return (
      <FechamentoButanta 
        showToast={showToast}
        onVoltar={onVoltar}
      />
    );
  }

  return (
    <div>
      {/* Header do Cliente com abas internas */}
      <div className="client-workspace-header">
        <div className="client-header-title">
          <div className="client-badge-logo">
            <button 
              className="btn btn-secondary btn-sm"
              onClick={onVoltar}
              title="Voltar para a tela de Clientes (Início)"
              style={{ marginRight: '6px' }}
            >
              <ArrowLeft size={16} />
              <span>Voltar</span>
            </button>

            <div className="client-logo-box">
              <ClientIcon size={26} />
            </div>

            <div className="client-name-details">
              <h1>{client.title}</h1>
              <p>{client.subtitle}</p>
            </div>
          </div>

          <div>
            <span className={`card-ref-badge ${client.badgeClass}`} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              {client.badge}
            </span>
          </div>
        </div>

        {/* Abas internas do Card do Cliente */}
        {client.isCarrefour ? (
          <div className="client-nav-tabs">
            {tabsCarrefour.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`client-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (tab.id === 'whatsapp') {
                      onOpenWhatsAppModal();
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : client.isProtege ? (
          <div className="client-nav-tabs">
            {tabsProtege.map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`client-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (tab.id === 'whatsapp') {
                      onOpenWhatsAppModal();
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : client.isButanta ? (
          <div className="client-nav-tabs">
            {tabsButanta.map(tab => {
              const TabIcon = tab.icon;
              const isActive = (activeTab === 'fechamento' && tab.id === 'quadro') || activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`client-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="client-nav-tabs">
            <button className="client-tab-btn active">
              <Sparkles size={16} />
              <span>Visão Geral & Cadastro de Filiais</span>
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {client.isCarrefour ? (
        <div>
          {activeTab === 'fechamento' && (
            <FechamentoCarrefour 
              key={`fechamento-tab-${activeTab}`}
              showToast={showToast}
              fechamentoAtivo={fechamentoAtivo}
              setFechamentoAtivo={setFechamentoAtivo}
              onNavigateToDetalhe={() => setActiveTab('detalhe')}
            />
          )}

          {activeTab === 'detalhe' && (
            <DetalheGerador 
              key={`detalhe-tab-${activeTab}`}
              fechamentoAtivo={fechamentoAtivo}
              showToast={showToast}
            />
          )}

          {activeTab === 'emails' && (
            <EmailsRegionaisModal 
              fechamentoAtivo={fechamentoAtivo}
              showToast={showToast}
              onClose={() => setActiveTab('fechamento')}
              isModal={false}
            />
          )}

          {activeTab === 'tarifas' && (
            <LojasConfig showToast={showToast} clientCode="carrefour" />
          )}

          {activeTab === 'historico' && (
            <HistoricoFechamentos 
              clientCode="carrefour"
              showToast={showToast}
              onSelectFechamento={(f) => {
                setFechamentoAtivo(f);
                setActiveTab('fechamento');
                showToast(`Fechamento "${f.titulo}" carregado no painel!`, 'info');
              }}
            />
          )}
        </div>
      ) : client.isProtege ? (
        <div>
          {activeTab === 'fechamento' && (
            <FechamentoProtege 
              key={`fechamento-protege-tab-${activeTab}`}
              showToast={showToast}
              fechamentoAtivo={fechamentoAtivo}
              setFechamentoAtivo={setFechamentoAtivo}
            />
          )}

          {activeTab === 'emails' && (
            <EmailsProtegeModal 
              fechamentoAtivo={fechamentoAtivo}
              showToast={showToast}
              onClose={() => setActiveTab('fechamento')}
              isModal={false}
            />
          )}

          {activeTab === 'tarifas' && (
            <LojasConfig showToast={showToast} clientCode="protege" />
          )}

          {activeTab === 'historico' && (
            <HistoricoFechamentos 
              clientCode="protege"
              showToast={showToast}
              onSelectFechamento={(f) => {
                setFechamentoAtivo(f);
                setActiveTab('fechamento');
                showToast(`Fechamento "${f.titulo}" carregado no painel!`, 'info');
              }}
            />
          )}
        </div>
      ) : client.isButanta ? (
        <div>
          {activeTab === 'historico' ? (
            <HistoricoFechamentos 
              clientCode="butanta"
              showToast={showToast}
              onSelectFechamento={(f) => {
                setFechamentoAtivo(f);
                setActiveTab('quadro');
                showToast(`Fechamento "${f.titulo}" selecionado!`, 'info');
              }}
            />
          ) : (
            <FechamentoButanta 
              key={`fechamento-butanta-${activeTab}`}
              showToast={showToast}
              activeInternalTab={activeTab === 'fechamento' ? 'quadro' : activeTab}
            />
          )}
        </div>
      ) : client.isAtacadaoAssai ? (
        <div>
          <FechamentoAtacadaoAssai showToast={showToast} />
        </div>
      ) : (
        /* Tela de clientes em implantação (Assaí & Atacadão, Dia) */
        <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'rgba(56, 189, 248, 0.1)', 
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px',
            color: 'var(--accent-cyan)'
          }}>
            <ClientIcon size={32} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '8px' }}>
            Módulo {client.name} em Configuração
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 24px', fontSize: '0.925rem' }}>
            A estrutura de banco de dados e APIs já está 100% pronta para receber o fechamento do <strong>{client.name}</strong>. Quando disponibilizar a planilha padrão e as regras de ciclo, poderemos cadastrar as filiais e configurar os parâmetros idênticos aos do Carrefour e Grupo Protege.
          </p>

          <div style={{ display: 'inline-flex', gap: '12px' }}>
            <button 
              className="btn btn-secondary"
              onClick={onVoltar}
            >
              Voltar ao Início
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => showToast('Módulo preparado para expansão!', 'info')}
            >
              <Plus size={16} />
              <span>Cadastrar Novas Lojas</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
