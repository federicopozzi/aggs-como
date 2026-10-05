import { API_URL } from './config.js';

// Client per il backend Google Apps Script.
// Ogni funzione restituisce { data, error },
// con error = { message, code } oppure null.

async function call(url, options) {
  try {
    const res  = await fetch(url, options);
    const json = await res.json();
    if (json.error) return { data: null, error: { message: json.error, code: json.code || null } };
    return { data: json.data ?? null, error: null };
  } catch (err) {
    return { data: null, error: { message: 'Servizio non raggiungibile', code: 'network' } };
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
