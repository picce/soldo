# Design di Soldo

Direzione scelta il 2026-11-05: **C · Taccuino**. Questo documento spiega le regole del sistema: colori, tipografia, icone, componenti e tono di voce. I mockup stanno nel file di design [design/soldo.figcraft](../../design/soldo.figcraft), che usa gli stessi valori. Le tre direzioni esplorate all'inizio sono archiviate in [exploration/](exploration/).

| Home, tema chiaro | Home, tema scuro |
|---|---|
| ![Home in chiaro](render/home-chiaro.png) | ![Home in scuro](render/home-scuro.png) |

## Schermate

Le schermate del nucleo, disegnate e approvate il 2026-11-05. Ogni immagine apre la versione a grandezza piena.

| Schermata | Chiaro | Scuro |
|---|---|---|
| Home | <img src="render/home-chiaro.png" width="220" alt="Home in chiaro"> | <img src="render/home-scuro.png" width="220" alt="Home in scuro"> |
| Home senza movimenti | <img src="render/home-vuota-chiaro.png" width="220" alt="Home vuota in chiaro"> | <img src="render/home-vuota-scuro.png" width="220" alt="Home vuota in scuro"> |
| Nuova uscita | <img src="render/nuova-uscita-chiaro.png" width="220" alt="Nuova uscita in chiaro"> | <img src="render/nuova-uscita-scuro.png" width="220" alt="Nuova uscita in scuro"> |
| Movimenti | <img src="render/movimenti-chiaro.png" width="220" alt="Movimenti in chiaro"> | <img src="render/movimenti-scuro.png" width="220" alt="Movimenti in scuro"> |
| Ricerca senza risultati | <img src="render/movimenti-nessun-risultato-chiaro.png" width="220" alt="Ricerca senza risultati in chiaro"> | <img src="render/movimenti-nessun-risultato-scuro.png" width="220" alt="Ricerca senza risultati in scuro"> |
| Onboarding | <img src="render/onboarding-chiaro.png" width="220" alt="Onboarding in chiaro"> | <img src="render/onboarding-scuro.png" width="220" alt="Onboarding in scuro"> |

### Fase 2

Le schermate che i mockup del nucleo non coprivano ([spec](../specs/mockup-fase-2.md)), disegnate il 2026-11-05 e da approvare.

| Schermata | Chiaro | Scuro |
|---|---|---|
| Modifica movimento | <img src="render/modifica-movimento-chiaro.png" width="220" alt="Modifica movimento in chiaro"> | <img src="render/modifica-movimento-scuro.png" width="220" alt="Modifica movimento in scuro"> |
| Righe scorse (elimina, duplica) | <img src="render/riga-scorsa-chiaro.png" width="220" alt="Righe scorse (elimina, duplica) in chiaro"> | <img src="render/riga-scorsa-scuro.png" width="220" alt="Righe scorse (elimina, duplica) in scuro"> |
| Data | <img src="render/foglio-data-chiaro.png" width="220" alt="Data in chiaro"> | <img src="render/foglio-data-scuro.png" width="220" alt="Data in scuro"> |
| Nota | <img src="render/foglio-nota-chiaro.png" width="220" alt="Nota in chiaro"> | <img src="render/foglio-nota-scuro.png" width="220" alt="Nota in scuro"> |
| Filtro categoria | <img src="render/filtro-categoria-chiaro.png" width="220" alt="Filtro categoria in chiaro"> | <img src="render/filtro-categoria-scuro.png" width="220" alt="Filtro categoria in scuro"> |
| Impostazioni | <img src="render/impostazioni-chiaro.png" width="220" alt="Impostazioni in chiaro"> | <img src="render/impostazioni-scuro.png" width="220" alt="Impostazioni in scuro"> |
| Categorie | <img src="render/categorie-chiaro.png" width="220" alt="Categorie in chiaro"> | <img src="render/categorie-scuro.png" width="220" alt="Categorie in scuro"> |
| Modifica categoria | <img src="render/modifica-categoria-chiaro.png" width="220" alt="Modifica categoria in chiaro"> | <img src="render/modifica-categoria-scuro.png" width="220" alt="Modifica categoria in scuro"> |
| Importa backup | <img src="render/importa-backup-chiaro.png" width="220" alt="Importa backup in chiaro"> | <img src="render/importa-backup-scuro.png" width="220" alt="Importa backup in scuro"> |
| Onboarding su Android | <img src="render/onboarding-android-chiaro.png" width="220" alt="Onboarding su Android in chiaro"> | <img src="render/onboarding-android-scuro.png" width="220" alt="Onboarding su Android in scuro"> |

Logo e proposte di icona: [render/identita.png](render/identita.png). Fondamenta (colori, stili di testo, icone): [render/fondamenta.png](render/fondamenta.png).

## File di design

Il file si apre con [FigCraft](https://github.com/storytold/figcraft), un editor open source che gira in locale (versione usata: 0.15.1). È un archivio binario versionato in git; gli screenshot aggiornati sono in [render/](render/).

- **Pagina Fondamenta**: colori e categorie nei due temi, stili di testo, icone usate divise per gruppo.
- **Pagina Schermate**: ogni schermata è un componente, nella riga in alto; le prime sei sono il nucleo, le successive la Fase 2. Sotto c'è la versione scura: un'istanza dentro una cornice con il modo «Scuro» e lo stesso nome più « · scuro». Se modifichi il componente, cambia anche la versione scura.
- **Pagina Identità**: logo nei due temi e tre proposte di icona dell'app, con le anteprime alle misure reali.
- **Variabili**: la collezione «Soldo» ha due modi, Chiaro e Scuro. Contiene `colore/*` (i token della tabella qui sotto) e `categoria/1…8`. I riempimenti sono legati alle variabili: per vedere una schermata al buio basta cambiare il modo della cornice che la contiene. Fa eccezione l'icona dell'app, che ha colori fissi.
- **Stili di testo**: sono 22, uno per ogni riga della tabella Tipografia.
- **Font**: il file usa IBM Plex Sans e IBM Plex Mono, che FigCraft non include. Nell'app si scaricano da *Testo ▸ Font mancanti* (bisogna abilitare il download). Una volta scaricati li usa anche `figcraft-cli`.

Per rigenerare uno screenshot si usa il nome della cornice:

```sh
figcraft-cli export design/soldo.figcraft --page Schermate --node "Nuova uscita" -o docs/design/render/nuova-uscita-chiaro.png --scale 2
figcraft-cli export design/soldo.figcraft --page Schermate --node "Nuova uscita · scuro" -o docs/design/render/nuova-uscita-scuro.png --scale 2
figcraft-cli export design/soldo.figcraft --page Fondamenta --node "Fondamenta" -o docs/design/render/fondamenta.png
figcraft-cli export design/soldo.figcraft --page Identità --node "Identità" -o docs/design/render/identita.png
```

Se cambia un valore, va aggiornato sia nel file sia qui.

## Principi

- È il quaderno dei conti di casa: carta a quadretti, inchiostro nero, il blu della biro per le azioni.
- Le cifre stanno in colonna, monospaziate e allineate a destra.
- Linee sottili da 1 px al posto di ombre e riempimenti. Niente gradienti, ombre decorative o vetro smerigliato.
- Un solo colore d'accento, Biro, per azioni, link e stato attivo. I colori delle categorie servono solo a riconoscerle.
- Le uscite sono in inchiostro con il segno meno, non in rosso: il rosso resta libero per errori e avvisi.

## Colori

| Token | Nel codice | Uso | Chiaro | Scuro |
|---|---|---|---|---|
| `carta` | `--color-paper` | Sfondo della pagina, colonna degli operatori nel tastierino | `#F5F4EF` | `#141414` |
| `superficie` | `--color-card` | Schede, barra di navigazione, pulsanti secondari, tasti | `#FFFFFF` | `#1C1C1C` |
| `quadretti` | `--color-grid` | Griglia di sfondo, passo 20 px | `#E4E6EC` | `#1F2128` |
| `linea` | `--color-line` | Divisori e bordi decorativi | `#D9D7CF` | `#34342F` |
| `inchiostro` | `--color-ink` | Testo principale, uscite, bordo dei pulsanti secondari | `#161616` | `#ECEBE6` |
| `testo-2` | `--color-ink-2` | Testo secondario, percentuali | `#5F5E59` | `#A3A29C` |
| `biro` | `--color-pen` | Azioni, link, stato attivo | `#2340C8` | `#7C93FF` |
| `su-biro` | `--color-on-pen` | Testo e icone sui pulsanti Biro | `#FFFFFF` | `#0F1530` |
| `entrate` | `--color-income` | Importi positivi | `#1F7A45` | `#4CC184` |
| `errore` | `--color-danger` | Errori, eliminazione (riga scorsa, «Ripristina» che sostituisce i dati) | `#B3261E` | `#F2B8B5` |
| `su-errore` | `--color-on-danger` | Testo e icone su Errore | `#FFFFFF` | `#601410` |

Nel codice i token stanno in [src/theme/tokens.css](../../src/theme/tokens.css), con nomi inglesi; i colori delle categorie sono `--color-category-1` … `--color-category-8`. Il tema scuro segue quello del sistema.

Contrasto (WCAG 2), tutto sopra 4,5:1:

| Coppia | Chiaro | Scuro |
|---|---|---|
| inchiostro su carta | 16,4 | 15,4 |
| testo-2 su carta | 5,9 | 7,2 |
| biro su carta | 7,2 | 6,6 |
| entrate su carta | 4,9 | 8,1 |
| errore su carta | 5,9 | 10,8 |
| su-errore su errore | 6,5 | 7,7 |
| su-biro su biro | 8,0 | 6,4 |

`linea` e `quadretti` sono decorativi (1,3:1 e 1,1:1). Un controllo il cui contorno è l'unico segno visibile usa `inchiostro` o `testo-2`, non `linea`.

## Colori delle categorie

Otto colori in un ordine fisso: l'ordine fa parte della verifica, quindi non va cambiato. Ogni categoria riceve un colore alla creazione e lo tiene per sempre, anche quando un filtro cambia quali categorie sono visibili.

| # | Chiaro | Scuro |
|---|---|---|
| 1 | `#3A66C4` | `#5C86E0` |
| 2 | `#D9663B` | `#D8653F` |
| 3 | `#1F9A86` | `#28A08A` |
| 4 | `#A97E10` | `#B98A1A` |
| 5 | `#C2588A` | `#CC6494` |
| 6 | `#5B8C2A` | `#6A9A3C` |
| 7 | `#7059C9` | `#8F7BE0` |
| 8 | `#C84444` | `#E06464` |

Verificati con lo script della skill `dataviz` su sfondo `carta`: tra colori vicini restano distinguibili anche con protanopia e deuteranopia (ΔE peggiore 10,5 in chiaro e 10,1 in scuro, minimo 8). Hanno tutti almeno 3:1 di contrasto sullo sfondo. Per riprovare dopo una modifica, dalla cartella della skill `dataviz`:

```sh
node scripts/validate_palette.js "#3A66C4,#D9663B,#1F9A86,#A97E10,#C2588A,#5B8C2A,#7059C9,#C84444" --mode light --surface "#F5F4EF"
node scripts/validate_palette.js "#5C86E0,#D8653F,#28A08A,#B98A1A,#CC6494,#6A9A3C,#8F7BE0,#E06464" --mode dark --surface "#141414"
```

### Categorie predefinite (proposta per la Fase 2)

Dodici categorie di uscita, nell'ordine della griglia dell'aggiunta rapida. Le prime otto prendono gli otto colori; Vestiti, Regali, Viaggi e Animali li riusano, ma si distinguono sempre per nome e icona. Nei grafici si vedono le prime 7 più «Altre» in `testo-2`.

| Categoria | Icona | Colore |
|---|---|---|
| Spesa | `shopping-cart` | 1 |
| Casa | `house` | 2 |
| Ristoranti | `fork-knife` | 3 |
| Trasporti | `bus` | 4 |
| Svago | `popcorn` | 5 |
| Bollette | `lightning` | 7 |
| Salute | `first-aid` | 8 |
| Vestiti | `t-shirt` | 1 |
| Regali | `gift` | 2 |
| Viaggi | `airplane-tilt` | 3 |
| Animali | `paw-print` | 4 |
| Altro | `dots-three-outline` | 6 |

Per le entrate ci sarà una lista a parte; nei mockup compare Stipendio (`hand-coins`, colore 7).

## Tipografia

IBM Plex Sans per l'interfaccia, IBM Plex Mono per le cifre. Sono self-hosted (`@fontsource`, solo il sottoinsieme latino, pesi 400, 500 e 600: [src/theme/fonts.css](../../src/theme/fonts.css)), così l'app funziona offline. Gli stili usati da più componenti sono classi `.type-*` in [src/theme/app.css](../../src/theme/app.css).

| Stile | Uso | Font | Peso | Corpo | Note |
|---|---|---|---|---|---|
| Logo grande | Logo nell'onboarding | Mono | 600 | 48 | −4%, il punto in `biro` |
| Importo grande | Importo nell'aggiunta rapida | Mono | 600 | 40 | −3% |
| Saldo | Saldo del rendiconto, simbolo € dell'importo grande | Mono | 600 | 32 | −3% |
| Titolo | Titolo di pagina (es. «Novembre 2026») | Sans | 600 | 24 | −1% |
| Logo | Logo nell'intestazione | Mono | 600 | 24 | −4%, il punto in `biro` |
| Tasto | Cifre e operatori del tastierino | Mono | 400 | 24 | |
| Descrizione | Motto e testi lunghi | Sans | 400 | 16 | interlinea 24 |
| Pulsante | Pulsanti | Sans | 600 | 16 | |
| Testo forte | Totali, titoli delle righe, «Annulla» | Sans | 600 | 15 | |
| Testo | Testo e voci delle righe | Sans | 400 | 15 | |
| Importo | Importi nelle righe | Mono | 500 | 15 | allineati a destra |
| Stato | Ora nella barra di stato (solo mockup) | Sans | 600 | 15 | |
| Comando | Selettore del conto, filtri, data/conto/nota | Sans | 500 | 14 | |
| Scheda / Scheda attiva | Schede del periodo, selettore Uscita/Entrata | Sans | 400 / 600 | 14 | |
| Testo piccolo | Seconda riga dei movimenti, spiegazioni | Sans | 400 | 13 | interlinea 18 |
| Nota | Percentuali, totali del giorno, calcolo in corso | Mono | 400 | 13 | `testo-2` |
| Etichetta | Etichette di sezione e dei giorni | Mono | 500 | 12 | maiuscolo, +2% |
| Didascalia | Nomi nella griglia delle categorie | Sans | 400 | 12 | |
| Navigazione / Navigazione attiva | Barra di navigazione | Sans | 400 / 600 | 11 | |

Gli importi si formattano con `Intl.NumberFormat('it-IT')`, quindi `1.284,30 €`. Nelle colonne di cifre il simbolo `€` si omette. Il segno meno è quello tipografico (`−`). Il saldo ha sempre il segno, anche quando è positivo; lo zero non ne ha.

## Forme e spaziature

- Margine laterale della pagina: 20 px.
- Lo sfondo della pagina è una griglia di quadretti da 20 px, sfasata di 10 px dal bordo.
- Raggi: 8 px per schede e pulsanti, 6 px per i pulsanti con sola icona e i filtri, 2–3 px per quadratini e barre.
- Bordi da 1 px, nessuna ombra. Anche il pulsante primario ha il bordo (nel suo stesso colore), così primario e secondario sono alti uguali.
- Target tattili di almeno 44 px. Le frecce del mese e il pulsante Chiudi misurano 34 px a vista, ma hanno un'area tattile di 44 px.

## Icone

Phosphor (licenza MIT), peso **Light**. Il peso Regular si usa per la voce attiva della navigazione e per i segni − e + nei pulsanti. L'app include solo le icone usate, in una collezione locale: niente download a runtime. Nel codice si usa `AppIcon`; l'elenco delle icone incluse sta in [scripts/build-icons.js](../../scripts/build-icons.js) e `pnpm icons` rigenera la collezione.

| Dove | Icona |
|---|---|
| Categorie | vedi la tabella delle categorie predefinite; entrate: `hand-coins` |
| Navigazione: Home, Movimenti, Budget, Statistiche, Impostazioni | `house`, `receipt`, `piggy-bank`, `chart-pie-slice`, `gear-six` |
| Home | `wallet`, `caret-down`, `caret-left`, `caret-right`, `minus`, `plus` |
| Aggiunta rapida | `x`, `calendar-blank`, `wallet`, `note-pencil`, `backspace` |
| Movimenti | `magnifying-glass`, `x` |
| Onboarding | `receipt`, `device-mobile`, `cloud-check`, `export` (il Condividi di iOS) |
| Fase 2 | `trash`, `copy`, `check`, `caret-right`, `dots-six-vertical` (maniglia), `archive`, `file-csv`, `file-arrow-up`, `warning`; per le categorie nuove una griglia di 24 icone (`coffee`, `car`, `train`, `barbell`, `book-open`, …) |

## Componenti

### Home

- **Schede del periodo** (Giorno, Settimana, Mese, Anno): solo testo. La scheda attiva è in `inchiostro`, peso 600, sottolineata in `biro` da 2 px. Sotto la riga c'è una linea.
- **Rendiconto**: scheda su `superficie`. Contiene le righe «Entrate ····· 2.450,00» e «Uscite ····· −1.284,30», con i puntini tratteggiati 1/3 px in `linea`. Sotto c'è una riga piena in `inchiostro`, poi il saldo in Mono 32.
- **Barra delle categorie**: prende il posto della ciambella delle altre direzioni. È alta 10 px, con i segmenti separati da 2 px e gli estremi arrotondati a 3 px.
- **Righe categoria**: quadratino da 10 px nel colore della categoria, nome, puntini, importo e percentuale.
- **Pulsanti**: il primario è pieno in `biro`; il secondario è su `superficie` con bordo in `inchiostro`. Raggio 8 px, altezza 52 px.
- **Barra delle azioni**: fissa in basso, sopra la navigazione, con «− Uscita» e «+ Entrata».
- **Navigazione**: cinque voci, ciascuna con icona ed etichetta. La voce attiva è in `inchiostro`, con una barretta `biro` da 28×2 px in alto.

### Aggiunta rapida

Si apre da «Uscita» o «Entrata» e serve a segnare un movimento con meno tocchi possibile: si scrive l'importo, poi si tocca la categoria e il movimento è salvato. Non c'è un pulsante Salva.

- **In alto**: Chiudi a sinistra e il selettore Uscita/Entrata al centro, con il segmento attivo pieno in `biro`.
- **Importo**: in Mono 40, allineato a destra, con il segno; il simbolo € è in Mono 32 `testo-2`. Sopra c'è il calcolo in corso in Nota (es. «8,90 + 3,50»), sotto una riga in `inchiostro`.
- **Data, conto e nota**: pulsanti piccoli alti 36 px su `superficie`, da toccare solo se servono. Di base: oggi, il conto predefinito, nessuna nota.
- **Categorie**: griglia di 4 colonne. Ogni casella ha l'icona da 26 px nel colore della categoria e il nome in Didascalia. Sopra la griglia c'è l'indicazione «tocca per salvare».
- **Tastierino**: una tabella a righe sottili, come un foglio di calcolo. Tasti alti 58 px, cifre in Mono 24 su `superficie`, operatori (÷ × − +) su `carta` in `testo-2`, `backspace` per cancellare l'ultima cifra. Il risultato si calcola mentre si scrive, quindi non serve il tasto =.
- Dopo il salvataggio si torna alla Home con l'avviso «Salvato: −12,40 € · Spesa».

### Movimenti

- **In alto**: titolo «Movimenti» e selettore del conto, come nella Home.
- **Ricerca**: campo alto 44 px su `superficie`, con bordo `linea`; mentre si scrive il bordo è `biro` e compare `x` per svuotarlo.
- **Filtri**: Tutti, Uscite, Entrate, Categoria. Alti 32 px; il filtro attivo è pieno in `biro`.
- **Giorni**: etichetta del giorno (es. «OGGI · GIOVEDÌ 5 NOVEMBRE») e totale del giorno in Nota a destra. I movimenti del giorno stanno in una scheda, separati da linee.
- **Riga**: icona da 22 px nel colore della categoria; la nota (o il nome della categoria, se la nota manca); sotto, in Testo piccolo, categoria e conto; a destra l'importo. Le entrate sono in `entrate` con il segno +.
- **Eliminazione**: l'avviso «Eliminato: −1,80 € · Ristoranti» compare sopra la navigazione, su `superficie` con bordo in `inchiostro`, con «Annulla» in `biro`.

### Righe scorse

- Verso sinistra si elimina, verso destra si duplica con la data di oggi. Sotto la riga compare l'azione: prima della soglia (40% della riga) su `quadretti` con icona Light e testo in `testo-2`; oltre la soglia su `errore` (eliminare) o `biro` (duplicare), con icona Regular e testo forte nei colori `su-errore` e `su-biro`, e una vibrazione breve.
- Al rilascio oltre la soglia l'azione parte subito e compare l'avviso con «Annulla». Le stesse azioni sono anche nella schermata di modifica.

### Fogli, finestre e campi

- **Foglio dal basso** (data, nota, filtri): su `superficie`, angoli in alto da 12 px, bordo superiore `linea`, maniglia 36×4 in `linea`, titolo nello stile Titolo e Chiudi. Sotto, la schermata è velata di nero al 40%.
- **Finestra di conferma** (importazione): scheda su `superficie` con bordo `inchiostro`, angoli da 12 px, anteprima in una scheda su `carta` con le righe a puntini, avviso in `errore` con l'icona `warning`; l'azione distruttiva è il pulsante pieno in `errore`.
- **Campi di testo**: alti 44 px, raggio 8, bordo `testo-2` (il contorno è l'unico segno del campo); bordo `biro` quando è attivo.
- **Elenchi in una scheda** (Impostazioni, Categorie, Data): righe da 12 px di margine verticale separate da `linea`, con la freccia `caret-right` quando aprono un'altra pagina.
- **Caselle di spunta**: 22 px, raggio 4; spuntate piene in `biro` con `check` in `su-biro`.
- **Scelta di icona e colore**: griglia di 6 icone per riga e otto campioni di colore; la scelta ha il bordo `biro` (icona) o `inchiostro` (colore) da 2 px, e il nome del colore compare accanto al titolo.

### Onboarding

Logo grande, motto «Il quaderno dei conti di casa.», tre punti separati da linee (due tocchi, dati sul telefono, backup sul proprio Drive), la scheda «Installa Soldo» e due pulsanti: «Inizia da zero» e «Ripristina un backup». La scheda spiega che su iPhone, se l'app non è installata, Safari può cancellare i dati dopo 7 giorni senza aprirla. Su Android la scheda ha il pulsante «Installa». Finché non c'è il backup automatico (Fase 3), il terzo punto è «Il backup è un file tuo».

### Stati vuoti

- **Home senza movimenti**: rendiconto a zero, barra tratteggiata in `linea` al posto di quella delle categorie, «Nessun movimento a novembre.» e cosa fare: «Tocca «Uscita» qui sotto per segnare la prima spesa.»
- **Ricerca senza risultati**: icona `magnifying-glass` in `testo-2`, «Nessun risultato per «pizza».» e dove cerca: «La ricerca include note e categorie di tutti i mesi.»

## Identità

- **Logo**: la parola «soldo» in Mono SemiBold, sempre minuscola, spaziatura −4%, con il punto in `biro`. Il punto è accostato alla parola di 0,18 em, perché nel Mono ogni carattere occupa la stessa larghezza e il punto resterebbe staccato.
- **Icona dell'app**: scelta il 2026-11-05 la **A · Quaderno** (carta a quadretti, s in inchiostro, punto in biro). Nella pagina Identità restano anche le proposte scartate, B · Biro (fondo blu, segno bianco) e C · Inchiostro (fondo scuro, punto in biro chiaro). Nel codice è [public/logo.svg](../../public/logo.svg), a tutta pagina e con il testo in tracciati; le icone PNG del manifest, la favicon e l'icona Apple si generano in build da quel file.

Sui termini: «Uscita» ed «Entrata» indicano il tipo di movimento; «Spesa» è la categoria della spesa alimentare.

## Tono di voce

Sobrio e preciso, prima i fatti. Si usa il tu quando serve un verbo. Niente punti esclamativi né emoji.

- «Nessun movimento a novembre.»
- «Salvato: −12,40 € · Spesa»
- «Eliminato: −1,80 € · Ristoranti» con «Annulla»
- «Nessun risultato per «pizza».»
- «Backup: Google Drive, 2 min fa»

## Esplorazione (2026-11-05)

| Direzione | In breve | Esito |
|---|---|---|
| [A · Rame](exploration/direzione-a-rame.png) | Carta calda, accento rame, Fraunces + Manrope, ciambella in una scheda | Scartata |
| [B · Mercato](exploration/direzione-b-mercato.png) | Testata gialla, colori pieni, Bricolage Grotesque + DM Sans | Scartata |
| [C · Taccuino](exploration/direzione-c-taccuino.png) | Quadretti, inchiostro e biro, IBM Plex Sans + Mono, rendiconto e barra | **Scelta** |
