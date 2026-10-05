import { apiGet } from './api.js';

const TIPO_LABEL = {
  uscita_giorno: 'Uscita',
  campo:         'Campo',
  riunione:      'Riunione',
  evento:        'Evento',
};

const GIORNI_SETTIMANA = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Stato
let tutteLeAttivita = [];
let tipoFiltro  = 'tutti';
let vistaAttiva = 'lista';
let meseCorrente = new Date();
meseCorrente.setDate(1);

// ──────────────────────────────────────────────
// FETCH
// ──────────────────────────────────────────────

async function caricaAttivita() {
  const { data, error } = await apiGet('attivita.list');

  if (error) {
    mostraErrore(error.message);
    return;
  }

  tutteLeAttivita = data || [];
  aggiorna();
}

// ──────────────────────────────────────────────
// FILTRO
// ──────────────────────────────────────────────

function attivitaFiltrate() {
  if (tipoFiltro === 'tutti') return tutteLeAttivita;
  return tutteLeAttivita.filter(a => a.tipo === tipoFiltro);
}

// ──────────────────────────────────────────────
// RENDER PRINCIPALE
// ──────────────────────────────────────────────

function aggiorna() {
  if (vistaAttiva === 'lista') {
    renderLista();
  } else {
    renderGriglia();
  }
}

// ──────────────────────────────────────────────
// VISTA LISTA
// ──────────────────────────────────────────────

function renderLista() {
  const container = document.getElementById('lista-container');
  const oggi = new Date().toISOString().slice(0, 10);
  const items = attivitaFiltrate().filter(a => {
    const fine = a.data_fine || a.data_inizio;
    return fine >= oggi;
  });

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">📅</div>
        <p>Nessuna attività in programma${tipoFiltro !== 'tutti' ? ' per questa categoria' : ''}.<br>Torna presto per scoprire le novità!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(cardListaHTML).join('');
}

function cardListaHTML(a) {
  const label   = TIPO_LABEL[a.tipo] || a.tipo;
  const dataFine = a.data_fine && a.data_fine !== a.data_inizio
    ? ` – ${formatData(a.data_fine)}` : '';
  const quotaHTML = a.quota > 0
    ? `<span class="text-sm" style="color:var(--color-text-muted)">Quota: <strong style="color:var(--color-text)">€${Number(a.quota).toLocaleString('it-IT')}</strong></span>`
    : '';

  return `
<article class="card card-attivita" style="display:flex;flex-direction:row;overflow:hidden">
  ${a.immagine_url
    ? `<img src="${a.immagine_url}" alt="${a.nome}" loading="lazy" class="card-attivita-img">`
    : `<div style="width:6px;flex-shrink:0;background:var(--color-${colorePerTipo(a.tipo)})" aria-hidden="true"></div>`
  }
  <div class="card-body" style="flex:1;min-width:0">
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-sm)">
      <span class="badge badge-${a.tipo}">${label}</span>
      <span class="text-sm text-muted">${formatData(a.data_inizio)}${dataFine}</span>
      ${quotaHTML}
    </div>
    <h3 style="font-size:1.0625rem;margin-bottom:var(--space-xs)">${a.nome}</h3>
    ${a.descrizione
      ? `<p style="max-width:none;font-size:0.9375rem;color:var(--color-text-muted);margin-bottom:var(--space-md)">${a.descrizione.slice(0, 160)}${a.descrizione.length > 160 ? '…' : ''}</p>`
      : ''}
    <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
      <a href="attivita.html?id=${a.id}" class="btn btn-primary btn-sm">
        ${a.ha_form_iscrizione ? 'Iscriviti' : 'Dettagli'}
      </a>
      <button type="button" class="btn btn-outline btn-sm" onclick="apriGoogleCalAttivita('${a.id}')">Aggiungi a Calendar</button>
    </div>
  </div>
</article>
  `.trim();
}

function colorePerTipo(tipo) {
  return { uscita_giorno: 'primary', campo: 'success', riunione: 'primary', evento: 'accent' }[tipo] || 'primary';
}

// ──────────────────────────────────────────────
// VISTA GRIGLIA
// ──────────────────────────────────────────────

function renderGriglia() {
  const anno = meseCorrente.getFullYear();
  const mese = meseCorrente.getMonth();

  document.getElementById('mese-label').textContent =
    meseCorrente.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const filtrate = attivitaFiltrate();
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const oggi = new Date().toISOString().slice(0, 10);

  // Giorno della settimana del 1° del mese (0=Dom → 6; 1=Lun → 0)
  const primoGiornoRaw = new Date(anno, mese, 1).getDay();
  const offset = primoGiornoRaw === 0 ? 6 : primoGiornoRaw - 1;

  let celle = '';

  // Intestazioni giorni
  GIORNI_SETTIMANA.forEach(g => {
    celle += `<div class="cal-day-name">${g}</div>`;
  });

  // Celle vuote prima del primo giorno
  for (let i = 0; i < offset; i++) {
    celle += `<div class="cal-day other-month"></div>`;
  }

  // Giorni del mese
  for (let g = 1; g <= giorniNelMese; g++) {
    const dataStr = `${anno}-${pad(mese + 1)}-${pad(g)}`;
    const isOggi  = dataStr === oggi;

    const eventiGiorno = filtrate.filter(a => {
      const fine = a.data_fine || a.data_inizio;
      return a.data_inizio <= dataStr && fine >= dataStr;
    });

    const eventiHTML = eventiGiorno.map(a => `
      <a href="attivita.html?id=${a.id}"
         class="cal-event-dot badge-${a.tipo}"
         title="${a.nome}"
         style="display:block;text-decoration:none">
        ${a.nome.length > 12 ? a.nome.slice(0, 12) + '…' : a.nome}
      </a>
    `).join('');

    celle += `
      <div class="cal-day${isOggi ? ' today' : ''}">
        <div class="cal-day-num">${g}</div>
        ${eventiHTML ? `<div class="cal-events">${eventiHTML}</div>` : ''}
      </div>
    `;
  }

  // Celle vuote dopo l'ultimo giorno
  const totCelle = offset + giorniNelMese;
  const codeExtra = totCelle % 7 === 0 ? 0 : 7 - (totCelle % 7);
  for (let i = 0; i < codeExtra; i++) {
    celle += `<div class="cal-day other-month"></div>`;
  }

  document.getElementById('griglia-container').innerHTML =
    `<div style="overflow-x:auto"><div class="cal-grid" role="grid" aria-label="Calendario ${meseCorrente.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}">${celle}</div></div>`;
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

function pad(n) {
  return String(n).padStart(2, '0');
}

function mostraErrore(msg) {
  const c = document.getElementById('lista-container');
  if (c) c.innerHTML = `
    <div class="alert alert-error" style="flex-direction:column;gap:var(--space-md)">
      <p>Errore nel caricamento delle attività. ${msg}</p>
      <button class="btn btn-outline btn-sm" onclick="location.reload()">Riprova</button>
    </div>`;
}

function aggiornaStatusFiltro() {
  const el = document.getElementById('filtro-status');
  if (!el) return;
  const n = attivitaFiltrate().length;
  const label = tipoFiltro === 'tutti' ? 'tutte le categorie' : tipoFiltro.replace('_', ' ');
  el.textContent = n === 0
    ? `Nessuna attività trovata per ${label}.`
    : `${n} attività trovate${tipoFiltro !== 'tutti' ? ` per ${label}` : ''}.`;
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

window.apriGoogleCalAttivita = (id) => {
  const a = tutteLeAttivita.find(x => String(x.id) === String(id));
  if (a) window.open(urlGoogleCal(a), '_blank', 'noopener');
};

// ──────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Toggle vista lista / griglia
  document.querySelectorAll('[data-vista]').forEach(btn => {
    btn.addEventListener('click', () => {
      vistaAttiva = btn.dataset.vista;

      document.querySelectorAll('[data-vista]').forEach(b => {
        const attivo = b.dataset.vista === vistaAttiva;
        b.setAttribute('aria-pressed', attivo);
        b.style.background    = attivo ? 'var(--color-primary)' : '';
        b.style.color         = attivo ? '#fff' : '';
      });

      document.getElementById('lista-view').classList.toggle('hidden', vistaAttiva !== 'lista');
      document.getElementById('griglia-view').classList.toggle('hidden', vistaAttiva !== 'griglia');

      aggiorna();
    });
  });

  // Filtri tipo
  document.querySelectorAll('[data-tipo]').forEach(pill => {
    pill.addEventListener('click', () => {
      tipoFiltro = pill.dataset.tipo;
      document.querySelectorAll('[data-tipo]').forEach(p => {
        p.classList.toggle('active', p.dataset.tipo === tipoFiltro);
      });
      aggiorna();
      aggiornaStatusFiltro();
    });
  });

  // Navigazione mese
  document.getElementById('mese-prec').addEventListener('click', () => {
    meseCorrente.setMonth(meseCorrente.getMonth() - 1);
    aggiorna();
  });
  document.getElementById('mese-succ').addEventListener('click', () => {
    meseCorrente.setMonth(meseCorrente.getMonth() + 1);
    aggiorna();
  });

  caricaAttivita();
});
