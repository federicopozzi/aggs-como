import { API_URL } from './config.js';

// Client per il backend Google Apps Script.
// Ogni funzione restituisce { data, error },
// con error = { message, code } oppure null.

// Oltre questo tempo la richiesta viene annullata, così la pagina non resta in caricamento infinito.
const TIMEOUT_MS = 60000;

async function call(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res  = await fetch(url, { ...options, signal: controller.signal });
    const json = await res.json();
    if (json.error) return { data: null, error: { message: json.error, code: json.code || null } };
    return { data: json.data ?? null, error: null };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { data: null, error: { message: 'Il server non risponde, ricarica la pagina e riprova', code: 'timeout' } };
    }
    return { data: null, error: { message: 'Servizio non raggiungibile', code: 'network' } };
  } finally {
    clearTimeout(timer);
  }
}

export function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params });
  return call(`${API_URL}?${qs}`);
}

// Body come text/plain: evita il preflight CORS, non supportato da Apps Script.
export function apiPost(action, data = {}, password) {
  return call(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data, password }),
  });
}

// Lettura di un'impostazione, condivisa tra gli script della stessa pagina
// (components.js e iscrizione.js chiedono entrambi iscrizioni_aperte).
const impostazioniCache = {};
export function getImpostazione(chiave) {
  impostazioniCache[chiave] ??= apiGet('impostazioni.get', { chiave });
  return impostazioniCache[chiave];
}
