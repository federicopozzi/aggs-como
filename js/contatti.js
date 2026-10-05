import { apiPost, getImpostazione } from './api.js';

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────

function init() {
  document.getElementById('form-mailing').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validaForm()) return;
    await inviaIscrizione();
  });

  checkIscrizioniAperte();
}

async function checkIscrizioniAperte() {
  const { data, error } = await getImpostazione('iscrizioni_aperte');

  if (!error && (data?.valore ?? 'true') === 'false') {
    document.getElementById('box-iscrizione-cta')?.classList.add('hidden');
  }
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

  if (!document.getElementById('nome')?.value.trim())          segnaErrore('nome');
  if (!document.getElementById('cognome')?.value.trim())       segnaErrore('cognome');
  if (!document.getElementById('email')?.value.includes('@'))  segnaErrore('email');
  if (!document.getElementById('consenso_privacy')?.checked)   segnaErrore('consenso_privacy');

  if (!valido) {
    document.querySelector('.form-group.has-error')
      ?.querySelector('input, select')
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

  const payload = {
    email:            document.getElementById('email').value.trim().toLowerCase(),
    nome:             document.getElementById('nome').value.trim() || null,
    cognome:          document.getElementById('cognome').value.trim() || null,
    nome_ragazzo:     document.getElementById('nome_ragazzo').value.trim() || null,
    unita:            document.getElementById('unita').value || null,
    consenso_privacy: true,
    attivo:           true,
  };

  const { error } = await apiPost('contatti.insert', payload);

  if (error) {
    btn.disabled  = false;
    btn.innerHTML = 'Iscriviti alla newsletter';

    // Email già presente (violazione unique)
    if (error.code === 'duplicate') {
      errBox.textContent = 'Questa email è già iscritta alla newsletter.';
    } else {
      errBox.textContent = `Si è verificato un errore: ${error.message}. Riprova o scrivici a aggscomo@gmail.com.`;
    }
    errBox.classList.remove('hidden');
    return;
  }

  document.getElementById('form-fields').classList.add('hidden');
  document.getElementById('form-success').classList.remove('hidden');
}

// ──────────────────────────────────────────────
// START
// ──────────────────────────────────────────────

init();
