# Configurare Dropbox e OneDrive

Il backup automatico su Dropbox e OneDrive ([spec](specs/backup-dropbox-onedrive.md)) funziona come quello su Google Drive ([docs/google-drive.md](google-drive.md)): un'app registrata presso il servizio e due segreti nel Worker per ciascuno. Finché mancano, `/api/dropbox/config` e `/api/onedrive/config` rispondono `{ "configured": false }` e l'app non mostra quel servizio. Si può configurare uno solo dei due.

`COOKIE_SECRET` è lo stesso di Google: se c'è già, non va cambiato.

Gli indirizzi di ritorno sono gli stessi quattro siti di Google, con il nome del servizio:

- `https://soldo.nridolfi.workers.dev/api/<servizio>/callback` (produzione)
- `https://develop-soldo.nridolfi.workers.dev/api/<servizio>/callback` (anteprima di `develop`)
- `http://localhost:5173/api/<servizio>/callback` (`pnpm dev`)
- `http://localhost:4173/api/<servizio>/callback` (`pnpm preview`)

## Dropbox

1. Apri [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) e crea un'app: **Scoped access**, tipo di accesso **App folder**, nome «Soldo». La cartella sarà `Applicazioni/Soldo` (`Apps/Soldo` in inglese).
2. In **Permissions** spunta `files.content.write`, `files.content.read` e `account_info.read`, poi **Submit**.
3. In **Settings → OAuth 2 → Redirect URIs** aggiungi i quattro indirizzi con `dropbox` (`…/api/dropbox/callback`).
4. Copia **App key** e **App secret**.
5. Segreti del Worker:

   ```bash
   npx wrangler secret put DROPBOX_CLIENT_ID
   npx wrangler secret put DROPBOX_CLIENT_SECRET
   ```

Un'app nuova è in stato **Development**: la usano fino a 500 account, senza revisione. Per aprirla a tutti si chiede la **Production** dalla pagina dell'app.

## OneDrive

1. Apri il [portale di Azure](https://portal.azure.com/), **Microsoft Entra ID → Registrazioni app → Nuova registrazione**: nome «Soldo», account supportati **Account in qualsiasi directory organizzativa e account Microsoft personali**, URI di reindirizzamento di tipo **Web** con `https://soldo.nridolfi.workers.dev/api/onedrive/callback`.
2. In **Autenticazione** aggiungi gli altri tre indirizzi con `onedrive`, sempre di tipo Web.
3. In **Certificati e segreti → Nuovo segreto client** crea un segreto (scadenza massima 24 mesi: segnati quando rinnovarlo) e copia il **Valore**.
4. In **Autorizzazioni API → Aggiungi un'autorizzazione → Microsoft Graph → Autorizzazioni delegate** aggiungi `Files.ReadWrite.AppFolder`, `User.Read` e `offline_access`. Non serve il consenso dell'amministratore.
5. Copia l'**ID applicazione (client)** dalla pagina **Panoramica**.
6. Segreti del Worker:

   ```bash
   npx wrangler secret put ONEDRIVE_CLIENT_ID
   npx wrangler secret put ONEDRIVE_CLIENT_SECRET
   ```

La cartella sarà `App/Soldo` (`Apps/Soldo` in inglese) nel OneDrive dell'utente.

## In locale

In `.dev.vars` (modello in `.dev.vars.example`) gli stessi nomi, con i valori dell'app di sviluppo.

## Prova

1. Sull'anteprima di `develop`, nelle Impostazioni, sotto «Backup automatico» compare la riga del servizio.
2. «Collega il tuo account», consenso, ritorno a Soldo con «Dropbox collegato» (o «OneDrive collegato»).
3. Dopo qualche secondo nella cartella dell'app ci sono `soldo-backup-AAAA-MM-GG.json.gz` e `soldo-backups.json`.
4. Da un altro browser, nel benvenuto, «Ripristina da Dropbox» elenca il backup e lo ripristina.
