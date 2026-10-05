import { getImpostazione } from './api.js';
import './reveal.js';

/**
 * Inietta header e footer in tutte le pagine.
 * Includi con: <script type="module" src="js/components.js"></script>
 * Aggiungi <header id="site-header"></header> e <footer id="site-footer"></footer> nell'HTML.
 */

const NAV_LINKS = [
  { href: 'index.html',      label: 'Home',       icon: 'home' },
  { href: 'storia.html',     label: 'Chi siamo',  icon: 'groups' },
  { href: 'calendario.html', label: 'Calendario', icon: 'calendar_month' },
  { href: 'contatti.html',   label: 'Contatti',   icon: 'mail' },
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

function bottomNavHTML() {
  const page = currentPage();
  return NAV_LINKS.map(({ href, label, icon }) => {
    const active = page === href;
    return `<a href="${href}"${active ? ' class="active" aria-current="page"' : ''}>
      <span class="bottom-nav-indicator"><span class="icon" aria-hidden="true">${icon}</span></span>
      <span>${label}</span>
    </a>`;
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

    <a href="iscrizione.html" class="btn btn-accent btn-sm header-cta" data-iscrizione>Iscriviti</a>
  </div>
</div>
  `.trim();

  // Navigation bar (mobile) e FAB "Iscriviti": fuori dall'header sticky
  const bottomNav = document.createElement('nav');
  bottomNav.className = 'bottom-nav';
  bottomNav.setAttribute('aria-label', 'Navigazione principale mobile');
  bottomNav.innerHTML = bottomNavHTML();
  document.body.appendChild(bottomNav);

  if (currentPage() !== 'iscrizione.html') {
    const fab = document.createElement('a');
    fab.href = 'iscrizione.html';
    fab.className = 'fab fab-extended';
    fab.dataset.iscrizione = '';
    fab.innerHTML = '<span class="icon" aria-hidden="true">edit</span><span>Iscriviti</span>';
    document.body.appendChild(fab);
  }

  // Top app bar: elevazione quando la pagina scorre
  const onScroll = () => el.classList.toggle('is-scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
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
        <li data-iscrizione><a href="iscrizione.html">Iscrizione</a></li>
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
  container.className = 'snackbar-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);

  const ICONS = { success: 'check_circle', error: 'error', info: 'info' };

  window.showToast = function(msg, type = 'success') {
    const kind = ICONS[type] ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `snackbar snackbar-${kind}`;
    toast.innerHTML = `<span class="icon" aria-hidden="true">${ICONS[kind]}</span><span></span>`;
    toast.lastElementChild.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
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

    if (data?.valore === 'true') {
      document.querySelectorAll('[data-iscrizione]').forEach(el => el.removeAttribute('data-iscrizione'));
    }
  } catch {
    // fail closed: senza conferma i bottoni restano nascosti
  }
})();
