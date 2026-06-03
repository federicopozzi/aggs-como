# Migrazione a nuovo progetto Supabase

Guida completa per spostare il sito AGGS Como su un nuovo account/progetto Supabase senza downtime.

**Regola d'oro**: crea e verifica tutto sul nuovo progetto prima di toccare `js/config.js`. Il sito continua a funzionare sul vecchio fino all'ultimo secondo.

---

## Dati del progetto attuale (riferimento)

| Cosa | Valore |
|---|---|
| Project Ref | `bdwragqrgfkqlupitouw` |
| URL | `https://bdwragqrgfkqlupitouw.supabase.co` |
| Credenziali frontend | `js/config.js` |
| Schema DB | `supabase/schema.sql` |
| Edge Function | `supabase/functions/send-email/index.ts` |

---

## STEP 1 — Crea il nuovo progetto

1. Vai su [supabase.com](https://supabase.com) → accedi con il **nuovo account**
2. **New project** → nome (es. `aggs-como`), password database (salvala in un posto sicuro)
3. Annota il **Project Ref** (stringa nell'URL del dashboard, es. `abcdefghijklmnop`)

---

## STEP 2 — Crea lo schema database

Nel dashboard del nuovo progetto: **SQL Editor → New query**

Incolla ed esegui tutto il contenuto di `supabase/schema.sql` (già presente nel repo).

Verifica nel **Table Editor** che siano presenti le 6 tabelle:
- `attivita`
- `soci`
- `iscrizioni_attivita`
- `contatti`
- `avvisi`
- `impostazioni`

---

## STEP 3 — Crea il bucket Storage

Nel dashboard: **Storage → New bucket**

- Nome: `documenti-attivita`
- Public: **sì**

Poi aggiungi le policy dal **SQL Editor**:

```sql
create policy "Documenti pubblici"
  on storage.objects for select
  using (bucket_id = 'documenti-attivita');

create policy "Solo admin può caricare"
  on storage.objects for insert
  with check (bucket_id = 'documenti-attivita' and auth.role() = 'service_role');
```

---

## STEP 4 — Collega la CLI al nuovo progetto

```bash
# Login con il nuovo account Supabase
supabase login

# Collega la repo al nuovo progetto
supabase link --project-ref NUOVO_PROJECT_REF
```

---

## STEP 5 — Imposta i secrets della Edge Function

Le variabili d'ambiente si impostano da **Project Settings → Edge Functions → Secrets** oppure via CLI:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx --project-ref NUOVO_PROJECT_REF
supabase secrets set SUPABASE_URL=https://NUOVO_PROJECT_REF.supabase.co --project-ref NUOVO_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ... --project-ref NUOVO_PROJECT_REF
```

> La `SUPABASE_SERVICE_ROLE_KEY` del nuovo progetto: **Project Settings → API → service_role key**
> La `RESEND_API_KEY`: recuperala dal pannello [resend.com](https://resend.com) dell'account collegato

---

## STEP 6 — Deploya la Edge Function

```bash
supabase functions deploy send-email --project-ref NUOVO_PROJECT_REF
```

Verifica nel dashboard: **Edge Functions → send-email** deve essere verde (deployed).

---

## STEP 7 — Configura i webhook

Nel dashboard: **Database → Webhooks → Create a new hook**

Servono **due webhook**, entrambi puntati allo stesso URL della Edge Function.

**Webhook 1 — iscrizioni soci**
- Name: `on-insert-soci`
- Table: `soci`
- Events: `INSERT`
- Type: HTTP Request
- URL: `https://NUOVO_PROJECT_REF.supabase.co/functions/v1/send-email`
- HTTP Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <anon key del nuovo progetto>`

**Webhook 2 — iscrizioni attività**
- Name: `on-insert-iscrizioni`
- Table: `iscrizioni_attivita`
- Events: `INSERT`
- Stesse impostazioni URL e header del webhook 1

> La funzione gestisce internamente i due casi: per `soci` genera il PDF tesseramento, per `iscrizioni_attivita` genera il PDF campo (solo se `tipo = 'campo'`) oppure invia solo email HTML.

---

## STEP 8 — Aggiorna `js/config.js`

Questo è l'**unico file da modificare nel frontend** per completare la migrazione. Le nuove credenziali si trovano in **Project Settings → API**:

```js
export const SUPABASE_URL      = 'https://NUOVO_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...nuova_anon_key...';
export const SUPABASE_SERVICE_KEY = 'eyJ...nuova_service_role_key...';
```

Carica `js/config.js` via FTP → il sito punta al nuovo progetto.

---

## STEP 9 — Aggiorna CLAUDE.md

Sostituisci il project ref nel comando deploy:

```bash
supabase functions deploy send-email --project-ref NUOVO_PROJECT_REF
```

E aggiorna l'URL del dashboard:
```
https://supabase.com/dashboard/project/NUOVO_PROJECT_REF
```

---

## Checklist finale

Verifica tutto questo prima di aggiornare `js/config.js`:

- [ ] 6 tabelle presenti nel Table Editor
- [ ] RLS attivo su tutte le tabelle (Dashboard → Authentication → Policies)
- [ ] Tabella `impostazioni` ha la riga `iscrizioni_aperte = true`
- [ ] Bucket `documenti-attivita` creato e pubblico
- [ ] Edge Function `send-email` verde (deployed)
- [ ] 3 secrets impostati: `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 2 webhook attivi: `on-insert-soci` e `on-insert-iscrizioni`
- [ ] Test: compila il form iscrizione → arriva l'email?

---

## Rollback

Se qualcosa va storto dopo lo switch, basta ripristinare le credenziali originali in `js/config.js`:

```js
export const SUPABASE_URL      = 'https://bdwragqrgfkqlupitouw.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
export const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

E ricaricare via FTP. Il vecchio progetto non viene toccato durante la migrazione.
