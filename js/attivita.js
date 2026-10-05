import { apiGet, apiPost } from './api.js';

const TIPO_LABEL = {
  uscita_giorno: 'Uscita',
  campo:         'Campo',
  riunione:      'Riunione',
  evento:        'Evento',
};

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────

async function init() {
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    mostraErrore('Nessuna attività specificata.', true);
    return;
  }

  const { data, error } = await apiGet('attivita.get', { id });

  if (error || !data) {
    mostraErrore("Attività non trovata o non più disponibile.", true);
    return;
  }

  document.title = `${data.nome} — AGGS Como`;
  renderPagina(data);
}

// ──────────────────────────────────────────────
// RENDER PAGINA
// ──────────────────────────────────────────────

function renderPagina(a) {
  const isMultiDay     = a.data_fine && a.data_fine !== a.data_inizio;
  const showNoteMediche = a.tipo === 'campo' || (a.tipo === 'uscita_giorno' && isMultiDay);
  const campiExtra     = Array.isArray(a.campi_extra) ? a.campi_extra : [];
  const docList        = Array.isArray(a.documenti) ? a.documenti.filter(d => d.url) : [];
  const tipoLabel      = TIPO_LABEL[a.tipo] || a.tipo;

  const dataFineHTML = isMultiDay
    ? `<span aria-hidden="true"> – </span>${formatData(a.data_fine)}`
    : '';

  const immaginHTML = a.immagine_url
    ? `<img src="${a.immagine_url}" alt="${a.nome}"
            style="width:100%;max-height:380px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:var(--space-xl)"
            loading="eager">`
    : '';

  const quotaHTML = a.quota > 0
    ? `<div style="display:flex;align-items:center;gap:var(--space-sm)">
         <span class="text-muted">Quota di partecipazione:</span>
         <strong style="font-size:1.125rem;color:var(--color-primary)">€${Number(a.quota).toLocaleString('it-IT')}</strong>
       </div>`
    : '';

  const unitaHTML = a.unita_target && a.unita_target !== 'tutti'
    ? `<p class="text-sm text-muted">Riservata a: <strong>${a.unita_target}</strong></p>`
    : '';

  const documentiHTML = docList.length
    ? `<div style="margin-bottom:var(--space-xl)">
         <h2 style="font-size:1.25rem;color:var(--color-primary);margin-bottom:var(--space-xs)">Documenti da scaricare</h2>
         <p class="text-sm text-muted" style="margin-bottom:var(--space-md)">
           Scarica il documento, compilalo e invialo via email alla segreteria.
         </p>
         <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
           ${docList.map(d => `
             <a href="${d.url}" target="_blank" rel="noopener"
                style="display:flex;align-items:center;gap:var(--space-md);
                       padding:var(--space-md);background:var(--color-surface);
                       border:1px solid var(--color-border);border-radius:var(--radius-md);
                       text-decoration:none;color:var(--color-text)">
               <span style="font-size:1.375rem;flex-shrink:0" aria-hidden="true">📄</span>
               <span style="flex:1;font-weight:500">${d.nome}</span>
               <span class="btn btn-outline btn-sm" style="flex-shrink:0">Scarica PDF</span>
             </a>`).join('')}
         </div>
       </div>`
    : '';

  const formHTML = a.ha_form_iscrizione
    ? (a.tipo_modulo === 'campo_minori'
        ? buildFormCampoMinoriHTML()
        : buildFormHTML(showNoteMediche, campiExtra))
    : (a.nota_iscrizioni
        ? `<div class="alert alert-info"><span>${a.nota_iscrizioni}</span></div>`
        : '');

  document.getElementById('page-content').innerHTML = `

    <!-- BREADCRUMB + HEADER -->
    <div class="page-header">
      <div class="container">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="index.html">Home</a>
          <span aria-hidden="true">›</span>
          <a href="calendario.html">Calendario</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">${a.nome}</span>
        </nav>
        <div style="display:flex;align-items:flex-start;gap:var(--space-md);flex-wrap:wrap;margin-top:var(--space-sm)">
          <div style="flex:1;min-width:0">
            <span class="badge badge-${a.tipo}" style="margin-bottom:var(--space-sm)">${tipoLabel}</span>
            <h1>${a.nome}</h1>
          </div>
        </div>
      </div>
    </div>

    <div class="section" style="padding-top:var(--space-xl)">
      <div class="container">
        <div style="display:grid;grid-template-columns:1fr;gap:var(--space-2xl)">

          <!-- COLONNA DETTAGLI -->
          <div style="max-width:720px">
            ${immaginHTML}

            <!-- Meta info -->
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-lg);margin-bottom:var(--space-xl);padding:var(--space-lg);background:var(--color-primary-light);border-radius:var(--radius-md)">
              <div>
                <p class="text-xs text-muted font-semibold" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">
                  ${isMultiDay ? 'Date' : 'Data'}
                </p>
                <p style="font-weight:600;color:var(--color-text)">
                  <time datetime="${a.data_inizio}">${formatData(a.data_inizio)}</time>${dataFineHTML}
                </p>
              </div>
              ${quotaHTML ? `<div>
                <p class="text-xs text-muted font-semibold" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Quota</p>
                <div>${quotaHTML}</div>
              </div>` : ''}
              ${unitaHTML ? `<div><p class="text-xs text-muted font-semibold" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Reparto</p>${unitaHTML}</div>` : ''}
              <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:flex-end">
                <button type="button" id="btn-google-cal" class="btn btn-outline btn-sm">Aggiungi a Calendar</button>
              </div>
            </div>

            <!-- Descrizione -->
            ${a.descrizione
              ? `<div style="margin-bottom:var(--space-xl)">
                   <h2 style="font-size:1.25rem;color:var(--color-primary);margin-bottom:var(--space-md)">Descrizione</h2>
                   <div style="white-space:pre-line;line-height:1.7">${a.descrizione}</div>
                 </div>`
              : ''}

            <!-- Documenti scaricabili -->
            ${documentiHTML}

            <!-- Form iscrizione -->
            <div id="iscrizione-section">
              ${(a.ha_form_iscrizione || a.nota_iscrizioni)
                ? `<h2 style="font-size:1.25rem;color:var(--color-primary);margin-bottom:var(--space-lg)">Iscrizione</h2>`
                : ''}
              ${formHTML}
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-google-cal').addEventListener('click', () => window.open(urlGoogleCal(a), '_blank', 'noopener'));

  if (a.ha_form_iscrizione) {
    if (a.tipo_modulo === 'campo_minori') {
      initFormCampoMinori(a);
    } else {
      initForm(a, showNoteMediche, campiExtra);
    }
  }
}

// ──────────────────────────────────────────────
// BUILD FORM HTML
// ──────────────────────────────────────────────

function buildFormHTML(showNoteMediche, campiExtra) {
  const extraHTML = campiExtra.length
    ? `<fieldset class="form-section">
         <legend>Informazioni aggiuntive</legend>
         ${campiExtra.map(renderCampoExtra).join('')}
       </fieldset>`
    : '';

  const noteMedicheHTML = showNoteMediche
    ? `<fieldset class="form-section">
         <legend>Note sanitarie</legend>
         <div class="form-group">
           <label class="form-label" for="note_mediche">
             Allergie, intolleranze o condizioni mediche rilevanti
           </label>
           <textarea id="note_mediche" name="note_mediche" class="form-control"
                     rows="3" placeholder="Scrivi qui eventuali note mediche…"></textarea>
           <span class="form-hint">Lascia vuoto se non ci sono indicazioni particolari.</span>
         </div>
       </fieldset>`
    : '';

  return `
<form id="form-iscrizione" class="form-page" novalidate>
  <div id="form-success" class="alert alert-success hidden" role="alert">
    <span>
      <strong>Iscrizione inviata!</strong> Riceverai una email di conferma a breve.
      Torna al <a href="calendario.html">calendario</a> per scoprire altre attività.
    </span>
  </div>

  <div id="form-fields">

    <!-- DATI PARTECIPANTE -->
    <fieldset class="form-section">
      <legend>Dati del partecipante</legend>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="nome">Nome <span class="required" aria-hidden="true">*</span></label>
          <input type="text" id="nome" name="nome" class="form-control"
                 autocomplete="given-name" required placeholder="Mario">
          <span class="form-error" id="err-nome">Inserisci il nome.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="cognome">Cognome <span class="required" aria-hidden="true">*</span></label>
          <input type="text" id="cognome" name="cognome" class="form-control"
                 autocomplete="family-name" required placeholder="Rossi">
          <span class="form-error" id="err-cognome">Inserisci il cognome.</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="data_nascita">
          Data di nascita <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="date" id="data_nascita" name="data_nascita" class="form-control"
               required autocomplete="bday">
        <span class="form-hint">Serve per determinare se è necessario il consenso del genitore.</span>
        <span class="form-error" id="err-data_nascita">Inserisci la data di nascita.</span>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="email_contatto">
            Email <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="email" id="email_contatto" name="email_contatto" class="form-control"
                 autocomplete="email" required placeholder="mario.rossi@email.it">
          <span class="form-error" id="err-email_contatto">Inserisci un indirizzo email valido.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="telefono">Telefono</label>
          <input type="tel" id="telefono" name="telefono" class="form-control"
                 autocomplete="tel" placeholder="+39 333 1234567">
        </div>
      </div>
    </fieldset>

    <!-- DATI GENITORE (mostrato se minorenne) -->
    <fieldset class="form-section hidden" id="sezione-genitore">
      <legend>Dati del genitore / tutore</legend>
      <span class="form-hint" style="display:block;margin-bottom:var(--space-md)">
        Il partecipante è minorenne: compila i dati del genitore o tutore legale.
      </span>
      <div class="form-group">
        <label class="form-label" for="nome_genitore">
          Nome e cognome del genitore <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="text" id="nome_genitore" name="nome_genitore" class="form-control"
               autocomplete="name" placeholder="Anna Rossi">
        <span class="form-error" id="err-nome_genitore">Inserisci il nome del genitore.</span>
      </div>
    </fieldset>

    ${noteMedicheHTML}
    ${extraHTML}

    <!-- CONSENSO PRIVACY -->
    <fieldset class="form-section">
      <legend>Consenso</legend>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="consenso_privacy" name="consenso_privacy" required>
          <span class="form-check-label">
            Ho letto e accetto la <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.
            Acconsento al trattamento dei dati personali per la gestione dell'iscrizione.
            <span class="required" aria-hidden="true">*</span>
          </span>
        </label>
        <span class="form-error" id="err-consenso_privacy">Devi accettare la privacy policy per procedere.</span>
      </div>
    </fieldset>

    <div id="form-error-generale" class="alert alert-error hidden" role="alert"></div>

    <button type="submit" class="btn btn-accent btn-lg btn-full" id="btn-submit">
      Invia iscrizione
    </button>

  </div>
</form>
  `.trim();
}

function renderCampoExtra(campo) {
  const req = campo.obbligatorio
    ? `<span class="required" aria-hidden="true">*</span>` : '';

  let input = '';
  switch (campo.tipo) {
    case 'testo_breve':
      input = `<input type="text" id="extra_${campo.id}" name="extra_${campo.id}"
                      class="form-control" ${campo.obbligatorio ? 'required' : ''}>`;
      break;
    case 'numero':
      input = `<input type="number" id="extra_${campo.id}" name="extra_${campo.id}"
                      class="form-control" ${campo.obbligatorio ? 'required' : ''}>`;
      break;
    case 'data':
      input = `<input type="date" id="extra_${campo.id}" name="extra_${campo.id}"
                      class="form-control" ${campo.obbligatorio ? 'required' : ''}>`;
      break;
    case 'checkbox':
      return `
        <div class="form-group">
          <label class="form-check">
            <input type="checkbox" id="extra_${campo.id}" name="extra_${campo.id}"
                   ${campo.obbligatorio ? 'required' : ''}>
            <span class="form-check-label">${campo.label} ${req}</span>
          </label>
        </div>`;
    case 'select':
      const opzioni = (campo.opzioni || [])
        .map(o => `<option value="${o}">${o}</option>`)
        .join('');
      input = `<select id="extra_${campo.id}" name="extra_${campo.id}"
                       class="form-control" ${campo.obbligatorio ? 'required' : ''}>
                 <option value="">Seleziona…</option>
                 ${opzioni}
               </select>`;
      break;
    default:
      input = `<input type="text" id="extra_${campo.id}" name="extra_${campo.id}" class="form-control">`;
  }

  return `
    <div class="form-group">
      <label class="form-label" for="extra_${campo.id}">${campo.label} ${req}</label>
      ${input}
    </div>`;
}

// ──────────────────────────────────────────────
// FORM LOGIC
// ──────────────────────────────────────────────

function initForm(attivita, showNoteMediche, campiExtra) {
  const form          = document.getElementById('form-iscrizione');
  const dataNascitaEl = document.getElementById('data_nascita');
  const sezioneGen    = document.getElementById('sezione-genitore');
  const nomeGenEl     = document.getElementById('nome_genitore');

  // Mostra/nasconde sezione genitore in base all'età
  dataNascitaEl.addEventListener('change', () => {
    const minore = isMinorenne(dataNascitaEl.value);
    sezioneGen.classList.toggle('hidden', !minore);
    if (nomeGenEl) nomeGenEl.required = minore;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validaForm(form, campiExtra)) return;
    await inviaIscrizione(form, attivita, campiExtra);
  });
}

function isMinorenne(dataNascita) {
  if (!dataNascita) return false;
  const nascita = new Date(dataNascita + 'T00:00:00');
  const oggi    = new Date();
  let eta = oggi.getFullYear() - nascita.getFullYear();
  const m = oggi.getMonth() - nascita.getMonth();
  if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) eta--;
  return eta < 18;
}

function validaForm(form, campiExtra) {
  let valido = true;

  // Rimuovi errori precedenti
  form.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));

  function segnaErrore(id) {
    const el = document.getElementById(id);
    if (el) el.closest('.form-group')?.classList.add('has-error');
    valido = false;
  }

  const nome         = form.querySelector('#nome');
  const cognome      = form.querySelector('#cognome');
  const dataNascita  = form.querySelector('#data_nascita');
  const email        = form.querySelector('#email_contatto');
  const privacy      = form.querySelector('#consenso_privacy');
  const nomeGenitore = form.querySelector('#nome_genitore');

  if (!nome?.value.trim())        segnaErrore('nome');
  if (!cognome?.value.trim())     segnaErrore('cognome');
  if (!dataNascita?.value)        segnaErrore('data_nascita');
  if (!email?.value.includes('@')) segnaErrore('email_contatto');
  if (!privacy?.checked)          segnaErrore('consenso_privacy');

  if (nomeGenitore?.required && !nomeGenitore.value.trim()) {
    segnaErrore('nome_genitore');
  }

  // Campi extra obbligatori
  campiExtra.filter(c => c.obbligatorio).forEach(c => {
    const el = form.querySelector(`#extra_${c.id}`);
    if (!el) return;
    const vuoto = el.type === 'checkbox' ? !el.checked : !el.value.trim();
    if (vuoto) {
      el.closest('.form-group')?.classList.add('has-error');
      valido = false;
    }
  });

  if (!valido) {
    form.querySelector('.form-group.has-error')
        ?.querySelector('input, select, textarea')
        ?.focus();
  }

  return valido;
}

async function inviaIscrizione(form, attivita, campiExtra) {
  const btn     = document.getElementById('btn-submit');
  const errBox  = document.getElementById('form-error-generale');

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Invio in corso…`;
  errBox.classList.add('hidden');

  // Raccoglie risposte campi extra
  const risposteExtra = {};
  campiExtra.forEach(c => {
    const el = form.querySelector(`#extra_${c.id}`);
    if (!el) return;
    risposteExtra[c.id] = el.type === 'checkbox' ? el.checked : el.value;
  });

  const payload = {
    attivita_id:    attivita.id,
    nome:           form.querySelector('#nome').value.trim(),
    cognome:        form.querySelector('#cognome').value.trim(),
    data_nascita:   form.querySelector('#data_nascita').value,
    email_contatto: form.querySelector('#email_contatto').value.trim(),
    telefono:       form.querySelector('#telefono')?.value.trim() || null,
    nome_genitore:  form.querySelector('#nome_genitore')?.value.trim() || null,
    note_mediche:   form.querySelector('#note_mediche')?.value.trim() || null,
    risposte_extra: risposteExtra,
    consenso_privacy: true,
  };

  const { error } = await apiPost('iscrizioni.insert', payload);

  if (error) {
    btn.disabled = false;
    btn.innerHTML = 'Invia iscrizione';
    errBox.textContent = `Si è verificato un errore: ${error.message}. Riprova o contattaci direttamente.`;
    errBox.classList.remove('hidden');
    return;
  }

  // Successo
  document.getElementById('form-fields').classList.add('hidden');
  document.getElementById('form-success').classList.remove('hidden');
  window.scrollTo({ top: document.getElementById('form-iscrizione').offsetTop - 80, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// MODULO CAMPO MINORI
// ──────────────────────────────────────────────

function buildFormCampoMinoriHTML() {
  return `
<form id="form-iscrizione" class="form-page" novalidate>
  <div id="form-success" class="alert alert-success hidden" role="alert">
    <span>
      <strong>Iscrizione inviata!</strong> Riceverai una email di conferma a breve.
      Torna al <a href="calendario.html">calendario</a> per scoprire altre attività.
    </span>
  </div>

  <div id="form-fields">

    <fieldset class="form-section">
      <legend>Dati del ragazzo / della ragazza</legend>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="nome">
            Nome <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="text" id="nome" name="nome" class="form-control"
                 autocomplete="given-name" required placeholder="Mario">
          <span class="form-error" id="err-nome">Inserisci il nome.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="cognome">
            Cognome <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="text" id="cognome" name="cognome" class="form-control"
                 autocomplete="family-name" required placeholder="Rossi">
          <span class="form-error" id="err-cognome">Inserisci il cognome.</span>
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="data_nascita">
            Data di nascita <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="date" id="data_nascita" name="data_nascita" class="form-control" required>
          <span class="form-error" id="err-data_nascita">Inserisci la data di nascita.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="unita">
            Reparto <span class="required" aria-hidden="true">*</span>
          </label>
          <select id="unita" name="unita" class="form-control" required>
            <option value="">Seleziona…</option>
            <option value="coccinelle">Coccinelle</option>
            <option value="lupetti">Lupetti</option>
            <option value="guide">Guide</option>
            <option value="scout">Scout</option>
          </select>
          <span class="form-error" id="err-unita">Seleziona il reparto.</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="codice_fiscale_ragazzo">
          Codice fiscale del ragazzo/a <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="text" id="codice_fiscale_ragazzo" name="codice_fiscale_ragazzo"
               class="form-control" required placeholder="RSSMRA10A01C933K"
               maxlength="16" style="text-transform:uppercase">
        <span class="form-error" id="err-codice_fiscale_ragazzo">Inserisci il codice fiscale del ragazzo/a.</span>
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Dati del genitore / tutore</legend>

      <div class="form-group">
        <label class="form-label" for="nome_genitore">
          Nome e cognome del genitore <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="text" id="nome_genitore" name="nome_genitore" class="form-control"
               autocomplete="name" required placeholder="Anna Rossi">
        <span class="form-error" id="err-nome_genitore">Inserisci il nome e cognome del genitore.</span>
      </div>

      <div class="form-group">
        <label class="form-label" for="codice_fiscale_genitore">
          Codice fiscale del genitore <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="text" id="codice_fiscale_genitore" name="codice_fiscale_genitore"
               class="form-control" required placeholder="RSSMRA80A01C933K"
               maxlength="16" style="text-transform:uppercase">
        <span class="form-error" id="err-codice_fiscale_genitore">Inserisci il codice fiscale del genitore.</span>
      </div>

      <div class="form-group">
        <label class="form-label" for="indirizzo_genitore">
          Indirizzo (reperibilità durante il campo) <span class="required" aria-hidden="true">*</span>
        </label>
        <input type="text" id="indirizzo_genitore" name="indirizzo_genitore" class="form-control"
               autocomplete="street-address" required placeholder="Via Roma 1, Como">
        <span class="form-error" id="err-indirizzo_genitore">Inserisci l'indirizzo di reperibilità.</span>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="telefono">
            Telefono 1 <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="tel" id="telefono" name="telefono" class="form-control"
                 autocomplete="tel" required placeholder="+39 333 1234567">
          <span class="form-error" id="err-telefono">Inserisci un numero di telefono.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="telefono_2">Telefono 2</label>
          <input type="tel" id="telefono_2" name="telefono_2" class="form-control"
                 autocomplete="tel" placeholder="+39 333 7654321">
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="telefono_3">Telefono 3</label>
          <input type="tel" id="telefono_3" name="telefono_3" class="form-control"
                 autocomplete="tel" placeholder="+39 333 0000000">
        </div>
        <div class="form-group">
          <label class="form-label" for="email_contatto">
            Email del genitore <span class="required" aria-hidden="true">*</span>
          </label>
          <input type="email" id="email_contatto" name="email_contatto" class="form-control"
                 autocomplete="email" required placeholder="anna.rossi@email.it">
          <span class="form-error" id="err-email_contatto">Inserisci un indirizzo email valido.</span>
        </div>
      </div>
    </fieldset>

    <fieldset class="form-section">
      <legend>Dichiarazioni</legend>

      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="consenso_autorizzazione" name="consenso_autorizzazione" required>
          <span class="form-check-label">
            Il sottoscritto <strong>AUTORIZZA</strong> il/la proprio/a figlio/a a partecipare
            al campo estivo dell'Associazione AGGS Como.
            <span class="required" aria-hidden="true">*</span>
          </span>
        </label>
        <span class="form-error" id="err-consenso_autorizzazione">Questa dichiarazione è obbligatoria.</span>
      </div>

      <div class="form-group" style="margin-top:var(--space-md)">
        <label class="form-check">
          <input type="checkbox" id="consenso_esonero" name="consenso_esonero" required>
          <span class="form-check-label">
            Il sottoscritto <strong>ESONERA</strong> i capi e gli incaricati da ogni responsabilità
            civile o penale derivante da incidenti non dipendenti dalla loro incuria.
            <span class="required" aria-hidden="true">*</span>
          </span>
        </label>
        <span class="form-error" id="err-consenso_esonero">Questa dichiarazione è obbligatoria.</span>
      </div>

      <div class="form-group" style="margin-top:var(--space-md)">
        <label class="form-check">
          <input type="checkbox" id="presa_visione_documenti" name="presa_visione_documenti" required>
          <span class="form-check-label">
            Sono consapevole che l'iscrizione sarà ritenuta valida solo dopo l'invio via email
            della copia del documento d'identità del genitore e del ragazzo/a, allegata al modulo
            di iscrizione e alla scheda medica debitamente compilata.
            <span class="required" aria-hidden="true">*</span>
          </span>
        </label>
        <span class="form-error" id="err-presa_visione_documenti">Questa dichiarazione è obbligatoria.</span>
      </div>
    </fieldset>

    <div style="background:rgba(0,57,133,.07);border-left:4px solid var(--color-primary);
                border-radius:var(--radius-md);padding:var(--space-lg);margin-bottom:var(--space-lg)">
      <p style="font-weight:600;color:var(--color-primary);margin-bottom:var(--space-sm)">
        Informazioni sul pagamento
      </p>
      <p style="font-size:.875rem;line-height:1.7;margin:0">
        La quota sarà comunicata nelle prossime comunicazioni. Il pagamento potrà essere
        effettuato solo tramite bonifico intestato a
        <strong>ASSOCIAZIONE GRUPPI GUIDE E SCOUT COMO</strong> —
        Banca: Credit Agricole —
        IBAN: <strong>IT05B0623010996000046690131</strong> —
        Causale: <em>Nome e cognome ragazzo – Partecipazione attività scoutistica</em>
      </p>
    </div>

    <fieldset class="form-section">
      <legend>Consenso privacy</legend>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" id="consenso_privacy" name="consenso_privacy" required>
          <span class="form-check-label">
            Ho letto e accetto la <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.
            Acconsento al trattamento dei dati personali per la gestione dell'iscrizione.
            <span class="required" aria-hidden="true">*</span>
          </span>
        </label>
        <span class="form-error" id="err-consenso_privacy">Devi accettare la privacy policy per procedere.</span>
      </div>
    </fieldset>

    <div id="form-error-generale" class="alert alert-error hidden" role="alert"></div>

    <button type="submit" class="btn btn-accent btn-lg btn-full" id="btn-submit">
      Invia iscrizione
    </button>

  </div>
</form>
  `.trim();
}

function initFormCampoMinori(attivita) {
  const form = document.getElementById('form-iscrizione');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validaFormCampoMinori(form)) return;
    await inviaIscrizioneCampoMinori(form, attivita);
  });
}

function validaFormCampoMinori(form) {
  let valido = true;
  form.querySelectorAll('.form-group.has-error').forEach(g => g.classList.remove('has-error'));

  function segnaErrore(id) {
    const el = document.getElementById(id);
    if (el) el.closest('.form-group')?.classList.add('has-error');
    valido = false;
  }

  ['nome', 'cognome', 'data_nascita', 'unita', 'nome_genitore',
   'codice_fiscale_ragazzo', 'codice_fiscale_genitore',
   'indirizzo_genitore', 'telefono'].forEach(id => {
    if (!form.querySelector(`#${id}`)?.value.trim()) segnaErrore(id);
  });

  const email = form.querySelector('#email_contatto');
  if (!email?.value.trim()) {
    segnaErrore('email_contatto');
  } else if (!email.value.includes('@')) {
    segnaErrore('email_contatto');
  }

  ['consenso_autorizzazione', 'consenso_esonero',
   'presa_visione_documenti', 'consenso_privacy'].forEach(id => {
    if (!form.querySelector(`#${id}`)?.checked) segnaErrore(id);
  });

  if (!valido) {
    form.querySelector('.form-group.has-error')
        ?.querySelector('input, select, textarea')
        ?.focus();
  }
  return valido;
}

async function inviaIscrizioneCampoMinori(form, attivita) {
  const btn    = document.getElementById('btn-submit');
  const errBox = document.getElementById('form-error-generale');

  btn.disabled  = true;
  btn.innerHTML = `<span class="spinner"></span> Invio in corso…`;
  errBox.classList.add('hidden');

  const payload = {
    attivita_id:             attivita.id,
    nome:                    form.querySelector('#nome').value.trim(),
    cognome:                 form.querySelector('#cognome').value.trim(),
    data_nascita:            form.querySelector('#data_nascita').value,
    email_contatto:          form.querySelector('#email_contatto').value.trim(),
    telefono:                form.querySelector('#telefono').value.trim(),
    nome_genitore:           form.querySelector('#nome_genitore').value.trim(),
    indirizzo_genitore:      form.querySelector('#indirizzo_genitore').value.trim(),
    telefono_2:              form.querySelector('#telefono_2')?.value.trim() || null,
    telefono_3:              form.querySelector('#telefono_3')?.value.trim() || null,
    consenso_autorizzazione: true,
    consenso_esonero:        true,
    presa_visione_documenti: true,
    consenso_privacy:        true,
    risposte_extra: {
      unita:                   form.querySelector('#unita').value,
      codice_fiscale_ragazzo:  form.querySelector('#codice_fiscale_ragazzo').value.trim().toUpperCase(),
      codice_fiscale_genitore: form.querySelector('#codice_fiscale_genitore').value.trim().toUpperCase(),
    },
  };

  const { error } = await apiPost('iscrizioni.insert', payload);

  if (error) {
    btn.disabled  = false;
    btn.innerHTML = 'Invia iscrizione';
    errBox.textContent = `Si è verificato un errore: ${error.message}. Riprova o contattaci direttamente.`;
    errBox.classList.remove('hidden');
    return;
  }

  document.getElementById('form-fields').classList.add('hidden');
  document.getElementById('form-success').classList.remove('hidden');
  window.scrollTo({ top: document.getElementById('form-iscrizione').offsetTop - 80, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// UTILITÀ
// ──────────────────────────────────────────────

function formatData(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function calDataFine(iso) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function urlGoogleCal(a) {
  const fine = a.data_fine || a.data_inizio;
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    a.nome,
    dates:   `${a.data_inizio.replace(/-/g, '')}/${calDataFine(fine)}`,
    details: (a.descrizione || '').replace(/<[^>]*>/g, ''),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function mostraErrore(msg, conLink = false) {
  document.getElementById('page-content').innerHTML = `
    <div class="section">
      <div class="container-sm">
        <div class="empty-state">
          <div class="empty-state-icon" aria-hidden="true">😕</div>
          <p>${msg}</p>
          ${conLink ? `<a href="calendario.html" class="btn btn-primary mt-md">Torna al calendario</a>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// START
// ──────────────────────────────────────────────

init();
