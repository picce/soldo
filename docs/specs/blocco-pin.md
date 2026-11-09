# Blocco con PIN

> **Stato**: Parziale (implementata e provata con i test; manca la prova a mano sul telefono installato)
> **Data**: 2026-11-09
> **Ambito**: Terza parte della Fase 5. Un PIN di 4 cifre, facoltativo, nasconde Soldo all'apertura e quando si torna all'app dopo un po'. È un blocco dell'interfaccia, non una cifratura.
> **Spec collegate**: sta nella sezione Sicurezza delle Impostazioni, con [`backup-cifrati.md`](./backup-cifrati.md); «Cancella i dati» riporta all'onboarding di [`released/onboarding.md`](./released/onboarding.md).

## Panoramica

Il telefono passa di mano: lo si presta per una foto, lo guarda un figlio. Chi apre Soldo vede tutte le spese. Con il blocco attivo Soldo mostra prima una schermata con il tastierino del PIN; i dati compaiono solo dopo il PIN giusto.

Il blocco non cifra i dati sul telefono: chi ha il telefono sbloccato e sa usare gli strumenti del browser può leggerli. Lo diciamo nel foglio delle Impostazioni. La protezione vera dei dati che escono dal telefono è la cifratura dei backup.

Chi dimentica il PIN non ha scorciatoie: può solo cancellare i dati di questo telefono e ripristinarli da un backup. Altrimenti il blocco non servirebbe a niente.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - attivare il blocco dalle Impostazioni con un PIN di 4 cifre scritto due volte; cambiarlo; disattivarlo;
  - scegliere quando si blocca: subito, dopo 1 minuto o dopo 5 minuti fuori dall'app; all'apertura si blocca sempre;
  - schermata di blocco sopra tutto, tastierino grande, vibrazione e scossa sul PIN sbagliato;
  - dopo 5 tentativi sbagliati, attesa crescente (30 secondi, poi il doppio a ogni errore, al massimo 15 minuti), che resiste a un ricaricamento;
  - «Hai dimenticato il PIN?»: spiega e offre di cancellare i dati di questo telefono, dopo una conferma, per ripartire dall'onboarding (dove si ripristina un backup).
- **Non-obiettivi**:
  - cifrare il database del telefono;
  - sblocco con impronta o volto (WebAuthn): da valutare dopo, perché nelle PWA il supporto è ancora disomogeneo;
  - PIN più lunghi di 4 cifre o con lettere.

## Design

### Stato e verifica

`src/app/lock.ts` (nuovo):

- `localStorage` `soldo.lock`: `{ hash, salt, iterations, after }`, con l'impronta PBKDF2-SHA-256 del PIN (100.000 iterazioni, sale di 16 byte, in base64) e `after` in secondi (`0`, `60`, `300`). Il PIN non è mai salvato. Non sta nel database, così non finisce nei backup.
- `localStorage` `soldo.lock.attempts`: `{ failures, until }`, i tentativi sbagliati e fino a quando aspettare.
- `appLock` (reattivo, sola lettura: attivo, dopo quanto), `locked` (la schermata è su), `enableLock(pin, after)`, `changeLockDelay(after)`, `disableLock()`, `unlock(pin)` → `'ok' | 'wrong' | 'wait'`, `waitUntil()`.
- `startLock()`, da `src/main.ts` prima di montare l'app: con il blocco attivo `locked` parte vero; quando la pagina va in background si segna l'ora, quando torna visibile si blocca se è passato `after`.
- Con `after` a 0 basta un passaggio in background (cambiare app, spegnere lo schermo). Scegliere un file o condividere un backup non deve bloccare: il blocco aspetta almeno 2 secondi fuori dall'app anche con «Subito».

### Schermata di blocco

`src/app/components/LockScreen.vue` (nuovo), montata in `src/App.vue` sopra tutto (anche avvisi e barra), mentre `locked` è vero. Il contenuto dietro è `inert`, così né il dito né il lettore di schermo ci arrivano.

- In alto il logo e «Scrivi il PIN», quattro pallini che si riempiono; sotto `PinPad`.
- Al quarto numero il PIN si controlla da solo: giusto, la schermata sparisce; sbagliato, i pallini tremano (niente movimento con «Riduci movimento»), vibrazione dove c'è, «PIN sbagliato.» e si riparte.
- In attesa dopo troppi errori: «Troppi tentativi. Riprova tra 30 secondi.», con il conto alla rovescia, e il tastierino disattivato.
- In fondo «Hai dimenticato il PIN?»: una finestra spiega che senza il PIN si può solo cancellare i dati di questo telefono e poi ripristinare un backup; «Cancella i dati» (rosso) chiede conferma una seconda volta e cancella database, stato del backup, cifratura e blocco, poi riparte dall'onboarding.

### Tastierino

`src/components/PinPad.vue` (nuovo): 1–9, 0 e «Cancella», tasti grandi come quelli di `Keypad`, con stato premuto, `aria-label` e gruppo «Tastierino del PIN». Emette `digit` e `delete`. Va nella pagina `/dev/ui`.

### Impostazioni

- Sezione **Sicurezza** (`src/features/settings/SettingsView.vue`): sotto «Cifratura dei backup» la riga «Blocco con PIN» (icona `lock-key`) con «Disattivato» oppure «Attivo · subito», «Attivo · dopo 1 minuto».
- Foglio «Blocco con PIN» (`src/features/settings/LockSheet.vue`, nuovo):
  - disattivato: una frase su cosa fa e cosa non fa («Nasconde Soldo a chi prende in mano il telefono. Non cifra i dati: per i backup c'è la cifratura.»), «Scegli un PIN»;
  - per scegliere il PIN: «Scegli un PIN di 4 cifre», poi «Scrivilo di nuovo»; se non coincidono, «I due PIN non coincidono.» e si riparte; dentro il foglio, con `PinPad`;
  - attivo: «Blocca» con `SegmentedControl` (Subito, 1 minuto, 5 minuti), «Cambia PIN», «Disattiva il blocco».
- Avvisi: «Blocco attivato.», «PIN cambiato.», «Blocco disattivato.».

### Cancellare i dati

`src/app/reset.ts` (nuovo): svuota le tabelle del database, toglie `soldo.backup`, `soldo.encryption`, `soldo.lock` e `soldo.lock.attempts`, dimentica l'onboarding, poi ricarica la pagina, che riparte dal benvenuto. La lingua scelta resta.

### Testi, icone, test

- Testi in `src/i18n/locales/it.json` ed `en.json`; icona `lock-key` in `scripts/build-icons.js`.
- Unitari: `src/app/lock.test.ts` (PIN giusto e sbagliato, attesa crescente che resiste a un ricaricamento, blocco dopo il tempo scelto), `src/components/PinPad.test.ts`.
- e2e `e2e/lock.spec.ts`: si attiva il blocco, la pagina ricaricata chiede il PIN; un PIN sbagliato non apre; quello giusto sì; «Hai dimenticato il PIN?» cancella i dati e torna al benvenuto.

## Fasi di rilascio

1. **Stato e verifica**: `lock.ts`, test unitari.
2. **Schermata e Impostazioni**: `PinPad`, `LockScreen`, `LockSheet`, `reset.ts`, testi, `/dev/ui`. Verifica: `pnpm check` e `pnpm test:e2e` verdi; prova a mano sul telefono installato, uscendo e rientrando dall'app.
