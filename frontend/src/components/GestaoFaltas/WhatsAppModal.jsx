import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ClipboardPaste,
  FileCheck
} from 'lucide-react';
import { api } from '../../services/api';

export default function WhatsAppModal({ 
  isOpen, 
  onClose, 
  fechamentoAtivo, 
  onSuccess, 
  showToast 
}) {
  const [texto, setTexto] = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const preencherExemplo = () => {
    setTexto(
`Respostas do WhatsApp - Fechamento Carrefour:
Guarujá: 0 faltas
Santos: 0 faltas
Praia Grande: 0 faltas
Santos Praiamar: 0 faltas
São Vicente: 0 faltas
DF - ASA SUL I: 0
DF - ASA SUL II: 3 faltas
DF - ASA NORTE II: 0
DF - LAGO SUL: 2 faltas
DF - ASA NORTE IV: 0
DF - BOM MOTIVO: 1 falta
CD BRASILIA: 0
BRASÍLIA SUL: 0
BRASÍLIA ASA NORTE: 15 faltas
GOIÂNIA ANÁPOLIS: 0
GOIÂNIA SUL: 0
GOIÂNIA SUDOESTE: 0
CAMPO GRANDE: 21 faltas
JUIZ DE FORA: 18 faltas`
    );
  };

  const colarDaAreaDeTransferencia = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setTexto(clipText);
        showToast('Texto colado da área de transferência!', 'info');
      }
    } catch (err) {
      showToast('Permissão de colagem negada pelo navegador. Use Ctrl+V no campo.', 'error');
    }
  };

  const processarTexto = async (aplicarDiretamente = false) => {
    if (!texto.trim()) {
      showToast('Por favor, digite ou cole as mensagens do WhatsApp.', 'error');
      return;
    }
    if (!fechamentoAtivo) {
      showToast('Nenhum fechamento selecionado.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.parseWhatsApp(fechamentoAtivo.id, texto, aplicarDiretamente);
      setResultado(res);
      if (aplicarDiretamente) {
        showToast(`${res.total_reconhecidas} lojas atualizadas com sucesso no fechamento!`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(`${res.total_reconhecidas} lojas reconhecidas! Revise e clique em Aplicar.`, 'info');
      }
    } catch (err) {
      showToast('Erro ao processar texto: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <MessageSquare size={22} color="#06b6d4" />
            <span>Leitor Inteligente de Respostas do WhatsApp</span>
          </h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '14px' }}>
            Cole aqui as mensagens recebidas no WhatsApp com as ausências das filiais. O sistema reconhece os nomes das lojas e os números de faltas automaticamente!
          </p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={colarDaAreaDeTransferencia}
            >
              <ClipboardPaste size={14} />
              <span>Colar (Ctrl+V)</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={preencherExemplo}
            >
              <Sparkles size={14} color="#06b6d4" />
              <span>Preencher Exemplo Real</span>
            </button>
          </div>

          <div className="form-group">
            <textarea
              className="form-textarea"
              rows={8}
              placeholder="Cole as mensagens do WhatsApp aqui... Exemplo:&#10;Guarujá: 0 faltas&#10;Santos: 2 faltas&#10;Brasília Asa Norte: 15&#10;Campo Grande: 21 faltas"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>

          {resultado && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                background: 'var(--bg-surface-elevated)', 
                padding: '12px 16px', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-subtle)',
                marginBottom: '12px'
              }}>
                <div style={{ flex: 1, color: '#34d399', fontWeight: '600', fontSize: '0.85rem' }}>
                  ✓ {resultado.total_reconhecidas} lojas identificadas
                </div>
                {resultado.total_nao_reconhecidas > 0 && (
                  <div style={{ flex: 1, color: '#fbbf24', fontWeight: '600', fontSize: '0.85rem' }}>
                    ⚠ {resultado.total_nao_reconhecidas} linhas não mapeadas
                  </div>
                )}
              </div>

              {/* Tabela de Previsualização */}
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Loja Identificada</th>
                      <th>Região</th>
                      <th style={{ textAlign: 'center' }}>Faltas Detectadas</th>
                      <th style={{ textAlign: 'right' }}>Desconto Calculado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.reconhecidas.map((rec, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>{rec.loja_nome}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{rec.regiao_nome}</td>
                        <td style={{ textAlign: 'center', fontWeight: '700' }}>{rec.faltas_detectadas}</td>
                        <td style={{ textAlign: 'right' }} className="currency-cell">
                          R$ {rec.desconto_calculado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>

            <button 
              className="btn btn-outline-cyan"
              onClick={() => processarTexto(false)}
              disabled={loading}
            >
              <Sparkles size={16} />
              <span>{loading ? 'Analisando...' : 'Analisar e Pré-visualizar'}</span>
            </button>

            <button 
              className="btn btn-primary"
              onClick={() => processarTexto(true)}
              disabled={loading}
            >
              <FileCheck size={16} />
              <span>{loading ? 'Aplicando...' : 'Aplicar ao Fechamento'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
