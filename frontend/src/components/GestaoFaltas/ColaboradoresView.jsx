import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Search, 
  CheckCircle2,
  Building,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';

export default function ColaboradoresView({ showToast }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [terminos, setTerminos] = useState({ proximos_45_dias: [], proximos_90_dias: [] });
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('todos'); // 'todos' ou 'terminos'

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [colabs, term] = await Promise.all([
        api.getColaboradores(),
        api.getTerminosExperiencia()
      ]);
      setColaboradores(colabs);
      setTerminos(term);
    } catch (err) {
      showToast('Erro ao carregar colaboradores: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const filtrados = colaboradores.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.loja_nome && c.loja_nome.toLowerCase().includes(busca.toLowerCase())) ||
    (c.cargo && c.cargo.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <div>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>
            <Users size={26} color="#06b6d4" />
            <span>Base de Colaboradores & Términos de Experiência</span>
          </h2>
          <p>
            Acompanhe o quadro de funcionários operacionais das filiais e prazos contratuais de 45 e 90 dias.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn btn-sm ${abaAtiva === 'todos' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaAtiva('todos')}
          >
            Quadro Geral
          </button>
          <button 
            className={`btn btn-sm ${abaAtiva === 'terminos' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAbaAtiva('terminos')}
          >
            <Clock size={14} />
            <span>Términos de Experiência</span>
          </button>
        </div>
      </div>

      {abaAtiva === 'terminos' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          {/* 1º Período - 45 dias */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={18} />
              <span>Vencimento de 45 Dias (Próximos 30 dias)</span>
            </h3>
            {terminos.proximos_45_dias?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum contrato vencendo nos próximos dias.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.825rem' }}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Loja</th>
                      <th>Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terminos.proximos_45_dias.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: '600' }}>{c.nome}</td>
                        <td>{c.loja_nome}</td>
                        <td style={{ color: 'var(--accent-amber)', fontWeight: '700' }}>{c.termino_experiencia_45}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2º Período - 90 dias */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <AlertTriangle size={18} />
              <span>Vencimento de 90 Dias (Efetivação Definitiva)</span>
            </h3>
            {terminos.proximos_90_dias?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nenhum contrato atingindo 90 dias nos próximos dias.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '0.825rem' }}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Loja</th>
                      <th>Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terminos.proximos_90_dias.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: '600' }}>{c.nome}</td>
                        <td>{c.loja_nome}</td>
                        <td style={{ color: '#f87171', fontWeight: '700' }}>{c.termino_experiencia_90}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Total: <strong>{colaboradores.length} colaboradores</strong>
            </span>

            <input 
              type="text" 
              placeholder="Buscar por colaborador ou loja..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="form-input"
              style={{ width: '280px', padding: '6px 12px' }}
            />
          </div>

          {loading ? (
            <div className="loading-box">
              <div className="spinner"></div>
              <p>Carregando colaboradores...</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Loja / Filial</th>
                    <th>Regional</th>
                    <th>Cargo</th>
                    <th style={{ textAlign: 'center' }}>1º Venc. (45d)</th>
                    <th style={{ textAlign: 'center' }}>2º Venc. (90d)</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        Nenhum colaborador encontrado.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: '600' }}>{c.nome}</td>
                        <td>{c.loja_nome || 'Central'}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{c.regiao_nome || '-'}</td>
                        <td>{c.cargo}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {c.termino_experiencia_45 || '-'}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          {c.termino_experiencia_90 || '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge-active card-badge">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
