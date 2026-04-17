// ── UUID ──────────────────────────────────────────────────
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── File System Access API ────────────────────────────────
export const fsaSupported = 'showOpenFilePicker' in window;

/** Apre un file JSON e restituisce { handle, data } */
export async function openJsonFile(description = 'File JSON') {
  if (!fsaSupported) {
    // Fallback: input file classico
    return openJsonFileFallback();
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description, accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);
    return { handle, data, fileName: file.name };
  } catch (e) {
    if (e.name === 'AbortError') return null;
    throw e;
  }
}

function openJsonFileFallback() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        resolve({ handle: null, data, fileName: file.name });
      } catch {
        alert('Errore: file JSON non valido');
        resolve(null);
      }
    };
    input.click();
  });
}

/** Salva JSON sul file originale (se supportato) o scarica */
export async function saveJsonFile(handle, data, fileName = 'export.json') {
  const json = JSON.stringify(data, null, 2);
  if (handle && fsaSupported) {
    try {
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') downloadJson(json, fileName);
      return false;
    }
  }
  downloadJson(json, fileName);
  return true;
}

/** Salva con nome (sempre apre dialog salva) */
export async function saveAsJsonFile(data, suggestedName = 'export.json') {
  const json = JSON.stringify(data, null, 2);
  if (fsaSupported) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'File JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return handle;
    } catch (e) {
      if (e.name !== 'AbortError') downloadJson(json, suggestedName);
      return null;
    }
  }
  downloadJson(json, suggestedName);
  return null;
}

function downloadJson(json, fileName) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────
export const STRUMENTAZIONI = [
  'Corpo libero', 'Bilanciere', 'Manubri', 'Cavi / pulegge',
  'Macchina', 'Kettlebell', 'Elastici', 'E-Z Curl Bar',
  'Palla medica', 'Palla da ginnastica', 'Rullo in schiuma', 'Altro', ''
];

export const LIVELLI = ['', 'principiante', 'intermedio', 'avanzato'];

export const OBIETTIVI = [
  'Forza', 'Massa muscolare', 'Definizione', 'Resistenza', 'Mobilità', 'Altro'
];

/** Converte lista di UUID categorie in nomi leggibili */
export function catIdsToNomi(catIds, tipologie) {
  if (!catIds) return '';
  const ids = typeof catIds === 'string'
    ? catIds.split(',').map(s => s.trim()).filter(Boolean)
    : catIds;
  return ids.map(id => {
    const t = tipologie.find(t => t.id === id);
    return t ? `${t.emoji} ${t.nome}` : id;
  }).join('; ');
}

/** Converte nomi in UUID categorie */
export function catNomiToIds(nomiStr, tipologie) {
  if (!nomiStr) return '';
  return nomiStr.split(';').map(n => {
    const nome = n.trim().replace(/^[^\w]+/, '').trim(); // rimuovi emoji
    const t = tipologie.find(t =>
      t.nome.toLowerCase() === nome.toLowerCase() ||
      `${t.emoji} ${t.nome}` === n.trim()
    );
    return t ? t.id : nome;
  }).filter(Boolean).join(',');
}

/** Ricerca fuzzy multi-token */
export function fuzzyMatch(query, ...fields) {
  if (!query.trim()) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.join(' ').toLowerCase();
  return tokens.every(t => haystack.includes(t));
}

/** Formatta una data ISO in dd/mm/yyyy */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate().toString().padLeft(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`;
}

// Template esercizio vuoto
export function esercizioVuoto(tipologiaId = '') {
  return {
    id: generateUUID(),
    nome: '',
    nome_ufficiale_it: '',
    nome_ufficiale_en: '',
    tipologia_id: tipologiaId,
    categorie_ids: tipologiaId,
    luogo: '',
    strumentazione: '',
    muscoli: '',
    regolazioni: '',
    thumbnail_path: '',
    immagine_path: '',
    alternative_ids: '',
    istruzioni: '',
    livello: '',
    categoria: '',
  };
}

// Template scheda vuota
export function schedaVuota(nome = '') {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    nome,
    obiettivo: '',
    numero_cicli: 4,
    durata_ciclo_giorni: 7,
    stato: 'bozza',
    data_creazione: now,
    data_inizio: null,
    peso_iniziale: null,
  };
}

// Template blocco vuoto
export function bloccoVuoto(schedaId, ordine = 0) {
  return {
    id: generateUUID(),
    scheda_id: schedaId,
    nome: '',
    tipologia: 'normale',
    ordine,
    esercizi_config: [],
  };
}

// Template esercizio in blocco
export function configEsercizioVuoto(bloccoId, ordine = 0) {
  return {
    id: generateUUID(),
    blocco_id: bloccoId,
    esercizio_nome: '',
    esercizio_id: '',
    ordine,
    numero_serie: 3,
    ripetute_serie: [10, 10, 10],
    cedimento_serie: [false, false, false],
    ipertrofia_secondi: [null, null, null],
    secondi_riposo: 90,
    alternative_ids: '',
  };
}
