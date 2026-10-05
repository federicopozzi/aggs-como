import { apiGet } from './api.js';

const TIPO_LABEL = {
  uscita_giorno: 'Uscita',
  campo:         'Campo',
  riunione:      'Riunione',
  evento:        'Evento',
};

function formatData(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cardHTML(a) {
  const tipoLabel = TIPO_LABEL[a.tipo] || a.tipo;
  const dataFine  = a.data_fine && a.data_fine !== a.data_inizio
    ? ` – ${formatData(a.data_fine)}`
    : '';

  return `
<article class="card card-attivita" style="display:flex;flex-direction:column">
  ${a.immagine_url
    ? `<img src="${a.immagine_url}" alt="${a.nome}" class="card-img" loading="lazy">`
    : `<div style="height:8rem;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-size:2.5rem" aria-hidden="true">⚜️</div>`
  }
  <div class="card-body" style="display:flex;flex-direction:column;flex:1">
    <div style="margin-bottom:var(--space-sm)">
      <span class="badge badge-${a.tipo}">${tipoLabel}</span>
    </div>
    <h3 style="margin-bottom:var(--space-xs);font-size:1.0625rem">${a.nome}</h3>
    <p class="text-sm text-muted" style="margin-bottom:var(--space-md);max-width:none">
      ${formatData(a.data_inizio)}${dataFine}
    </p>
    ${a.descrizione
      ? `<p style="max-width:none;font-size:0.9375rem;color:var(--color-text-muted);margin-bottom:var(--space-md)">${a.descrizione.slice(0,120)}${a.descrizione.length > 120 ? '…' : ''}</p>`
      : ''
    }
    <a href="attivita.html?id=${a.id}" class="btn btn-primary btn-sm" style="margin-top:auto;align-self:flex-start">
      ${a.ha_form_iscrizione ? 'Iscriviti' : 'Dettagli'}
    </a>
  </div>
</article>
  `.trim();
}

async function loadPreview() {
  const container = document.getElementById('attivita-preview');
  if (!container) return;

  const { data, error } = await apiGet('attivita.prossime', { limit: 3 });

  if (error || !data?.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon" aria-hidden="true">📅</div>
        <p>Nessuna attività in programma al momento.<br>Torna presto per scoprire le novità!</p>
        <a href="calendario.html" class="btn btn-outline mt-md">Vai al calendario</a>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(cardHTML).join('');
}

// ── Avvisi ──────────────────────────────────────────────────────

const AVVISO_TIPO = {
  info:       { label: 'Info',       badgeStyle: 'background:#061991;color:#fff', border: '#061991' },
  importante: { label: 'Importante', badgeStyle: 'background:#EE891D;color:#fff', border: '#EE891D' },
  urgente:    { label: 'Urgente',    badgeStyle: 'background:#c0392b;color:#fff', border: '#c0392b' },
};

function avvisoHTML(a) {
  const cfg = AVVISO_TIPO[a.tipo] || AVVISO_TIPO.info;
  return `
    <div style="background:var(--color-surface);border-radius:var(--radius-md);
                border-left:4px solid ${cfg.border};padding:var(--space-md) var(--space-lg);
                box-shadow:var(--shadow-sm)">
      <div style="display:flex;align-items:center;gap:var(--space-sm);
                  margin-bottom:var(--space-xs);flex-wrap:wrap">
        <span class="badge" style="${cfg.badgeStyle}">${cfg.label}</span>
        <strong style="font-size:1rem">${a.titolo}</strong>
      </div>
      <p style="color:var(--color-text-muted);max-width:none;margin:0">${a.testo}</p>
    </div>`.trim();
}

async function loadAvvisi() {
  const section = document.getElementById('section-avvisi');
  const list    = document.getElementById('avvisi-list');
  if (!section || !list) return;

  const { data, error } = await apiGet('avvisi.attivi');

  if (error || !data?.length) return;

  section.style.display = '';
  list.innerHTML = data.map(avvisoHTML).join('');
}

loadPreview();
loadAvvisi();

// ── Banner 5×1000 dismissabile ──────────────────────────────────
const banner = document.getElementById('banner-5x1000');
if (banner) {
  if (sessionStorage.getItem('banner5x1000_dismissed')) banner.classList.add('is-hidden');
  banner.querySelector('.banner-dismiss')?.addEventListener('click', () => {
    banner.classList.add('is-hidden');
    sessionStorage.setItem('banner5x1000_dismissed', '1');
  });
}
