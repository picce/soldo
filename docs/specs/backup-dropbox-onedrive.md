# Backup su Dropbox e OneDrive

> **Stato**: Parziale (implementata e provata con Dropbox e OneDrive finti; manca la prova con account veri, dopo la configurazione di `docs/dropbox-onedrive.md`)
> **Data**: 2026-11-09
> **Ambito**: Quarta parte della Fase 5. Il backup automatico, oggi solo su Google Drive, può andare anche su Dropbox o su OneDrive. Si usa un servizio alla volta; ognuno compare solo dove il Worker ha le sue credenziali.
> **Spec collegate**: estende [`backup-google-drive.md`](./backup-google-drive.md) (motore, conservazione, ripristino, interfaccia); i file possono essere cifrati come in [`backup-cifrati.md`](./released/backup-cifrati.md).

## Panoramica

Non tutti usano Google Drive. Dropbox e OneDrive sono gli altri due spazi personali più diffusi, e la roadmap li prevede per la Fase 5.

Per chi usa l'app cambia solo la scelta: nelle Impostazioni, sotto «Backup automatico», ci sono Google Drive, Dropbox e OneDrive (quelli configurati sul sito). Collegato uno, gli altri spariscono finché non lo si scollega. Tutto il resto funziona come con Google Drive: un file al giorno, gli ultimi 14 giorni e 12 mesi, il ripristino dall'onboarding e dalle Impostazioni, la scelta quando lo spazio ha già i backup di un altro telefono.

I dati di spesa non passano mai dal Worker: l'app parla direttamente con l'API di Dropbox o di Microsoft Graph.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - collegare Dropbox o OneDrive dalle Impostazioni e dall'onboarding, come Google Drive;
  - backup automatico, conservazione e ripristino uguali per i tre servizi;
  - nessun servizio senza credenziali sul Worker: il sito mostra solo quelli configurati;
  - un solo servizio collegato alla volta;
  - la stessa sicurezza di Google: refresh token in un cookie cifrato che solo il Worker legge, PKCE, richieste solo dalle pagine dell'app.
- **Non-obiettivi**:
  - più servizi insieme (lo stesso backup su Drive e su Dropbox);
  - spostare i backup da un servizio all'altro;
  - accesso a file fuori dalla cartella dell'app: Soldo chiede solo la cartella sua (`App folder` su Dropbox, `Files.ReadWrite.AppFolder` su OneDrive).

## Design

### Worker

- `worker/oauth.ts` (nuovo): il flusso che oggi è in `worker/google.ts` (rotte `config`, `connect`, `callback`, `token`, `disconnect`, cookie del flusso e della sessione, controllo dell'origine), reso generico. Un servizio dichiara URL di consenso e di token, permessi, parametri in più, come controllare i permessi concessi e come revocare.
- `worker/google.ts` diventa la configurazione di Google, con lo stesso comportamento di oggi.
- `worker/dropbox.ts` (nuovo): consenso su `www.dropbox.com/oauth2/authorize` con `token_access_type=offline`, token su `api.dropboxapi.com/oauth2/token`, permessi `files.content.write files.content.read account_info.read`; alla disconnessione revoca il token. Segreti `DROPBOX_CLIENT_ID` e `DROPBOX_CLIENT_SECRET`.
- `worker/onedrive.ts` (nuovo): consenso e token su `login.microsoftonline.com/common/oauth2/v2.0/…`, permessi `Files.ReadWrite.AppFolder User.Read offline_access`; Microsoft non ha una revoca del singolo token: alla disconnessione si cancella il cookie. Segreti `ONEDRIVE_CLIENT_ID` e `ONEDRIVE_CLIENT_SECRET`.
- `COOKIE_SECRET` resta uno solo. Rotte `/api/dropbox/*` e `/api/onedrive/*`, ritorno con `?dropbox=…` e `?onedrive=…`.
- Procedura di configurazione in `docs/dropbox-onedrive.md` (nuovo), modello in `.dev.vars.example`.

### App

- `src/backup/services.ts` (nuovo): i tre servizi (`google`, `dropbox`, `onedrive`) con nome, icona, accesso e provider.
- `src/backup/oauth.ts` (nuovo): l'accesso tramite il Worker di `src/backup/google/auth.ts`, per ogni servizio (consenso, access token in memoria, disconnessione, disponibilità). `google/auth.ts` lo usa.
- `src/backup/folder.ts` (nuovo): un provider di backup sopra una cartella semplice (elenca, leggi, scrivi, cancella). Dropbox e OneDrive non hanno le proprietà dei file di Drive: il riepilogo di ogni backup (giorno, data, conteggi, checksum, cifrato) sta in `soldo-backups.json` nella stessa cartella. Un file senza riepilogo nell'indice compare lo stesso, con il giorno preso dal nome; un riepilogo senza file si ignora.
- `src/backup/authorized.ts` (nuovo): le richieste con l'access token, che a un 401 lo rinnovano una volta.
- `src/backup/dropbox/dropbox.ts` (nuovo): la cartella su Dropbox API v2 (`files/list_folder`, `files/upload` con `mode: overwrite`, `files/download`, `files/delete_v2`, `users/get_current_account`).
- `src/backup/onedrive/onedrive.ts` (nuovo): la cartella su Microsoft Graph (`/me/drive/special/approot`, upload semplice, che arriva a 250 MB, l'indirizzo di download temporaneo del file, `/me` per l'account).
- `src/backup/state.ts`: `service` nello stato (`google` di base, così chi ha già Drive collegato non nota niente).
- `src/backup/auto.ts`: il provider è quello del servizio collegato; `completeConnection(service)`.
- `src/backup/start.ts`: legge `?google=`, `?dropbox=` o `?onedrive=`.
- `public/_headers`: `connect-src` con `https://api.dropboxapi.com`, `https://content.dropboxapi.com`, `https://graph.microsoft.com` e gli host dei download di OneDrive (`https://*.1drv.com`, `https://*.sharepoint.com`).

### Interfaccia

- **Impostazioni**, sezione «Backup automatico» (`src/features/settings/SettingsView.vue`): senza collegamento una riga per ogni servizio disponibile («Collega il tuo account: il backup parte da solo»); collegato, solo la riga del servizio con lo stato.
- `DriveSheet.vue` e `DriveRestoreSheet.vue` diventano del servizio collegato: titolo, icona e testi con il suo nome («Ripristina da Dropbox», «Il tuo OneDrive è pieno»). La frase su dove vanno i backup dice la cartella di ciascuno: «Soldo» su Drive, «Applicazioni/Soldo» su Dropbox, «App/Soldo» su OneDrive.
- **Onboarding** (`src/features/onboarding/WelcomeView.vue`): «Ripristina da Google Drive», «Ripristina da Dropbox», «Ripristina da OneDrive» per i servizi disponibili; il punto del benvenuto dice «Il backup va sul tuo cloud» quando ce n'è più d'uno.
- Testi in `src/i18n/locales/it.json` ed `en.json` con il nome del servizio come parametro; icone Phosphor `dropbox-logo` e, per OneDrive, che in Phosphor non c'è, `cloud`.

### Test

- Worker: i test di Google restano; `worker/services.test.ts` per Dropbox e OneDrive (consenso, callback, permessi mancanti, token e disconnessione).
- App: `src/backup/folder.test.ts` (indice, file senza riepilogo, cancellazione), `src/test/fake-cloud.ts` (le due API in memoria) e `src/backup/cloud.test.ts` (il motore su Dropbox e su OneDrive).
- e2e: in `e2e/drive.spec.ts`, Dropbox collegato dalle Impostazioni fa il backup e un altro telefono lo ripristina dall'onboarding.

## Fasi di rilascio

1. **Worker generico**: `oauth.ts`, Google senza cambiamenti visibili, Dropbox e OneDrive con i test.
2. **Provider**: `folder.ts`, Dropbox, OneDrive, servizi e motore. Verifica: test unitari con le API finte.
3. **Interfaccia**: Impostazioni, fogli, onboarding, testi. Verifica: `pnpm check` e `pnpm test:e2e` verdi; prova con account veri dopo la configurazione di `docs/dropbox-onedrive.md`.
