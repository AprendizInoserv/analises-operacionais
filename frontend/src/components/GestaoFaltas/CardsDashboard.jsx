import React from 'react';
import { 
  Building2, 
  Store, 
  ShoppingCart, 
  ShieldCheck, 
  History, 
  TrendingUp,
  FileSpreadsheet,
  PlusCircle,
  ArrowRight
} from 'lucide-react';

export default function CardsDashboard({ 
  onSelectClient, 
  setActiveView,
  kpis 
}) {
  const clientCards = [
    {
      id: 'carrefour',
      title: 'Fechamento Carrefour',
      subtitle: 'Fechamento Oficial (Ciclo 20 a 19)',
      description: 'Fechamento operacional com 19 filiais ativas, recebimento de faltas via WhatsApp, cálculo de descontos, planilha Excel oficial e e-mails regionais.',
      icon: Building2,
      badge: 'Ativo',
      badgeClass: 'badge-tag-active',
      actionText: 'Acessar Painel →',
      onClick: () => onSelectClient('carrefour')
    },
    {
      id: 'assai_atacadao',
      title: 'Fechamento Assaí & Atacadão',
      subtitle: 'Motor Automatizado 2.0',
      description: 'Ingestão direta do GeoVictoria, cruzamento determinístico em 4 níveis, apuração de presenças, folgas e ocorrências, geração de Excel e PDFs em ZIP.',
      icon: Store,
      badge: 'Ativo',
      badgeClass: 'badge-tag-active',
      actionText: 'Acessar Painel →',
      onClick: () => onSelectClient('assai_atacadao')
    },
    {
      id: 'dia',
      title: 'Fechamento Dia',
      subtitle: 'Rede Dia',
      description: 'Fechamento operacional de faltas e escalas da rede Dia, apuração de postos e consolidação mensal de ausências.',
      icon: ShoppingCart,
      badge: 'Em Breve',
      badgeClass: 'badge-tag-future',
      actionText: 'Acessar Painel →',
      onClick: () => onSelectClient('dia')
    },
    {
      id: 'protege',
      title: 'Fechamento Protege',
      subtitle: 'Grupo Protege Oficial',
      description: 'Fechamento operacional com 16 filiais ativas, registro de respostas via WhatsApp, gerador de e-mails oficial, edição de faltas/tarifas e exportação Excel.',
      icon: ShieldCheck,
      badge: 'Ativo',
      badgeClass: 'badge-tag-active',
      actionText: 'Acessar Painel →',
      onClick: () => onSelectClient('protege')
    },
    {
      id: 'butanta',
      title: 'Shopping Butantã',
      subtitle: 'Quadro de Presenças & Faltas',
      description: 'Gestão diária por turnos (Manhã, Tarde, Noite), apuração de faltas, folgas, atestados, apoio noturno e banheirista com parser inteligente de WhatsApp e relatórios Excel.',
      icon: Store,
      badge: 'Ativo',
      badgeClass: 'badge-tag-active',
      actionText: 'Acessar Painel →',
      onClick: () => onSelectClient('butanta')
    },
    {
      id: 'historico_banco',
      title: 'Histórico de Fechamentos',
      subtitle: 'Banco de Dados',
      description: 'Consulte todos os fechamentos passados salvos no banco de dados, compare métricas mensais e baixe as planilhas oficiais em Excel.',
      icon: History,
      badge: 'Ativo',
      badgeClass: 'badge-tag-active',
      actionText: 'Acessar Painel →',
      onClick: () => setActiveView('historico_banco')
    }
  ];

  return (
    <div>
      {/* Top Banner KPI summary */}
      {kpis && (
        <div className="kpi-row">
          <div className="kpi-card">
            <div className="kpi-icon">
              <Building2 size={24} />
            </div>
            <div className="kpi-info">
              <h4>Lojas Carrefour</h4>
              <div className="kpi-value">{kpis.total_lojas_ativas || 19} filiais</div>
              <div className="kpi-sub">Cadastradas com tarifas ativas</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">
              <TrendingUp size={24} />
            </div>
            <div className="kpi-info">
              <h4>Faltas Registradas</h4>
              <div className="kpi-value">{kpis.total_faltas_acumuladas || 0} ausências</div>
              <div className="kpi-sub">Total histórico acumulado</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#f43f5e', background: 'rgba(244, 63, 94, 0.15)' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div className="kpi-info">
              <h4>Desconto Total</h4>
              <div className="kpi-value" style={{ color: '#f87171' }}>
                R$ {(kpis.total_descontos_acumulados || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="kpi-sub">Calculado no banco de dados</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Section Header */}
      <div className="home-section-header">
        <h2>Acesso Rápido aos Recursos</h2>
        <p>Selecione o cliente abaixo para acessar o painel de apuração, tarifas e fechamento de faltas.</p>
      </div>

      {/* Cards Grid */}
      <div className="cards-grid-reference">
        {clientCards.map((card) => {
          const Icon = card.icon;
          return (
            <div 
              key={card.id} 
              className="resource-card-ref"
              onClick={card.onClick}
            >
              <div>
                <div className="card-ref-top">
                  <div className="card-ref-icon-box">
                    <Icon size={20} />
                  </div>
                  <span className={`card-ref-badge ${card.badgeClass}`}>
                    {card.badge}
                  </span>
                </div>

                <div className="card-ref-content">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </div>

              <div className="card-ref-action">
                <span>{card.actionText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
