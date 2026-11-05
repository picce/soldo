# Lingua inglese

> **Stato**: Parziale (implementata su `develop` il 2026-11-05; manca la pubblicazione su `main`)
> **Data**: 2026-11-05
> **Ambito**: L'app parla italiano e inglese. La lingua segue quella del dispositivo e si può cambiare nelle Impostazioni; i testi passano in file JSON precompilati in build.
> **Spec collegate**: [`tema-taccuino.md`](./tema-taccuino.md) (stessa fase: la pagina Impostazioni usa il controllo a segmenti del Taccuino, i messaggi precompilati riducono il peso)

## Panoramica

Con la Fase 0 l'app ha solo i testi italiani, in `src/i18n/it.ts`; la roadmap metteva l'inglese in Fase 5. Il 2026-11-05 è stato chiesto di gestirlo subito: oggi i testi sono pochi, quindi costa poco, e ogni schermata della Fase 2 nascerà già nelle due lingue.

Serve anche un cambio di formato: per caricare la build di vue-i18n senza compilatore dei messaggi (più leggera, vedi [`tema-taccuino.md`](./tema-taccuino.md)), i testi devono essere in JSON e venire precompilati da `@intlify/unplugin-vue-i18n`.

## Obiettivi e non-obiettivi

- **Obiettivi**:
  - due lingue, `it` e `en`, con le stesse chiavi (controllate da typecheck e da un test);
  - lingua iniziale dal dispositivo: la prima di `navigator.languages` che l'app supporta, confrontando solo la lingua principale (`it-CH` vale `it`); se nessuna è supportata, inglese;
  - scelta manuale nelle Impostazioni: Automatica, Italiano, English; la scelta resta sul dispositivo;
  - `<html lang>` e il titolo della pagina seguono la lingua attiva, anche quando cambia senza navigare;
  - messaggi precompilati in build e vue-i18n senza compilatore;
  - per ogni lingua un locale `Intl` (`it-IT`, `en-GB`), pronto per importi e date della Fase 2.
- **Non-obiettivi**:
  - URL tradotti: i percorsi restano quelli attuali (`/movimenti`, `/statistiche`, …);
  - manifest localizzato: ce n'è uno solo, con nome «Soldo» e descrizione in italiano;
  - altre lingue;
  - nomi delle categorie predefinite: si decidono con il seed della Fase 2 (probabilmente nella lingua attiva al primo avvio, poi modificabili).

## Design

### Testi

- `src/i18n/locales/it.json`: i testi di `src/i18n/it.ts`, che viene rimosso.
- `src/i18n/locales/en.json` (nuovo): le stesse chiavi in inglese, con lo stesso tono (sobrio, niente punti esclamativi).
- `src/i18n/index.ts`: `createI18n` con `it` ed `en`, `fallbackLocale: 'it'`. Il tipo `MessageSchema` deriva da `it.json` e `en.json` deve rispettarlo. Esporta `SUPPORTED_LOCALES` e la mappa dei locale `Intl`.
- `vite.config.ts` e `vitest.config.ts`: plugin `VueI18nPlugin` di `@intlify/unplugin-vue-i18n` con `include` su `src/i18n/locales/*.json`; usa la build runtime di vue-i18n.

### Scelta della lingua

- `src/i18n/locale.ts` (nuovo):
  - `resolveLocale(preference, languages)`: funzione pura; con `auto` sceglie dalla lista delle lingue del dispositivo, altrimenti restituisce la lingua scelta;
  - `useLocalePreference()`: legge e scrive la preferenza (`auto`, `it`, `en`) in `localStorage` con la chiave `soldo:locale`, applica la lingua a vue-i18n e imposta `document.documentElement.lang`. Se `localStorage` non è disponibile, vale `auto`.
- `src/main.ts`: applica la lingua prima del mount, così il primo render è già nella lingua giusta.
- `src/app/router.ts`: il titolo della pagina si aggiorna anche quando cambia la lingua, non solo a ogni navigazione.

La preferenza resta in `localStorage` anche dopo l'arrivo di Dexie: riguarda il dispositivo, non i dati da salvare nel backup.

### Impostazioni

`src/features/settings/SettingsView.vue`: sezione «Lingua» con un controllo a segmenti: Automatica, Italiano, English. Il controllo è il componente riusabile `src/components/SegmentedControl.vue` (`VvButtonGroup` con `toggle`, stile del selettore Uscita/Entrata dei mockup), che servirà anche all'aggiunta rapida della Fase 2. I nomi delle lingue restano nella loro lingua; «Automatica» si traduce. Sotto, una riga in `--color-ink-2` spiega che Automatica usa la lingua del dispositivo.

### Test

- `src/i18n/locale.test.ts` (nuovo): `resolveLocale` con lingue supportate, varianti regionali, nessuna lingua supportata; le chiavi di `it.json` ed `en.json` coincidono.
- `src/app/components/BottomNav.test.ts`: le voci in inglese quando la lingua è `en`.
- `src/features/settings/SettingsView.test.ts` (nuovo): il cambio di lingua aggiorna testi, `lang` e preferenza salvata.
- `e2e/language.spec.ts` (nuovo): con il browser in inglese l'app parte in inglese; dalle Impostazioni si passa all'italiano e la scelta sopravvive al reload.

### Documenti

`AGENTS.md`: i testi stanno in `src/i18n/locales/it.json` ed `en.json`, sempre in entrambe le lingue.

## Fasi di rilascio

1. **Formato JSON e build runtime**: stessi testi di oggi, `pnpm check` e `pnpm test:e2e` verdi.
2. **Inglese e rilevamento**: test unitari e e2e della lingua verdi.
3. **Impostazioni**: scelta manuale, persistenza dopo il reload.
4. **Pubblicazione**: insieme a [`tema-taccuino.md`](./tema-taccuino.md), con la stessa pull request verso `main`.
