# Configurare Google Drive

Il backup automatico ([spec](specs/backup-google-drive.md)) ha bisogno di un client OAuth di Google e di tre segreti nel Worker. Finché mancano, `/api/google/config` risponde `{ "configured": false }` e l'app non mostra la sezione «Backup automatico»: tutto il resto funziona come prima.

Serve una sola volta, da un account Google qualsiasi (va bene quello personale). Costa zero.

## 1. Progetto Google Cloud

1. Apri [console.cloud.google.com](https://console.cloud.google.com/) e crea un progetto, per esempio «Soldo».
2. In **API e servizi → Libreria** cerca «Google Drive API» e attivala.

## 2. Schermata di consenso

In **Google Auth Platform** (il vecchio «Schermata consenso OAuth»):

1. **Branding**: nome dell'app «Soldo», email di assistenza (la tua). Più in basso:
   - home page: `https://soldo.nridolfi.workers.dev`
   - privacy: `https://soldo.nridolfi.workers.dev/privacy`
   - domini autorizzati: `nridolfi.workers.dev`
2. **Pubblico**: tipo «Esterno», stato **Testing**. In «Utenti di prova» aggiungi gli account Google che useranno Soldo (fino a 100).
3. **Accesso ai dati**: aggiungi l'ambito `https://www.googleapis.com/auth/drive.file` («Visualizzare, creare ed eliminare i propri file di Google Drive utilizzati con questa app»). È un ambito non sensibile: niente revisione di sicurezza.

In modalità Testing Google fa scadere il collegamento dopo **7 giorni**: Soldo lo mostra con «Da ricollegare» e basta un tocco su «Ricollega Google Drive». Per toglierlo bisogna pubblicare l'app (stato «In produzione») e passare la verifica del brand di Google: dominio verificato in Search Console (meglio un dominio proprio di un sottodominio di `workers.dev`), home page e privacy raggiungibili. Con il solo `drive.file` non serve la verifica delle app con ambiti sensibili.

## 3. Client OAuth

In **Google Auth Platform → Client → Crea client**:

- tipo: **Applicazione web**, nome «Soldo»;
- **URI di reindirizzamento autorizzati** (uno per ogni sito da cui ci si collega):
  - `https://soldo.nridolfi.workers.dev/api/google/callback` (produzione)
  - `https://develop-soldo.nridolfi.workers.dev/api/google/callback` (anteprima di `develop`)
  - `http://localhost:5173/api/google/callback` (`pnpm dev`)
  - `http://localhost:4173/api/google/callback` (`pnpm preview`)
- le «Origini JavaScript autorizzate» non servono: il browser non usa il client, parla con il Worker.

Alla creazione Google mostra **ID client** e **client secret**: copiali.

## 4. Segreti del Worker

Dalla cartella del progetto, con wrangler collegato all'account Cloudflare:

```sh
npx wrangler secret put GOOGLE_CLIENT_ID      # l'ID client
npx wrangler secret put GOOGLE_CLIENT_SECRET  # il client secret
npx wrangler secret put COOKIE_SECRET         # una stringa casuale lunga:
# node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
```

I segreti valgono per il Worker `soldo`, quindi sia per la produzione sia per le anteprime di `develop`, e restano ai deploy successivi. Si possono mettere anche dalla dashboard di Cloudflare (Workers → soldo → Impostazioni → Variabili e segreti, tipo «Segreto»).

Cambiare `COOKIE_SECRET` scollega tutti i dispositivi: i cookie già dati non si leggono più e l'app chiede di ricollegare Drive.

## 5. Prova

1. `https://soldo.nridolfi.workers.dev/api/google/config` risponde `{"configured":true}`.
2. Nell'app, Impostazioni → «Backup automatico» → Google Drive: si apre Google, si sceglie l'account, si torna a Soldo con «Google Drive collegato».
3. Pochi secondi dopo, nel Drive c'è la cartella «Soldo» con `soldo-backup-AAAA-MM-GG.json.gz`.
4. Su un altro browser (o in incognito): «Ripristina da Google Drive» al primo avvio, scegli il backup, stessi movimenti.

## In locale

Copia `.dev.vars.example` in `.dev.vars` (ignorato da git) e riempilo con gli stessi valori, oppure con un client OAuth di prova. `pnpm dev` e `pnpm preview` lo leggono da soli.

## Cosa fa il Worker

Solo i token, senza memoria: `worker/google.ts` scambia il codice di Google con il refresh token, lo cifra in un cookie `HttpOnly` che il browser rimanda solo a `/api/google/*`, e da quello ricava access token di un'ora per l'app. I backup vanno dal browser a Drive direttamente: i dati di spesa non passano dal Worker.
