# Design di Soldo

Direzione scelta il 2026-11-05: **C · Taccuino**. Questo documento spiega le regole del sistema: colori, tipografia, icone, componenti e tono di voce. I mockup stanno nel file di design [design/soldo.figcraft](../../design/soldo.figcraft), che usa gli stessi valori. Le tre direzioni esplorate all'inizio sono archiviate in [esplorazione/](esplorazione/).

| Home, tema chiaro | Home, tema scuro |
|---|---|
| ![Home in chiaro](render/home-chiaro.png) | ![Home in scuro](render/home-scuro.png) |

## File di design

Il file si apre con [FigCraft](https://github.com/storytold/figcraft), un editor open source che gira in locale (versione usata: 0.15.1). È un archivio binario versionato in git; gli screenshot aggiornati sono in [render/](render/).

- **Pagina Fondamenta**: colori e categorie nei due temi, stili di testo, icone.
- **Pagina Schermate**: la Home è un componente. La versione scura ne è un'istanza dentro una cornice con il modo «Scuro».
- **Variabili**: la collezione «Soldo» ha due modi, Chiaro e Scuro. Contiene `colore/*` (i token della tabella qui sotto) e `categoria/1…8`. I riempimenti sono legati alle variabili: per vedere una schermata al buio basta cambiare il modo della cornice che la contiene.
- **Stili di testo**: sono 17, uno per ogni riga della tabella Tipografia.
- **Font**: il file usa IBM Plex Sans e IBM Plex Mono, che FigCraft non include. Nell'app si scaricano da *Testo ▸ Font mancanti* (bisogna abilitare il download); in alternativa si installano dai file TTF di Google Fonts.

Per rigenerare gli screenshot (con IBM Plex installato):

```sh
figcraft-cli export design/soldo.figcraft --page Schermate --node "Home" -o docs/design/render/home-chiaro.png --scale 2
figcraft-cli export design/soldo.figcraft --page Schermate --node "Home · scuro" -o docs/design/render/home-scuro.png --scale 2
figcraft-cli export design/soldo.figcraft --page Fondamenta --node "Fondamenta" -o docs/design/render/fondamenta.png
```

Se cambia un valore, va aggiornato sia nel file sia qui.

## Principi

- È il quaderno dei conti di casa: carta a quadretti, inchiostro nero, il blu della biro per le azioni.
- Le cifre stanno in colonna, monospaziate e allineate a destra.
- Linee sottili da 1 px al posto di ombre e riempimenti. Niente gradienti, ombre decorative o vetro smerigliato.
- Un solo colore d'accento, Biro, per azioni, link e stato attivo. I colori delle categorie servono solo a riconoscerle.
- Le uscite sono in inchiostro con il segno meno, non in rosso: il rosso resta libero per errori e avvisi.

## Colori

| Token | Uso | Chiaro | Scuro |
|---|---|---|---|
| `carta` | Sfondo della pagina | `#F5F4EF` | `#141414` |
| `superficie` | Schede, barra di navigazione, pulsanti secondari | `#FFFFFF` | `#1C1C1C` |
| `quadretti` | Griglia di sfondo, passo 20 px | `#E4E6EC` | `#1F2128` |
| `linea` | Divisori e bordi decorativi | `#D9D7CF` | `#34342F` |
| `inchiostro` | Testo principale, uscite, bordo dei pulsanti secondari | `#161616` | `#ECEBE6` |
| `testo-2` | Testo secondario, percentuali | `#5F5E59` | `#A3A29C` |
| `biro` | Azioni, link, stato attivo | `#2340C8` | `#7C93FF` |
| `su-biro` | Testo e icone sui pulsanti Biro | `#FFFFFF` | `#0F1530` |
| `entrate` | Importi positivi | `#1F7A45` | `#4CC184` |

Contrasto (WCAG 2), tutto sopra 4,5:1:

| Coppia | Chiaro | Scuro |
|---|---|---|
| inchiostro su carta | 16,4 | 15,4 |
| testo-2 su carta | 5,9 | 7,2 |
| biro su carta | 7,2 | 6,6 |
| entrate su carta | 4,9 | 8,1 |
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

Da decidere in Fase 2: le categorie predefinite saranno più di otto. Proposta: nei grafici si vedono le prime 7 più «Altre» in `testo-2`; le categorie oltre l'ottava riusano i colori, ma si distinguono sempre per nome e icona.

## Tipografia

IBM Plex Sans per l'interfaccia, IBM Plex Mono per le cifre. Sono self-hosted (`@fontsource`, solo il sottoinsieme latino), così l'app funziona offline.

| Uso | Font | Peso | Corpo | Note |
|---|---|---|---|---|
| Saldo | Mono | 600 | 32 | spaziatura −3% |
| Titolo di pagina (es. «Novembre 2026») | Sans | 600 | 24 | −1% |
| Logo «soldo.» | Mono | 600 | 24 | −4%, il punto in `biro` |
| Pulsanti | Sans | 600 | 16 | |
| Testo e voci delle righe | Sans | 400 | 15 | |
| Importi nelle righe | Mono | 500 | 15 | allineati a destra |
| Schede del periodo | Sans | 400, attiva 600 | 14 | |
| Percentuali e note | Mono | 400 | 13 | `testo-2` |
| Etichette di sezione | Mono | 500 | 12 | maiuscolo, +2% |
| Barra di navigazione | Sans | 400, attiva 600 | 11 | |

Gli importi si formattano con `Intl.NumberFormat('it-IT')`, quindi `1.284,30 €`. Nelle colonne di cifre il simbolo `€` si omette. Il segno meno è quello tipografico (`−`). Il saldo ha sempre il segno, anche quando è positivo.

## Forme e spaziature

- Margine laterale della pagina: 20 px.
- Lo sfondo della pagina è una griglia di quadretti da 20 px, sfasata di 10 px dal bordo.
- Raggi: 8 px per schede e pulsanti, 6 px per i pulsanti con sola icona, 2–3 px per quadratini e barre.
- Bordi da 1 px, nessuna ombra.
- Target tattili di almeno 44 px. Le frecce del mese misurano 34 px a vista, ma hanno un'area tattile di 44 px.

## Icone

Phosphor (licenza MIT), peso **Light**. Il peso Regular si usa per la voce attiva della navigazione e per i segni − e + nei pulsanti. L'app include solo le icone usate, in una collezione locale: niente download a runtime.

| Dove | Icona |
|---|---|
| Spesa, Casa, Ristoranti, Trasporti, Svago | `shopping-cart`, `house`, `fork-knife`, `bus`, `popcorn` |
| Bollette, Salute, Abbigliamento, Regali, Viaggi, Animali, Altro | `lightning`, `first-aid`, `t-shirt`, `gift`, `airplane-tilt`, `paw-print`, `dots-three-outline` |
| Navigazione: Home, Movimenti, Budget, Statistiche, Impostazioni | `house`, `receipt`, `piggy-bank`, `chart-pie-slice`, `gear-six` |
| Interfaccia | `minus`, `plus`, `caret-left`, `caret-right`, `caret-down`, `magnifying-glass`, `wallet`, `cloud-check` |

## Componenti della Home

- **Schede del periodo** (Giorno, Settimana, Mese, Anno): solo testo. La scheda attiva è in `inchiostro`, peso 600, sottolineata in `biro` da 2 px. Sotto la riga c'è una linea.
- **Rendiconto**: scheda su `superficie`. Contiene le righe «Entrate ····· 2.450,00» e «Uscite ····· −1.284,30», con i puntini tratteggiati 1/3 px in `linea`. Sotto c'è una riga piena in `inchiostro`, poi il saldo in Mono 32.
- **Barra delle categorie**: prende il posto della ciambella delle altre direzioni. È alta 10 px, con i segmenti separati da 2 px e gli estremi arrotondati a 3 px.
- **Righe categoria**: quadratino da 10 px nel colore della categoria, nome, puntini, importo e percentuale.
- **Pulsanti**: il primario è pieno in `biro`; il secondario è su `superficie` con bordo in `inchiostro`. Raggio 8 px, altezza 52 px.
- **Barra delle azioni**: fissa in basso, sopra la navigazione, con «− Uscita» e «+ Entrata».
- **Navigazione**: cinque voci, ciascuna con icona ed etichetta. La voce attiva è in `inchiostro`, con una barretta `biro` da 28×2 px in alto.

Sui termini: «Uscita» ed «Entrata» indicano il tipo di movimento; «Spesa» è la categoria della spesa alimentare.

## Tono di voce

Sobrio e preciso, prima i fatti. Si usa il tu quando serve un verbo. Niente punti esclamativi né emoji.

- «Nessun movimento a novembre.»
- «Salvato: −12,40 € · Spesa»
- «Backup: Google Drive, 2 min fa»

## Esplorazione (2026-11-05)

| Direzione | In breve | Esito |
|---|---|---|
| [A · Rame](esplorazione/direzione-a-rame.png) | Carta calda, accento rame, Fraunces + Manrope, ciambella in una scheda | Scartata |
| [B · Mercato](esplorazione/direzione-b-mercato.png) | Testata gialla, colori pieni, Bricolage Grotesque + DM Sans | Scartata |
| [C · Taccuino](esplorazione/direzione-c-taccuino.png) | Quadretti, inchiostro e biro, IBM Plex Sans + Mono, rendiconto e barra | **Scelta** |
