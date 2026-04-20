import React, { useState, useEffect } from 'react';
import LibreriaEditor from './components/LibreriaEditor';
import SchedeEditor from './components/SchedeEditor';
import ToastContainer from './components/Toast';
import './App.css';

export default function App() {
  const [sezione, setSezione] = useState('libreria');
  const [tema, setTema] = useState(() =>
    localStorage.getItem('bd-tema') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema);
    localStorage.setItem('bd-tema', tema);
  }, [tema]);

  const toggleTema = () => setTema(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🏋️</span>
          <div style={{ flex: 1 }}>
            <div className="brand-name">BastaDivano!</div>
            <div className="brand-sub">Editor PC</div>
          </div>
          {/* Toggle tema */}
          <button onClick={toggleTema} title={tema === 'dark' ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '4px 8px', cursor: 'pointer', fontSize: 16, lineHeight: 1,
              color: 'var(--text-secondary)', transition: 'all 0.15s' }}>
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${sezione === 'libreria' ? 'active' : ''}`}
            onClick={() => setSezione('libreria')}>
            <span className="nav-icon">📚</span><span>Libreria Esercizi</span>
          </button>
          <button className={`nav-item ${sezione === 'schede' ? 'active' : ''}`}
            onClick={() => setSezione('schede')}>
            <span className="nav-icon">📅</span><span>Schede Allenamento</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="help-box">
            <div className="help-title">💡 Come usare</div>
            <p>Collega il telefono via USB. Apri i JSON da <code>BastaDivano/</code>, modifica, salva.</p>
            <p className="help-warn">⚠️ Richiede Chrome o Edge</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {sezione === 'libreria' && <LibreriaEditor />}
        {sezione === 'schede'   && <SchedeEditor />}
      </main>

      <ToastContainer />
    </div>
  );
}
