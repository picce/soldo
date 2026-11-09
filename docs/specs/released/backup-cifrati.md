# Backup cifrati

> **Stato**: Rilasciata (versione 0.9.0, 2026-11-09)
> **Data**: 2026-11-09
> **Ambito**: Seconda parte della Fase 5. Una passphrase scelta dall'utente cifra i backup automatici su Google Drive e quelli esportati come file; il ripristino la chiede. Il resto dell'app non cambia.
> **Spec collegate**: cifra i file di [`released/backup-manuale.md`](./backup-manuale.md) e di [`backup-google-drive.md`](../backup-google-drive.md); il formato dei dati resta quello di [`released/dati-locali.md`](./dati-locali.md).

## Panoramica

I backup di Soldo contengono tutte le spese dell'utente. Su Google Drive li legge chiunque entri nell'account Google; un file esportato lo legge chiunque lo trovi, nella cartella Download o in un allegato. La roadmap prevede per la Fase 5 la cifratura facoltativa dei backup con una passphrase.

Dalle Impostazioni l'utente sceglie una passphrase. Da quel momento ogni backup, automatico o esportato, è cifrato con una chiave ricavata dalla passphrase. Il telefono tiene la chiave, non la passphrase, così il backup automatico continua da solo senza chiedere niente. La passphrase serve solo per ripristinare: su un telefono nuovo, o dopo aver cancellato i dati.

Chi perde la passphrase perde i backup cifrati: nessuno può recuperarla, nemmeno noi. Lo diciamo chiaramente prima di attivare la cifratura.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - attivare la cifratura dalle Impostazioni con una passphrase scritta due volte, cambiarla, disattivarla;
  - cifrare i backup automatici su Google Drive e il backup esportato come file;
  - ripristinare un backup cifrato, da file o da Drive, chiedendo la passphrase; con la passphrase sbagliata non cambia niente;
  - dopo il ripristino di un backup cifrato, il telefono continua a cifrare con la stessa passphrase, così i backup successivi non tornano in chiaro;
  - continuare a ripristinare i backup in chiaro, vecchi e nuovi.
- **Non-obiettivi**:
  - cifrare i dati sul telefono: IndexedDB resta in chiaro, la protezione del telefono è il blocco con PIN (spec a parte, Fase 5);
  - cifrare l'esportazione CSV, che serve ad aprire i movimenti in un foglio di calcolo;
  - ricifrare i backup già su Drive: restano come sono e la conservazione (14 giornalieri e 12 mensili) li sostituisce col tempo;
  - recuperare una passphrase dimenticata, o ricordarla all'utente a intervalli;
  - nascondere su Drive la data, il numero di movimenti, categorie e conti e il checksum del backup: stanno nelle proprietà del file perché l'elenco dei backup si mostri senza scaricarli.

## Design

### Crittografia

Solo Web Crypto, niente librerie. `src/backup/crypto.ts` (nuovo):

- **Chiave**: PBKDF2 con SHA-256, sale casuale di 16 byte, 600.000 iterazioni (indicazione OWASP 2023), da cui una chiave AES-GCM di 256 bit. Ricavarla richiede circa mezzo secondo su un telefono: succede quando si attiva la cifratura e quando si apre un backup, mai a ogni backup.
- **File cifrato**: un'intestazione di 41 byte, poi il testo cifrato.

  | Byte | Contenuto |
  |---|---|
  | 0–7 | `SOLDOENC` in ASCII: riconosce il file |
  | 8 | versione della cifratura, `1` |
  | 9–12 | iterazioni di PBKDF2, intero senza segno big-endian |
  | 13–28 | sale |
  | 29–40 | IV di AES-GCM, casuale per ogni file |
  | 41– | AES-GCM del backup compresso con gzip (`packBackup` di `src/backup/pack.ts`), con i 16 byte del tag in fondo |

  L'intestazione è anche il dato aggiuntivo autenticato di AES-GCM: se cambia un byte, il file non si apre.
- **Funzioni**: `isEncrypted(bytes)`, `createBackupKey(passphrase, iterations?)` (sale nuovo), `deriveBackupKey(passphrase, salt, iterations)`, `encryptBytes(bytes, key)`, `decryptBytes(bytes, passphrase)` (legge sale e iterazioni dall'intestazione; con la passphrase sbagliata restituisce `null`). Le iterazioni sono un parametro solo perché i test non aspettino mezzo secondo ogni volta.

### Chiave sul telefono

`src/backup/encryption.ts` (nuovo), sul modello di `src/backup/state.ts`:

- `localStorage` `soldo.encryption`: `{ key, salt, iterations, since }`, con chiave e sale in base64 e `since` la data di attivazione (ISO 8601). Non sta nel database, così non finisce nei backup e un ripristino non la cambia di nascosto.
- Tenere la chiave in chiaro sul telefono non toglie niente: sul telefono ci sono già tutti i dati in chiaro. La cifratura protegge i backup che escono dal telefono.
- `backupEncryption` (sola lettura, reattivo, segue le altre schede con l'evento `storage`), `enableEncryption(passphrase)`, `adoptEncryption(key)` (dopo un ripristino), `disableEncryption()`, `encryptionKey()` (la `CryptoKey`, importata una volta sola).
- Attivare, cambiare o disattivare la cifratura azzera `lastChecksum` dello stato del backup automatico, così il prossimo backup parte anche se i dati non sono cambiati e sostituisce il file di oggi con quello nuovo.

### Backup

- `src/backup/pack.ts`: `sealBackup(backup)` comprime e, con la cifratura attiva, cifra; restituisce i byte e `encrypted`.
- `src/backup/auto.ts`: carica `sealBackup` al posto di `packBackup`; il riepilogo dice se il file è cifrato.
- `src/backup/provider.ts`: `BackupSummary.encrypted` (facoltativo, `false` se manca).
- `src/backup/google/drive.ts`: il file cifrato si chiama `soldo-backup-AAAA-MM-GG.soldo`, con tipo `application/octet-stream` e la proprietà `encrypted: '1'`; quello in chiaro non cambia.
- `src/backup/export.ts`: con la cifratura attiva `exportBackup` consegna `soldo-backup-AAAA-MM-GG.soldo` (`application/octet-stream`); senza, il JSON di sempre.

### Ripristino

`src/backup/import.ts`:

- `readBackupBytes` riconosce l'intestazione e, invece di leggere il file, restituisce `{ ok: false, error: 'locked', locked }`, con `locked` i byte, il nome del file e il checksum di Drive.
- `unlockBackup(locked, passphrase)`: decifra e continua come `readBackupBytes`, checksum compreso. Con la passphrase sbagliata `{ ok: false, error: 'wrongPassphrase' }`. Se riesce, la lettura porta anche la chiave usata.
- `restoreBackup(backup, key?)`: dopo il ripristino, con la chiave, `adoptEncryption(key)`: il telefono continua a cifrare con la passphrase del backup appena aperto.

### Interfaccia

Nessun mockup nuovo: le schermate usano componenti e schemi che ci sono già (`BottomSheet`, `TextField`, la finestra di `RestoreBackup`, le righe delle Impostazioni).

- **Impostazioni** (`src/features/settings/SettingsView.vue`): una sezione nuova **Sicurezza**, sopra Google Drive, con la riga «Cifratura dei backup» (icona `lock`) e il dettaglio «Disattivata» oppure «Attiva dal 9 novembre». Il blocco con PIN andrà nella stessa sezione. Con la cifratura attiva la riga «Esporta backup» dice «File cifrato con tutti i dati».
- **Foglio «Cifratura dei backup»** (`src/features/settings/EncryptionSheet.vue`, nuovo):
  - disattivata: una frase su cosa fa («Chi apre i tuoi backup, su Google Drive o in un file, non può leggerli senza la passphrase. Questo telefono la ricorda: la chiede solo il ripristino.»), i campi «Passphrase» (almeno 8 caratteri) e «Ripeti la passphrase», l'avviso in rosso («Se perdi la passphrase, i backup cifrati non si possono più aprire. Nessuno può recuperarla, nemmeno noi.») e il pulsante «Cifra i backup»;
  - attiva: il riquadro con il lucchetto («I backup sono cifrati», «dal 9 novembre 2026»), la nota «I backup fatti prima restano come erano.», il pulsante «Cambia passphrase» (riapre i due campi, con «Salva la passphrase») e l'azione discreta «Disattiva la cifratura»;
  - errori nei campi: «Almeno 8 caratteri.», «Le due passphrase non coincidono.»;
  - avvisi: «Da ora i backup sono cifrati.», «Passphrase cambiata.», «Da ora i backup non sono cifrati.». Se Google Drive è collegato, subito dopo parte un backup.
- **Ripristino** (`src/features/settings/RestoreBackup.vue`): un backup cifrato, da file o da Drive, apre la stessa finestra con un primo passo: titolo «Backup cifrato», «Scrivi la passphrase scelta quando hai attivato la cifratura.», il campo «Passphrase», «Annulla» e «Apri». Con la passphrase sbagliata il campo dice «Passphrase sbagliata.» e resta aperto; con quella giusta la finestra passa all'anteprima di sempre. Il selettore dei file accetta anche `.soldo`.
- **Backup su Drive** (`src/features/settings/DriveRestoreSheet.vue`): un backup cifrato ha «· cifrato» dopo il numero di movimenti; scaricato, passa a `RestoreBackup` come gli altri. Lo stesso nell'onboarding (`src/features/onboarding/WelcomeView.vue`), che usa gli stessi componenti.
- `TextField` (`src/components/TextField.vue`) prende la prop `type` (`text` o `password`).
- Testi in `src/i18n/locales/it.json` ed `en.json`; icona `lock` in `scripts/build-icons.js`; il foglio nella pagina `/dev/ui`.

### Test

- Unitari: `src/backup/crypto.test.ts` (andata e ritorno, passphrase sbagliata, intestazione o testo modificati, file in chiaro riconosciuti), `src/backup/encryption.test.ts`, i casi cifrati in `src/backup/import.test.ts` e `src/backup/auto.test.ts` (il file su Drive è cifrato e si ripristina con la passphrase).
- e2e in `e2e/backup.spec.ts`: si attiva la cifratura, si esporta, il file non è JSON; si ripristina con la passphrase sbagliata e poi con quella giusta. In `e2e/drive.spec.ts`: con la cifratura attiva il backup su Drive è cifrato e si ripristina chiedendo la passphrase.

## Fasi di rilascio

1. **Crittografia e chiave**: `crypto.ts`, `encryption.ts` e i test unitari. Verifica: `pnpm test`.
2. **Backup e ripristino cifrati**: `pack.ts`, `auto.ts`, `drive.ts`, `export.ts`, `import.ts`. Verifica: un backup cifrato, su file e su Drive finto, si ripristina solo con la passphrase giusta.
3. **Interfaccia**: sezione Sicurezza, foglio della cifratura, passo della passphrase nel ripristino, testi in due lingue, `/dev/ui`. Verifica: `pnpm check` e `pnpm test:e2e` verdi; prova a mano sul telefono, con un ripristino da Drive vero quando la configurazione di Google ci sarà.
