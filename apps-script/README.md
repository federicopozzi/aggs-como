# Backend del sito su Google Fogli

Il sito salva iscrizioni, attività e avvisi in un **Foglio Google**. Un **Apps Script** collegato al Foglio fa da backend: risponde al sito, invia le email di conferma da Gmail e genera i PDF dai modelli Google Docs. È tutto gratuito e non va mai in pausa.

> Fai tutto con l'account **aggscomo@gmail.com**: le email partiranno da quell'indirizzo e i dati resteranno nel suo Drive.

## 1. Crea il Foglio e lo script

1. Vai su [sheets.new](https://sheets.new) e chiama il foglio `AGGS Como – Dati`.
2. Apri **Estensioni → Apps Script**.
3. Nell'editor crea questi file con **+ → Script**, usando gli stessi nomi, e incolla il contenuto dei file di questa cartella:
   - `Code.gs` (sostituisce il `Codice.gs` già presente)
   - `Email.gs`
   - `Setup.gs`
   - `Logo.gs`
4. Apri **⚙ Impostazioni progetto**:
   - Fuso orario: **(GMT+01:00) Roma**.
   - Spunta *Mostra il file manifest "appsscript.json" nell'editor*, poi incolla il contenuto di `appsscript.json`.

## 2. Imposta la password admin

In **⚙ Impostazioni progetto → Proprietà dello script** aggiungi:

| Proprietà | Valore |
|---|---|
| `ADMIN_PASSWORD` | la password per entrare in `admin.html` |
| `MAILING_LIST_SHEET_ID` | *(facoltativo)* l'ID del foglio mailing list che usavi prima. Se lo lasci vuoto, gli indirizzi finiscono nella scheda `mailing_list` di questo Foglio. |

La password resta su Google e non compare mai nel codice del sito.

## 3. Esegui il setup (una volta)

Nell'editor, scegli la funzione dal menu a tendina accanto a **▶ Esegui**:

1. **`setup`**: crea le schede `attivita`, `soci`, `iscrizioni_attivita`, `contatti`, `avvisi`, `impostazioni` e `mailing_list`.
   - Al primo avvio Google chiede le autorizzazioni. Clicca *Avanzate → Vai a … (non sicuro)*: è normale per gli script personali.
2. **`creaModelli`**: crea in Drive la cartella **AGGS Como – Sito**, con dentro:
   - `Modello PDF – Tesseramento annuale`
   - `Modello PDF – Iscrizione attività minori`
   - la cartella `Documenti attività (pubblici)`, dove finiscono i PDF caricati da admin.

## 4. Pubblica la Web App

1. Clicca **Esegui il deployment → Nuovo deployment**, poi sull'ingranaggio scegli **Applicazione web**.
2. Imposta *Esegui come*: **Me**. *Chi ha accesso*: **Chiunque**.
3. Clicca **Esegui il deployment** e copia l'URL che termina con `/exec`.
4. Incollalo in `js/config.js`:

   ```js
   export const API_URL = 'https://script.google.com/macros/s/…/exec';
   ```

5. Carica via FTP i file aggiornati del sito.

> **Ogni volta che modifichi gli script**, vai su *Esegui il deployment → Gestisci deployment → ✏ → Versione: Nuova versione → Esegui il deployment*. L'URL resta lo stesso. Se crei invece un *nuovo* deployment, l'URL cambia.

## Modelli PDF

I due documenti Google si modificano come un normale documento: testi, impaginazione, logo, IBAN. Le parole tra doppie graffe vengono sostituite con i dati dell'iscrizione. Un segnaposto senza valore diventa `—`.

**Tesseramento** (dati da `soci`):
- composti: `{{ragazzo_nome}}`, `{{ragazzo_cf}}`, `{{genitore_nome}}`, `{{genitore_cf}}`, `{{anno}}`, `{{unita}}`, `{{data_nascita}}`, `{{indirizzo}}`
- singole colonne del foglio: `{{luogo_nascita}}`, `{{classe_frequentata}}`, `{{telefono}}`, `{{telefono_emergenza}}`, `{{email}}`, `{{note}}` e qualsiasi altra colonna della scheda `soci`.

**Iscrizione attività** (dati da `iscrizioni_attivita`):
- composti: `{{attivita}}`, `{{ragazzo_nome}}`, `{{ragazzo_cf}}`, `{{genitore_nome}}`, `{{genitore_cf}}`, `{{unita}}`, `{{indirizzo}}`, `{{data_nascita}}`
- singole colonne: `{{telefono}}`, `{{telefono_2}}`, `{{telefono_3}}`, `{{email_contatto}}`, `{{note_mediche}}`
- risposte ai campi extra dell'attività: `{{<id del campo>}}`.

Il modulo attività viene allegato a ogni iscrizione a un'attività.

## Gestire i dati

- **Dal pannello `admin.html`**: attività, campi extra, documenti PDF, stato delle iscrizioni, avvisi, apertura e chiusura delle iscrizioni.
- **Dal Foglio**: puoi leggere e correggere qualsiasi riga, anche da telefono. Alcune regole:
  - Non rinominare le intestazioni della riga 1.
  - Le date vanno scritte come `2026-08-01`.
  - Le caselle sì/no vanno scritte `TRUE` / `FALSE`.
  - Le colonne `campi_extra`, `documenti` e `risposte_extra` contengono JSON: modificale da admin, non a mano.
- Il pannello admin non mostra `soci` e `contatti`: li trovi solo nel Foglio.

## Limiti gratuiti

- **Gmail**: 100 email al giorno (account gratuito).
- **Apps Script**: 6 minuti per singola richiesta e 90 minuti al giorno di esecuzione.

Per un'associazione con iscrizioni stagionali non ci si avvicina a questi limiti.
