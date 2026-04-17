import React, { useState } from 'react';
import LibreriaEditor from './components/LibreriaEditor';
import SchedeEditor from './components/SchedeEditor';
import ToastContainer from './components/Toast';
import './App.css';

export default function App() {
  const [sezione, setSezione] = useState('libreria');

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏋️</span>
          <div>
            <div className="brand-name">BastaDivano!</div>
            <div className="brand-sub">Editor PC</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${sezione === 'libreria' ? 'active' : ''}`}
            onClick={() => setSezione('libreria')}
          >
            <span className="nav-icon">📚</span>
            <span>Libreria Esercizi</span>
          </button>
          <button
            className={`nav-item ${sezione === 'schede' ? 'active' : ''}`}
            onClick={() => setSezione('schede')}
          >
            <span className="nav-icon">📅</span>
            <span>Schede Allenamento</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="help-box">
            <div className="help-title">💡 Come usare</div>
            <p>Collega il telefono via USB. Apri i JSON da <code>BastaDivano/</code>, modifica, salva.</p>
            <p className="help-warn">⚠️ Richiede Chrome o Edge (per accesso diretto ai file)</p>
            <p style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              Su altri browser scarica il file modificato anziché sovrascriverlo.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Contenuto principale ── */}
      <main className="main-content">
        {sezione === 'libreria' && <LibreriaEditor />}
        {sezione === 'schede'   && <SchedeEditor />}
      </main>

      <ToastContainer />
    </div>
  );
}
