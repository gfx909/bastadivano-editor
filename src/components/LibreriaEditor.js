import React, { useState, useMemo, useCallback } from 'react';
import {
  openJsonFile, saveJsonFile, saveAsJsonFile,
  generateUUID, fuzzyMatch, esercizioVuoto, catIdsToNomi, LIVELLI
} from '../utils';
import EsercizioModal from './EsercizioModal';
import ConfirmDialog from './ConfirmDialog';
import { toastOk, toastErr } from './Toast';

const LIVELLO_COLOR = {
  principiante: '#27ae60',
  intermedio:   '#e67e22',
  avanzato:     '#e74c3c',
};

export default function LibreriaEditor() {
  const [fileHandle, setFileHandle] = useState(null);
  const [fileName, setFileName]     = useState(null);
  const [libreria, setLibreria]     = useState(null); // { versione, tipo, tipologie, esercizi }
  const [modified, setModified]     = useState(false);

  const [cerca, setCerca]           = useState('');
  const [filtroTip, setFiltroTip]   = useState('');
  const [filtroLiv, setFiltroLiv]   = useState('');
  const [sortField, setSortField]   = useState('nome');
  const [sortDir, setSortDir]       = useState('asc');

  const [editingEs, setEditingEs]   = useState(null); // esercizio in modifica
  const [toDelete, setToDelete]     = useState(null);

  // ── Apri file ──────────────────────────────────────────
  const handleOpen = async () => {
    if (modified) {
      if (!window.confirm('Hai modifiche non salvate. Vuoi aprire un altro file senza salvare?')) return;
    }
    const result = await openJsonFile('Libreria esercizi JSON');
    if (!result) return;
    if (result.data.tipo !== 'libreria_esercizi' && !result.data.esercizi) {
      toastErr('File non valido: non è una libreria esercizi BastaDivano');
      return;
    }
    setFileHandle(result.handle);
    setFileName(result.fileName);
    setLibreria({
      versione: result.data.versione || '1.0',
      tipo: 'libreria_esercizi',
      data_export: result.data.data_export || new Date().toISOString(),
      tipologie: result.data.tipologie || [],
      esercizi: result.data.esercizi || [],
    });
    setModified(false);
    toastOk(`Aperto: ${result.fileName} (${(result.data.esercizi || []).length} esercizi)`);
  };

  // ── Nuova libreria vuota ──────────────────────────────
  const handleNuova = () => {
    if (modified && !window.confirm('Hai modifiche non salvate. Continuare?')) return;
    setLibreria({
      versione: '1.0',
      tipo: 'libreria_esercizi',
      data_export: new Date().toISOString(),
      tipologie: [
        { id: generateUUID(), nome: 'Petto',       emoji: '🏋️', immagine_path: null },
        { id: generateUUID(), nome: 'Dorso',        emoji: '🔙', immagine_path: null },
        { id: generateUUID(), nome: 'Gambe',        emoji: '🦵', immagine_path: null },
        { id: generateUUID(), nome: 'Spalle',       emoji: '🔝', immagine_path: null },
        { id: generateUUID(), nome: 'Braccia',      emoji: '💪', immagine_path: null },
        { id: generateUUID(), nome: 'Core',         emoji: '⚡', immagine_path: null },
        { id: generateUUID(), nome: 'Cardio',       emoji: '🚴', immagine_path: null },
        { id: generateUUID(), nome: 'Flessibilità', emoji: '🧘', immagine_path: null },
      ],
      esercizi: [],
    });
    setFileHandle(null);
    setFileName('nuova_libreria.json');
    setModified(false);
  };

  // ── Salva ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!libreria) return;
    const data = { ...libreria, data_export: new Date().toISOString() };
    const ok = await saveJsonFile(fileHandle, data, fileName || 'libreria_it.json');
    if (ok) { setModified(false); toastOk('Salvato!'); }
    else toastErr('Errore nel salvataggio');
  };

  const handleSaveAs = async () => {
    if (!libreria) return;
    const data = { ...libreria, data_export: new Date().toISOString() };
    const handle = await saveAsJsonFile(data, fileName || 'libreria_it.json');
    if (handle) { setFileHandle(handle); setModified(false); toastOk('Salvato con nome!'); }
  };

  // ── Modifica esercizio ────────────────────────────────
  const handleEdit = (e) => setEditingEs({ ...e });

  const handleNew = () => {
    const firstTip = libreria.tipologie[0];
    setEditingEs(esercizioVuoto(firstTip?.id || ''));
  };

  const handleSaveEs = useCallback((saved) => {
    setLibreria(prev => {
      const idx = prev.esercizi.findIndex(e => e.id === saved.id);
      const esercizi = idx >= 0
        ? prev.esercizi.map(e => e.id === saved.id ? saved : e)
        : [...prev.esercizi, saved];
      return { ...prev, esercizi };
    });
    setModified(true);
    setEditingEs(null);
    toastOk(saved.nome);
  }, []);

  const handleDelete = useCallback(() => {
    if (!toDelete) return;
    setLibreria(prev => ({
      ...prev,
      esercizi: prev.esercizi.filter(e => e.id !== toDelete.id),
    }));
    setModified(true);
    setToDelete(null);
    toastOk(`"${toDelete.nome}" eliminato`);
  }, [toDelete]);

  // ── Filtro + ordinamento ──────────────────────────────
  const filtered = useMemo(() => {
    if (!libreria) return [];
    let list = libreria.esercizi.filter(e =>
      fuzzyMatch(cerca, e.nome, e.nome_ufficiale_it, e.nome_ufficiale_en, e.muscoli, e.strumentazione) &&
      (filtroTip === '' || (e.categorie_ids || e.tipologia_id || '').includes(filtroTip)) &&
      (filtroLiv === '' || e.livello === filtroLiv)
    );
    list = [...list].sort((a, b) => {
      const va = (a[sortField] || '').toString().toLowerCase();
      const vb = (b[sortField] || '').toString().toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }, [libreria, cerca, filtroTip, filtroLiv, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortArrow = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  // ── Render ────────────────────────────────────────────
  if (!libreria) return (
    <div className="empty-state">
      <div className="empty-icon">📚</div>
      <div className="empty-title">Nessuna libreria aperta</div>
      <div className="empty-desc">
        Apri un file <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>libreria_it.json</code> dalla cartella
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)', marginLeft: 4 }}>BastaDivano/esercizi/</code>
        del telefono, oppure crea una nuova libreria da zero.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleOpen}>📂 Apri libreria.json</button>
        <button className="btn btn-ghost" onClick={handleNuova}>✨ Nuova libreria</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Toolbar ── */}
      <div className="toolbar">
        <span className="toolbar-title">LIBRERIA ESERCIZI</span>
        <div className="toolbar-sep" />
        <span className="toolbar-info">
          📄 {fileName}{modified ? ' •' : ''} &nbsp;|&nbsp; {filtered.length}/{libreria.esercizi.length} esercizi
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={handleOpen}>📂 Apri</button>
        <button className="btn btn-ghost btn-sm" onClick={handleNuova}>✨ Nuova</button>
        <div className="toolbar-sep" />
        <button className="btn btn-green btn-sm" onClick={handleNew}>➕ Aggiungi</button>
        <button className="btn btn-gold btn-sm" onClick={handleSave} disabled={!modified}>💾 Salva</button>
        <button className="btn btn-ghost btn-sm" onClick={handleSaveAs}>💾 Salva con nome</button>
      </div>

      {/* ── Filtri ── */}
      <div style={{ padding: '10px 16px', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Ricerca */}
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Cerca nome, muscolo, attrezzo..."
            value={cerca} onChange={e => setCerca(e.target.value)} />
        </div>

        {/* Filtro tipologia */}
        <select className="select" style={{ width: 160 }} value={filtroTip} onChange={e => setFiltroTip(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {libreria.tipologie.map(t => (
            <option key={t.id} value={t.id}>{t.emoji} {t.nome}</option>
          ))}
        </select>

        {/* Filtro livello */}
        <select className="select" style={{ width: 150 }} value={filtroLiv} onChange={e => setFiltroLiv(e.target.value)}>
          <option value="">Tutti i livelli</option>
          {LIVELLI.filter(Boolean).map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {(cerca || filtroTip || filtroLiv) && (
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setCerca(''); setFiltroTip(''); setFiltroLiv(''); }}>
            ✕ Reset filtri
          </button>
        )}
      </div>

      {/* ── Tabella ── */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-panel)', position: 'sticky', top: 0, zIndex: 10 }}>
              {[
                [null,            '',               52],
                ['nome',          'Nome',          220],
                ['nome_ufficiale_en', 'EN',         150],
                [null,            'Categorie',      130],
                ['strumentazione','Strumentazione', 120],
                ['livello',       'Livello',         90],
                ['muscoli',       'Muscoli',        170],
                [null,            'Azioni',          80],
              ].map(([field, label, w]) => (
                <th key={label}
                  style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase',
                    width: w, cursor: field ? 'pointer' : 'default',
                    borderBottom: '1px solid var(--border)',
                    userSelect: 'none',
                  }}
                  onClick={() => field && toggleSort(field)}
                >
                  {label}{field && sortArrow(field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <Row key={e.id} e={e} tipologie={libreria.tipologie} i={i}
                onEdit={() => handleEdit(e)}
                onDelete={() => setToDelete(e)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Nessun esercizio trovato
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modali ── */}
      {editingEs && (
        <EsercizioModal
          esercizio={editingEs}
          tipologie={libreria.tipologie}
          onSave={handleSaveEs}
          onClose={() => setEditingEs(null)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Elimina esercizio"
          desc={`Vuoi eliminare "${toDelete.nome}"? L'operazione non può essere annullata.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

// ── Funzione URL immagine da free-exercise-db ─────────────
function getImgUrl(esercizio, full = false) {
  const orig = esercizio._id_originale;
  if (!orig) return null;
  const frame = full ? '1' : '0';
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${orig}/${frame}.jpg`;
}

// ── Lightbox immagine grande ──────────────────────────────
function Lightbox({ esercizio, onClose }) {
  const url0 = getImgUrl(esercizio, false);
  const url1 = getImgUrl(esercizio, true);
  const [frame, setFrame] = React.useState(0);
  const url = frame === 0 ? url0 : url1;

  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)', padding: 20,
          maxWidth: 520, width: '90vw', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Titolo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{esercizio.nome}</div>
            {esercizio.nome_ufficiale_en && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{esercizio.nome_ufficiale_en}</div>
            )}
          </div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Immagine */}
        <div style={{ background: 'var(--bg-deep)', borderRadius: 'var(--radius-md)',
          overflow: 'hidden', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={url} alt={esercizio.nome}
            style={{ maxWidth: '100%', maxHeight: 380, objectFit: 'contain', display: 'block' }}
            onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
          />
          <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center',
            gap: 8, color: 'var(--text-muted)', fontSize: 12, padding: 40 }}>
            <span style={{ fontSize: 32 }}>🖼️</span>
            <span>Immagine non disponibile</span>
          </div>
        </div>

        {/* Toggle frame 0/1 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className={`btn btn-sm ${frame===0 ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFrame(0)}>Frame 1</button>
          <button className={`btn btn-sm ${frame===1 ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFrame(1)}>Frame 2</button>
        </div>

        {/* Link originale */}
        <div style={{ textAlign: 'center' }}>
          <a href={`https://github.com/yuhonas/free-exercise-db/tree/main/exercises/${esercizio._id_originale}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: 'var(--accent-light)', textDecoration: 'none' }}>
            🔗 Vedi su free-exercise-db
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Thumbnail con lazy load ───────────────────────────────
function Thumb({ esercizio, onClick }) {
  const [status, setStatus] = React.useState('loading'); // loading | ok | err
  const url = getImgUrl(esercizio, false);

  if (!url) return (
    <div style={{ width: 36, height: 36, background: 'var(--bg-card)',
      borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18 }}>💪</div>
  );

  return (
    <div onClick={onClick} title="Clicca per ingrandire"
      style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden',
        cursor: 'pointer', flexShrink: 0, background: 'var(--bg-card)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)', transition: 'transform 0.15s ease' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {status !== 'err' && (
        <img src={url} alt="" loading="lazy"
          style={{ width: 36, height: 36, objectFit: 'cover',
            display: status === 'ok' ? 'block' : 'none' }}
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('err')}
        />
      )}
      {status === 'loading' && (
        <div style={{ width: 20, height: 20, borderRadius: '50%',
          border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite' }} />
      )}
      {status === 'err' && <span style={{ fontSize: 16 }}>💪</span>}
    </div>
  );
}

// ── Riga tabella ──────────────────────────────────────────
function Row({ e, tipologie, i, onEdit, onDelete }) {
  const [lightbox, setLightbox] = React.useState(false);

  const catLabel = React.useMemo(() => {
    const ids = (e.categorie_ids || e.tipologia_id || '').split(',').map(s => s.trim()).filter(Boolean);
    return ids.map(id => {
      const t = tipologie.find(t => t.id === id);
      return t ? `${t.emoji} ${t.nome}` : '';
    }).filter(Boolean).join(', ');
  }, [e, tipologie]);

  const livColor = LIVELLO_COLOR[e.livello] || 'transparent';

  return (
    <>
      <tr style={{ background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-card)04',
        transition: 'background 0.1s ease' }}
        onMouseEnter={evt => evt.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={evt => evt.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-base)' : '#1f224008'}
      >
        {/* Thumbnail */}
        <td style={{ padding: '6px 8px 6px 12px', borderBottom: '1px solid var(--border)20', width: 52 }}>
          <Thumb esercizio={e} onClick={() => setLightbox(true)} />
        </td>

        {/* Nome */}
        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)20' }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{e.nome}</div>
          {e.nome_ufficiale_it && e.nome_ufficiale_it !== e.nome && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{e.nome_ufficiale_it}</div>
          )}
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)20' }}>
          {e.nome_ufficiale_en || ''}
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, borderBottom: '1px solid var(--border)20' }}>
          {catLabel}
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)20' }}>
          {e.strumentazione || ''}
        </td>
        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)20' }}>
          {e.livello && (
            <span style={{ fontSize: 10, fontWeight: 600, color: livColor,
              background: livColor + '20', border: `1px solid ${livColor}50`,
              padding: '2px 7px', borderRadius: 10 }}>
              {e.livello}
            </span>
          )}
        </td>
        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)20', maxWidth: 180 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.muscoli || ''}
          </div>
        </td>
        <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)20' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" title="Modifica" onClick={onEdit} style={{ fontSize: 13 }}>✏️</button>
            <button className="btn-icon" title="Elimina" onClick={onDelete}
              style={{ fontSize: 13, color: 'var(--red)', borderColor: 'var(--red)30' }}>🗑️</button>
          </div>
        </td>
      </tr>

      {lightbox && <Lightbox esercizio={e} onClose={() => setLightbox(false)} />}
    </>
  );
}

