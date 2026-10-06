import React from 'react';
import { Menu, Sun, Wifi, ChevronRight } from 'lucide-react';

export default function Topbar({ 
  onToggleSidebar, 
  activeView, 
  selectedClient, 
  onOpenNetworkModal 
}) {
  const getBreadcrumb = () => {
    if (selectedClient === 'carrefour') {
      return (
        <div className="breadcrumb-nav">
          <span>Clientes</span>
          <ChevronRight size={13} />
          <span>Carrefour</span>
          <ChevronRight size={13} />
          <span className="current">Fechamento de Faltas (20 a 19)</span>
        </div>
      );
    }
    if (selectedClient === 'assai_atacadao') {
      return (
        <div className="breadcrumb-nav">
          <span>Clientes</span>
          <ChevronRight size={13} />
          <span>Assaí & Atacadão</span>
          <ChevronRight size={13} />
          <span className="current">Módulo Unificado</span>
        </div>
      );
    }
    if (selectedClient === 'dia') {
      return (
        <div className="breadcrumb-nav">
          <span>Clientes</span>
          <ChevronRight size={13} />
          <span>Supermercados Dia</span>
          <ChevronRight size={13} />
          <span className="current">Fechamento de Ausências</span>
        </div>
      );
    }
    if (selectedClient === 'protege') {
      return (
        <div className="breadcrumb-nav">
          <span>Clientes</span>
          <ChevronRight size={13} />
          <span>Grupo Protege</span>
          <ChevronRight size={13} />
          <span className="current">Fechamento de Postos</span>
        </div>
      );
    }
    if (selectedClient === 'butanta') {
      return (
        <div className="breadcrumb-nav">
          <span>Clientes</span>
          <ChevronRight size={13} />
          <span>Shopping Butantã</span>
          <ChevronRight size={13} />
          <span className="current">Quadro de Presenças & Faltas</span>
        </div>
      );
    }

    const viewNames = {
      home: 'Início',
      historico_banco: 'Histórico de Fechamentos'
    };

    return (
      <div className="breadcrumb-nav">
        <span>Geral</span>
        <ChevronRight size={13} />
        <span className="current">{viewNames[activeView] || 'Início'}</span>
      </div>
    );
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button 
          className="btn-toggle-sidebar" 
          onClick={onToggleSidebar}
          title="Alternar barra lateral"
        >
          <Menu size={18} />
        </button>

        {getBreadcrumb()}
      </div>

      <div className="topbar-right">
        <button 
          className="badge-network-pill"
          onClick={onOpenNetworkModal}
          title="Clique para ver link de compartilhamento no Wi-Fi"
        >
          <span className="pulse-dot"></span>
          <Wifi size={13} />
          <span>Wi-Fi: 10.1.1.116</span>
        </button>

        <button 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          title="Tema"
        >
          <Sun size={16} />
        </button>

        <div className="topbar-user-badge">
          Logado como: <strong>gabriel.lopes</strong>
        </div>
      </div>
    </header>
  );
}
