/**
 * Email di conferma con PDF allegato e mailing list.
 * Le email partono dall'account Google che ha pubblicato la Web App (quota Gmail: 100/giorno).
 */

const EMAIL_ASSOCIAZIONE = 'aggscomo@gmail.com';

// ──────────────────────────────────────────────
// INVIO
// ──────────────────────────────────────────────

function inviaEmailSocio_(rec) {
  if (!rec.email) return;
  const pdf  = generaPdf_('MODELLO_TESSERAMENTO_ID', valoriSocio_(rec), `iscrizione_${rec.cognome}_${rec.nome}.pdf`);
  const mail = sociEmail_(rec, !!pdf);
  invia_(rec.email, mail, pdf);
}

function inviaEmailIscrizione_(rec, attivita) {
  if (!rec.email_contatto) return;
  let dataAttivita = attivita.data_inizio ? formatDate_(attivita.data_inizio) : '';
  if (attivita.data_fine && attivita.data_fine !== attivita.data_inizio) {
    dataAttivita += ` – ${formatDate_(attivita.data_fine)}`;
  }
  const pdf  = generaPdf_('MODELLO_CAMPO_ID', valoriIscrizione_(rec, attivita), `campo_${rec.cognome}_${rec.nome}.pdf`);
  const mail = attivitaEmail_(rec, attivita.nome, dataAttivita, !!pdf);
  invia_(rec.email_contatto, mail, pdf);
}

function invia_(to, mail, pdf) {
  MailApp.sendEmail({
    to,
    subject:     mail.subject,
    htmlBody:    mail.html,
    body:        mail.text,
    name:        'AGGS Como',
    replyTo:     EMAIL_ASSOCIAZIONE,
    attachments: pdf ? [pdf] : [],
  });
}

// ──────────────────────────────────────────────
// PDF DA MODELLO GOOGLE DOCS
// ──────────────────────────────────────────────

// Copia il modello, sostituisce i segnaposto {{chiave}}, esporta in PDF e cestina la copia.
// Restituisce null se il modello non è configurato o qualcosa va storto (l'email parte comunque).
function generaPdf_(propModello, valori, filename) {
  const tplId = PropertiesService.getScriptProperties().getProperty(propModello);
  if (!tplId) { console.warn(`${propModello} non impostato: email senza PDF`); return null; }

  let copia;
  try {
    copia = DriveApp.getFileById(tplId).makeCopy(`tmp_${filename}`);
    const doc = DocumentApp.openById(copia.getId());
    [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(sezione => {
      if (!sezione) return;
      Object.keys(valori).forEach(k => {
        sezione.replaceText(`\\{\\{${k}\\}\\}`, valori[k] ? String(valori[k]) : '—');
      });
      sezione.replaceText('\\{\\{[a-z_0-9]+\\}\\}', '—'); // segnaposto non riconosciuti
    });
    doc.saveAndClose();
    return copia.getAs(MimeType.PDF).setName(filename);
  } catch (err) {
    console.error('Generazione PDF non riuscita:', err && err.stack || err);
    return null;
  } finally {
    if (copia) copia.setTrashed(true);
  }
}

// Valori per il modello tesseramento: tutte le colonne di `soci` più alcuni campi composti.
function valoriSocio_(rec) {
  const v = Object.assign({}, rec);
  v.ragazzo_nome  = `${rec.cognome || ''} ${rec.nome || ''}`.trim();
  v.ragazzo_cf    = rec.codice_fiscale;
  v.genitore_nome = `${rec.nome_genitore || ''} ${rec.cognome_genitore || ''}`.trim();
  v.genitore_cf   = rec.codice_fiscale_genitore;
  v.anno          = rec.anno_associativo;
  v.unita         = capitalize_(rec.unita);
  v.data_nascita  = rec.data_nascita ? formatDate_(rec.data_nascita) : '';
  v.indirizzo     = [rec.indirizzo_via, [rec.indirizzo_cap, rec.indirizzo_citta].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');
  return v;
}

// Valori per il modello campo: colonne di `iscrizioni_attivita`, risposte_extra e dati attività.
function valoriIscrizione_(rec, attivita) {
  const extra = rec.risposte_extra || {};
  const v = Object.assign({}, extra, rec);
  delete v.risposte_extra;
  v.attivita      = attivita.nome;
  v.ragazzo_nome  = `${rec.cognome || ''} ${rec.nome || ''}`.trim();
  v.ragazzo_cf    = extra.codice_fiscale_ragazzo;
  v.genitore_nome = rec.nome_genitore;
  v.genitore_cf   = extra.codice_fiscale_genitore;
  v.unita         = capitalize_(extra.unita);
  v.indirizzo     = rec.indirizzo_genitore || extra.indirizzo;
  v.data_nascita  = rec.data_nascita ? formatDate_(rec.data_nascita) : '';
  return v;
}

// ──────────────────────────────────────────────
// MAILING LIST
// ──────────────────────────────────────────────

// Aggiunge l'email alla scheda mailing_list (o al foglio indicato in MAILING_LIST_SHEET_ID),
// saltando i duplicati.
function aggiungiMailingList_(rec, fonte) {
  const email = String(rec.email || '').trim().toLowerCase();
  if (!email) return;

  const esterno = PropertiesService.getScriptProperties().getProperty('MAILING_LIST_SHEET_ID');
  const sh = esterno ? SpreadsheetApp.openById(esterno).getSheets()[0] : sheet_('mailing_list');

  const last = sh.getLastRow();
  const esistenti = last ? sh.getRange(1, 1, last, 1).getValues().map(r => String(r[0]).trim().toLowerCase()) : [];
  if (esistenti.indexOf(email) >= 0) return;

  sh.appendRow([email, rec.nome || '', rec.cognome || '', rec.unita || '', fonte, today_()].map(x => toCell_('', x)));
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
  'settembre', 'ottobre', 'novembre', 'dicembre'];

function formatDate_(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return y && m && d ? `${d} ${MESI[m - 1]} ${y}` : String(iso);
}

function capitalize_(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────
// TEMPLATE EMAIL
// ──────────────────────────────────────────────

function layoutEmail_(subject, accentBar, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc_(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f9f7f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:100%;">
        <tr>
          <td style="background:#003985;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.3px;">AGGS Como</p>
            <p style="margin:8px 0 0;color:#a8c4e8;font-size:14px;">Associazione Gruppi Guide e Scouts</p>
          </td>
        </tr>
        ${accentBar ? `<tr>
          <td style="background:#ff751f;padding:12px 40px;">
            <p style="margin:0;color:#ffffff;font-size:14px;font-weight:600;">${accentBar}</p>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:40px 40px 32px;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <hr style="border:none;border-top:1px solid #e2e4e9;margin:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#6b7280;">
              AGGS Como — <a href="mailto:${EMAIL_ASSOCIAZIONE}" style="color:#003985;text-decoration:none;">${EMAIL_ASSOCIAZIONE}</a>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
              Hai ricevuto questa email perché hai effettuato un'iscrizione tramite il sito AGGS Como.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const P_STYLE = 'margin:0 0 16px;font-size:16px;color:#1a1a2e;line-height:1.6;';

function riepilogo_(righe) {
  const tr = righe.filter(r => r[1]).map(([label, value], i) => `
                    <tr>
                      <td style="padding:6px 0;font-size:14px;color:#6b7280;${i === 0 ? 'width:140px;' : ''}">${label}</td>
                      <td style="padding:6px 0;font-size:14px;color:#1a1a2e;font-weight:500;">${value}</td>
                    </tr>`).join('');
  return `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8eef7;border-radius:8px;margin:24px 0;">
              <tr>
                <td style="padding:24px 28px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#003985;text-transform:uppercase;letter-spacing:0.8px;">Riepilogo iscrizione</p>
                  <table width="100%" cellpadding="0" cellspacing="0">${tr}
                  </table>
                </td>
              </tr>
            </table>`;
}

function sociEmail_(rec, hasAttachment) {
  const nome         = `${rec.nome} ${rec.cognome}`;
  const unita        = capitalize_(rec.unita);
  const anno         = rec.anno_associativo || '';
  const genitore     = rec.nome_genitore ? `${rec.nome_genitore} ${rec.cognome_genitore || ''}`.trim() : null;
  const destinatario = genitore ? `Caro/a ${genitore},` : `Caro/a ${rec.nome},`;
  const subject      = `Conferma iscrizione ${anno} — AGGS Como`;

  const html = layoutEmail_(subject, null, `
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">${esc_(destinatario)}</p>
            <p style="${P_STYLE}">
              Siamo felici di confermarti l'iscrizione di <strong>${esc_(nome)}</strong> per l'anno associativo <strong>${esc_(anno)}</strong>.
            </p>
            ${riepilogo_([
              ['Scout/Guida', esc_(nome)],
              ['Reparto', esc_(unita)],
              ['Anno associativo', esc_(anno)],
              ['Genitore', genitore && esc_(genitore)],
            ])}
            ${hasAttachment ? `<p style="${P_STYLE}">
              In allegato trovi il modulo di iscrizione precompilato: stampalo, firmalo e consegnalo al capo reparto.
            </p>` : ''}
            <p style="${P_STYLE}">
              I capi del reparto ti contatteranno presto con tutte le informazioni sulle prossime attività.
            </p>
            <p style="margin:0;font-size:16px;color:#1a1a2e;line-height:1.6;">Buona caccia e buona strada! 🏕️</p>`);

  const text = `${destinatario}

Siamo felici di confermarti l'iscrizione di ${nome} per l'anno associativo ${anno}.

RIEPILOGO ISCRIZIONE
Scout/Guida: ${nome}
Reparto: ${unita}
Anno associativo: ${anno}${genitore ? `\nGenitore: ${genitore}` : ''}
${hasAttachment ? '\nIn allegato trovi il modulo di iscrizione precompilato: stampalo, firmalo e consegnalo al capo reparto.\n' : ''}
I capi del reparto ti contatteranno presto con tutte le informazioni sulle prossime attività.

Buona caccia e buona strada!

AGGS Como
${EMAIL_ASSOCIAZIONE}`;

  return { subject, html, text };
}

function attivitaEmail_(rec, nomeAttivita, dataAttivita, hasAttachment) {
  const nome         = `${rec.nome} ${rec.cognome}`;
  const genitore     = rec.nome_genitore || null;
  const destinatario = genitore ? `Caro/a ${genitore},` : `Caro/a ${rec.nome},`;
  const subject      = `Conferma pre-iscrizione ${nomeAttivita} – AGGS Como`;

  const html = layoutEmail_(subject, 'Iscrizione attività confermata ✓', `
            <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;">${esc_(destinatario)}</p>
            <p style="${P_STYLE}">
              Abbiamo ricevuto l'iscrizione di <strong>${esc_(nome)}</strong> all'attività <strong>${esc_(nomeAttivita)}</strong>${dataAttivita ? ` del <strong>${esc_(dataAttivita)}</strong>` : ''}.
            </p>
            ${riepilogo_([
              ['Partecipante', esc_(nome)],
              ['Attività', esc_(nomeAttivita)],
              ['Data', dataAttivita && esc_(dataAttivita)],
              ['Genitore', genitore && esc_(genitore)],
              ['Stato', '<span style="background:#fff3e0;color:#e05e0a;padding:2px 10px;border-radius:20px;font-size:13px;font-weight:600;">In attesa di conferma</span>'],
            ])}
            <p style="${P_STYLE}">
              L'iscrizione è attualmente <strong>in attesa di conferma</strong>. Riceverai una comunicazione dai capi appena verrà processata.
            </p>
            ${hasAttachment ? `<p style="${P_STYLE}">
              In allegato trovi il modulo precompilato. Stampalo, firmalo e consegnalo al capo unità.
            </p>` : ''}
            <p style="margin:0;font-size:16px;color:#1a1a2e;line-height:1.6;">
              Per qualsiasi domanda puoi scriverci a <a href="mailto:${EMAIL_ASSOCIAZIONE}" style="color:#003985;">${EMAIL_ASSOCIAZIONE}</a>.
            </p>`);

  const text = `${destinatario}

Abbiamo ricevuto l'iscrizione di ${nome} all'attività "${nomeAttivita}"${dataAttivita ? ` del ${dataAttivita}` : ''}.

RIEPILOGO ISCRIZIONE
Partecipante: ${nome}
Attività: ${nomeAttivita}${dataAttivita ? `\nData: ${dataAttivita}` : ''}${genitore ? `\nGenitore: ${genitore}` : ''}
Stato: In attesa di conferma

L'iscrizione è attualmente in attesa di conferma. Riceverai una comunicazione dai capi appena verrà processata.
${hasAttachment ? '\nIn allegato trovi il modulo precompilato. Stampalo, firmalo e consegnalo al capo unità.\n' : ''}
Per qualsiasi domanda puoi scriverci a ${EMAIL_ASSOCIAZIONE}.

AGGS Como
${EMAIL_ASSOCIAZIONE}`;

  return { subject, html, text };
}
