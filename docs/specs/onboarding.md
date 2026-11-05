# Onboarding al primo avvio

> **Stato**: Bozza (non implementata)
> **Data**: 2026-11-05
> **Ambito**: Al primo avvio Soldo presenta l'app e offre due strade: iniziare da zero (crea categorie e conto) o ripristinare un backup. Invita a installare l'app, perché su iPhone i dati di un sito non installato possono essere cancellati.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) (dati iniziali, storage persistente) e [`backup-manuale.md`](./backup-manuale.md) (ripristino); [`mockup-fase-2.md`](./mockup-fase-2.md) per la variante Android

## Panoramica

Il mockup approvato è [Onboarding](../design/render/onboarding-chiaro.png). Oggi l'app si apre direttamente sulla Home vuota. Il primo avvio è il momento giusto per creare i dati iniziali, chiedere lo storage persistente e spiegare l'installazione: la roadmap indica tra i rischi che Safari può cancellare lo storage dei siti non installati dopo 7 giorni senza uso.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - finché `meta.onboardedAt` non esiste, ogni percorso porta a `/benvenuto` (tranne `/dev/ui`);
  - schermata come nel mockup: logo, motto, tre punti, scheda «Installa Soldo», «Inizia da zero» e «Ripristina un backup»;
  - «Inizia da zero»: crea categorie e conto (`seedDefaults`), chiede lo storage persistente, segna `onboardedAt` e apre la Home;
  - «Ripristina un backup»: apre la scelta del file e il flusso di importazione di [`backup-manuale.md`](./backup-manuale.md); a ripristino riuscito segna `onboardedAt`;
  - scheda di installazione adatta al dispositivo: su iPhone le istruzioni con Condividi; su Android e Chrome desktop il pulsante «Installa» (evento `beforeinstallprompt`); nascosta se l'app è già installata (`display-mode: standalone`);
  - in Fase 2 il terzo punto non promette Google Drive: «Il backup è un file tuo», «Lo esporti quando vuoi e lo salvi dove preferisci.» Torna al testo del mockup con la Fase 3.
- **Non-obiettivi**:
  - tour delle funzioni o più passaggi: una schermata sola;
  - richiesta di permessi (notifiche): non servono.

## Design

- `src/app/router.ts`: percorso `/benvenuto` (`welcome`, `meta.fullscreen`) e una guardia globale che legge `meta.onboardedAt` (una volta per sessione, poi in memoria).
- `src/features/onboarding/WelcomeView.vue` (nuovo).
- `src/features/onboarding/InstallCard.vue` (nuovo) e `src/app/install.ts` (nuovo): rileva iOS non installato e intercetta `beforeinstallprompt` per mostrarlo più tardi.
- Usa `src/db/seed.ts`, `src/db/persist.ts` e `src/backup/import.ts`. Oggi `src/main.ts` chiama `seedDefaults()` a ogni avvio ([`aggiunta-rapida.md`](./aggiunta-rapida.md)): l'onboarding toglie quella chiamata. Chi ha già categorie senza `onboardedAt` (chi ha usato l'anteprima prima dell'onboarding) non rivede l'onboarding.
- Testi in `src/i18n/locales/it.json` ed `en.json`; icone `receipt`, `device-mobile`, `file-arrow-up`, `export` in `scripts/build-icons.js`.
- `e2e/*`: gli e2e delle altre spec partono da un database già inizializzato con un helper in `e2e/fixtures.ts` (nuovo), così non passano ogni volta dall'onboarding.

### Test

- `src/features/onboarding/WelcomeView.test.ts`: «Inizia da zero» crea i dati una volta sola anche con doppio tocco.
- `src/app/install.test.ts`: rilevamento di iOS e della modalità installata.
- `e2e/onboarding.spec.ts` (nuovo): primo avvio, «Inizia da zero», Home vuota; al secondo avvio si arriva direttamente alla Home.

## Fasi di rilascio

1. **Guardia, schermata e «Inizia da zero»**, con l'e2e.
2. **Ripristino** quando c'è l'importazione di [`backup-manuale.md`](./backup-manuale.md).
3. **Scheda di installazione** per iPhone e Android, con prova su entrambi i dispositivi.
