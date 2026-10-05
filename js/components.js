import { getImpostazione } from './api.js';
import './reveal.js';

/**
 * Inietta header e footer in tutte le pagine.
 * Includi con: <script type="module" src="js/components.js"></script>
 * Aggiungi <header id="site-header"></header> e <footer id="site-footer"></footer> nell'HTML.
 */

const NAV_LINKS = [
  { href: 'index.html',      label: 'Home' },
  { href: 'storia.html',     label: 'Chi siamo' },
  { href: 'calendario.html', label: 'Calendario' },
  { href: 'contatti.html',   label: 'Contatti' },
];

function currentPage() {
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';
  return file === '' ? 'index.html' : file;
}

function navLinksHTML(extraClass = '') {
  const page = currentPage();
  return NAV_LINKS.map(({ href, label }) => {
    const active = page === href ? ' active' : '';
    return `<a href="${href}" class="${extraClass}${active}">${label}</a>`;
  }).join('');
}

function renderHeader(el) {
  el.innerHTML = `
<div class="container">
  <div class="header-inner">
    <a href="index.html" class="site-logo" aria-label="AGGS Como — torna alla home">
      <img src="assets/logo.svg" alt="Logo AGGS Como" width="40" height="40"
           onerror="this.style.display='none'">
      <span class="site-logo-name">
        AGGS Como
        <span>Associazione Gruppi Guide e Scouts</span>
      </span>
    </a>

    <nav class="site-nav" aria-label="Navigazione principale">
      ${navLinksHTML()}
    </nav>

    <a href="iscrizione.html" class="btn btn-accent btn-sm header-cta">Iscriviti</a>

    <button class="nav-toggle" id="nav-toggle"
            aria-controls="mobile-menu"
            aria-expanded="false"
            aria-label="Apri menu">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <line x1="3" y1="6"  x2="19" y2="6"  stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<nav class="mobile-menu" id="mobile-menu" aria-label="Menu mobile">
  ${navLinksHTML()}
  <a href="iscrizione.html" class="btn btn-accent mt-md">Iscriviti</a>
</nav>
  `.trim();

  const toggle = el.querySelector('#nav-toggle');
  const menu   = el.querySelector('#mobile-menu');

  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Chiudi cliccando un link mobile
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Apri menu');
      document.body.style.overflow = '';
    });
  });
}

function renderFooter(el) {
  const year = new Date().getFullYear();
  el.innerHTML = `
<div class="container">
  <div class="footer-grid">

    <div class="footer-brand">
      <a href="index.html" class="site-logo" aria-label="AGGS Como">
        <img src="assets/logo.svg" alt="Logo AGGS Como" width="36" height="36"
             onerror="this.style.display='none'">
        <span class="site-logo-name">
          AGGS Como
          <span>Associazione Gruppi Guide e Scouts</span>
        </span>
      </a>
      <p class="footer-tagline">Crescere insieme attraverso l'avventura, la natura e i valori scout.</p>
    </div>

    <div>
      <p class="footer-heading">Pagine</p>
      <ul class="footer-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="storia.html">Chi siamo</a></li>
        <li><a href="calendario.html">Calendario</a></li>
        <li><a href="iscrizione.html">Iscrizione</a></li>
        <li><a href="contatti.html">Contatti</a></li>
      </ul>
    </div>

    <div>
      <p class="footer-heading">Contatti</p>
      <ul class="footer-links">
        <li><a href="mailto:aggscomo@gmail.com">aggscomo@gmail.com</a></li>
        <li><a href="contatti.html">Iscriviti alla newsletter</a></li>
      </ul>
    </div>

    <div class="footer-5x1000">
      <p class="footer-heading">Sostienici con il 5×1000</p>
      <p class="footer-5x1000-text">Nella dichiarazione dei redditi (730&nbsp;/&nbsp;CU&nbsp;/&nbsp;Modello&nbsp;Redditi), firma nel riquadro <em>«Sostegno degli enti del Terzo Settore»</em> e indica il codice fiscale:</p>
      <p class="footer-5x1000-cf">95062000138</p>
    </div>

  </div>

  <div class="footer-bottom">
    <span>&copy; ${year} AGGS Como — Tutti i diritti riservati</span>
    <a href="assets/PRIVACY.pdf" target="_blank" rel="noopener">Privacy Policy</a>
  </div>
</div>
  `.trim();
}

// ──────────────────────────────────────────────
// SKIP-TO-CONTENT LINK
// ──────────────────────────────────────────────

(function injectSkipLink() {
  const skip = document.createElement('a');
  skip.href = '#main-content';
  skip.className = 'skip-link';
  skip.textContent = 'Vai al contenuto principale';
  document.body.insertBefore(skip, document.body.firstChild);
})();

// ──────────────────────────────────────────────
// TOAST NOTIFICATIONS (globale: window.showToast)
// ──────────────────────────────────────────────

(function initToast() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    zIndex: '9000',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    pointerEvents: 'none',
  });
  document.body.appendChild(container);

  window.showToast = function(msg, type = 'success') {
    const bg = { success: '#2d7a47', error: '#c0392b', info: '#061991' }[type] || '#061991';
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      background: bg,
      color: '#fff',
      padding: '0.75rem 1.25rem',
      borderRadius: '8px',
      fontSize: '0.875rem',
      fontWeight: '500',
      maxWidth: '320px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      pointerEvents: 'auto',
      opacity: '0',
      transform: 'translateY(0.5rem)',
      transition: 'opacity 0.2s, transform 0.2s',
    });
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(0.5rem)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  };
})();

// ──────────────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────────────

const headerEl = document.getElementById('site-header');
const footerEl = document.getElementById('site-footer');

if (headerEl) {
  headerEl.className = 'site-header';
  renderHeader(headerEl);
}
if (footerEl) {
  footerEl.className = 'site-footer';
  renderFooter(footerEl);
}

// ──────────────────────────────────────────────
// VISIBILITÀ BOTTONI ISCRIZIONE
// ──────────────────────────────────────────────

(async function applyIscrizioniSetting() {
  try {
    const { data } = await getImpostazione('iscrizioni_aperte');

    if ((data?.valore ?? 'true') === 'false') {
      // Nasconde i bottoni CTA "Iscriviti" nell'header (desktop e mobile)
      if (headerEl) {
        headerEl.querySelectorAll('a[href="iscrizione.html"]').forEach(el => {
          el.style.display = 'none';
        });
      }
      // Nasconde il bottone CTA nella home (se presente)
      const heroBtn = document.getElementById('btn-hero-iscriviti');
      if (heroBtn) heroBtn.style.display = 'none';
      const ctaSection = document.getElementById('section-cta-iscrizione');
      if (ctaSection) ctaSection.style.display = 'none';
    }
  } catch {
    // fail open: mostra i bottoni se non riesce a leggere il setting
  }
})();
