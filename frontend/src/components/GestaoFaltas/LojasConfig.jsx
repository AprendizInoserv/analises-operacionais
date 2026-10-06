import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Save, 
  Plus, 
  Search, 
  DollarSign, 
  RefreshCw, 
  Percent,
  Check,
  Edit2
} from 'lucide-react';
import { api } from '../../services/api';

export default function LojasConfig({ showToast, clientCode }) {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [reajustePct, setReajustePct] = useState('');

  const carregarLojas = async () => {
    setLoading(true);
    try {
      const data = await api.getLojas();
      setLojas(data);
    } catch (err) {
      showToast('Erro ao carregar lojas: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLojas();
  }, []);

  const handlePriceChange = (lojaId, novoValor) => {
    setLojas(prev => prev.map(l => {
      if (l.id === lojaId) {
        return { ...l, desconto_por_falta: novoValor };
      }
      return l;
    }));
  };

  const salvarPrecos = async () => {
    setSaving(true);
    try {
      const payload = lojas.map(l => ({
        id: l.id,
        desconto_por_falta: parseFloat(l.desconto_por_falta) || 0
      }));
      await api.atualizarPrecosLote(payload);
      showToast('Tarifas de faltas atualizadas com sucesso!', 'success');
      carregarLojas();
    } catch (err) {
      showToast('Erro ao salvar tarifas: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const aplicarReajusteGeral = () => {
    const pct = parseFloat(reajustePct);
    if (isNaN(pct) || pct === 0) {
      showToast('Informe uma porcentagem válida (ex: 5 para +5% ou -3 para -3%)', 'error');
      return;
    }
    const fator = 1 + (pct / 100);
    setLojas(prev => prev.map(l => {
      const valAtual = parseFloat(l.desconto_por_falta) || 0;
      const novoVal = (valAtual * fator).toFixed(4);
      return { ...l, desconto_por_falta: novoVal };
    }));
    showToast(`Reajuste de ${pct > 0 ? '+' : ''}${pct}% aplicado na tela. Clique em Salvar para persistir.`, 'info');
    setReajustePct('');
  };

  const lojasFiltradas = lojas.filter(l => {
    if (clientCode === 'protege') {
      if (!l.cliente_nome?.toLowerCase().includes('protege') && !l.nome?.toLowerCase().includes('protege')) return false;
    } else if (clientCode === 'carrefour') {
      if (!l.cliente_nome?.toLowerCase().includes('carrefour') && l.nome?.toLowerCase().includes('protege')) return false;
    }
    return (
      l.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (l.regiao_nome && l.regiao_nome.toLowerCase().includes(busca.toLowerCase())) ||
      (l.supervisor && l.supervisor.toLowerCase().includes(busca.toLowerCase()))
    );
  });

  return (
    <div>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>
            <Store size={26} color="#06b6d4" />
            <span>Gerenciamento de Lojas & Tarifas de Faltas</span>
          </h2>
          <p>
            Configure o valor unitário cobrado por cada ausência em cada loja do Carrefour e de outros clientes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={carregarLojas}
          >
            <RefreshCw size={15} />
            <span>Recarregar</span>
          </button>

          <button 
            className="btn btn-primary btn-sm"
            onClick={salvarPrecos}
            disabled={saving}
          >
            <Save size={16} />
            <span>{saving ? 'Gravando...' : 'Salvar Todas as Tarifas'}</span>
          </button>
        </div>
      </div>

      {/* Assistente de Reajuste em Massa */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Percent size={18} color="#06b6d4" />
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>
              Reajuste Rápido Percentual (Convenção Coletiva / Dissídio):
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="number" 
              step="0.1"
              placeholder="Ex: 5.5 (%)" 
              value={reajustePct}
              onChange={(e) => setReajustePct(e.target.value)}
              className="form-input"
              style={{ width: '130px', padding: '6px 12px' }}
            />
            <button 
              className="btn btn-secondary btn-sm"
              onClick={aplicarReajusteGeral}
            >
              Aplicar em Todas
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Lojas */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Total de filiais: <strong>{lojas.length} lojas</strong>
          </span>

          <input 
            type="text" 
            placeholder="Filtrar por loja ou região..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="form-input"
            style={{ width: '260px', padding: '6px 12px' }}
          />
        </div>

        {loading ? (
          <div className="loading-box">
            <div className="spinner"></div>
            <p>Carregando lojas e preços...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  <th>Loja / Filial</th>
                  <th>Regional</th>
                  <th style={{ textAlign: 'right' }}>Valor Desconto por Falta (R$)</th>
                  <th>Supervisor / Contato</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lojasFiltradas.map((loja, idx) => (
                  <tr key={loja.id}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '600' }}>{loja.nome}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{loja.regiao_nome}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>R$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={loja.desconto_por_falta}
                          onChange={(e) => handlePriceChange(loja.id, e.target.value)}
                          className="form-input input-price"
                        />
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                      {loja.supervisor || 'Operacional'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge-active card-badge">
                        Ativa
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
