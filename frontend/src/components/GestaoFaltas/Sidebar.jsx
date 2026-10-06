import React from 'react';
import { 
  LayoutGrid, 
  Building2, 
  Store, 
  ShoppingCart, 
  ShieldCheck, 
  History, 
  LogOut, 
  Sparkles,
  Wifi
} from 'lucide-react';

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  selectedClient, 
  setSelectedClient,
  onOpenNetworkModal,
  collapsed 
}) {
  const irParaHome = () => {
    setSelectedClient(null);
    setActiveView('home');
  };

  const irParaCliente = (clientCode) => {
    setSelectedClient(clientCode);
    setActiveView('client_hub');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Top Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Sparkles size={20} />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <h2>Sistema Operacional</h2>
            <span>Fechamento de Faltas</span>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-content">
        {/* GERAL */}
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-title">Geral</div>}
          <button 
            className={`sidebar-item ${activeView === 'home' && !selectedClient ? 'active' : ''}`}
            onClick={irParaHome}
            title="Início"
          >
            <div className="sidebar-item-left">
              <LayoutGrid size={18} />
              {!collapsed && <span>Início</span>}
            </div>
          </button>
        </div>

        {/* CLIENTES DE FECHAMENTO */}
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-title">Clientes de Fechamento</div>}
          
          <button 
            className={`sidebar-item ${selectedClient === 'carrefour' ? 'active' : ''}`}
            onClick={() => irParaCliente('carrefour')}
            title="Carrefour (19 lojas)"
          >
            <div className="sidebar-item-left">
              <Building2 size={18} />
              {!collapsed && <span>Carrefour</span>}
            </div>
            {!collapsed && <span className="sidebar-item-badge">19 Lojas</span>}
          </button>

          <button 
            className={`sidebar-item ${selectedClient === 'assai_atacadao' ? 'active' : ''}`}
            onClick={() => irParaCliente('assai_atacadao')}
            title="Assaí & Atacadão (Juntos)"
          >
            <div className="sidebar-item-left">
              <Store size={18} />
              {!collapsed && <span>Assaí & Atacadão</span>}
            </div>
            {!collapsed && (
              <span className="sidebar-item-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                Motor 2.0
              </span>
            )}
          </button>

          <button 
            className={`sidebar-item ${selectedClient === 'dia' ? 'active' : ''}`}
            onClick={() => irParaCliente('dia')}
            title="Supermercados Dia"
          >
            <div className="sidebar-item-left">
              <ShoppingCart size={18} />
              {!collapsed && <span>Dia</span>}
            </div>
            {!collapsed && (
              <span className="sidebar-item-badge" style={{ background: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8' }}>
                Em breve
              </span>
            )}
          </button>

          <button 
            className={`sidebar-item ${selectedClient === 'protege' ? 'active' : ''}`}
            onClick={() => irParaCliente('protege')}
            title="Grupo Protege (16 lojas)"
          >
            <div className="sidebar-item-left">
              <ShieldCheck size={18} />
              {!collapsed && <span>Protege</span>}
            </div>
            {!collapsed && <span className="sidebar-item-badge">16 Lojas</span>}
          </button>

          <button 
            className={`sidebar-item ${selectedClient === 'butanta' ? 'active' : ''}`}
            onClick={() => irParaCliente('butanta')}
            title="Shopping Butantã (Quadro de Presenças & Faltas)"
          >
            <div className="sidebar-item-left">
              <Store size={18} />
              {!collapsed && <span>Shopping Butantã</span>}
            </div>
            {!collapsed && (
              <span className="sidebar-item-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                Quadro Ativo
              </span>
            )}
          </button>
        </div>

        {/* ANÁLISES */}
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-title">Análises</div>}
          
          <button 
            className={`sidebar-item ${activeView === 'historico_banco' ? 'active' : ''}`}
            onClick={() => { setSelectedClient(null); setActiveView('historico_banco'); }}
            title="Histórico de Fechamentos"
          >
            <div className="sidebar-item-left">
              <History size={18} />
              {!collapsed && <span>Histórico Fechamentos</span>}
            </div>
          </button>
        </div>
      </div>

      {/* Footer Profile */}
      <div className="sidebar-footer">
        <div className="user-profile-card">
          <div className="user-avatar">
            GA
          </div>
          {!collapsed && (
            <div className="user-info">
              <div className="user-name">gabriel.lopes</div>
              <div className="user-email">gabriel.marques@inoserv.com.br</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button 
            className="btn-sidebar-sair"
            onClick={onOpenNetworkModal}
            title="Ver link Wi-Fi"
            style={{ marginBottom: '6px' }}
          >
            <Wifi size={13} color="#10b981" />
            <span>Wi-Fi: 10.1.1.116</span>
          </button>
        )}

        {!collapsed && (
          <button 
            className="btn-sidebar-sair"
            onClick={() => alert('Sessão ativa no servidor local')}
          >
            <LogOut size={13} />
            <span>Sair</span>
          </button>
        )}
      </div>
    </aside>
  );
}
