import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import FechamentoButanta from '../components/GestaoFaltas/FechamentoButanta';
import Toast from '../components/GestaoFaltas/Toast';
import '../components/GestaoFaltas/gestaoFaltas.css';

export default function ButantaPage() {
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' }>({
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast({ message: '', type: 'success' });
    }, 4000);
  };

  return (
    <div className="w-full space-y-6">
      <FechamentoButanta showToast={showToast} onVoltar={undefined} />

      {toast.message && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: 'success' })}
        />
      )}
    </div>
  );
}
