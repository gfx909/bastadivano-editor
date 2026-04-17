import React, { useState, useEffect } from 'react';
import {
  STRUMENTAZIONI, LIVELLI, catIdsToNomi, catNomiToIds
} from '../utils';

export default function EsercizioModal({ esercizio, tipologie, onSave, onClose }) {
  const [form, setForm] = useState({ ...esercizio });
  // categorie come array di ids selezionati
  const [catSelezionate, setCatSelezionate] = useState(() => {
    const ids = (esercizio.categorie_ids || esercizio.tipologia_id || '')
      .split(',').map(s => s.trim()).filter(Boolean);
    return new Set(ids);
  });

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const toggleCat = (id) => {
    setCatSelezionate(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!form.nome.trim()) { alert('Il nome è obbligatorio'); return; }
    const catArr = [...catSelezionate];
    const saved = {
      ...form,
      nome: form.nome.trim(),
      categorie_ids: catArr.join(','),
      tipologia_id: catArr[0] || '',
    };
    onSave(saved);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">
            {esercizio.nome ? `✏️ ${esercizio.nome}` : '➕ Nuovo esercizio'}
          </span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* ── NOMI ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Nomi</div>
            <div className="modal-grid">
              <div className="field-group span-2">
                <label className="field-label">Nome personale *</label>
                <input className="input" value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder="Es. Panca piana mia" autoFocus />
              </div>
              <div className="field-group">
                <label className="field-label">🇮🇹 Nome ufficiale IT</label>
                <input className="input" value={form.nome_ufficiale_it || ''} onChange={e => set('nome_ufficiale_it', e.target.value)}
                  placeholder="Es. Distensione su panca" />
              </div>
              <div className="field-group">
                <label className="field-label">🇬🇧 Official name EN</label>
                <input className="input" value={form.nome_ufficiale_en || ''} onChange={e => set('nome_ufficiale_en', e.target.value)}
                  placeholder="Es. Bench press" />
              </div>
            </div>
          </div>

          {/* ── CATEGORIE ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Categorie (una o più)</div>
            <div className="chip-list">
              {tipologie.map(t => (
                <button key={t.id}
                  className={`chip ${catSelezionate.has(t.id) ? 'selected' : ''}`}
                  onClick={() => toggleCat(t.id)}
                >
                  {t.emoji} {t.nome}
                </button>
              ))}
            </div>
          </div>

          {/* ── DETTAGLI ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Dettagli</div>
            <div className="modal-grid">
              <div className="field-group">
                <label className="field-label">Strumentazione</label>
                <select className="select" value={form.strumentazione || ''} onChange={e => set('strumentazione', e.target.value)}>
                  {STRUMENTAZIONI.map(s => <option key={s} value={s}>{s || '— nessuna —'}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Livello</label>
                <select className="select" value={form.livello || ''} onChange={e => set('livello', e.target.value)}>
                  {LIVELLI.map(l => <option key={l} value={l}>{l || '— qualsiasi —'}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Luogo / Palestra</label>
                <input className="input" value={form.luogo || ''} onChange={e => set('luogo', e.target.value)}
                  placeholder="Es. Palestra Milano" />
              </div>
              <div className="field-group">
                <label className="field-label">Tipo allenamento</label>
                <input className="input" value={form.categoria || ''} onChange={e => set('categoria', e.target.value)}
                  placeholder="Es. strength, stretching..." />
              </div>
              <div className="field-group span-2">
                <label className="field-label">Muscoli coinvolti</label>
                <input className="input" value={form.muscoli || ''} onChange={e => set('muscoli', e.target.value)}
                  placeholder="Es. Primari: Petto | Secondari: Tricipiti" />
              </div>
              <div className="field-group span-2">
                <label className="field-label">Regolazioni / Note tecniche</label>
                <input className="input" value={form.regolazioni || ''} onChange={e => set('regolazioni', e.target.value)}
                  placeholder="Es. Livello: principiante | Forza: spinta" />
              </div>
            </div>
          </div>

          {/* ── ISTRUZIONI ── */}
          <div className="field-group">
            <label className="field-label">Istruzioni di esecuzione (IT)</label>
            <textarea className="textarea" rows={5}
              value={form.istruzioni || ''} onChange={e => set('istruzioni', e.target.value)}
              placeholder="Descrivi passo per passo come eseguire l'esercizio..." />
          </div>

          {/* ── PATH IMMAGINI ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Percorsi immagini</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Relativi a <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-code)' }}>BastaDivano/</code>
            </div>
            <div className="modal-grid">
              <div className="field-group">
                <label className="field-label">Thumbnail</label>
                <input className="input" value={form.thumbnail_path || ''} onChange={e => set('thumbnail_path', e.target.value)}
                  placeholder="esercizi/thumbnail/nome.jpg" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              </div>
              <div className="field-group">
                <label className="field-label">Immagine grande / GIF</label>
                <input className="input" value={form.immagine_path || ''} onChange={e => set('immagine_path', e.target.value)}
                  placeholder="esercizi/immagini/nome.jpg" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Salva esercizio</button>
        </div>
      </div>
    </div>
  );
}
