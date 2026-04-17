import React, { useState, useCallback } from 'react';
import {
  openJsonFile, saveJsonFile, saveAsJsonFile, generateUUID,
  schedaVuota, bloccoVuoto, configEsercizioVuoto, OBIETTIVI
} from '../utils';
import ConfirmDialog from './ConfirmDialog';
import { toastOk, toastErr } from './Toast';

export default function SchedeEditor() {
  const [fileHandle, setFileHandle]   = useState(null);
  const [fileName, setFileName]       = useState(null);
  const [scheda, setScheda]           = useState(null);
  const [modified, setModified]       = useState(false);
  const [bloccoAperto, setBloccoAperto] = useState(null); // id blocco espanso
  const [toDelete, setToDelete]       = useState(null);
  const [libreriaEsercizi, setLibreriaEsercizi] = useState(null);

  const mark = () => setModified(true);

  // ── Apri scheda JSON ──────────────────────────────────
  const handleOpen = async () => {
    if (modified && !window.confirm('Modifiche non salvate. Continuare?')) return;
    const result = await openJsonFile('Scheda allenamento JSON');
    if (!result) return;
    const data = result.data;
    if (data.tipo !== 'scheda' || !data.scheda) {
      toastErr('File non valido: non è una scheda BastaDivano');
      return;
    }
    // Normalizza: ensure blocchi have esercizi_config
    const blocchi = (data.blocchi || []).map(b => ({
      ...b,
      esercizi_config: b.esercizi_config || [],
    }));
    setFileHandle(result.handle);
    setFileName(result.fileName);
    setScheda({ ...data.scheda, blocchi });
    setModified(false);
    setBloccoAperto(blocchi[0]?.id || null);
    toastOk(`Aperto: ${result.fileName}`);
  };

  // ── Apri libreria esercizi (per autocomplete) ─────────
  const handleOpenLibreria = async () => {
    const result = await openJsonFile('Libreria esercizi JSON');
    if (!result || !result.data.esercizi) return;
    setLibreriaEsercizi(result.data.esercizi);
    toastOk(`Libreria caricata: ${result.data.esercizi.length} esercizi`);
  };

  // ── Nuova scheda ──────────────────────────────────────
  const handleNuova = () => {
    if (modified && !window.confirm('Modifiche non salvate. Continuare?')) return;
    const s = schedaVuota('Nuova Scheda');
    setScheda({ ...s, blocchi: [] });
    setFileHandle(null);
    setFileName('nuova_scheda.json');
    setModified(false);
  };

  // ── Salva ─────────────────────────────────────────────
  const toJsonData = (s) => ({
    versione: '1.0',
    tipo: 'scheda',
    data_export: new Date().toISOString(),
    scheda: {
      id: s.id, nome: s.nome, obiettivo: s.obiettivo,
      numero_cicli: s.numero_cicli, durata_ciclo_giorni: s.durata_ciclo_giorni,
      stato: s.stato, data_creazione: s.data_creazione,
    },
    blocchi: s.blocchi.map(b => ({
      id: b.id, scheda_id: s.id, nome: b.nome,
      tipologia: b.tipologia || 'normale', ordine: b.ordine,
      esercizi_config: (b.esercizi_config || []).map(cfg => ({
        id: cfg.id, blocco_id: b.id,
        esercizio_nome: cfg.esercizio_nome,
        esercizio_id: cfg.esercizio_id || '',
        ordine: cfg.ordine,
        numero_serie: cfg.numero_serie,
        ripetute_serie: cfg.ripetute_serie,
        cedimento_serie: cfg.cedimento_serie,
        secondi_riposo: cfg.secondi_riposo,
        alternative_ids: cfg.alternative_ids || '',
      })),
    })),
  });

  const handleSave = async () => {
    if (!scheda) return;
    const ok = await saveJsonFile(fileHandle, toJsonData(scheda), fileName || 'scheda.json');
    if (ok) { setModified(false); toastOk('Salvato!'); }
    else toastErr('Errore nel salvataggio');
  };

  const handleSaveAs = async () => {
    if (!scheda) return;
    const safeName = scheda.nome.replace(/[^a-zA-Z0-9_]/g, '_');
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const handle = await saveAsJsonFile(toJsonData(scheda), `${safeName}_${dateStr}.json`);
    if (handle) { setFileHandle(handle); setModified(false); toastOk('Salvato con nome!'); }
  };

  // ── Modifica meta-scheda ──────────────────────────────
  const setMeta = (field, value) => {
    setScheda(prev => ({ ...prev, [field]: value }));
    mark();
  };

  // ── Blocchi ───────────────────────────────────────────
  const addBlocco = () => {
    const b = bloccoVuoto(scheda.id, scheda.blocchi.length);
    b.nome = `Giorno ${scheda.blocchi.length + 1}`;
    setScheda(prev => ({ ...prev, blocchi: [...prev.blocchi, b] }));
    setBloccoAperto(b.id);
    mark();
  };

  const updateBlocco = (id, field, value) => {
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.map(b => b.id === id ? { ...b, [field]: value } : b),
    }));
    mark();
  };

  const deleteBlocco = (id) => {
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.filter(b => b.id !== id).map((b, i) => ({ ...b, ordine: i })),
    }));
    if (bloccoAperto === id) setBloccoAperto(null);
    mark();
  };

  const moveBlocco = (id, dir) => {
    setScheda(prev => {
      const blocchi = [...prev.blocchi];
      const idx = blocchi.findIndex(b => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= blocchi.length) return prev;
      [blocchi[idx], blocchi[newIdx]] = [blocchi[newIdx], blocchi[idx]];
      return { ...prev, blocchi: blocchi.map((b, i) => ({ ...b, ordine: i })) };
    });
    mark();
  };

  // ── Esercizi nel blocco ───────────────────────────────
  const addEsercizio = (bloccoId) => {
    const cfg = configEsercizioVuoto(bloccoId);
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.map(b =>
        b.id === bloccoId
          ? { ...b, esercizi_config: [...(b.esercizi_config || []), { ...cfg, ordine: (b.esercizi_config || []).length }] }
          : b
      ),
    }));
    mark();
  };

  const updateEsercizio = (bloccoId, cfgId, field, value) => {
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.map(b =>
        b.id !== bloccoId ? b : {
          ...b,
          esercizi_config: b.esercizi_config.map(cfg =>
            cfg.id === cfgId ? { ...cfg, [field]: value } : cfg
          ),
        }
      ),
    }));
    mark();
  };

  const deleteEsercizio = (bloccoId, cfgId) => {
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.map(b =>
        b.id !== bloccoId ? b : {
          ...b,
          esercizi_config: b.esercizi_config
            .filter(cfg => cfg.id !== cfgId)
            .map((cfg, i) => ({ ...cfg, ordine: i })),
        }
      ),
    }));
    mark();
  };

  const moveEsercizio = (bloccoId, cfgId, dir) => {
    setScheda(prev => ({
      ...prev,
      blocchi: prev.blocchi.map(b => {
        if (b.id !== bloccoId) return b;
        const cfgs = [...b.esercizi_config];
        const idx = cfgs.findIndex(c => c.id === cfgId);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= cfgs.length) return b;
        [cfgs[idx], cfgs[newIdx]] = [cfgs[newIdx], cfgs[idx]];
        return { ...b, esercizi_config: cfgs.map((c, i) => ({ ...c, ordine: i })) };
      }),
    }));
    mark();
  };

  // ── Render ────────────────────────────────────────────
  if (!scheda) return (
    <div className="empty-state">
      <div className="empty-icon">📅</div>
      <div className="empty-title">Nessuna scheda aperta</div>
      <div className="empty-desc">
        Apri un file <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>NomeScheda_DATA.json</code> dalla cartella
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)', marginLeft: 4 }}>BastaDivano/schede/</code>, oppure crea una nuova scheda.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleOpen}>📂 Apri scheda</button>
        <button className="btn btn-ghost" onClick={handleNuova}>✨ Nuova scheda</button>
      </div>
    </div>
  );

  const statoColor = { attiva: '#27ae60', bozza: '#e67e22', terminata: '#8890bb' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <span className="toolbar-title">SCHEDE</span>
        <div className="toolbar-sep" />
        <span className="toolbar-info">
          📄 {fileName}{modified ? ' •' : ''} &nbsp;|&nbsp; {scheda.blocchi.length} blocchi
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" title="Carica libreria esercizi per autocomplete" onClick={handleOpenLibreria}>
          📚 {libreriaEsercizi ? `Libreria (${libreriaEsercizi.length})` : 'Carica libreria...'}
        </button>
        <div className="toolbar-sep" />
        <button className="btn btn-ghost btn-sm" onClick={handleOpen}>📂 Apri</button>
        <button className="btn btn-ghost btn-sm" onClick={handleNuova}>✨ Nuova</button>
        <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={!modified}>💾 Salva</button>
        <button className="btn btn-ghost btn-sm" onClick={handleSaveAs}>💾 Salva con nome</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {/* ── Meta-scheda ── */}
        <div style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field-group" style={{ flex: '2 1 200px' }}>
              <label className="field-label">Nome scheda *</label>
              <input className="input" value={scheda.nome} onChange={e => setMeta('nome', e.target.value)} placeholder="Es. Forza Base 3 giorni" />
            </div>
            <div className="field-group" style={{ flex: '2 1 180px' }}>
              <label className="field-label">Obiettivo</label>
              <select className="select" value={scheda.obiettivo || ''} onChange={e => setMeta('obiettivo', e.target.value)}>
                <option value="">— scegli —</option>
                {OBIETTIVI.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field-group" style={{ flex: '1 1 100px' }}>
              <label className="field-label">N. cicli</label>
              <input className="input" type="number" min={1} max={52}
                value={scheda.numero_cicli || 4} onChange={e => setMeta('numero_cicli', +e.target.value)} />
            </div>
            <div className="field-group" style={{ flex: '1 1 100px' }}>
              <label className="field-label">Durata ciclo (gg)</label>
              <input className="input" type="number" min={1} max={30}
                value={scheda.durata_ciclo_giorni || 7} onChange={e => setMeta('durata_ciclo_giorni', +e.target.value)} />
            </div>
            <div className="field-group" style={{ flex: '1 1 110px' }}>
              <label className="field-label">Stato</label>
              <select className="select" value={scheda.stato || 'bozza'} onChange={e => setMeta('stato', e.target.value)}
                style={{ color: statoColor[scheda.stato] || 'inherit' }}>
                <option value="bozza">Bozza</option>
                <option value="attiva">Attiva</option>
                <option value="terminata">Terminata</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Blocchi ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Blocchi / Giorni
          </span>
          <button className="btn btn-green btn-sm" onClick={addBlocco}>➕ Aggiungi blocco</button>
        </div>

        {scheda.blocchi.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
            Nessun blocco. Clicca "Aggiungi blocco" per iniziare.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scheda.blocchi.map((b, bi) => (
            <BloccoCard
              key={b.id}
              blocco={b}
              index={bi}
              total={scheda.blocchi.length}
              aperto={bloccoAperto === b.id}
              libreriaEsercizi={libreriaEsercizi}
              onToggle={() => setBloccoAperto(prev => prev === b.id ? null : b.id)}
              onUpdate={(field, val) => updateBlocco(b.id, field, val)}
              onDelete={() => deleteBlocco(b.id)}
              onMoveUp={() => moveBlocco(b.id, -1)}
              onMoveDown={() => moveBlocco(b.id, 1)}
              onAddEs={() => addEsercizio(b.id)}
              onUpdateEs={(cfgId, field, val) => updateEsercizio(b.id, cfgId, field, val)}
              onDeleteEs={(cfgId) => deleteEsercizio(b.id, cfgId)}
              onMoveEs={(cfgId, dir) => moveEsercizio(b.id, cfgId, dir)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Blocco Card ───────────────────────────────────────────
function BloccoCard({ blocco, index, total, aperto, libreriaEsercizi,
  onToggle, onUpdate, onDelete, onMoveUp, onMoveDown,
  onAddEs, onUpdateEs, onDeleteEs, onMoveEs }) {

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      {/* Header blocco */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
        onClick={onToggle}>
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 24 }}>
          {(index + 1).toString().padStart(2, '0')}
        </span>
        <input
          className="input"
          value={blocco.nome}
          onChange={e => { e.stopPropagation(); onUpdate('nome', e.target.value); }}
          onClick={e => e.stopPropagation()}
          placeholder="Nome blocco / giorno (es. Giorno A - Push)"
          style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', padding: '0 4px' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {(blocco.esercizi_config || []).length} esercizi
        </span>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button className="btn-icon" onClick={onMoveUp} disabled={index === 0} title="Su" style={{ fontSize: 12 }}>↑</button>
          <button className="btn-icon" onClick={onMoveDown} disabled={index === total - 1} title="Giù" style={{ fontSize: 12 }}>↓</button>
          <button className="btn-icon" onClick={onDelete} title="Elimina blocco" style={{ color: 'var(--red)', fontSize: 12 }}>🗑</button>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{aperto ? '▲' : '▼'}</span>
      </div>

      {/* Body blocco (espanso) */}
      {aperto && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
          {(blocco.esercizi_config || []).map((cfg, ci) => (
            <EsercizioRow
              key={cfg.id}
              cfg={cfg}
              index={ci}
              total={(blocco.esercizi_config || []).length}
              libreriaEsercizi={libreriaEsercizi}
              onUpdate={(field, val) => onUpdateEs(cfg.id, field, val)}
              onDelete={() => onDeleteEs(cfg.id)}
              onMoveUp={() => onMoveEs(cfg.id, -1)}
              onMoveDown={() => onMoveEs(cfg.id, 1)}
            />
          ))}
          {(blocco.esercizi_config || []).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
              Nessun esercizio. Aggiungine uno.
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={onAddEs}>
            ➕ Aggiungi esercizio
          </button>
        </div>
      )}
    </div>
  );
}

// ── Riga esercizio nel blocco ─────────────────────────────
function EsercizioRow({ cfg, index, total, libreriaEsercizi, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [showSuggest, setShowSuggest] = useState(false);

  const suggest = libreriaEsercizi
    ? libreriaEsercizi.filter(e =>
        e.nome.toLowerCase().includes((cfg.esercizio_nome || '').toLowerCase())
      ).slice(0, 8)
    : [];

  const ripsStr = Array.isArray(cfg.ripetute_serie)
    ? cfg.ripetute_serie.join(',')
    : cfg.ripetute_serie || '';

  const handleRips = (val) => {
    const arr = val.split(',').map(s => {
      const n = parseInt(s.trim(), 10);
      return isNaN(n) ? s.trim() : n;
    });
    onUpdate('ripetute_serie', arr);
    // Sincronizza numero serie
    onUpdate('numero_serie', arr.length);
    onUpdate('cedimento_serie', Array(arr.length).fill(false));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
      borderBottom: '1px solid var(--border)30' }}>
      {/* Numero ordine */}
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 22 }}>
        {index + 1}.
      </span>

      {/* Nome esercizio con autocomplete */}
      <div style={{ position: 'relative', flex: 3 }}>
        <input
          className="input"
          value={cfg.esercizio_nome || ''}
          onChange={e => { onUpdate('esercizio_nome', e.target.value); setShowSuggest(true); }}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          onFocus={() => setShowSuggest(true)}
          placeholder="Nome esercizio..."
          style={{ fontSize: 12 }}
        />
        {showSuggest && suggest.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            maxHeight: 180, overflowY: 'auto', boxShadow: 'var(--shadow-md)' }}>
            {suggest.map(e => (
              <div key={e.id}
                style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-secondary)' }}
                onMouseDown={() => { onUpdate('esercizio_nome', e.nome); onUpdate('esercizio_id', e.id); setShowSuggest(false); }}
                onMouseEnter={ev => ev.target.style.background = 'var(--bg-hover)'}
                onMouseLeave={ev => ev.target.style.background = 'transparent'}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{e.nome}</span>
                {e.strumentazione && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>{e.strumentazione}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* N. serie */}
      <div style={{ minWidth: 60 }}>
        <input className="input" type="number" min={1} max={20}
          value={cfg.numero_serie || 3}
          onChange={e => onUpdate('numero_serie', +e.target.value)}
          title="N. serie"
          style={{ fontSize: 12, textAlign: 'center' }}
        />
      </div>

      {/* Ripetizioni */}
      <div style={{ flex: 2 }}>
        <input className="input"
          value={ripsStr}
          onChange={e => handleRips(e.target.value)}
          placeholder="Es: 10,10,8"
          title="Ripetizioni per serie (separate da virgola)"
          style={{ fontSize: 12 }}
        />
      </div>

      {/* Riposo sec */}
      <div style={{ minWidth: 70 }}>
        <input className="input" type="number" min={0} max={600} step={15}
          value={cfg.secondi_riposo || 90}
          onChange={e => onUpdate('secondi_riposo', +e.target.value)}
          title="Secondi riposo"
          style={{ fontSize: 12, textAlign: 'center' }}
        />
      </div>

      {/* Controlli */}
      <div style={{ display: 'flex', gap: 2, minWidth: 88 }}>
        <button className="btn-icon" onClick={onMoveUp} disabled={index === 0} title="Su" style={{ fontSize: 11 }}>↑</button>
        <button className="btn-icon" onClick={onMoveDown} disabled={index === total - 1} title="Giù" style={{ fontSize: 11 }}>↓</button>
        <button className="btn-icon" onClick={onDelete} title="Elimina" style={{ color: 'var(--red)', fontSize: 11 }}>✕</button>
      </div>
    </div>
  );
}
