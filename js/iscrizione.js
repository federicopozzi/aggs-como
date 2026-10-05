import { apiPost, getImpostazione } from './api.js';

// ──────────────────────────────────────────────
// ANNO ASSOCIATIVO
// ──────────────────────────────────────────────

function calcolaAnnoCorrente() {
  const oggi = new Date();
  const anno = oggi.getFullYear();
  return (oggi.getMonth() + 1) >= 9
    ? `${anno}-${anno + 1}`
    : `${anno - 1}-${anno}`;
}

function populateAnnoAssociativo() {
  const sel = document.getElementById('anno_associativo');
  if (!sel) return;

  const corrente  = calcolaAnnoCorrente();
  const annoStart = parseInt(corrente.split('-')[0]);
  const opzioni   = [`${annoStart}-${annoStart + 1}`, `${annoStart + 1}-${annoStart + 2}`];

  // Se siamo prima di settembre mostra anche l'anno precedente
  if ((new Date().getMonth() + 1) < 9) {
    opzioni.unshift(`${annoStart - 1}-${annoStart}`);
  }

  sel.innerHTML = opzioni
    .map(a => `<option value="${a}"${a === corrente ? ' selected' : ''}>${a}</option>`)
    .join('');

  aggiornaCausale();
}

// ──────────────────────────────────────────────
// CAUSALE PAGAMENTO
// ──────────────────────────────────────────────

function aggiornaCausale() {
  const nome    = document.getElementById('nome')?.value.trim();
  const cognome = document.getElementById('cognome')?.value.trim();
  const anno    = document.getElementById('anno_associativo')?.value;

  const nomeCompleto = (cognome || nome)
    ? [cognome, nome].filter(Boolean).join(' ')
    : 'Nome e Cognome';
  const annoLabel = anno || '____';

  const el = document.getElementById('causale-preview');
  if (el) el.textContent = `${nomeCompleto} – ACCONTO Tesseramento associativa anno ${annoLabel}`;
}

// ──────────────────────────────────────────────
// LOGICA MINORENNE / MAGGIORENNE
// ──────────────────────────────────────────────

function isMinorenne(dataNascita) {
  if (!dataNascita) return false;
  const nascita = new Date(dataNascita + 'T00:00:00');
  const oggi    = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const m = oggi.getMonth() - nascita.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) eta--;
  return eta < 18;
}

function aggiornaSezioneMinorenne(minore) {
  const sezioneGen   = document.getElementById('sezione-genitore');
  const nomeGenEl    = document.getElementById('nome_genitore');
  const cognomeGenEl = document.getElementById('cognome_genitore');
  const cittaEl      = document.getElementById('indirizzo_citta');
  const capEl        = document.getElementById('indirizzo_cap');
  const viaEl        = document.getElementById('indirizzo_via');

  sezioneGen.classList.toggle('hidden', !minore);
  sezioneGen.setAttribute('aria-hidden', String(!minore));

  if (nomeGenEl)    nomeGenEl.required    = minore;
  if (cognomeGenEl) cognomeGenEl.required = minore;
  if (cittaEl)      cittaEl.required      = minore;
  if (capEl)        capEl.required        = minore;
  if (viaEl)        viaEl.required        = minore;

  const hintEl    = document.getElementById('hint-contatti');
  const labelTel  = document.getElementById('label-telefono');
  const labelCel  = document.getElementById('label-cellulare');
  const labelTest = document.getElementById('label-tesseramento');

  if (hintEl) {
    hintEl.textContent = minore
      ? 'Telefono, email e cellulare del genitore o tutore legale.'
      : 'I tuoi contatti.';
  }
  if (labelTel) labelTel.textContent = minore ? 'Telefono fisso' : 'Telefono';
  if (labelCel) labelCel.textContent = minore ? 'Cellulare' : 'Cellulare / emergenza';

  if (labelTest) {
    const testo = minore
      ? "Chiedo il tesseramento del/della proprio/a figlio/a all'associazione."
      : "Chiedo il mio tesseramento all'associazione.";
    labelTest.innerHTML = `${testo} <span class="required" aria-hidden="true">*</span>`;
  }
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────

async function init() {
  try {
    const { data } = await getImpostazione('iscrizioni_aperte');

    if ((data?.valore ?? 'true') === 'false') {
      mostraIscrizioniChiuse();
      return;
    }
  } catch {
    // fail open: se non riesce a leggere il setting, mostra il form
  }

  populateAnnoAssociativo();

  const dataNascitaEl = document.getElementById('data_nascita');
  const nomeEl        = document.getElementById('nome');
  const cognomeEl     = document.getElementById('cognome');
  const annoEl        = document.getElementById('anno_associativo');

  dataNascitaEl.addEventListener('change', () => {
    aggiornaSezioneMinorenne(isMinorenne(dataNascitaEl.value));
  });

  nomeEl.addEventListener('input', aggiornaCausale);
  cognomeEl.addEventListener('input', aggiornaCausale);
  annoEl.addEventListener('change', aggiornaCausale);

  document.getElementById('form-iscrizione').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validaForm()) return;
    await inviaIscrizione();
  });
}

function mostraIscrizioniChiuse() {
  const container = document.querySelector('.container-sm');
  if (!container) return;
  container.innerHTML = `
    <div style="text-align:center;padding:var(--space-2xl) 0">
      <div style="font-size:3.5rem;margin-bottom:var(--space-lg)" aria-hidden="true">🔒</div>
      <h2 style="color:var(--color-primary);margin-bottom:var(--space-md)">
        Iscrizioni chiuse
      </h2>
      <p class="text-muted" style="max-width:46ch;margin-inline:auto;margin-bottom:var(--space-xl)">
        Le iscrizioni all'anno associativo sono attualmente chiuse.<br>
        Torna presto per scoprire quando riaprono.
      </p>
      <a href="contatti.html" class="btn btn-primary btn-lg">Hai domande? Contattaci</a>
    </div>
  `;
}

// ──────────────────────────────────────────────
// VALIDAZIONE
// ──────────────────────────────────────────────

function validaForm() {
  let valido = true;

  document.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));

  function segnaErrore(id) {
    const el = document.getElementById(id);
    if (el) el.closest('.form-group')?.classList.add('has-error');
    valido = false;
  }

  // Dati ragazzo
  if (!document.getElementById('cognome')?.value.trim())              segnaErrore('cognome');
  if (!document.getElementById('nome')?.value.trim())                 segnaErrore('nome');
  if (!document.getElementById('luogo_nascita')?.value.trim())        segnaErrore('luogo_nascita');
  if (!document.getElementById('data_nascita')?.value)                segnaErrore('data_nascita');
  if (!document.getElementById('codice_fiscale')?.value.trim())       segnaErrore('codice_fiscale');
  if (!document.getElementById('classe_frequentata')?.value)          segnaErrore('classe_frequentata');
  if (!document.getElementById('unita')?.value)                       segnaErrore('unita');

  // Email e cellulare
  if (!document.getElementById('email')?.value.includes('@'))         segnaErrore('email');
  if (!document.getElementById('telefono_emergenza')?.value.trim())   segnaErrore('telefono_emergenza');

  // Dati genitore (solo se minorenne)
  const sezioneGen = document.getElementById('sezione-genitore');
  if (!sezioneGen.classList.contains('hidden')) {
    if (!document.getElementById('nome_genitore')?.value.trim())             segnaErrore('nome_genitore');
    if (!document.getElementById('cognome_genitore')?.value.trim())          segnaErrore('cognome_genitore');
    if (!document.getElementById('codice_fiscale_genitore')?.value.trim())   segnaErrore('codice_fiscale_genitore');
    if (!document.getElementById('indirizzo_citta')?.value.trim())           segnaErrore('indirizzo_citta');
    if (!document.getElementById('indirizzo_cap')?.value.trim())    segnaErrore('indirizzo_cap');
    if (!document.getElementById('indirizzo_via')?.value.trim())    segnaErrore('indirizzo_via');
  }

  // Dichiarazioni obbligatorie
  if (!document.getElementById('dichiarazione_tesseramento')?.checked) segnaErrore('dichiarazione_tesseramento');
  if (!document.getElementById('dichiarazione_esonero')?.checked)      segnaErrore('dichiarazione_esonero');
  if (!document.getElementById('consenso_privacy')?.checked)            segnaErrore('consenso_privacy');

  if (!valido) {
    document.querySelector('.form-group.has-error')
      ?.querySelector('input, select, textarea')
      ?.focus();
  }

  return valido;
}

// ──────────────────────────────────────────────
// SUBMIT
// ──────────────────────────────────────────────

async function inviaIscrizione() {
  const btn    = document.getElementById('btn-submit');
  const errBox = document.getElementById('form-error-generale');

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Invio in corso…';
  errBox.classList.add('hidden');

  const cf             = document.getElementById('codice_fiscale').value.trim().toUpperCase();
  const minore         = !document.getElementById('sezione-genitore').classList.contains('hidden');

  const payload = {
    cognome:              document.getElementById('cognome').value.trim(),
    nome:                 document.getElementById('nome').value.trim(),
    luogo_nascita:        document.getElementById('luogo_nascita').value.trim() || null,
    data_nascita:         document.getElementById('data_nascita').value,
    codice_fiscale:       cf || null,
    classe_frequentata:   document.getElementById('classe_frequentata').value.trim() || null,
    unita:                document.getElementById('unita').value,
    anno_associativo:     document.getElementById('anno_associativo').value,
    email:                document.getElementById('email').value.trim(),
    telefono:             document.getElementById('telefono').value.trim() || null,
    telefono_emergenza:   document.getElementById('telefono_emergenza').value.trim() || null,
    nome_genitore:            minore ? (document.getElementById('nome_genitore').value.trim() || null) : null,
    cognome_genitore:         minore ? (document.getElementById('cognome_genitore').value.trim() || null) : null,
    codice_fiscale_genitore:  minore ? (document.getElementById('codice_fiscale_genitore').value.trim().toUpperCase() || null) : null,
    indirizzo_citta:      minore ? (document.getElementById('indirizzo_citta').value.trim() || null) : null,
    indirizzo_cap:        minore ? (document.getElementById('indirizzo_cap').value.trim() || null) : null,
    indirizzo_via:        minore ? (document.getElementById('indirizzo_via').value.trim() || null) : null,
    iscrizione_mailing_list: document.getElementById('iscrizione_mailing_list').checked,
    consenso_privacy:     true,
    consenso_foto:        document.getElementById('consenso_foto').checked,
    note:                 document.getElementById('note').value.trim() || null,
  };

  const { error } = await apiPost('soci.insert', payload);

  if (error) {
    btn.disabled  = false;
    btn.innerHTML = 'Invia iscrizione';
    errBox.textContent = `Si è verificato un errore: ${error.message}. Riprova o contattaci direttamente.`;
    errBox.classList.remove('hidden');
    return;
  }

  document.getElementById('form-fields').classList.add('hidden');
  document.getElementById('form-success').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// START
// ──────────────────────────────────────────────

init();
