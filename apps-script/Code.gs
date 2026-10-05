/**
 * AGGS Como — backend del sito su Google Fogli.
 *
 * Pubblicato come Web App ("Esegui come: me", "Chi ha accesso: chiunque").
 *   GET  ?action=...           → letture pubbliche
 *   POST {action, data, password} (text/plain) → scritture pubbliche e azioni admin
 * Risposta sempre JSON: { data } oppure { error, code }.
 */

const TZ = 'Europe/Rome';

// Colonne di ogni scheda. La prima riga del foglio deve contenere questi nomi
// (l'ordine nel foglio può cambiare: le colonne sono cercate per nome).
const SCHEMA = {
  attivita: ['id', 'nome', 'descrizione', 'tipo', 'tipo_modulo', 'data_inizio', 'data_fine', 'quota',
    'unita_target', 'ha_form_iscrizione', 'nota_iscrizioni', 'campi_extra', 'documenti', 'immagine_url',
    'attiva', 'created_at'],
  soci: ['id', 'nome', 'cognome', 'data_nascita', 'luogo_nascita', 'codice_fiscale', 'classe_frequentata',
    'unita', 'anno_associativo', 'email', 'telefono', 'telefono_emergenza', 'nome_genitore',
    'cognome_genitore', 'codice_fiscale_genitore', 'indirizzo_via', 'indirizzo_citta', 'indirizzo_cap',
    'iscrizione_mailing_list', 'consenso_privacy', 'consenso_foto', 'note', 'data_iscrizione'],
  iscrizioni_attivita: ['id', 'attivita_id', 'nome', 'cognome', 'data_nascita', 'email_contatto', 'telefono',
    'telefono_2', 'telefono_3', 'nome_genitore', 'indirizzo_genitore', 'note_mediche', 'risposte_extra',
    'stato', 'consenso_privacy', 'consenso_autorizzazione', 'consenso_esonero', 'presa_visione_documenti',
    'data_iscrizione', 'note'],
  contatti: ['id', 'email', 'nome', 'cognome', 'nome_ragazzo', 'unita', 'consenso_privacy', 'attivo',
    'data_iscrizione'],
  avvisi: ['id', 'titolo', 'testo', 'tipo', 'attivo', 'data_scadenza', 'created_at'],
  impostazioni: ['chiave', 'valore', 'updated_at'],
  mailing_list: ['email', 'nome', 'cognome', 'unita', 'fonte', 'data'],
};

const BOOL_COLS = ['ha_form_iscrizione', 'attiva', 'attivo', 'iscrizione_mailing_list', 'consenso_privacy',
  'consenso_foto', 'consenso_autorizzazione', 'consenso_esonero', 'presa_visione_documenti'];
const NUM_COLS  = ['quota'];
const JSON_COLS = ['campi_extra', 'documenti', 'risposte_extra'];

// Colonne con un default quando la riga viene creata.
const CREATED_COL = { attivita: 'created_at', avvisi: 'created_at', soci: 'data_iscrizione',
  iscrizioni_attivita: 'data_iscrizione', contatti: 'data_iscrizione' };

// ──────────────────────────────────────────────
// ENTRY POINT
// ──────────────────────────────────────────────

function doGet(e) {
  return handle_(() => {
    const p = e.parameter || {};
    switch (p.action) {
      case 'attivita.list':     return attivitaPubbliche_();
      case 'attivita.prossime': return attivitaProssime_(Number(p.limit) || 3);
      case 'attivita.get':      return attivitaGet_(p.id);
      case 'avvisi.attivi':     return avvisiAttivi_();
      case 'impostazioni.get':  return impostazioneGet_(p.chiave);
      default: throw apiError_('Azione non valida', 'bad_request');
    }
  });
}

function doPost(e) {
  return handle_(() => {
    let body;
    try { body = JSON.parse(e.postData.contents); }
    catch (err) { throw apiError_('Richiesta non valida', 'bad_request'); }

    const action = body.action || '';
    const data   = body.data || {};

    switch (action) {
      case 'soci.insert':       return sociInsert_(data);
      case 'iscrizioni.insert': return iscrizioneInsert_(data);
      case 'contatti.insert':   return contattoInsert_(data);
    }

    if (action.indexOf('admin.') === 0) {
      checkPassword_(body.password);
      switch (action) {
        case 'admin.login':  return { ok: true };
        case 'admin.select': return adminSelect_(data);
        case 'admin.insert': return adminInsert_(data);
        case 'admin.update': return adminUpdate_(data);
        case 'admin.delete': return adminDelete_(data);
        case 'admin.upload': return adminUpload_(data);
      }
    }
    throw apiError_('Azione non valida', 'bad_request');
  });
}

function handle_(fn) {
  let out;
  try {
    out = { data: fn() };
  } catch (err) {
    if (!err.code) console.error(err && err.stack || err);
    out = { error: err.message || String(err), code: err.code || 'server' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function checkPassword_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) throw apiError_('ADMIN_PASSWORD non impostata nelle proprietà dello script', 'server');
  if (!password || password !== expected) {
    Utilities.sleep(800); // rallenta i tentativi a caso
    throw apiError_('Password errata', 'unauthorized');
  }
}

// ──────────────────────────────────────────────
// ACCESSO AL FOGLIO
// ──────────────────────────────────────────────

function sheet_(table) {
  if (!SCHEMA[table]) throw apiError_('Tabella non valida', 'bad_request');
  const sh = SpreadsheetApp.getActive().getSheetByName(table);
  if (!sh) throw apiError_(`Scheda "${table}" mancante: esegui setup()`, 'server');
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
}

// Legge una scheda come array di oggetti, con i tipi convertiti.
// Ogni oggetto ha anche _row (numero di riga nel foglio), rimosso prima di rispondere.
function readTable_(table) {
  const sh   = sheet_(table);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const head   = headers_(sh);
  const values = sh.getRange(2, 1, last - 1, head.length).getValues();
  const rows   = [];
  values.forEach((r, i) => {
    if (r.every(v => v === '' || v === null)) return;
    const obj = { _row: i + 2 };
    head.forEach((h, c) => { if (h) obj[h] = fromCell_(h, r[c]); });
    rows.push(obj);
  });
  return rows;
}

function fromCell_(col, v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, TZ, hasTime ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  }
  if (BOOL_COLS.indexOf(col) >= 0) return v === true || String(v).toLowerCase() === 'true';
  if (v === '' || v === null) return null;
  if (NUM_COLS.indexOf(col) >= 0) { const n = parseFloat(v); return isNaN(n) ? null : n; }
  if (JSON_COLS.indexOf(col) >= 0) {
    try { return JSON.parse(v); } catch (err) { return null; }
  }
  return String(v);
}

function toCell_(col, v) {
  if (v === null || v === undefined) return '';
  if (BOOL_COLS.indexOf(col) >= 0) return v ? 'TRUE' : 'FALSE';
  if (JSON_COLS.indexOf(col) >= 0) return JSON.stringify(v);
  const s = String(v);
  // Un apostrofo iniziale impedisce che il Foglio interpreti il testo come formula o numero
  // (es. "+39 333…" o "=…" inseriti da un form pubblico).
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function clean_(row) {
  const out = {};
  Object.keys(row).forEach(k => { if (k !== '_row') out[k] = row[k]; });
  return out;
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

// Aggiunge una riga e restituisce l'oggetto salvato. Imposta id e data di creazione.
function insertRow_(table, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh   = sheet_(table);
    const head = headers_(sh);
    const rec  = {};
    SCHEMA[table].forEach(c => { if (row[c] !== undefined) rec[c] = row[c]; });
    if (head.indexOf('id') >= 0 && !rec.id) rec.id = Utilities.getUuid();
    const created = CREATED_COL[table];
    if (created && !rec[created]) rec[created] = nowIso_();
    sh.appendRow(head.map(h => toCell_(h, rec[h])));
    return rec;
  } finally {
    lock.releaseLock();
  }
}

function matches_(row, where) {
  return Object.keys(where || {}).every(k => String(row[k]) === String(where[k]));
}

// ──────────────────────────────────────────────
// LETTURE PUBBLICHE
// ──────────────────────────────────────────────

function byDate_(col, desc) {
  return (a, b) => {
    const x = a[col] || '', y = b[col] || '';
    return desc ? (x < y ? 1 : x > y ? -1 : 0) : (x < y ? -1 : x > y ? 1 : 0);
  };
}

function attivitaPubbliche_() {
  return readTable_('attivita').filter(a => a.attiva).sort(byDate_('data_inizio')).map(clean_);
}

function attivitaProssime_(limit) {
  const oggi = today_();
  return attivitaPubbliche_().filter(a => a.data_inizio && a.data_inizio >= oggi).slice(0, limit);
}

function attivitaGet_(id) {
  const a = readTable_('attivita').find(r => r.id === id && r.attiva);
  return a ? clean_(a) : null;
}

function avvisiAttivi_() {
  const oggi = today_();
  return readTable_('avvisi')
    .filter(a => a.attivo && (!a.data_scadenza || a.data_scadenza >= oggi))
    .sort(byDate_('created_at', true))
    .map(a => ({ id: a.id, titolo: a.titolo, testo: a.testo, tipo: a.tipo }));
}

function impostazioneGet_(chiave) {
  const r = readTable_('impostazioni').find(x => x.chiave === chiave);
  return r ? { valore: r.valore } : null;
}

// ──────────────────────────────────────────────
// SCRITTURE PUBBLICHE (form del sito)
// ──────────────────────────────────────────────

// Campi che un form pubblico non può impostare.
const PROTECTED = ['id', 'stato', 'note_admin', 'data_iscrizione', 'created_at'];

function publicRow_(table, data) {
  const row = {};
  SCHEMA[table].forEach(c => {
    if (PROTECTED.indexOf(c) < 0 && data[c] !== undefined) row[c] = data[c];
  });
  return row;
}

function required_(row, fields) {
  fields.forEach(f => {
    if (row[f] === undefined || row[f] === null || row[f] === '' || row[f] === false) {
      throw apiError_(`Campo obbligatorio mancante: ${f}`, 'bad_request');
    }
  });
}

function sociInsert_(data) {
  const aperte = impostazioneGet_('iscrizioni_aperte');
  if (aperte && aperte.valore === 'false') throw apiError_('Le iscrizioni sono chiuse', 'closed');

  const row = publicRow_('soci', data);
  required_(row, ['nome', 'cognome', 'email', 'consenso_privacy']);
  const rec = insertRow_('soci', row);

  afterInsert_(() => inviaEmailSocio_(rec));
  if (rec.iscrizione_mailing_list) afterInsert_(() => aggiungiMailingList_(rec, 'socio'));
  return { id: rec.id };
}

function iscrizioneInsert_(data) {
  const row = publicRow_('iscrizioni_attivita', data);
  required_(row, ['attivita_id', 'nome', 'cognome', 'email_contatto', 'consenso_privacy']);

  const attivita = attivitaGet_(row.attivita_id);
  if (!attivita || !attivita.ha_form_iscrizione) {
    throw apiError_('Le iscrizioni a questa attività sono chiuse', 'closed');
  }

  row.stato = 'in_attesa';
  const rec = insertRow_('iscrizioni_attivita', row);
  afterInsert_(() => inviaEmailIscrizione_(rec, attivita));
  return { id: rec.id };
}

function contattoInsert_(data) {
  const row = publicRow_('contatti', data);
  row.email = String(row.email || '').trim().toLowerCase();
  required_(row, ['email', 'consenso_privacy']);

  if (readTable_('contatti').some(c => String(c.email).toLowerCase() === row.email)) {
    throw apiError_('Email già iscritta', 'duplicate');
  }
  row.attivo = true;
  const rec = insertRow_('contatti', row);
  afterInsert_(() => aggiungiMailingList_(rec, 'newsletter'));
  return { id: rec.id };
}

// Email e mailing list non devono far fallire un'iscrizione già salvata.
function afterInsert_(fn) {
  try { fn(); } catch (err) { console.error(err && err.stack || err); }
}

// ──────────────────────────────────────────────
// ADMIN
// ──────────────────────────────────────────────

function adminSelect_(d) {
  let rows = readTable_(d.table).filter(r => matches_(r, d.where));
  if (d.order) rows.sort(byDate_(d.order, d.desc));
  rows = rows.map(clean_);
  if (d.single) {
    if (!rows.length) throw apiError_('Elemento non trovato', 'not_found');
    return rows[0];
  }
  return rows;
}

function adminInsert_(d) {
  return insertRow_(d.table, d.row || {});
}

// Aggiorna le righe che corrispondono a `where`. Per impostazioni crea la chiave se manca.
function adminUpdate_(d) {
  if (!d.where || !Object.keys(d.where).length) throw apiError_('Filtro mancante', 'bad_request');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh   = sheet_(d.table);
    const head = headers_(sh);
    const rows = readTable_(d.table).filter(r => matches_(r, d.where));

    if (!rows.length && d.table === 'impostazioni') {
      lock.releaseLock();
      return insertRow_('impostazioni', Object.assign({}, d.where, d.patch));
    }

    rows.forEach(r => {
      Object.keys(d.patch || {}).forEach(k => {
        const c = head.indexOf(k);
        if (c >= 0 && k !== 'id') sh.getRange(r._row, c + 1).setValue(toCell_(k, d.patch[k]));
      });
    });
    return { updated: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function adminDelete_(d) {
  if (!d.id) throw apiError_('id mancante', 'bad_request');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    deleteWhere_(d.table, r => r.id === d.id);
    // Come il vincolo FK "on delete cascade" di prima
    if (d.table === 'attivita') deleteWhere_('iscrizioni_attivita', r => r.attivita_id === d.id);
    return { deleted: true };
  } finally {
    lock.releaseLock();
  }
}

function deleteWhere_(table, pred) {
  const sh = sheet_(table);
  readTable_(table).filter(pred).map(r => r._row)
    .sort((a, b) => b - a) // dal basso, così i numeri di riga restano validi
    .forEach(n => sh.deleteRow(n));
}

function adminUpload_(d) {
  const folderId = PropertiesService.getScriptProperties().getProperty('DOCUMENTI_FOLDER_ID');
  if (!folderId) throw apiError_('Cartella documenti non configurata: esegui creaModelli()', 'server');
  const name = String(d.filename || 'documento.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = Utilities.newBlob(Utilities.base64Decode(d.base64), 'application/pdf', name);
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { url: `https://drive.google.com/file/d/${file.getId()}/view` };
}
