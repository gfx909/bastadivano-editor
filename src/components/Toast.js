import React, { useState, useCallback, useEffect } from 'react';

let _addToast = null;

export function toast(msg, type = 'info') {
  if (_addToast) _addToast(msg, type);
}
export const toastOk  = (msg) => toast(msg, 'success');
export const toastErr = (msg) => toast(msg, 'error');

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((msg, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => { _addToast = add; return () => { _addToast = null; }; }, [add]);

  const icons = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{icons[t.type]}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
