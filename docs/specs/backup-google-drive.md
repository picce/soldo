# Backup automatico su Google Drive

> **Stato**: Parziale (implementata e provata con Google finto; manca la configurazione di Google, [`docs/google-drive.md`](../google-drive.md), e la prova con un Drive vero)
> **Data**: 2026-11-05
> **Ambito**: Fase 3 della roadmap. Si collega Google Drive dalle Impostazioni o dal primo avvio; da lì il backup parte da solo e finisce nella cartella «Soldo» del Drive dell'utente. Da Drive si ripristina, anche su un altro telefono. Il Worker scambia solo i token di Google e non vede mai i dati.
> **Spec collegate**: usa il formato di [`backup-manuale.md`](./released/backup-manuale.md); estende [`onboarding.md`](./released/onboarding.md) («Ripristina da Google Drive»); le regole visive sono quelle di [`docs/design`](../design/README.md)

## Panoramica

Oggi i dati stanno solo nel telefono, e il backup è un file da esportare a mano. Se il telefono si perde, o Safari cancella lo storage di un sito non installato, si perde tutto quello che è successo dopo l'ultima esportazione.

Con la Fase 3 l'utente collega una volta il suo Google Drive e non ci pensa più: dopo ogni modifica Soldo carica un backup nella cartella «Soldo» del suo Drive, e su un telefono nuovo lo ripristina in tre tocchi. I dati restano nello spazio dell'utente: nessun database nostro.

Google non dà un refresh token a un'app che vive solo nel browser, e senza refresh token il collegamento scadrebbe ogni ora. Per questo il Worker tiene il `client_secret` e il refresh token, cifrato in un cookie che solo lui legge. Al browser passa l'access token, e il browser parla con la Drive API direttamente.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - collegare Google Drive dalle Impostazioni, con lo scope `drive.file` (Soldo vede solo i file che ha creato lui), e scollegarlo;
  - backup automatico: 10 secondi dopo l'ultima modifica, all'avvio, quando l'app va in background e quando torna la rete; senza modifiche dall'ultimo backup non si carica niente;
  - un file al giorno nella cartella «Soldo», compresso (gzip), con un checksum; si tengono gli ultimi 14 giorni con un backup e l'ultimo backup di ognuno degli ultimi 12 mesi;
  - stato nelle Impostazioni: ultimo backup, backup in corso, errori («Da ricollegare», «Spazio su Drive esaurito») e «Esegui backup ora»;
  - ripristino da Drive, dalle Impostazioni e dal primo avvio: elenco dei backup con data e numero di movimenti, poi la stessa conferma del ripristino da file;
  - nessuna sovrascrittura per sbaglio: se Drive ha già backup e questo telefono non ne ha mai fatti, Soldo chiede se ripristinarne uno o usare i dati del telefono prima di caricare qualcosa;
  - pagina della privacy, che Google chiede per la schermata di consenso;
  - tutto funziona anche senza la configurazione di Google: finché il Worker non ha le credenziali, la sezione non compare.
- **Non-obiettivi**:
  - Dropbox e OneDrive (Fase 5): l'interfaccia `BackupProvider` è pronta per loro;
  - cifratura del backup con una passphrase (Fase 5);
  - sincronizzazione tra due telefoni attivi insieme (Fase 7): Drive tiene il backup dell'ultimo telefono che l'ha scritto;
  - backup ad app chiusa: una PWA non ha lavoro in background affidabile, e ogni modifica avviene comunque ad app aperta.

## Design

### Worker: token di Google

`worker/index.ts` smista le richieste; il codice nuovo sta in `worker/google.ts` (le quattro rotte) e `worker/cookies.ts` (cookie cifrati). Il Worker resta senza stato: niente KV né database.

| Rotta | Cosa fa |
|---|---|
| `GET /api/google/config` | `{ configured }`: vero se il Worker ha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `COOKIE_SECRET` |
| `GET /api/google/connect?return=/percorso` | Genera `state` e il `code_verifier` PKCE, li mette in un cookie cifrato di 10 minuti e rimanda a Google (`access_type=offline`, `prompt=consent`, scope `drive.file`) |
| `GET /api/google/callback` | Controlla `state`, scambia il `code` con il `client_secret` e il `code_verifier`, salva il refresh token in un cookie cifrato e torna a `percorso?google=connected` (oppure `denied`, `scope`, `error`) |
| `POST /api/google/token` | Dal cookie, un access token nuovo: `{ accessToken, expiresIn }`. Se Google ha revocato il permesso cancella il cookie e risponde 401 |
| `POST /api/google/disconnect` | Revoca il token presso Google e cancella il cookie |

- **Cookie**: valore cifrato con AES-GCM (chiave dallo SHA-256 di `COOKIE_SECRET`, il nome del cookie come dato autenticato), `HttpOnly`, `Secure`, `Path=/api/google`. Quello del refresh token è `SameSite=Strict` e dura 400 giorni, rinnovato a ogni access token; quello del collegamento in corso è `SameSite=Lax`, perché deve tornare indietro dal redirect di Google.
- **Richieste POST**: accettate solo dalla stessa origine (intestazione `Origin`), così un altro sito non può usare il cookie.
- **Percorso di ritorno**: solo un percorso dell'app (inizia con `/`, non con `//`), altrimenti `/impostazioni`.
- **Scope**: se nella schermata di Google l'utente toglie il permesso su Drive, il collegamento non vale e l'app lo spiega.
- I token non finiscono mai nei log.

### App: Drive e motore del backup

Tutto in `src/backup/`, caricato solo quando serve (il primo chunk non cresce):

- `provider.ts`: interfaccia `BackupProvider` (`list`, `upload`, `download`, `remove`, `account`) e tipi dei file remoti. Il backup su file della Fase 2 resta com'è: ha bisogno di un tocco dell'utente (condivisione o download), quindi non è una destinazione che il motore può scrivere da solo.
- `google/auth.ts`: `connectGoogle(percorso)` (navigazione verso `/api/google/connect`), access token in memoria con la scadenza, `disconnectGoogle()`; `useDriveAvailable()` chiede `/api/google/config` e ricorda la risposta per quando manca la rete.
- `google/drive.ts`: il provider Google con la Drive API v3 via `fetch`:
  - cartella «Soldo» trovata con `appProperties` (anche se l'utente la rinomina o la sposta), creata se manca;
  - un file per giorno, `soldo-backup-AAAA-MM-GG.json.gz`: il primo backup del giorno crea il file, i successivi lo aggiornano;
  - in `appProperties` data, numero di movimenti, categorie, conti e checksum, così l'elenco del ripristino non scarica i file;
  - i backup vecchi vanno nel cestino di Drive (recuperabili per 30 giorni), non cancellati;
  - un 401 rinnova l'access token una volta; lo spazio esaurito e i limiti di Google diventano errori con un nome.
- `pack.ts`: JSON del backup compresso con `CompressionStream('gzip')` e SHA-256 dei dati; lettura di un file compresso o no.
- `retention.ts`: `backupsToRemove(files)`, funzione pura.
- `auto.ts`: il motore.
  - **Stato** del dispositivo in `localStorage` (`soldo.backup`): collegamento, account, ultimo backup, checksum dell'ultimo backup, file di oggi, errore, scelta in sospeso. Non sta nel database, così non finisce nei backup e scriverlo non fa partire un altro backup.
  - **Quando**: modifiche al database (`Dexie.on('storagemutated')`, con la pagina visibile) dopo 10 secondi senza altre modifiche; avvio dell'app dopo 3 secondi; pagina nascosta, se c'è qualcosa in sospeso; ritorno della rete; «Esegui backup ora».
  - **Un backup**: istantanea del database (`createBackup` della Fase 2), checksum; se è uguale all'ultimo non carica niente, altrimenti carica e poi applica la conservazione. «Esegui backup ora» carica sempre (`runBackup({ force: true })`), anche senza modifiche: sostituisce il file di oggi, o lo rifà se è stato cancellato dal servizio. Un solo backup alla volta, anche tra due schede (Web Locks).
  - **Mai prima del primo avvio**: senza `meta.onboardedAt` il motore non carica niente, quindi non può mettere su Drive un telefono vuoto.
  - **Scelta in sospeso**: al primo backup dopo il collegamento, se Drive ha già backup di Soldo e questo telefono non ne ha mai fatti, il motore si ferma e le Impostazioni chiedono «Ripristina da Drive» o «Usa i dati di questo telefono».
  - **Errori**: senza rete aspetta la rete; con il permesso revocato o scaduto si ferma finché non si ricollega; con lo spazio esaurito o Google non disponibile riprova alla prossima occasione.
- `start.ts`, importato da `main.ts`: legge `?google=…` dopo il ritorno da Google, lo toglie dall'indirizzo, mostra l'avviso e avvia il motore solo se Drive è collegato.
- `import.ts`: `readBackup` legge anche i file `.json.gz` (si riconoscono dai primi due byte), così un backup scaricato da Drive si ripristina anche da file.

### Interfaccia

Nessun mockup nuovo: le schermate usano le righe delle Impostazioni, i fogli dal basso e la finestra di ripristino già disegnati.

- **Impostazioni**, nuova sezione «Backup automatico» sopra «Backup» (che diventa «Backup su file»), visibile quando Google è configurato o Drive è già collegato:
  - non collegato: riga «Google Drive», «Collega il tuo account: il backup parte da solo»; senza rete un avviso dice che serve la rete;
  - collegato: riga «Google Drive» con lo stato («Automatico · ultimo: 2 minuti fa», «Backup in corso…», «Da ricollegare», «Spazio su Drive esaurito», «Scegli quali dati tenere»), che apre il foglio «Google Drive».
- **Foglio «Google Drive»** (`src/features/settings/DriveSheet.vue`): l'account, lo stato, «Esegui backup ora», «Ripristina da Drive», «Scollega»; con il permesso scaduto «Ricollega Google Drive»; con la scelta in sospeso la spiegazione e i due pulsanti.
- **Foglio «Backup su Google Drive»** (`src/features/settings/DriveRestoreSheet.vue`): i backup dal più recente, con data, ora e movimenti; tocco su uno, download e la conferma di `RestoreBackup.vue` (che ora accetta anche un backup già letto, `show(lettura)`).
- **Primo avvio**: con Google configurato i pulsanti sono «Inizia da zero», «Ripristina da Google Drive» e, più piccolo, «Ripristina da un file». Il ritorno da Google riapre il benvenuto con l'elenco dei backup (`/benvenuto?ripristina=drive`). Il terzo punto dice che il backup va sul Drive dell'utente.
- **Privacy**: `public/privacy.html`, pagina statica in italiano e in inglese, raggiungibile all'indirizzo `/privacy` anche senza aver fatto il primo avvio; collegata da Impostazioni → Informazioni.
- Testi in `src/i18n/locales/it.json` ed `en.json`; icone `google-drive-logo` e `shield-check` in `scripts/build-icons.js`.
- `public/_headers`: `connect-src` aggiunge `https://www.googleapis.com`.

### Configurazione

[`docs/google-drive.md`](../google-drive.md) spiega come creare il progetto Google Cloud, la schermata di consenso (in modalità Testing: fino a 100 utenti di prova, collegamento da rifare ogni 7 giorni) e il client OAuth con gli indirizzi di ritorno di produzione, anteprima e sviluppo, e come dare al Worker i tre segreti con `wrangler secret put`. In locale i segreti vanno in `.dev.vars` (modello in `.dev.vars.example`).

### Test

- Unit: Worker (rotte, cookie cifrati, controllo dell'origine, errori di Google) in ambiente Node; conservazione; compressione e checksum; provider Drive con `fetch` finto; motore (niente caricamento senza modifiche, prima del primo avvio o con la scelta in sospeso; errori; un backup alla volta); Impostazioni e primo avvio con Drive configurato o no.
- E2E (`e2e/drive.spec.ts`): Google e la Drive API finti con `page.route` (`e2e/drive.ts`, sullo stesso Drive in memoria dei test unitari, `src/test/fake-drive.ts`); collegamento dalle Impostazioni e backup dopo una spesa; ripristino da Drive al primo avvio; scelta in sospeso quando Drive ha già backup.
- A mano, dopo la configurazione: collegamento su Android dal browser e dall'app installata, backup dopo una spesa, ripristino su un secondo browser con gli stessi conteggi.

## Fasi di rilascio

Un rilascio, la versione 0.4.0, in quattro passi sullo stesso branch:

1. **Worker**: rotte e cookie, con i test.
2. **Drive e motore**: provider, compressione, conservazione, motore e avvio.
3. **Interfaccia**: Impostazioni, fogli, primo avvio, privacy, testi e icone.
4. **Documentazione e test end-to-end**; poi la configurazione di Google, che fa l'utente seguendo `docs/google-drive.md`. Fino ad allora la versione pubblicata si comporta come la 0.3.0.
