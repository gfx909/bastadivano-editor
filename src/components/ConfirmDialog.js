import React from 'react';

export default function ConfirmDialog({ title, desc, onConfirm, onCancel, danger = true }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{danger ? '⚠️ ' : ''}{title}</span>
        </div>
        <div className="modal-body">
          <p className="confirm-desc">{desc}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Annulla</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {danger ? 'Elimina' : 'Conferma'}
          </button>
        </div>
      </div>
    </div>
  );
}
