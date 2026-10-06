import React from 'react';
import { Wifi, Copy, Check, X, Smartphone, Laptop, Globe } from 'lucide-react';

export default function NetworkModal({ isOpen, onClose, showToast }) {
  if (!isOpen) return null;

  const localIp = '10.1.1.116';
  const urlFrontend = `http://${localIp}:5173`;
  const urlBackend = `http://${localIp}:8000/api/`;

  const copiarUrl = (url, label) => {
    navigator.clipboard.writeText(url);
    showToast(`${label} copiado! Envie para seus colegas.`, 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <Wifi size={22} color="#10b981" />
            <span>Acesso na Mesma Rede Wi-Fi</span>
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Qualquer pessoa conectada na mesma rede Wi-Fi da empresa ou roteador que o seu computador pode acessar o sistema diretamente pelo navegador:
          </p>

          <div style={{ background: '#080d1a', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                Link de Acesso para Colegas (Frontend)
              </span>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => copiarUrl(urlFrontend, 'Link do Painel')}
              >
                <Copy size={13} />
                <span>Copiar Link</span>
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--accent-cyan)', fontWeight: '700', wordBreak: 'break-all' }}>
              {urlFrontend}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Laptop size={16} color="#06b6d4" />
              <span>Como seus colegas acessam:</span>
            </h4>
            <ol style={{ paddingLeft: '18px', color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: '1.6' }}>
              <li>Conecte o celular ou notebook no mesmo Wi-Fi da empresa;</li>
              <li>Abra o Chrome, Edge ou Safari;</li>
              <li>Acesse o endereço: <strong style={{ color: 'var(--text-main)' }}>{urlFrontend}</strong>;</li>
              <li>Pronto! Eles poderão preencher faltas, baixar planilhas e copiar e-mails em tempo real sem instalar nada.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={onClose}>
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
