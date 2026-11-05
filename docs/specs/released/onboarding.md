# Onboarding al primo avvio

> **Stato**: Rilasciata
> **Data**: 2026-11-05
> **Ambito**: Al primo avvio Soldo presenta l'app e offre due strade: iniziare da zero (crea categorie e conto) o ripristinare un backup. Invita a installare l'app, perché su iPhone i dati di un sito non installato possono essere cancellati.
> **Spec collegate**: richiede [`dati-locali.md`](./dati-locali.md) (dati iniziali, storage persistente) e [`backup-manuale.md`](./backup-manuale.md) (ripristino); [`mockup-fase-2.md`](./mockup-fase-2.md) per la variante Android

## Panoramica

I mockup approvati sono [Onboarding](../../design/render/onboarding-chiaro.png) e [Installa su Android](../../design/render/onboarding-android-chiaro.png). Prima di questa spec l'app si apriva direttamente sulla Home vuota e creava le categorie da sola a ogni avvio. Il primo avvio è il momento giusto per creare i dati iniziali, chiedere lo storage persistente e spiegare l'installazione: la roadmap indica tra i rischi che Safari può cancellare lo storage dei siti non installati dopo 7 giorni senza uso.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - finché `meta.onboardedAt` non esiste, ogni percorso porta a `/benvenuto` (tranne `/dev/ui`); dopo, `/benvenuto` porta alla Home;
  - schermata come nel mockup: logo, motto, tre punti, scheda «Installa Soldo», «Inizia da zero» e «Ripristina un backup»;
  - «Inizia da zero»: crea categorie e conto (`seedDefaults`), chiede lo storage persistente, segna `onboardedAt` e apre la Home;
  - «Ripristina un backup»: apre la scelta del file e il flusso di importazione di [`backup-manuale.md`](./backup-manuale.md); a ripristino riuscito segna `onboardedAt` e apre la Home;
  - scheda di installazione adatta al dispositivo: su iPhone le istruzioni con Condividi; dove il browser offre l'installazione (`beforeinstallprompt`, Chrome su Android e su computer) il pulsante «Installa»; negli altri browser dove trovarla nel menu; nascosta se l'app è già installata (`display-mode: standalone`);
  - in Fase 2 il terzo punto non promette Google Drive: «Il backup è un file tuo», «Lo esporti quando vuoi e lo salvi dove preferisci.» Torna al testo del mockup con la Fase 3.
- **Non-obiettivi**:
  - tour delle funzioni o più passaggi: una schermata sola;
  - richiesta di permessi (notifiche): non servono;
  - un pulsante «Installa» fuori dall'onboarding (per esempio nelle Impostazioni): da valutare se serve.

## Design

- `src/app/router.ts`: percorso `/benvenuto` (`welcome`, `meta.fullscreen`) e `requireOnboarding(router)`, la guardia globale. La installa `src/main.ts`, non `createAppRouter`, così i test delle pagine non ci passano. La guardia carica `src/app/onboarding.ts` solo quando serve: il database resta fuori dal primo chunk.
- `src/app/onboarding.ts`: `isOnboarded()` legge `meta.onboardedAt` finché la risposta non è sì, poi la tiene in memoria; `markOnboarded()`. Chi ha già categorie senza `onboardedAt` (chi ha usato l'anteprima prima dell'onboarding, o ha ripristinato un backup senza il segno) non rivede l'onboarding: il segno si scrive in quel momento.
- `src/main.ts`: non chiama più `seedDefaults()` a ogni avvio; ascolta `beforeinstallprompt` fin dall'inizio (`listenForInstall`), perché l'evento può arrivare prima che la pagina compaia.
- `src/app/install.ts`: conserva l'evento `beforeinstallprompt` e lo riapre con «Installa» (`promptInstall`); `isIos()` riconosce iPhone e iPad (che si presenta come un Mac con lo schermo tattile); `isStandalone()`.
- `src/features/onboarding/WelcomeView.vue` e `InstallCard.vue`. «Inizia da zero» crea i dati una volta sola anche con doppio tocco (e `seedDefaults` non fa niente se le categorie ci sono già). Il ripristino usa `RestoreBackup.vue` di [`backup-manuale.md`](./backup-manuale.md), lo stesso delle Impostazioni.
- `src/app/components/ReloadPrompt.vue`: sulla schermata di benvenuto l'avviso «Soldo è pronto per funzionare anche offline» non compare: copriva il logo, e la schermata lo dice già.
- Testi in `src/i18n/locales/it.json` ed `en.json` (`welcome`); icona `device-mobile` in `scripts/build-icons.js` (le altre c'erano già).
- `e2e/fixtures.ts`: la `page` degli e2e delle altre spec passa da «Inizia da zero» prima del test, così ogni test parte come dopo il primo avvio.

### Test

- `src/app/onboarding.test.ts`: stato iniziale, segno, dati di prima dell'onboarding.
- `src/app/router.test.ts`: la guardia porta al benvenuto e, dopo, dal benvenuto alla Home.
- `src/app/install.test.ts`: riconoscimento di iPhone e iPad.
- `src/features/onboarding/WelcomeView.test.ts`: testi della Fase 2; «Inizia da zero» crea i dati una volta sola anche con doppio tocco e apre la Home.
- `e2e/onboarding.spec.ts`: primo avvio, «Inizia da zero», Home vuota con le categorie predefinite; al secondo avvio si arriva direttamente alla Home; ripristino di un backup fatto su un altro dispositivo; scheda per iPhone.

## Fasi di rilascio

1. **Guardia, schermata e «Inizia da zero»**, con l'e2e.
2. **Ripristino** quando c'è l'importazione di [`backup-manuale.md`](./backup-manuale.md).
3. **Scheda di installazione** per iPhone e Android, con prova su entrambi i dispositivi.

Le tre fasi sono uscite insieme con la versione 0.2.0. L'installazione è stata provata su Android il 2026-11-05; su iPhone resta da provare.
