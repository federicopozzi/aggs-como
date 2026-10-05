# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sito istituzionale per **AGGS Como**. Pubblico target: famiglie. Tono caldo, accessibile.

---

## Stack — REGOLE ASSOLUTE

- **HTML / CSS / JS vanilla** — nessun framework, nessun bundler, nessun npm
- **Tutti gli script**: `<script type="module" src="js/...js">`
- **Backend**: Google Fogli + Google Apps Script (cartella `apps-script/`), pubblicato come Web App
- **Unica configurazione** in `js/config.js`: `export const API_URL` (URL `/exec` della Web App). Nessun segreto nel frontend
- Deploy frontend via FTP su hosting condiviso — file statici puri

---

## Comandi operativi

- Gli script in `apps-script/` vanno **incollati** nell'editor Apps Script del Foglio (account aggscomo@gmail.com). Setup completo in `apps-script/README.md`
- Dopo ogni modifica agli script: *Esegui il deployment → Gestisci deployment → Nuova versione* (l'URL resta lo stesso)
- Anteprima locale del sito: `python -m http.server 8000` (i moduli ES non funzionano da `file://`)

---

## Struttura file

```
css/base.css · components.css · layout.css
js/config.js · api.js · home.js · calendario.js · iscrizione.js
   attivita.js · contatti.js · admin.js · components.js · gallery.js · reveal.js
index.html · storia.html · calendario.html · iscrizione.html
attivita.html · contatti.html · admin.html
apps-script/Code.gs (API + accesso Foglio) · Email.gs (email, PDF, mailing list)
   Setup.gs (setup, creaModelli) · Logo.gs · appsscript.json · README.md
```

---

## Design system

- Font: **DM Sans** (Google Fonts)
- `--color-primary: #003985` · `--color-accent: #ff751f`
- `--color-bg: #f9f7f4` · `--color-surface: #ffffff` · `--color-text: #1a1a2e`
- Mobile-first, breakpoint `768px`, contrasto AA, focus visibile

---

## API (`js/api.js`)

- `apiGet(action, params)` / `apiPost(action, data, password?)` → `{ data, error }` con `error = { message, code }`
- POST inviati come `text/plain` (Apps Script non gestisce il preflight CORS)
- `getImpostazione(chiave)` condivide la richiesta tra gli script della stessa pagina
- Azioni pubbliche: `attivita.list|prossime|get`, `avvisi.attivi`, `impostazioni.get`, `soci.insert`, `iscrizioni.insert`, `contatti.insert` (codice `duplicate` se l'email esiste)
- Azioni admin (password verificata sul server, proprietà script `ADMIN_PASSWORD`): `admin.login|select|insert|update|delete|upload`

---

## Database (schede del Foglio Google)

Colonne definite in `SCHEMA` in `apps-script/Code.gs`; riga 1 = intestazioni, tutte le celle in formato testo. Date `yyyy-mm-dd`, booleani `TRUE/FALSE`, JSON come testo.

**`attivita`**: id, nome, descrizione, tipo (`uscita_giorno|campo|riunione|evento`), tipo_modulo, data_inizio, data_fine, quota, unita_target, ha_form_iscrizione, nota_iscrizioni, `campi_extra` (JSON), `documenti` (JSON `[{nome,url}]`), immagine_url, attiva, created_at

**`soci`**: id, nome, cognome, data_nascita, luogo_nascita, codice_fiscale, classe_frequentata, unita (`lupetti|coccinelle|scout|guide`), anno_associativo, email, telefono, telefono_emergenza, nome_genitore, cognome_genitore, codice_fiscale_genitore, indirizzo_via, indirizzo_citta, indirizzo_cap, iscrizione_mailing_list, consenso_privacy, consenso_foto, note, data_iscrizione

**`iscrizioni_attivita`**: id, attivita_id, nome, cognome, data_nascita, email_contatto, telefono, telefono_2, telefono_3, nome_genitore, indirizzo_genitore, note_mediche, `risposte_extra` (JSON), stato (`in_attesa|confermato|annullato`), consenso_privacy, consenso_autorizzazione, consenso_esonero, presa_visione_documenti, data_iscrizione, note

**`contatti`**: id, email (unica, controllata dal server), nome, cognome, nome_ragazzo, unita, consenso_privacy, attivo, data_iscrizione

**`avvisi`**: id, titolo, testo, tipo (`info|importante|urgente`), attivo, data_scadenza, created_at

**`impostazioni`**: chiave, valore, updated_at — chiave `iscrizioni_aperte` controlla visibilità form iscrizione

**`mailing_list`**: email, nome, cognome, unita, fonte (`socio|newsletter`), data

**Regole server**: le letture pubbliche restituiscono solo attività `attiva` e avvisi attivi non scaduti; i form pubblici non possono impostare id/stato/date; `soci.insert` rifiutato se `iscrizioni_aperte=false`, `iscrizioni.insert` se l'attività non ha `ha_form_iscrizione`; eliminare un'attività elimina le sue iscrizioni.

---

## Logiche chiave

**Minorenne** (età < 18 in `iscrizione.js`): mostra la sezione genitore con nome, cognome, codice_fiscale_genitore e indirizzo; email/telefono sono del genitore.

**campi_extra**: array JSON `[{ id, label, tipo, opzioni?, obbligatorio }]` — tipi: `testo_breve|checkbox|select|data|numero`. Costruito nell'admin, salvato in `attivita.campi_extra`, risposto in `iscrizioni_attivita.risposte_extra`.

**attivita.html**: legge `?id=` dall'URL, `apiGet('attivita.get')`, popola pagina e costruisce il form dinamicamente dai `campi_extra` (`tipo_modulo = campo_minori` usa il form dedicato).

**admin.html**: login verificato da Apps Script, password tenuta in `sessionStorage` e inviata a ogni richiesta; gestisce CRUD attività, costruttore campi_extra, upload PDF su Drive, tabella iscrizioni con cambio stato ed export CSV, avvisi, impostazioni.

**home.js**: carica le prossime 3 attività (`data_inizio >= oggi`) e gli avvisi attivi. Controlla anche il banner 5×1000 con dismiss in sessionStorage.

---

## Email e PDF (`apps-script/Email.gs`)

Inviate con `MailApp` dall'account che ha pubblicato la Web App (limite 100/giorno), subito dopo l'inserimento:
- `soci.insert` → email di conferma tesseramento + PDF dal modello Docs `MODELLO_TESSERAMENTO_ID`
- `iscrizioni.insert` → email pre-iscrizione + PDF dal modello Docs `MODELLO_CAMPO_ID` (per ogni attività)

I PDF si generano copiando il modello Google Docs e sostituendo i segnaposto `{{chiave}}` (elenco in `apps-script/README.md`); i modelli si modificano direttamente in Docs. Errori di email/PDF vengono loggati ma non annullano l'iscrizione.

Mailing list: `soci` con `iscrizione_mailing_list` e tutti i `contatti` finiscono in `mailing_list` (o nel foglio `MAILING_LIST_SHEET_ID`), senza duplicati.

---

## Regole operative

- Modifica solo le parti necessarie, non riscrivere file interi
- Ogni form: checkbox `consenso_privacy` obbligatoria + link a `assets/PRIVACY.pdf`
- Nuova colonna in una scheda: aggiungerla in `SCHEMA` (`Code.gs`), rieseguire `setup` e, se serve nei PDF, aggiungere il segnaposto nel modello Docs
