/**
 * Funzioni da eseguire UNA VOLTA dall'editor Apps Script (menu ▶ Esegui).
 *   1. setup()        → crea le schede del Foglio con le intestazioni
 *   2. creaModelli()  → crea in Drive la cartella "AGGS Como – Sito" con i due modelli PDF
 *                        e la cartella per i documenti delle attività
 * Rieseguirle non cancella dati: setup aggiunge solo ciò che manca,
 * creaModelli ricrea i modelli (i vecchi restano in Drive).
 */

function setup() {
  const ss = SpreadsheetApp.getActive();

  Object.keys(SCHEMA).forEach(table => {
    const sh = ss.getSheetByName(table) || ss.insertSheet(table);
    const cols = SCHEMA[table];

    // Tutto in formato testo: date e telefoni non vengono convertiti dal Foglio
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), cols.length)).setNumberFormat('@');

    const esistenti = sh.getLastColumn() ? headers_(sh).filter(Boolean) : [];
    const mancanti  = cols.filter(c => esistenti.indexOf(c) < 0);
    if (mancanti.length) {
      sh.getRange(1, esistenti.length + 1, 1, mancanti.length).setValues([mancanti]);
    }
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#e8eef7');
    sh.setFrozenRows(1);
  });

  if (!impostazioneGet_('iscrizioni_aperte')) {
    insertRow_('impostazioni', { chiave: 'iscrizioni_aperte', valore: 'true', updated_at: nowIso_() });
  }

  // Rimuove il foglio vuoto creato di default
  ['Foglio1', 'Sheet1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  console.log('Setup completato.');
}

// ──────────────────────────────────────────────
// MODELLI GOOGLE DOCS
// ──────────────────────────────────────────────

const BLU    = '#003985';
const GRIGIO = '#6b7280';
const SCURO  = '#1a1a2e';

function creaModelli() {
  const props  = PropertiesService.getScriptProperties();
  const radice = DriveApp.createFolder('AGGS Como – Sito');
  const docs   = radice.createFolder('Documenti attività (pubblici)');
  docs.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const tess  = creaModelloTesseramento_();
  const campo = creaModelloCampo_();
  [tess, campo].forEach(id => DriveApp.getFileById(id).moveTo(radice));

  props.setProperties({
    MODELLO_TESSERAMENTO_ID: tess,
    MODELLO_CAMPO_ID:        campo,
    DOCUMENTI_FOLDER_ID:     docs.getId(),
  });

  console.log('Modelli creati nella cartella: ' + radice.getUrl());
}

function creaModelloTesseramento_() {
  const doc  = DocumentApp.create('Modello PDF – Tesseramento annuale');
  const body = nuovoBody_(doc);

  intestazione_(body);
  titolo_(body, 'MODULO DI ISCRIZIONE – ANNO {{anno}}');

  testo_(body, 'Il/La sottoscritto/a (genitore / esercente la responsabilità genitoriale)');
  campi_(body, [['Nome e cognome del genitore', '{{genitore_nome}}'], ['Codice fiscale del genitore', '{{genitore_cf}}']]);

  testo_(body, "CHIEDE IL TESSERAMENTO del/della proprio/a figlio/a all'associazione:");
  campi_(body, [['Cognome e nome del ragazzo/a', '{{ragazzo_nome}}'], ['Codice fiscale del ragazzo/a', '{{ragazzo_cf}}']]);
  campi_(body, [['Nato/a a', '{{luogo_nascita}}'], ['Il', '{{data_nascita}}']]);
  campi_(body, [['Reparto', '{{unita}}'], ['Anno associativo', '{{anno}}']]);
  campi_(body, [['Telefono', '{{telefono}}'], ['Email', '{{email}}']]);

  testo_(body, 'Il/La sottoscritto/a:', { bold: true });
  elenco_(body, [
    'ESONERA i capi da ogni responsabilità civile o penale derivante da incidenti non dipendenti dalla loro incuria;',
    'AUTORIZZA il trattamento dei dati personali ai sensi del Regolamento UE 2016/679 (GDPR);',
    "PRENDE ATTO dello Statuto e del Regolamento dell'associazione.",
  ]);

  firma_(body);

  sezione_(body, 'INFORMAZIONI PER IL PAGAMENTO — Bonifico bancario');
  righe_(body, [
    ['IBAN:', 'IT05B0623010996000046690131'],
    ['Intestato a:', 'ASSOCIAZIONE GRUPPI GUIDE E SCOUT COMO'],
    ['Causale:', '{{ragazzo_nome}} – ACCONTO Tesseramento associativa anno {{anno}}'],
  ]);

  nota_(body, 'Consegnare questo modulo firmato al capo reparto prima della prima attività.');

  doc.saveAndClose();
  return doc.getId();
}

function creaModelloCampo_() {
  const doc  = DocumentApp.create('Modello PDF – Iscrizione attività minori');
  const body = nuovoBody_(doc);

  intestazione_(body);
  titolo_(body, 'MODULO DI ISCRIZIONE MINORI – {{attivita}}');

  campi_(body, [['Cognome e nome del ragazzo/a', '{{ragazzo_nome}}'], ['Codice fiscale del ragazzo/a', '{{ragazzo_cf}}']]);
  campi_(body, [['Unità', '{{unita}}'], ['Data di nascita', '{{data_nascita}}']]);

  testo_(body, 'Il/La sottoscritto/a (genitore / esercente la responsabilità genitoriale)');
  campi_(body, [['Nome e cognome del genitore', '{{genitore_nome}}'], ['Codice fiscale del genitore', '{{genitore_cf}}']]);

  testo_(body, 'Il/La sottoscritto/a:', { bold: true });
  elenco_(body, [
    "AUTORIZZA il/la proprio/a figlio/a a partecipare all'attività dell'Associazione.",
    'ESONERA i capi e gli incaricati da ogni responsabilità civile o penale derivante da incidenti non dipendenti dalla loro incuria.',
    "CERTIFICA che l'iscrizione sarà ritenuta valida solo a seguito dell'invio della copia del documento d'identità di un genitore e del ragazzo/a, allegata al modulo di iscrizione e alla scheda medica debitamente compilata.",
  ]);

  sezione_(body, 'REPERIBILITÀ DURANTE IL CAMPO');
  campi_(body, [['Indirizzo', '{{indirizzo}}']]);
  campi_(body, [['Telefono 1', '{{telefono}}'], ['Telefono 2', '{{telefono_2}}'], ['Telefono 3', '{{telefono_3}}']]);

  firma_(body);

  sezione_(body, 'INFORMAZIONI PER IL PAGAMENTO — Bonifico bancario');
  righe_(body, [
    ['Intestato a:', 'ASSOCIAZIONE GRUPPI GUIDE E SCOUT COMO'],
    ['Banca:', 'Credit Agricole'],
    ['IBAN:', 'IT05B0623010996000046690131'],
    ['Causale:', '{{ragazzo_nome}} – Partecipazione attività scoutistica'],
  ]);

  nota_(body, "Consegnare il modulo firmato alla segreteria all'indirizzo aggscomo@gmail.com");

  doc.saveAndClose();
  return doc.getId();
}

// ── Mattoncini per i modelli ─────────────────────

function nuovoBody_(doc) {
  const body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(40).setMarginRight(40);
  return body;
}

function stile_(el, opts) {
  const t = el.editAsText();
  t.setFontFamily('Arial').setFontSize(opts.size || 10).setBold(!!opts.bold)
   .setForegroundColor(opts.color || SCURO);
  return el;
}

function intestazione_(body) {
  const table = body.appendTable([['', '']]);
  table.setBorderWidth(0);
  const logoCell = table.getCell(0, 0).setWidth(70);
  const img = logoCell.getChild(0).asParagraph().appendInlineImage(
    Utilities.newBlob(Utilities.base64Decode(LOGO_BASE64), 'image/png', 'logo.png'));
  const ratio = img.getHeight() / img.getWidth();
  img.setWidth(60).setHeight(Math.round(60 * ratio));

  const txt = table.getCell(0, 1);
  const nomeAss = txt.getChild(0).asParagraph();
  nomeAss.setText('ASSOCIAZIONE GRUPPI GUIDE E SCOUT – GRUPPO DI COMO'); // setText non restituisce il paragrafo
  stile_(nomeAss, { size: 10, bold: true, color: BLU });
  stile_(txt.appendParagraph('C.F./P.IVA 95062000138 – Via Mazzini, 10 - 22077 Olgiate Comasco'),
    { size: 8, color: GRIGIO });
  body.appendHorizontalRule();
}

function titolo_(body, text) {
  stile_(body.appendParagraph(text), { size: 13, bold: true, color: BLU })
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(6).setSpacingAfter(12);
}

function testo_(body, text, opts) {
  stile_(body.appendParagraph(text), Object.assign({ size: 9 }, opts || {})).setSpacingBefore(8).setSpacingAfter(4);
}

function sezione_(body, text) {
  stile_(body.appendParagraph(text), { size: 10, bold: true, color: BLU }).setSpacingBefore(12).setSpacingAfter(6);
}

function nota_(body, text) {
  body.appendHorizontalRule();
  stile_(body.appendParagraph(text), { size: 8, color: GRIGIO });
}

// Riga di campi: etichetta piccola grigia sopra, valore in grassetto sotto.
function campi_(body, coppie) {
  const table = body.appendTable([coppie.map(c => c[0]), coppie.map(c => c[1])]);
  table.setBorderWidth(0.5).setBorderColor('#c5c9d0');
  coppie.forEach((_, i) => {
    stile_(table.getCell(0, i), { size: 7, color: GRIGIO });
    stile_(table.getCell(1, i), { size: 10, bold: true });
  });
}

function righe_(body, righe) {
  const table = body.appendTable(righe);
  table.setBorderWidth(0);
  righe.forEach((_, i) => {
    stile_(table.getCell(i, 0).setWidth(80), { size: 9, color: GRIGIO });
    stile_(table.getCell(i, 1), { size: 9, bold: true });
  });
}

function elenco_(body, voci) {
  voci.forEach(v => {
    stile_(body.appendParagraph('– ' + v), { size: 9 }).setIndentStart(10).setIndentFirstLine(10).setSpacingAfter(4);
  });
}

function firma_(body) {
  body.appendParagraph('');
  const table = body.appendTable([['Data: ____________________', 'Firma del genitore: ________________________________']]);
  table.setBorderWidth(0);
  stile_(table.getCell(0, 0), { size: 10 });
  stile_(table.getCell(0, 1), { size: 10 });
  body.appendParagraph('');
}
