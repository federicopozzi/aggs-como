import { apiPost } from './api.js';

// La password è verificata da Apps Script e inviata con ogni richiesta admin.
const SESSION_KEY = 'aggs_admin_pwd';

async function adminApi(action, data = {}) {
  const res = await apiPost(action, data, sessionStorage.getItem(SESSION_KEY));
  if (res.error?.code === 'unauthorized') doLogout();
  return res;
}

const db = {
  select: (table, opts = {})    => adminApi('admin.select', { table, ...opts }),
  get:    (table, id)           => adminApi('admin.select', { table, where: { id }, single: true }),
  insert: (table, row)          => adminApi('admin.insert', { table, row }),
  update: (table, where, patch) => adminApi('admin.update', { table, where, patch }),
  delete: (table, id)           => adminApi('admin.delete', { table, id }),
};

// ──────────────────────────────────────────────
// TOAST (locale — admin.html non carica components.js)
// ──────────────────────────────────────────────

(function initAdminToast() {
  if (window.showToast) return;
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: '9000',
    display: 'flex', flexDirection: 'column', gap: '0.5rem', pointerEvents: 'none',
  });
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  window.showToast = function(msg, type = 'success') {
    const bg = { success: '#2d7a47', error: '#c0392b', info: '#061991' }[type] || '#061991';
    const t = document.createElement('div');
    Object.assign(t.style, {
      background: bg, color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '8px',
      fontSize: '0.875rem', fontWeight: '500', maxWidth: '320px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.18)', pointerEvents: 'auto',
      opacity: '0', transform: 'translateY(0.5rem)', transition: 'opacity 0.2s, transform 0.2s',
    });
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      t.style.opacity = '0'; t.style.transform = 'translateY(0.5rem)';
      setTimeout(() => t.remove(), 250);
    }, 3500);
  };
})();

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────

function isLoggedIn() {
  return !!sessionStorage.getItem(SESSION_KEY);
}

async function doLogin(password) {
  const { error } = await apiPost('admin.login', {}, password);
  if (error) return false;
  sessionStorage.setItem(SESSION_KEY, password);
  return true;
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById('admin-panel').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-password').value = '';
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────

function init() {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    if (await doLogin(document.getElementById('login-password').value)) {
      errEl.classList.add('hidden');
      startAdmin();
    } else {
      errEl.classList.remove('hidden');
      document.getElementById('login-password').value = '';
      document.getElementById('login-password').focus();
    }
  });

  if (isLoggedIn()) startAdmin();
}

function startAdmin() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');

  document.getElementById('btn-logout').addEventListener('click', doLogout);

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  initModalAttivita();
  initModalAvviso();
  loadAttivita();
}

// ──────────────────────────────────────────────
// TABS
// ──────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.getElementById('panel-attivita').classList.toggle('hidden', tab !== 'attivita');
  document.getElementById('panel-iscrizioni').classList.toggle('hidden', tab !== 'iscrizioni');
  document.getElementById('panel-avvisi').classList.toggle('hidden', tab !== 'avvisi');
  document.getElementById('panel-impostazioni').classList.toggle('hidden', tab !== 'impostazioni');

  if (tab === 'attivita')     loadAttivita();
  if (tab === 'iscrizioni')   initIscrizioni();
  if (tab === 'avvisi')       loadAvvisiAdmin();
  if (tab === 'impostazioni') loadImpostazioni();
}

// ──────────────────────────────────────────────
// ATTIVITÀ — LISTA
// ──────────────────────────────────────────────

const TIPO_LABEL = {
  uscita_giorno: 'Uscita',
  campo:         'Campo',
  riunione:      'Riunione',
  evento:        'Evento',
};

async function loadAttivita() {
  const el = document.getElementById('attivita-list');
  el.innerHTML = '<div class="loading-overlay"><span class="spinner"></span><span>Caricamento…</span></div>';

  const { data, error } = await db.select('attivita', { order: 'data_inizio', desc: true });

  if (error) {
    el.innerHTML = `<div class="alert alert-error">Errore: ${error.message}</div>`;
    return;
  }

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true"><span class="icon">assignment</span></div>
        <p>Nessuna attività trovata. Creane una con il pulsante qui sopra.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Data</th>
            <th>Quota</th>
            <th>Form</th>
            <th>Stato</th>
            <th style="width:260px"></th>
          </tr>
        </thead>
        <tbody>${data.map(renderAttivitaRow).join('')}</tbody>
      </table>
    </div>`;

  el.querySelectorAll('[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () =>
      toggleAttiva(btn.dataset.toggleId, btn.dataset.attiva === 'true')
    );
  });

  el.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', () => apriModalModifica(btn.dataset.editId));
  });

  el.querySelectorAll('[data-form-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () =>
      toggleFormIscrizione(btn.dataset.formToggleId, btn.dataset.haForm === 'true')
    );
  });
}

function renderAttivitaRow(a) {
  const dataStr = formatData(a.data_inizio) +
    (a.data_fine && a.data_fine !== a.data_inizio ? ' – ' + formatData(a.data_fine) : '');

  return `
    <tr>
      <td style="font-weight:500;max-width:240px">${a.nome}</td>
      <td><span class="badge badge-${a.tipo}">${TIPO_LABEL[a.tipo] || a.tipo}</span></td>
      <td style="white-space:nowrap;font-size:.875rem">${dataStr}</td>
      <td>${a.quota > 0 ? `€${Number(a.quota).toLocaleString('it-IT')}` : '<span class="text-muted">—</span>'}</td>
      <td>${a.ha_form_iscrizione ? '<span class="badge badge-primary">Sì</span>' : '<span class="text-muted">—</span>'}</td>
      <td>${a.attiva
        ? '<span class="badge badge-success">Attiva</span>'
        : '<span class="badge badge-neutral">Non attiva</span>'}</td>
      <td>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm btn-outline"
                  data-edit-id="${a.id}" aria-label="Modifica ${a.nome}">
            Modifica
          </button>
          <button class="btn btn-sm btn-ghost"
                  data-form-toggle-id="${a.id}" data-ha-form="${a.ha_form_iscrizione}"
                  style="${a.ha_form_iscrizione ? 'color:var(--color-error)' : 'color:var(--color-success)'}">
            ${a.ha_form_iscrizione ? 'Chiudi iscr.' : 'Apri iscr.'}
          </button>
          <button class="btn btn-sm ${a.attiva ? 'btn-ghost' : 'btn-outline'}"
                  data-toggle-id="${a.id}" data-attiva="${a.attiva}">
            ${a.attiva ? 'Disattiva' : 'Attiva'}
          </button>
        </div>
      </td>
    </tr>`;
}

async function toggleAttiva(id, attualmenteAttiva) {
  if (attualmenteAttiva) {
    const ok = confirm('Disattivare questa attività? Non sarà più visibile sul sito.');
    if (!ok) return;
  }

  const { error } = await db.update('attivita', { id }, { attiva: !attualmenteAttiva });

  if (error) {
    if (window.showToast) window.showToast(`Errore: ${error.message}`, 'error');
    else alert(`Errore: ${error.message}`);
    return;
  }

  if (window.showToast) {
    window.showToast(attualmenteAttiva ? 'Attività disattivata.' : 'Attività attivata.');
  }
  loadAttivita();
}

async function toggleFormIscrizione(id, haFormAttuale) {
  if (haFormAttuale) {
    const ok = confirm('Chiudere le iscrizioni? Il form non sarà più visibile sul sito.');
    if (!ok) return;
  }

  const { error } = await db.update('attivita', { id }, { ha_form_iscrizione: !haFormAttuale });

  if (error) {
    if (window.showToast) window.showToast(`Errore: ${error.message}`, 'error');
    return;
  }

  if (window.showToast) {
    window.showToast(haFormAttuale ? 'Iscrizioni chiuse.' : 'Iscrizioni aperte.');
  }
  loadAttivita();
}

// ──────────────────────────────────────────────
// MODAL — NUOVA ATTIVITÀ
// ──────────────────────────────────────────────

let campiExtra = [];
let documenti  = [];
let editingId  = null;

function syncNotaIscrizioni() {
  document.getElementById('nota-iscrizioni-group')
    .classList.toggle('hidden', document.getElementById('att-ha-form').checked);
}

function initModalAttivita() {
  document.getElementById('btn-nuova-attivita').addEventListener('click', () => {
    editingId  = null;
    campiExtra = [];
    documenti  = [];
    document.getElementById('form-attivita').reset();
    document.getElementById('att-attiva').checked = true;
    document.getElementById('modal-att-title').textContent = 'Nuova attività';
    document.getElementById('modal-att-save').textContent = 'Salva attività';
    document.getElementById('modal-att-delete').classList.add('hidden');
    syncNotaIscrizioni();
    renderCampiExtraList();
    renderDocumentiList();
    apriModal();
  });

  document.getElementById('modal-att-close').addEventListener('click', chiudiModal);
  document.getElementById('modal-att-cancel').addEventListener('click', chiudiModal);
  document.getElementById('modal-attivita').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) chiudiModal();
  });

  document.getElementById('modal-att-save').addEventListener('click', salvaAttivita);
  document.getElementById('modal-att-delete').addEventListener('click', eliminaAttivita);

  // Builder
  document.getElementById('att-ha-form').addEventListener('change', syncNotaIscrizioni);
  syncNotaIscrizioni();

  // Documenti PDF
  document.getElementById('btn-carica-pdf').addEventListener('click', () => {
    document.getElementById('input-pdf').click();
  });

  document.getElementById('input-pdf').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    e.target.value = '';
    if (!files.length) return;

    const progress = document.getElementById('upload-doc-progress');
    const btn      = document.getElementById('btn-carica-pdf');
    progress.style.display = 'flex';
    btn.disabled = true;

    for (const file of files) {
      try {
        const doc = await uploadPDF(file);
        documenti.push(doc);
      } catch (err) {
        window.showToast(`Errore: ${err.message}`, 'error');
      }
    }

    progress.style.display = 'none';
    btn.disabled = false;
    renderDocumentiList();
  });

  document.getElementById('btn-aggiungi-campo').addEventListener('click', () => {
    document.getElementById('aggiungi-campo-box').classList.remove('hidden');
    document.getElementById('btn-aggiungi-campo').classList.add('hidden');
    document.getElementById('campo-label').focus();
  });

  document.getElementById('btn-annulla-campo').addEventListener('click', () => {
    chiudiFormCampo();
  });

  document.getElementById('campo-tipo').addEventListener('change', (e) => {
    document.getElementById('campo-opzioni-group')
      .classList.toggle('hidden', e.target.value !== 'select');
  });

  document.getElementById('btn-conferma-campo').addEventListener('click', aggiungiCampo);
}

function apriModal() {
  document.getElementById('modal-attivita').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  document.getElementById('form-att-error').classList.add('hidden');
  document.getElementById('att-nome').focus();
}

function chiudiModal() {
  editingId = null;
  document.getElementById('modal-attivita').classList.remove('is-open');
  document.body.style.overflow = '';
  chiudiFormCampo();
  document.getElementById('form-att-error').classList.add('hidden');
  document.querySelectorAll('#form-attivita .form-group.has-error')
    .forEach(g => g.classList.remove('has-error'));
}

async function apriModalModifica(id) {
  editingId = id;
  campiExtra = [];
  document.getElementById('form-attivita').reset();
  document.getElementById('modal-att-title').textContent = 'Modifica attività';
  document.getElementById('modal-att-save').textContent = 'Salva modifiche';
  document.getElementById('modal-att-delete').classList.remove('hidden');
  document.getElementById('form-att-error').classList.add('hidden');
  renderCampiExtraList();
  apriModal();

  const { data, error } = await db.get('attivita', id);

  if (error) {
    document.getElementById('form-att-error').textContent = `Errore nel caricamento: ${error.message}`;
    document.getElementById('form-att-error').classList.remove('hidden');
    return;
  }

  document.getElementById('att-nome').value        = data.nome || '';
  document.getElementById('att-descrizione').value  = data.descrizione || '';
  document.getElementById('att-tipo').value         = data.tipo || '';
  document.getElementById('att-data-inizio').value  = data.data_inizio || '';
  document.getElementById('att-data-fine').value    = data.data_fine || '';
  document.getElementById('att-quota').value        = data.quota != null ? data.quota : 0;
  document.getElementById('att-immagine').value     = data.immagine_url || '';
  document.getElementById('att-ha-form').checked          = !!data.ha_form_iscrizione;
  document.getElementById('att-attiva').checked            = !!data.attiva;
  document.getElementById('att-nota-iscrizioni').value     = data.nota_iscrizioni || '';
  document.getElementById('att-tipo-modulo').value         = data.tipo_modulo || '';
  syncNotaIscrizioni();

  campiExtra = Array.isArray(data.campi_extra) ? [...data.campi_extra] : [];
  documenti  = Array.isArray(data.documenti)   ? [...data.documenti]   : [];
  renderCampiExtraList();
  renderDocumentiList();
}

function chiudiFormCampo() {
  document.getElementById('aggiungi-campo-box').classList.add('hidden');
  document.getElementById('btn-aggiungi-campo').classList.remove('hidden');
  document.getElementById('campo-label').value = '';
  document.getElementById('campo-tipo').value = 'testo_breve';
  document.getElementById('campo-opzioni').value = '';
  document.getElementById('campo-obbligatorio').checked = false;
  document.getElementById('campo-opzioni-group').classList.add('hidden');
  document.getElementById('err-campo-label').style.display = 'none';
}

function aggiungiCampo() {
  const label  = document.getElementById('campo-label').value.trim();
  const errEl  = document.getElementById('err-campo-label');

  if (!label) {
    errEl.style.display = 'block';
    document.getElementById('campo-label').focus();
    return;
  }
  errEl.style.display = 'none';

  const tipo    = document.getElementById('campo-tipo').value;
  const opzioni = tipo === 'select'
    ? document.getElementById('campo-opzioni').value
        .split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  const baseId = label.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const campo = {
    id:           `${baseId}_${campiExtra.length}`,
    label,
    tipo,
    obbligatorio: document.getElementById('campo-obbligatorio').checked,
    ...(tipo === 'select' && { opzioni }),
  };

  campiExtra.push(campo);
  renderCampiExtraList();
  chiudiFormCampo();
}

const TIPO_CAMPO_LABEL = {
  testo_breve: 'Testo',
  numero:      'Numero',
  data:        'Data',
  checkbox:    'Sì/No',
  select:      'Selezione',
};

function renderCampiExtraList() {
  const el = document.getElementById('campi-extra-list');
  if (!campiExtra.length) {
    el.innerHTML = '<p class="text-sm text-muted" style="margin-bottom:var(--space-md)">Nessun campo aggiuntivo.</p>';
    return;
  }
  el.innerHTML = campiExtra.map((c, i) => `
    <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) var(--space-md);
                background:var(--color-surface);border-radius:var(--radius-sm);
                border:1px solid var(--color-border);margin-bottom:var(--space-xs)">
      <span style="font-size:.875rem;flex:1;min-width:0;font-weight:500">${c.label}</span>
      <span class="badge badge-neutral">${TIPO_CAMPO_LABEL[c.tipo] || c.tipo}</span>
      ${c.obbligatorio ? '<span class="badge badge-accent">Obbligatorio</span>' : ''}
      <button type="button" class="btn btn-sm btn-ghost"
              style="color:var(--color-error);padding:.25rem .5rem;flex-shrink:0"
              data-rimuovi="${i}" aria-label="Rimuovi ${c.label}">✕</button>
    </div>`).join('');

  el.querySelectorAll('[data-rimuovi]').forEach(btn => {
    btn.addEventListener('click', () => {
      campiExtra.splice(parseInt(btn.dataset.rimuovi), 1);
      renderCampiExtraList();
    });
  });
}

// Il PDF viene salvato in una cartella Google Drive condivisa con link.
async function uploadPDF(file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const base64   = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Lettura del file non riuscita'));
    reader.readAsDataURL(file);
  });

  const { data, error } = await adminApi('admin.upload', {
    filename: `${Date.now()}-${safeName}`,
    base64,
  });

  if (error) throw error;
  const publicUrl = data.url;

  const nome = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
  return { nome, url: publicUrl };
}

function renderDocumentiList() {
  const el = document.getElementById('documenti-list');
  if (!documenti.length) {
    el.innerHTML = '<p class="text-sm text-muted" style="margin-bottom:var(--space-sm)">Nessun documento caricato.</p>';
    return;
  }
  el.innerHTML = documenti.map((d, i) => `
    <div style="display:flex;align-items:center;gap:var(--space-md);padding:var(--space-sm) var(--space-md);
                background:var(--color-surface);border-radius:var(--radius-sm);
                border:1px solid var(--color-border);margin-bottom:var(--space-xs)">
      <span style="font-size:1rem;flex-shrink:0" aria-hidden="true">📄</span>
      <span style="font-size:.875rem;flex:1;min-width:0;font-weight:500;
                   overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.nome}</span>
      <a href="${d.url}" target="_blank" rel="noopener"
         class="btn btn-sm btn-ghost" style="font-size:.8125rem;flex-shrink:0">Vedi</a>
      <button type="button" class="btn btn-sm btn-ghost"
              style="color:var(--color-error);padding:.25rem .5rem;flex-shrink:0"
              data-rimuovi-doc="${i}" aria-label="Rimuovi ${d.nome}">✕</button>
    </div>`).join('');

  el.querySelectorAll('[data-rimuovi-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      documenti.splice(parseInt(btn.dataset.rimuoviDoc), 1);
      renderDocumentiList();
    });
  });
}

async function salvaAttivita() {
  const nome       = document.getElementById('att-nome').value.trim();
  const tipo       = document.getElementById('att-tipo').value;
  const dataInizio = document.getElementById('att-data-inizio').value;
  const errEl      = document.getElementById('form-att-error');

  document.querySelectorAll('#form-attivita .form-group.has-error')
    .forEach(g => g.classList.remove('has-error'));
  errEl.classList.add('hidden');

  let valido = true;
  if (!nome)       { document.getElementById('att-nome').closest('.form-group').classList.add('has-error'); valido = false; }
  if (!tipo)       { document.getElementById('att-tipo').closest('.form-group').classList.add('has-error'); valido = false; }
  if (!dataInizio) { document.getElementById('att-data-inizio').closest('.form-group').classList.add('has-error'); valido = false; }
  if (!valido) return;

  const btn = document.getElementById('modal-att-save');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>';

  const payload = {
    nome,
    descrizione:        document.getElementById('att-descrizione').value.trim() || null,
    tipo,
    tipo_modulo:        document.getElementById('att-tipo-modulo').value || null,
    data_inizio:        dataInizio,
    data_fine:          document.getElementById('att-data-fine').value || null,
    quota:              parseFloat(document.getElementById('att-quota').value) || 0,
    immagine_url:       document.getElementById('att-immagine').value.trim() || null,
    ha_form_iscrizione: document.getElementById('att-ha-form').checked,
    nota_iscrizioni:    document.getElementById('att-nota-iscrizioni').value.trim() || null,
    attiva:             document.getElementById('att-attiva').checked,
    campi_extra:        campiExtra,
    documenti:          documenti,
  };

  const { error } = editingId
    ? await db.update('attivita', { id: editingId }, payload)
    : await db.insert('attivita', payload);

  btn.disabled  = false;
  btn.innerHTML = editingId ? 'Salva modifiche' : 'Salva attività';

  if (error) {
    errEl.textContent = `Errore nel salvataggio: ${error.message}`;
    errEl.classList.remove('hidden');
    return;
  }

  chiudiModal();
  loadAttivita();
  if (window.showToast) window.showToast(editingId ? 'Attività aggiornata.' : 'Attività salvata con successo.');
}

async function eliminaAttivita() {
  if (!editingId) return;
  if (!confirm('Eliminare questa attività definitivamente?\n\nVerranno eliminate anche tutte le iscrizioni collegate. L\'azione non è reversibile.')) return;

  const { error } = await db.delete('attivita', editingId);

  if (error) { window.showToast(`Errore: ${error.message}`, 'error'); return; }

  chiudiModal();
  loadAttivita();
  window.showToast('Attività eliminata.');
}

// ──────────────────────────────────────────────
// ISCRIZIONI
// ──────────────────────────────────────────────

let iscrizioniSelectInit = false;

async function initIscrizioni() {
  const { data, error } = await db.select('attivita', { order: 'data_inizio', desc: true });

  const select = document.getElementById('select-attivita-isc');
  if (error || !data) return;

  const prev = select.value;
  select.innerHTML = '<option value="">Scegli un\'attività…</option>' +
    data.map(a => `<option value="${a.id}">${a.nome} (${formatData(a.data_inizio)})</option>`).join('');

  if (prev) { select.value = prev; loadIscrizioni(prev); }

  if (!iscrizioniSelectInit) {
    select.addEventListener('change', () => {
      const id = select.value;
      document.getElementById('iscrizioni-content').innerHTML = id
        ? '<div class="loading-overlay"><span class="spinner"></span><span>Caricamento…</span></div>'
        : '<p class="text-muted">Seleziona un\'attività per vedere le iscrizioni.</p>';
      if (id) loadIscrizioni(id);
    });
    iscrizioniSelectInit = true;
  }
}

const STATO_BADGE = {
  in_attesa:  'badge-neutral',
  confermato: 'badge-success',
  annullato:  'badge-error',
};
const STATO_LABEL = {
  in_attesa:  'In attesa',
  confermato: 'Confermato',
  annullato:  'Annullato',
};

async function loadIscrizioni(attivitaId) {
  const el = document.getElementById('iscrizioni-content');
  el.innerHTML = '<div class="loading-overlay"><span class="spinner"></span><span>Caricamento…</span></div>';

  const { data, error } = await db.select('iscrizioni_attivita', {
    where: { attivita_id: attivitaId },
    order: 'data_iscrizione',
    desc:  true,
  });

  if (error) { el.innerHTML = `<div class="alert alert-error">Errore: ${error.message}</div>`; return; }

  if (!data.length) {
    el.innerHTML = '<p class="text-muted">Nessuna iscrizione per questa attività.</p>';
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                flex-wrap:wrap;gap:var(--space-md);margin-bottom:var(--space-md)">
      <p class="text-muted text-sm">
        ${data.length} iscrizione${data.length !== 1 ? 'i' : ''}
      </p>
      <button id="btn-export" class="btn btn-outline btn-sm">Esporta CSV</button>
    </div>
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th><th>Cognome</th><th>Email</th>
            <th>Telefono</th><th>Stato</th><th>Data</th><th>Azioni</th>
          </tr>
        </thead>
        <tbody>${data.map(renderIscrizioneRow).join('')}</tbody>
      </table>
    </div>`;

  el.querySelectorAll('[data-cambia-stato]').forEach(btn => {
    btn.addEventListener('click', () =>
      cambiaStato(btn.dataset.cambiaStato, btn.dataset.nuovo, attivitaId)
    );
  });

  document.getElementById('btn-export')
    .addEventListener('click', () => exportCSV(data));
}

function renderIscrizioneRow(i) {
  let azioni = '';
  if (i.stato === 'in_attesa') {
    azioni = `
      <button class="btn btn-sm btn-outline"
              style="color:var(--color-success);border-color:var(--color-success)"
              data-cambia-stato="${i.id}" data-nuovo="confermato">Conferma</button>
      <button class="btn btn-sm btn-ghost" style="color:var(--color-error)"
              data-cambia-stato="${i.id}" data-nuovo="annullato">Annulla</button>`;
  } else if (i.stato === 'confermato') {
    azioni = `<button class="btn btn-sm btn-ghost" style="color:var(--color-error)"
              data-cambia-stato="${i.id}" data-nuovo="annullato">Annulla</button>`;
  } else {
    azioni = `<button class="btn btn-sm btn-ghost"
              data-cambia-stato="${i.id}" data-nuovo="in_attesa">Ripristina</button>`;
  }

  return `
    <tr>
      <td>${i.nome}</td>
      <td>${i.cognome}</td>
      <td style="font-size:.875rem">
        <a href="mailto:${i.email_contatto}" style="color:var(--color-primary)">
          ${i.email_contatto}
        </a>
      </td>
      <td style="font-size:.875rem">${i.telefono || '—'}</td>
      <td><span class="badge ${STATO_BADGE[i.stato] || 'badge-neutral'}">
        ${STATO_LABEL[i.stato] || i.stato}
      </span></td>
      <td style="font-size:.875rem;white-space:nowrap">
        ${formatData((i.data_iscrizione || '').split('T')[0])}
      </td>
      <td style="display:flex;gap:var(--space-xs);flex-wrap:wrap">${azioni}</td>
    </tr>`;
}

async function cambiaStato(id, nuovoStato, attivitaId) {
  if (nuovoStato === 'annullato') {
    const ok = confirm('Annullare questa iscrizione? L\'iscritto verrà segnato come annullato.');
    if (!ok) return;
  }

  const { error } = await db.update('iscrizioni_attivita', { id }, { stato: nuovoStato });

  if (error) {
    if (window.showToast) window.showToast(`Errore: ${error.message}`, 'error');
    else alert(`Errore: ${error.message}`);
    return;
  }

  const labelStato = { confermato: 'Iscrizione confermata.', annullato: 'Iscrizione annullata.', in_attesa: 'Iscrizione ripristinata.' };
  if (window.showToast) window.showToast(labelStato[nuovoStato] || 'Stato aggiornato.');
  loadIscrizioni(attivitaId);
}

function exportCSV(data) {
  const colonne = [
    'nome','cognome','data_nascita','email_contatto','telefono',
    'nome_genitore','stato','data_iscrizione','note_mediche','note',
  ];

  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    colonne.join(';'),
    ...data.map(r => colonne.map(c => escape(r[c])).join(';')),
  ].join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `iscrizioni_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// AVVISI
// ──────────────────────────────────────────────

let editingAvvisoId = null;

const AVVISO_CONFIG = {
  info:       { label: 'Info',       badgeStyle: 'background:#061991;color:#fff' },
  importante: { label: 'Importante', badgeStyle: 'background:#EE891D;color:#fff' },
  urgente:    { label: 'Urgente',    badgeStyle: 'background:#c0392b;color:#fff' },
};

async function loadAvvisiAdmin() {
  const el = document.getElementById('avvisi-admin-list');
  el.innerHTML = '<div class="loading-overlay"><span class="spinner"></span><span>Caricamento…</span></div>';

  const { data, error } = await db.select('avvisi', { order: 'created_at', desc: true });

  if (error) {
    el.innerHTML = `<div class="alert alert-error">Errore: ${error.message}</div>`;
    return;
  }

  if (!data.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true"><span class="icon">campaign</span></div>
        <p>Nessun avviso. Creane uno con il pulsante qui sopra.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Titolo</th>
            <th>Scadenza</th>
            <th>Stato</th>
            <th style="width:220px"></th>
          </tr>
        </thead>
        <tbody>${data.map(renderAvvisoRow).join('')}</tbody>
      </table>
    </div>`;

  el.querySelectorAll('[data-edit-avviso]').forEach(btn => {
    btn.addEventListener('click', () => apriModalModificaAvviso(btn.dataset.editAvviso));
  });

  el.querySelectorAll('[data-toggle-avviso]').forEach(btn => {
    btn.addEventListener('click', () =>
      toggleAttivoAvviso(btn.dataset.toggleAvviso, btn.dataset.attivo === 'true')
    );
  });
}

function renderAvvisoRow(a) {
  const cfg      = AVVISO_CONFIG[a.tipo] || AVVISO_CONFIG.info;
  const scadenza = a.data_scadenza
    ? formatData(a.data_scadenza)
    : '<span class="text-muted">—</span>';

  return `
    <tr>
      <td><span class="badge" style="${cfg.badgeStyle}">${cfg.label}</span></td>
      <td style="font-weight:500;max-width:260px">${a.titolo}</td>
      <td style="font-size:.875rem">${scadenza}</td>
      <td>${a.attivo
        ? '<span class="badge badge-success">Attivo</span>'
        : '<span class="badge badge-neutral">Non attivo</span>'}</td>
      <td>
        <div style="display:flex;gap:var(--space-xs);flex-wrap:wrap;align-items:center">
          <button class="btn btn-sm btn-outline"
                  data-edit-avviso="${a.id}" aria-label="Modifica avviso">
            Modifica
          </button>
          <button class="btn btn-sm btn-ghost"
                  data-toggle-avviso="${a.id}" data-attivo="${a.attivo}">
            ${a.attivo ? 'Disattiva' : 'Attiva'}
          </button>
        </div>
      </td>
    </tr>`;
}

async function toggleAttivoAvviso(id, attivoAttuale) {
  const { error } = await db.update('avvisi', { id }, { attivo: !attivoAttuale });

  if (error) { window.showToast(`Errore: ${error.message}`, 'error'); return; }
  window.showToast(attivoAttuale ? 'Avviso disattivato.' : 'Avviso attivato.');
  loadAvvisiAdmin();
}

function initModalAvviso() {
  document.getElementById('btn-nuovo-avviso').addEventListener('click', () => {
    editingAvvisoId = null;
    document.getElementById('form-avviso').reset();
    document.getElementById('avv-attivo').checked = true;
    document.getElementById('modal-avviso-title').textContent = 'Nuovo avviso';
    document.getElementById('modal-avviso-save').textContent = 'Salva avviso';
    document.getElementById('modal-avviso-delete').classList.add('hidden');
    document.getElementById('form-avviso-error').classList.add('hidden');
    apriModalAvviso();
  });

  document.getElementById('modal-avviso-close').addEventListener('click', chiudiModalAvviso);
  document.getElementById('modal-avviso-cancel').addEventListener('click', chiudiModalAvviso);
  document.getElementById('modal-avviso').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) chiudiModalAvviso();
  });
  document.getElementById('modal-avviso-save').addEventListener('click', salvaAvviso);
  document.getElementById('modal-avviso-delete').addEventListener('click', eliminaAvviso);
}

function apriModalAvviso() {
  document.getElementById('modal-avviso').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  document.getElementById('avv-titolo').focus();
}

function chiudiModalAvviso() {
  editingAvvisoId = null;
  document.getElementById('modal-avviso').classList.remove('is-open');
  document.body.style.overflow = '';
  document.getElementById('form-avviso-error').classList.add('hidden');
}

async function apriModalModificaAvviso(id) {
  editingAvvisoId = id;
  document.getElementById('form-avviso').reset();
  document.getElementById('modal-avviso-title').textContent = 'Modifica avviso';
  document.getElementById('modal-avviso-save').textContent = 'Salva modifiche';
  document.getElementById('modal-avviso-delete').classList.remove('hidden');
  document.getElementById('form-avviso-error').classList.add('hidden');
  apriModalAvviso();

  const { data, error } = await db.get('avvisi', id);

  if (error) {
    document.getElementById('form-avviso-error').textContent = `Errore nel caricamento: ${error.message}`;
    document.getElementById('form-avviso-error').classList.remove('hidden');
    return;
  }

  document.getElementById('avv-titolo').value   = data.titolo || '';
  document.getElementById('avv-testo').value    = data.testo || '';
  document.getElementById('avv-tipo').value     = data.tipo || 'info';
  document.getElementById('avv-scadenza').value = data.data_scadenza || '';
  document.getElementById('avv-attivo').checked = !!data.attivo;
}

async function salvaAvviso() {
  const titolo = document.getElementById('avv-titolo').value.trim();
  const testo  = document.getElementById('avv-testo').value.trim();
  const errEl  = document.getElementById('form-avviso-error');

  errEl.classList.add('hidden');
  if (!titolo || !testo) {
    errEl.textContent = 'Titolo e testo sono obbligatori.';
    errEl.classList.remove('hidden');
    if (!titolo) document.getElementById('avv-titolo').focus();
    else         document.getElementById('avv-testo').focus();
    return;
  }

  const btn = document.getElementById('modal-avviso-save');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span>';

  const payload = {
    titolo,
    testo,
    tipo:          document.getElementById('avv-tipo').value,
    data_scadenza: document.getElementById('avv-scadenza').value || null,
    attivo:        document.getElementById('avv-attivo').checked,
  };

  const { error } = editingAvvisoId
    ? await db.update('avvisi', { id: editingAvvisoId }, payload)
    : await db.insert('avvisi', payload);

  btn.disabled    = false;
  btn.textContent = editingAvvisoId ? 'Salva modifiche' : 'Salva avviso';

  if (error) {
    errEl.textContent = `Errore nel salvataggio: ${error.message}`;
    errEl.classList.remove('hidden');
    return;
  }

  chiudiModalAvviso();
  loadAvvisiAdmin();
  window.showToast(editingAvvisoId ? 'Avviso aggiornato.' : 'Avviso pubblicato.');
}

async function eliminaAvviso() {
  if (!editingAvvisoId) return;
  if (!confirm('Eliminare questo avviso definitivamente? L\'azione non è reversibile.')) return;

  const { error } = await db.delete('avvisi', editingAvvisoId);

  if (error) { window.showToast(`Errore: ${error.message}`, 'error'); return; }

  chiudiModalAvviso();
  loadAvvisiAdmin();
  window.showToast('Avviso eliminato.');
}

// ──────────────────────────────────────────────
// IMPOSTAZIONI
// ──────────────────────────────────────────────

async function loadImpostazioni() {
  const badge = document.getElementById('iscrizioni-stato-badge');
  const btn   = document.getElementById('btn-toggle-iscrizioni');
  if (!badge || !btn) return;

  badge.innerHTML = '<span class="spinner" style="width:1.25rem;height:1.25rem;border-width:2px"></span>';
  btn.disabled    = true;
  btn.textContent = 'Caricamento…';

  const { data, error } = await db.select('impostazioni', { where: { chiave: 'iscrizioni_aperte' }, single: true });

  if (error) {
    badge.innerHTML = `
      <div class="alert alert-error" style="margin:0">
        Errore: ${error.message}<br>
        Esegui la funzione <code>setup</code> in Apps Script (vedi apps-script/README.md).
      </div>`;
    btn.textContent = 'Non disponibile';
    return;
  }

  renderStatoIscrizioni((data?.valore ?? 'true') !== 'false');
}

function renderStatoIscrizioni(aperte) {
  const badge = document.getElementById('iscrizioni-stato-badge');
  const btn   = document.getElementById('btn-toggle-iscrizioni');
  if (!badge || !btn) return;

  badge.innerHTML = aperte
    ? '<span class="badge badge-success" style="font-size:.9375rem;padding:.375rem .875rem">Aperte</span>'
    : '<span class="badge badge-neutral" style="font-size:.9375rem;padding:.375rem .875rem">Chiuse</span>';

  btn.textContent       = aperte ? 'Chiudi iscrizioni' : 'Apri iscrizioni';
  btn.style.background  = aperte ? 'var(--color-error)' : '#2d7a47';
  btn.style.borderColor = aperte ? 'var(--color-error)' : '#2d7a47';
  btn.disabled          = false;
  btn.onclick           = () => toggleIscrizioni(aperte);
}

async function toggleIscrizioni(attualmenteAperte) {
  if (attualmenteAperte) {
    const ok = confirm(
      'Chiudere le iscrizioni?\n\n' +
      'Il modulo di iscrizione e i pulsanti "Iscriviti" non saranno più visibili sul sito.'
    );
    if (!ok) return;
  }

  const btn = document.getElementById('btn-toggle-iscrizioni');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner" style="width:1rem;height:1rem;border-width:2px"></span>';

  const { error } = await db.update('impostazioni', { chiave: 'iscrizioni_aperte' }, {
    valore:     attualmenteAperte ? 'false' : 'true',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    window.showToast(`Errore: ${error.message}`, 'error');
    renderStatoIscrizioni(attualmenteAperte);
    return;
  }

  window.showToast(attualmenteAperte ? 'Iscrizioni chiuse.' : 'Iscrizioni aperte.');
  renderStatoIscrizioni(!attualmenteAperte);
}

// ──────────────────────────────────────────────
// UTILITÀ
// ──────────────────────────────────────────────

function formatData(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
  return isNaN(d) ? '—' : d.toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ──────────────────────────────────────────────
// START
// ──────────────────────────────────────────────

init();
