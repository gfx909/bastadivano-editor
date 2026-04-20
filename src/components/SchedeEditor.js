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
  const [libreriaTipologie, setLibreriaTipologie] = useState([]);

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
    setLibreriaTipologie(result.data.tipologie || []);
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
              libreriaTipologie={libreriaTipologie}
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

// ── Selettore esercizi dalla libreria ────────────────────
function EsercizioPickerModal({ libreria, tipologie, onPick, onClose, titolo, escludi = [] }) {
  const [cerca, setCerca]         = React.useState('');
  const [filtroTip, setFiltroTip] = React.useState('');

  // Se non abbiamo tipologie dalla libreria, le ricaviamo dagli esercizi
  const tips = React.useMemo(() => {
    if (tipologie && tipologie.length > 0) return tipologie;
    // Fallback: costruisce tipologie minimali dagli UUID
    const map = new Map();
    (libreria || []).forEach(e => {
      const ids = (e.categorie_ids || e.tipologia_id || '').split(',').filter(Boolean);
      ids.forEach(id => { if (!map.has(id)) map.set(id, { id, nome: id, emoji: '💪' }); });
    });
    return [...map.values()];
  }, [tipologie, libreria]);

  const results = React.useMemo(() => {
    if (!libreria) return [];
    const q = cerca.toLowerCase().trim();
    return libreria.filter(e => !escludi.includes(e.id)).filter(e => {
      const catStr = e.categorie_ids || e.tipologia_id || '';
      const inCat = !filtroTip || catStr.split(',').map(s => s.trim()).includes(filtroTip);
      if (!inCat) return false;
      if (!q) return true;
      const tokens = q.split(/\s+/);
      const hay = [e.nome, e.nome_ufficiale_it, e.nome_ufficiale_en,
        e.muscoli, e.strumentazione].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    }).slice(0, 100);
  }, [libreria, cerca, filtroTip]);

  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 660, height: '85vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">📚 {titolo || 'Scegli esercizio dalla libreria'}</span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Ricerca + filtro */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Barra ricerca */}
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input className="search-input" autoFocus
              placeholder="Cerca nome, muscolo, attrezzo... (es: panca bilanciere)"
              value={cerca} onChange={e => setCerca(e.target.value)} />
          </div>

          {/* Chip filtro tipologia */}
          {tips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {/* Chip "Tutte" */}
              <button
                onClick={() => setFiltroTip('')}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', border: '1px solid',
                  background: filtroTip === '' ? 'var(--accent)' : 'transparent',
                  borderColor: filtroTip === '' ? 'var(--accent)' : 'var(--border)',
                  color: filtroTip === '' ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.12s ease',
                }}>
                Tutte
              </button>

              {tips.map(t => {
                const sel = filtroTip === t.id;
                return (
                  <button key={t.id}
                    onClick={() => setFiltroTip(sel ? '' : t.id)}
                    style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      background: sel ? 'var(--accent)' : 'var(--bg-card)',
                      borderColor: sel ? 'var(--accent)' : 'var(--border)',
                      color: sel ? 'white' : 'var(--text-secondary)',
                      transition: 'all 0.12s ease',
                    }}>
                    {t.emoji && t.emoji !== t.id ? `${t.emoji} ` : ''}{t.nome}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lista risultati */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {cerca || filtroTip
                ? `Nessun risultato${filtroTip ? ' per questa categoria' : ''}${cerca ? ` con "${cerca}"` : ''}`
                : 'Carica la libreria per cercare gli esercizi'}
            </div>
          ) : (
            results.map(e => (
              <PickerRow key={e.id} esercizio={e} onPick={onPick} />
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{results.length} risultati{filtroTip ? ` in "${tips.find(t=>t.id===filtroTip)?.nome || filtroTip}"` : ''}</span>
          <span>ESC per chiudere</span>
        </div>
      </div>
    </div>
  );
}

function PickerRow({ esercizio: e, onPick }) {
  const [imgOk, setImgOk] = React.useState(null);
  const imgUrl = e._id_originale
    ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e._id_originale}/0.jpg`
    : null;

  const LIVELLO_COLOR = { principiante:'#27ae60', intermedio:'#e67e22', avanzato:'#e74c3c' };

  return (
    <div onClick={() => onPick(e)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        borderBottom: '1px solid var(--border)30', cursor: 'pointer',
        transition: 'background 0.1s' }}
      onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
    >
      {/* Thumbnail */}
      <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {imgUrl ? (
          <img src={imgUrl} alt="" loading="lazy"
            style={{ width: 44, height: 44, objectFit: 'cover',
              display: imgOk === true ? 'block' : 'none' }}
            onLoad={() => setImgOk(true)}
            onError={() => setImgOk(false)}
          />
        ) : null}
        {imgOk !== true && <span style={{ fontSize: 20 }}>💪</span>}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{e.nome}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[e.nome_ufficiale_en, e.strumentazione, e.muscoli?.split('|')[0]?.trim()]
            .filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Livello */}
      {e.livello && (
        <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0,
          color: LIVELLO_COLOR[e.livello] || 'var(--text-muted)',
          background: (LIVELLO_COLOR[e.livello] || '#888') + '20',
          border: `1px solid ${(LIVELLO_COLOR[e.livello] || '#888')}40`,
          padding: '2px 7px', borderRadius: 10 }}>
          {e.livello}
        </span>
      )}

      {/* Pulsante aggiungi */}
      <span style={{ fontSize: 18, color: 'var(--accent-light)', flexShrink: 0 }}>＋</span>
    </div>
  );
}

// ── Blocco Card ───────────────────────────────────────────
function BloccoCard({ blocco, index, total, aperto, libreriaEsercizi, libreriaTipologie,
  onToggle, onUpdate, onDelete, onMoveUp, onMoveDown,
  onAddEs, onUpdateEs, onDeleteEs, onMoveEs }) {

  const [editingNome, setEditingNome] = React.useState(false);

  return (
    <div style={{ background: 'var(--bg-panel)', border: `1px solid ${aperto ? 'var(--accent)60' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)', transition: 'border-color 0.2s' }}>

      {/* ── Header blocco ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: aperto ? 'var(--accent)08' : 'transparent',
        borderRadius: aperto ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
        transition: 'background 0.2s' }}>

        {/* Numero */}
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          minWidth: 26, fontWeight: 700 }}>
          {(index + 1).toString().padStart(2, '0')}
        </span>

        {/* Nome blocco — visibilmente editabile */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={e => e.stopPropagation()}>
          <input
            className="input"
            value={blocco.nome}
            onChange={e => onUpdate('nome', e.target.value)}
            onFocus={() => setEditingNome(true)}
            onBlur={() => setEditingNome(false)}
            placeholder="✏️ Nome blocco / giorno (es. Giorno A – Push)"
            style={{
              flex: 1,
              background: editingNome ? 'var(--bg-input)' : 'transparent',
              border: editingNome ? '1px solid var(--accent)' : '1px dashed var(--border)',
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              padding: '4px 8px', borderRadius: 'var(--radius-sm)',
              transition: 'all 0.15s ease', cursor: 'text',
            }}
          />
        </div>

        {/* Badge esercizi */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0,
          background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 10,
          border: '1px solid var(--border)' }}>
          {(blocco.esercizi_config || []).length} es.
        </span>

        {/* Controlli */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button className="btn-icon" onClick={onMoveUp} disabled={index === 0}
            title="Sposta su" style={{ fontSize: 12 }}>↑</button>
          <button className="btn-icon" onClick={onMoveDown} disabled={index === total - 1}
            title="Sposta giù" style={{ fontSize: 12 }}>↓</button>
          <button className="btn-icon" onClick={onDelete}
            title="Elimina blocco" style={{ color: 'var(--red)', fontSize: 12 }}>🗑</button>
        </div>

        {/* Toggle espandi/chiudi */}
        <button className="btn-icon" onClick={onToggle}
          style={{ fontSize: 13, borderColor: aperto ? 'var(--accent)40' : 'var(--border)',
            color: aperto ? 'var(--accent-light)' : 'var(--text-muted)' }}>
          {aperto ? '▲' : '▼'}
        </button>
      </div>

      {/* ── Body blocco (espanso) ── */}
      {aperto && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0 14px 14px' }}>
          {/* Intestazione colonne */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 0 4px',
            borderBottom: '1px solid var(--border)40', marginBottom: 4 }}>
            <span style={{ minWidth: 26 }} />
            <span style={{ flex: 3, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.6px', textTransform: 'uppercase' }}>Esercizio</span>
            <span style={{ minWidth: 64, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.6px', textTransform: 'uppercase', textAlign: 'center' }}>N.Serie</span>
            <span style={{ minWidth: 72, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              letterSpacing: '0.6px', textTransform: 'uppercase', textAlign: 'center' }}>Riposo(s)</span>
            <span style={{ minWidth: 92 }} />
          </div>

          {(blocco.esercizi_config || []).map((cfg, ci) => (
            <EsercizioRow
              key={cfg.id}
              cfg={cfg}
              index={ci}
              total={(blocco.esercizi_config || []).length}
              libreriaEsercizi={libreriaEsercizi}
              libreriaTipologie={libreriaTipologie}
              onUpdate={(field, val) => onUpdateEs(cfg.id, field, val)}
              onDelete={() => onDeleteEs(cfg.id)}
              onMoveUp={() => onMoveEs(cfg.id, -1)}
              onMoveDown={() => onMoveEs(cfg.id, 1)}
            />
          ))}

          {(blocco.esercizi_config || []).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
              padding: '16px 0 8px' }}>
              Nessun esercizio ancora.
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
function EsercizioRow({ cfg, index, total, libreriaEsercizi, libreriaTipologie, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [showSuggest, setShowSuggest] = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [showAltPicker, setShowAltPicker] = useState(false);

  const query = (cfg.esercizio_nome || '').toLowerCase().trim();
  const suggest = React.useMemo(() => {
    if (!libreriaEsercizi || !query) return [];
    const tokens = query.split(/\s+/);
    return libreriaEsercizi.filter(e => {
      const hay = [e.nome, e.nome_ufficiale_it, e.nome_ufficiale_en,
        e.muscoli, e.strumentazione].join(' ').toLowerCase();
      return tokens.every(t => hay.includes(t));
    }).slice(0, 10);
  }, [libreriaEsercizi, query]);

  const handlePick = (esercizio) => {
    onUpdate('esercizio_nome', esercizio.nome);
    onUpdate('esercizio_id', esercizio.id);
    setShowPicker(false);
    setShowSuggest(false);
  };

  // Gestione alternativi: array di { id, nome }
  const altIds = React.useMemo(() => {
    const raw = cfg.alternative_ids || '';
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }, [cfg.alternative_ids]);

  const altNomi = React.useMemo(() => {
    if (!libreriaEsercizi) return altIds.map(id => ({ id, nome: id }));
    return altIds.map(id => {
      const e = libreriaEsercizi.find(e => e.id === id);
      return { id, nome: e ? e.nome : id };
    });
  }, [altIds, libreriaEsercizi]);

  const handlePickAlt = (esercizio) => {
    if (altIds.includes(esercizio.id)) return; // già presente
    const newIds = [...altIds, esercizio.id].join(',');
    onUpdate('alternative_ids', newIds);
    setShowAltPicker(false);
  };

  const removeAlt = (id) => {
    onUpdate('alternative_ids', altIds.filter(a => a !== id).join(','));
  };

  const matched = libreriaEsercizi?.find(e =>
    e.nome.toLowerCase() === (cfg.esercizio_nome || '').toLowerCase());
  const thumbUrl = matched?._id_originale
    ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${matched._id_originale}/0.jpg`
    : null;

  return (
    <>
      {/* ── Riga principale esercizio ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0 3px',
        borderBottom: altNomi.length === 0 ? '1px solid var(--border)25' : 'none' }}>

        {/* Numero */}
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
          minWidth: 26, textAlign: 'right' }}>{index + 1}.</span>

        {/* Nome + autocomplete + pulsante libreria */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', gap: 4 }}>
          {thumbUrl && (
            <img src={thumbUrl} alt="" loading="lazy"
              style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover',
                flexShrink: 0, border: '1px solid var(--border)' }}
              onError={e => e.target.style.display = 'none'} />
          )}
          <div style={{ position: 'relative', flex: 1 }}>
            <input className="input" value={cfg.esercizio_nome || ''}
              onChange={e => { onUpdate('esercizio_nome', e.target.value); setShowSuggest(true); }}
              onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
              onFocus={() => setShowSuggest(true)}
              placeholder="Scrivi o cerca dalla libreria →"
              style={{ fontSize: 12, paddingRight: 28 }} />
            {libreriaEsercizi && (
              <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                fontSize: 10, color: 'var(--accent-light)', pointerEvents: 'none' }}>⌄</span>
            )}
            {showSuggest && suggest.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                background: 'var(--bg-panel)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', maxHeight: 220, overflowY: 'auto',
                boxShadow: 'var(--shadow-md)', marginTop: 2 }}>
                {suggest.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', cursor: 'pointer' }}
                    onMouseDown={() => handlePick(e)}
                    onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                    {e._id_originale && (
                      <img src={`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${e._id_originale}/0.jpg`}
                        alt="" loading="lazy" onError={ev => ev.target.style.display='none'}
                        style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nome}</div>
                      {e.strumentazione && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.strumentazione}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn-icon" onClick={() => setShowPicker(true)}
            title={libreriaEsercizi ? 'Sfoglia libreria' : 'Carica prima la libreria'}
            disabled={!libreriaEsercizi}
            style={{ fontSize: 14, padding: '4px 7px',
              color: libreriaEsercizi ? 'var(--accent-light)' : 'var(--text-muted)',
              borderColor: libreriaEsercizi ? 'var(--accent)40' : 'var(--border)' }}>📚</button>
        </div>

        {/* N. serie */}
        <div style={{ minWidth: 64 }}>
          <input className="input" type="number" min={1} max={20}
            value={cfg.numero_serie || 3}
            onChange={e => {
              const n = +e.target.value;
              onUpdate('numero_serie', n);
              const rips = Array.isArray(cfg.ripetute_serie) ? [...cfg.ripetute_serie] : [10,10,10];
              const ced  = Array.isArray(cfg.cedimento_serie) ? [...cfg.cedimento_serie] : [];
              const iso  = Array.isArray(cfg.ipertrofia_secondi) ? [...cfg.ipertrofia_secondi] : [];
              while (rips.length < n) rips.push(rips[rips.length-1] || 10);
              while (ced.length  < n) ced.push(false);
              while (iso.length  < n) iso.push(null);
              onUpdate('ripetute_serie',   rips.slice(0, n));
              onUpdate('cedimento_serie',  ced.slice(0, n));
              onUpdate('ipertrofia_secondi', iso.slice(0, n));
            }}
            title="N. serie" style={{ fontSize: 12, textAlign: 'center' }} />
        </div>

        {/* Riposo */}
        <div style={{ minWidth: 72 }}>
          <input className="input" type="number" min={0} max={600} step={15}
            value={cfg.secondi_riposo || 90}
            onChange={e => onUpdate('secondi_riposo', +e.target.value)}
            title="Secondi di riposo" style={{ fontSize: 12, textAlign: 'center' }} />
        </div>

        {/* Controlli */}
        <div style={{ display: 'flex', gap: 2, minWidth: 92 }}>
          <button className="btn-icon" onClick={onMoveUp} disabled={index === 0} title="Su" style={{ fontSize: 11 }}>↑</button>
          <button className="btn-icon" onClick={onMoveDown} disabled={index === total - 1} title="Giù" style={{ fontSize: 11 }}>↓</button>
          <button className="btn-icon" onClick={onDelete} title="Rimuovi" style={{ color: 'var(--red)', fontSize: 11 }}>✕</button>
        </div>
      </div>

      {/* ── Alternativi ── */}
      <div style={{ marginLeft: 34, marginBottom: 4, display: 'flex', flexWrap: 'wrap',
        gap: 5, alignItems: 'center',
        borderBottom: '1px solid var(--border)25', paddingBottom: 6 }}>
        {altNomi.map(alt => {
          const altE = libreriaEsercizi?.find(e => e.id === alt.id);
          const altThumb = altE?._id_originale
            ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${altE._id_originale}/0.jpg`
            : null;
          return (
            <div key={alt.id} style={{ display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '2px 6px 2px 4px', fontSize: 11 }}>
              {altThumb && (
                <img src={altThumb} alt="" loading="lazy"
                  style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                  onError={e => e.target.style.display='none'} />
              )}
              <span style={{ color: 'var(--text-secondary)' }}>⇄ {alt.nome}</span>
              <button onClick={() => removeAlt(alt.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 11, padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
          );
        })}
        <button onClick={() => setShowAltPicker(true)}
          disabled={!libreriaEsercizi}
          title={libreriaEsercizi ? 'Aggiungi alternativo' : 'Carica prima la libreria'}
          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, cursor: 'pointer',
            background: 'transparent', border: '1px dashed var(--border)',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
          ＋ alternativo
        </button>
      </div>

      {/* ── Dettaglio serie ── */}
      <SerieEditor cfg={cfg} onUpdate={onUpdate} />

      {/* Pickers */}
      {showPicker && libreriaEsercizi && (
        <EsercizioPickerModal libreria={libreriaEsercizi} tipologie={libreriaTipologie}
          onPick={handlePick} onClose={() => setShowPicker(false)} />
      )}
      {showAltPicker && libreriaEsercizi && (
        <EsercizioPickerModal libreria={libreriaEsercizi} tipologie={libreriaTipologie}
          titolo="Scegli esercizio alternativo"
          escludi={[cfg.esercizio_id, ...altIds].filter(Boolean)}
          onPick={handlePickAlt} onClose={() => setShowAltPicker(false)} />
      )}
    </>
  );
}

// ── Editor per-serie: rip + cedimento + isometria ─────────
function SerieEditor({ cfg, onUpdate }) {
  const n    = cfg.numero_serie || 3;
  const rips = Array.isArray(cfg.ripetute_serie)    ? cfg.ripetute_serie    : Array(n).fill(10);
  const ced  = Array.isArray(cfg.cedimento_serie)   ? cfg.cedimento_serie   : Array(n).fill(false);
  const iso  = Array.isArray(cfg.ipertrofia_secondi)? cfg.ipertrofia_secondi: Array(n).fill(null);

  const setRip = (i, val) => {
    const arr = [...rips]; arr[i] = val === '' ? '' : (parseInt(val, 10) || val);
    onUpdate('ripetute_serie', arr);
  };
  const setCed = (i, val) => {
    const arr = [...ced]; arr[i] = val;
    onUpdate('cedimento_serie', arr);
  };
  const setIso = (i, val) => {
    const arr = [...iso]; arr[i] = val === '' ? null : (parseInt(val, 10) || null);
    onUpdate('ipertrofia_secondi', arr);
  };

  // Controlla se almeno una serie ha cedimento o isometria → mostra sempre espanso
  const hasCed = ced.some(Boolean);
  const hasIso = iso.some(v => v !== null && v !== '');
  const [expanded, setExpanded] = React.useState(hasCed || hasIso);

  return (
    <div style={{ marginLeft: 34, marginBottom: 6 }}>
      {/* Header compatto con anteprima rip + toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: expanded ? 6 : 0 }}>
        {/* Anteprima ripetizioni compatta quando non espanso */}
        {!expanded && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <input
                  type="text" inputMode="numeric"
                  value={rips[i] ?? 10}
                  onChange={e => setRip(i, e.target.value)}
                  style={{ width: 36, padding: '3px 4px', textAlign: 'center', fontSize: 11,
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text-primary)' }}
                  title={`Ripetizioni serie ${i+1}`}
                />
                {i < n - 1 && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>,</span>}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded(v => !v)}
          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            background: (hasCed || hasIso) ? 'var(--accent)20' : 'transparent',
            border: `1px solid ${(hasCed || hasIso) ? 'var(--accent)50' : 'var(--border)'}`,
            color: (hasCed || hasIso) ? 'var(--accent-light)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4 }}
          title="Modifica ripetizioni, cedimento e isometria per ogni serie">
          {expanded ? '▲' : '▼'}
          {expanded ? ' Comprimi' : ' Dettaglio serie'}
          {(hasCed || hasIso) && <span style={{ fontSize: 9 }}>●</span>}
        </button>
      </div>

      {/* Griglia dettaglio serie */}
      {expanded && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, overflow: 'hidden' }}>
          {/* Intestazione */}
          <div style={{ display: 'grid',
            gridTemplateColumns: '28px 1fr 1fr 1fr',
            gap: 0, background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border)' }}>
            {['#', 'Ripetizioni', 'Cedimento', 'Isometria (sec)'].map((h, i) => (
              <div key={h} style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700,
                color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase',
                borderRight: i < 3 ? '1px solid var(--border)30' : 'none',
                textAlign: i === 0 ? 'center' : 'left' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Righe serie */}
          {Array.from({ length: n }, (_, i) => (
            <div key={i} style={{ display: 'grid',
              gridTemplateColumns: '28px 1fr 1fr 1fr',
              borderBottom: i < n - 1 ? '1px solid var(--border)20' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)10' }}>

              {/* N. serie */}
              <div style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11,
                fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                borderRight: '1px solid var(--border)30', display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                {i + 1}
              </div>

              {/* Ripetizioni */}
              <div style={{ padding: '5px 8px', borderRight: '1px solid var(--border)30',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="text" inputMode="numeric"
                  value={rips[i] ?? 10}
                  onChange={e => setRip(i, e.target.value)}
                  placeholder="10"
                  style={{ width: 52, padding: '4px 6px', textAlign: 'center', fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>rip</span>
              </div>

              {/* Cedimento */}
              <div style={{ padding: '5px 8px', borderRight: '1px solid var(--border)30',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', userSelect: 'none' }}>
                  <div onClick={() => setCed(i, !ced[i])}
                    style={{ width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
                      background: ced[i] ? 'var(--accent)' : 'var(--bg-input)',
                      border: `1px solid ${ced[i] ? 'var(--accent)' : 'var(--border)'}`,
                      position: 'relative', transition: 'all 0.15s ease', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 2, left: ced[i] ? 14 : 2,
                      width: 12, height: 12, borderRadius: '50%', background: 'white',
                      transition: 'left 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </div>
                  <span style={{ fontSize: 11,
                    color: ced[i] ? 'var(--accent-light)' : 'var(--text-muted)',
                    fontWeight: ced[i] ? 600 : 400 }}>
                    {ced[i] ? '🔥 Sì' : 'No'}
                  </span>
                </label>
              </div>

              {/* Isometria */}
              <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="number" min={0} max={300} step={5}
                  value={iso[i] ?? ''}
                  onChange={e => setIso(i, e.target.value)}
                  placeholder="—"
                  style={{ width: 52, padding: '4px 6px', textAlign: 'center', fontSize: 12,
                    background: (iso[i] !== null && iso[i] !== '') ? 'var(--accent)12' : 'var(--bg-input)',
                    border: `1px solid ${(iso[i] !== null && iso[i] !== '') ? 'var(--accent)60' : 'var(--border)'}`,
                    borderRadius: 4, color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>sec</span>
                {(iso[i] !== null && iso[i] !== '') && (
                  <span style={{ fontSize: 10, color: 'var(--accent-light)' }}>⏱</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
