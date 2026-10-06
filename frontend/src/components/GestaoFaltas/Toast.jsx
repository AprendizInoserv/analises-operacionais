import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  return (
    <div className="toast-container">
      <div className={`toast ${type}`}>
        {type === 'success' && <CheckCircle2 size={18} color="#10b981" />}
        {type === 'error' && <AlertCircle size={18} color="#f43f5e" />}
        {type === 'info' && <Info size={18} color="#06b6d4" />}
        <span>{message}</span>
      </div>
    </div>
  );
}
