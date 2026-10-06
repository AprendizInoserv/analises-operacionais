import React from 'react';
import { 
  Building2, 
  LayoutGrid, 
  CalendarCheck2, 
  MessageSquare, 
  Store, 
  Mail, 
  History, 
  Users, 
  Wifi
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenNetworkModal }) {
  const tabs = [
    { id: 'dashboard', label: 'Início (Recursos)', icon: LayoutGrid },
    { id: 'carrefour', label: 'Fechamento Carrefour', icon: CalendarCheck2 },
    { id: 'whatsapp', label: 'Registro WhatsApp', icon: MessageSquare },
    { id: 'lojas', label: 'Lojas & Tarifas', icon: Store },
    { id: 'emails', label: 'E-mails Regionais', icon: Mail },
    { id: 'historico', label: 'Histórico no Banco', icon: History },
    { id: 'colaboradores', label: 'Colaboradores', icon: Users },
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="nav-brand" onClick={() => setActiveTab('dashboard')}>
          <div className="brand-icon-box">
            <Building2 size={22} />
          </div>
          <div className="brand-text">
            <h1>Gestão de Faltas</h1>
            <span>Painel Operacional 2026</span>
          </div>
        </div>

        <nav className="nav-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="nav-right-actions">
          <button 
            className="badge-network" 
            title="Clique para ver link de compartilhamento no Wi-Fi"
            onClick={onOpenNetworkModal}
          >
            <span className="pulse-dot"></span>
            <Wifi size={14} />
            <span>Wi-Fi: 10.1.1.116</span>
          </button>
        </div>
      </div>
    </header>
  );
}
