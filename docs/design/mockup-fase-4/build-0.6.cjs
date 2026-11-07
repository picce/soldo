// Mockups of docs/specs/budget-mensili.md and docs/specs/ricorrenze.md, step 1, with the pieces of
// build.cjs (same tokens, fonts and icons). Usage: node build-0.6.cjs <repo> <outDir>
const { icon, cat, status, back, check, nav, label, button, seg, chip, field, sheet, keypad, row, amount, writeMockups } = require('./build.cjs')

const caret = icon('caret-right', { size: 16, color: 'var(--color-ink-2)' })

const CATEGORIES = [
  ['shopping-cart', 1, 'Spesa'],
  ['house', 2, 'Casa'],
  ['fork-knife', 3, 'Ristoranti'],
  ['bus', 4, 'Trasporti'],
  ['popcorn', 5, 'Svago'],
  ['lightning', 7, 'Bollette'],
  ['first-aid', 8, 'Salute'],
  ['t-shirt', 1, 'Vestiti'],
  ['gift', 2, 'Regali'],
  ['airplane-tilt', 3, 'Viaggi'],
  ['paw-print', 4, 'Animali'],
  ['dots-three-outline', 6, 'Altro'],
]
const byName = name => CATEGORIES.find(item => item[2] === name)
const catIcon = (name, size = 22) => icon(byName(name)[0], { size, color: cat(byName(name)[1]) })

/** Budget bar: the fill says the level (accent, warning, danger), the track is a lighter step of it. */
function meter(ratio) {
  const level = ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok'
  return `<span class="meter meter--${level}"><i style="width:${Math.min(ratio, 1) * 100}%"></i></span>`
}

function budgetRow(name, spent, budget, ratio, right, rightLabel) {
  const level = ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok'
  const flag = level === 'ok'
    ? ''
    : `<span class="flag flag--${level}">${icon(level === 'over' ? 'warning-circle' : 'warning', { size: 14, regular: true })}${Math.round(ratio * 100)}%</span>`
  return `<div class="brow">
    ${catIcon(name)}
    <span class="brow__text"><span class="t-body">${name}</span><span class="t-small muted">${spent} di ${budget} € ${flag}</span></span>
    <span class="brow__right"><span class="t-amount">${right}</span><span class="t-small muted">${rightLabel}</span></span>
    <span class="brow__meter">${meter(ratio)}</span>
  </div>`
}

const header = (extra = '') => `${status}<header class="page"><h1 class="t-title">Budget</h1>${extra}</header>`
const monthHead = month => `<div class="period"><h2 class="t-title">${month}</h2><span class="arrows"><span class="iconbtn big">${icon('caret-left', { size: 18 })}</span><span class="iconbtn big">${icon('caret-right', { size: 18 })}</span></span></div>`

const BUDGET_BODY = `
  <div class="body">
    ${monthHead('Novembre 2026')}
    <div class="card bcard">
      <div class="bcard__head"><span class="t-label muted">Budget del mese</span><span class="t-note">68%</span></div>
      <div class="bcard__big"><span class="saldo">320,00 €</span><span class="t-small muted">restano</span></div>
      ${meter(0.68)}
      <div class="bcard__foot"><span class="t-note">Spesi 680,00 di 1.000,00 €</span></div>
      <div class="bcard__day t-small">${icon('calendar-blank', { size: 16, color: 'var(--color-ink-2)' })}<span>Mancano 24 giorni: <b>13,33 € al giorno</b></span></div>
    </div>
    ${label('Per categoria')}
    <div class="card">
      ${budgetRow('Spesa', '182,40', '250,00', 0.73, '67,60', 'restano')}
      ${budgetRow('Ristoranti', '172,00', '200,00', 0.86, '28,00', 'restano')}
      ${budgetRow('Svago', '96,50', '80,00', 1.21, '16,50', 'oltre')}
      <div class="row nobudget"><span class="t-small muted">Senza budget</span><span class="t-amount muted">189,10</span></div>
    </div>
  </div>`

function categoryGrid(selected, rows = 3) {
  return `<div class="cats">${label('Categoria', selected ? 'tocca per cambiare' : 'tocca per salvare')}<div class="grid">${CATEGORIES.slice(0, rows * 4).map(([ic, c, name]) => `<span class="tile ${name === selected ? 'on' : ''}">${icon(ic, { size: 26, color: cat(c) })}<span>${name}</span></span>`).join('')}</div></div>`
}

const when = (weekday, day) => `<span class="when"><span class="t-small muted">${weekday}</span><span class="t-note">${day}</span></span>`
const editorTop = (kinds, on, trash = false) => `<header class="editor-top">${`<span class="iconbtn">${icon('x', { size: 18 })}</span>`}${seg(kinds, on, 'grow')}${trash ? `<span class="iconbtn danger">${icon('trash', { size: 18 })}</span>` : ''}</header>`
const amountLine = (line, value) => `<div class="amount"><span class="t-note muted">${line}</span><span class="big">${value} <small>€</small></span></div>`
const chips = list => `<div class="chips">${list.map(([ic, text]) => chip(ic, text)).join('')}</div>`

const SCREENS = {
  'budget': ['Budget', 390, `${header()}${BUDGET_BODY}<div class="bar">${button('Aggiungi budget', 'plus', 'wide')}</div>${nav('Budget')}`],

  'budget-vuoto': ['Budget vuoto', 390, `${header()}
    <div class="body">
      ${monthHead('Novembre 2026')}
      <div class="empty">
        ${icon('piggy-bank', { size: 48, color: 'var(--color-ink-2)' })}
        <h2 class="t-title-s">Decidi quanto spendere</h2>
        <p class="t-body muted">Un budget per il mese, o per le categorie che vuoi tenere d'occhio. Qui vedi quanto ti resta, e Soldo ti avvisa quando ti avvicini.</p>
        ${button('Imposta un budget', 'plus', 'primary')}
      </div>
    </div>${nav('Budget')}`],

  'modifica-budget': ['Un budget', 390, `${back('Budget: Ristoranti')}
    <div class="body">
      <p class="t-note muted sub">Novembre 2026</p>
      ${label('Importo al mese')}${field('200,00', '€')}
      <div class="gap16">${seg(['Ogni mese', 'Solo novembre'], 'Ogni mese')}</div>
      <p class="t-small muted hint">Da novembre 2026 in poi, finché non lo cambi.</p>
      <div class="card gap">${row(icon('receipt', { color: 'var(--color-ink-2)' }), 'Spesi finora a novembre', '', amount('172,00 €'))}</div>
    </div>
    <div class="bar">${button('Togli', 'x')}${button('Salva', 'check', 'primary')}</div>`],

  'aggiungi-budget': ['Foglio «Aggiungi budget»', 390, `${header()}${BUDGET_BODY}${nav('Budget')}
    ${sheet('Aggiungi budget', `<div class="card">
      ${['Casa', 'Bollette', 'Salute', 'Vestiti', 'Regali', 'Viaggi'].map(name => row(catIcon(name), name, '', caret)).join('')}
    </div>`)}`],

  'notifica-budget': ['Avviso nella notifica', 390, `${status}
    <header class="page"><span class="logo">soldo<b>.</b></span></header>
    <div class="body">
      <div class="tabs"><span>Giorno</span><span>Settimana</span><span class="on">Mese</span><span>Anno</span></div>
      <div class="period"><h2 class="t-title">Novembre 2026</h2></div>
      <div class="card summary">
        <div class="sumrow"><span class="muted">Entrate</span><i></i><span class="t-amount income">2.450,00</span></div>
        <div class="sumrow"><span class="muted">Uscite</span><i></i><span class="t-amount">−692,40</span></div>
        <div class="sumtotal"><b class="t-body-strong">Saldo</b><span class="saldo">+1.757,60 €</span></div>
      </div>
    </div>
    <div class="toast"><span class="t-body">Salvato: −12,40 € · Ristoranti. Budget di Ristoranti: 86% usato.</span></div>
    <div class="homebar">${button('Uscita', 'minus', 'primary')}${button('Entrata', 'plus')}</div>${nav('Home')}`],

  'foglio-ripeti': ['Foglio della data con «Ripeti»', 390, `${status}
    ${editorTop(['Uscita', 'Entrata'], 'Uscita')}
    ${amountLine('&nbsp;', '−750,00')}
    ${sheet('Data', `<div class="card">
        ${row('', '<b class="t-body-strong">Oggi</b>', 'sabato 7 novembre', check)}
        ${row('', '<b class="t-body-strong">Ieri</b>', 'venerdì 6 novembre', '<span class="nocheck"></span>')}
      </div>
      ${label('Ripeti')}
      <div class="card">
        ${['Non si ripete', 'Ogni giorno', 'Ogni settimana', 'Ogni mese', 'Ogni anno'].map(text => row('', text, '', text === 'Ogni mese' ? check : '<span class="nocheck"></span>')).join('')}
      </div>
      <div class="pair">
        <label class="mini"><span class="t-label muted">Ogni</span><span class="field small"><span>1</span><span class="field__suffix">mese</span></span></label>
        <label class="mini"><span class="t-label muted">Fino al</span><span class="field small"><span class="muted">Nessuna fine</span>${icon('calendar-blank', { size: 18, color: 'var(--color-ink-2)' })}</span></label>
      </div>`)}`],

  'nuova-ricorrente': ['Aggiunta rapida, ripetuta', 390, `${status}
    ${editorTop(['Uscita', 'Entrata', 'Trasferimento'], 'Uscita')}
    ${amountLine('&nbsp;', '−750,00')}
    ${chips([['repeat', 'Oggi · mensile'], ['bank', 'Bonifico'], ['note-pencil', 'Affitto']])}
    ${categoryGrid('', 2)}
    ${keypad}`],

  'ricorrenze': ['Ricorrenze', 390, `${back('Ricorrenze')}
    <div class="body">
      ${label('In arrivo', 'prossimi 30 giorni')}
      <div class="card">
        ${row(when('lun', '9 nov'), 'Netflix', 'Ogni mese · Carta', amount('−12,99'))}
        ${row(when('ven', '27 nov'), 'Stipendio', 'Ogni mese · Banca', amount('+2.450,00', 'income'))}
        ${row(when('mar', '1 dic'), 'Affitto', 'Ogni mese · Bonifico', amount('−750,00'))}
        ${row(when('mar', '1 dic'), 'Risparmi', 'Ogni mese · Banca → Salvadanaio', amount('200,00'))}
      </div>
      ${label('Attive')}
      <div class="card">
        ${row(catIcon('Casa'), 'Affitto', 'Ogni mese · prossimo 1 dic', amount('−750,00') + caret)}
        ${row(catIcon('Svago'), 'Netflix', 'Ogni mese · prossimo 9 nov', amount('−12,99') + caret)}
        ${row(icon('hand-coins', { color: cat(7) }), 'Stipendio', 'Ogni mese · prossimo 27 nov', amount('+2.450,00', 'income') + caret)}
        ${row(icon('arrows-left-right', { color: 'var(--color-ink-2)' }), 'Risparmi', 'Ogni mese · prossimo 1 dic', amount('200,00') + caret)}
      </div>
      <div class="fold"><span class="t-label muted">Concluse (1)</span>${icon('caret-down', { size: 16, color: 'var(--color-ink-2)' })}</div>
    </div>
    <div class="bar">${button('Nuova ricorrenza', 'plus', 'wide')}</div>`],

  'modifica-serie': ['Una serie, in modifica', 390, `${status}
    ${editorTop(['Uscita', 'Entrata'], 'Uscita', true)}
    ${amountLine('<span class="t-label">Ricorrenza</span>', '−750,00')}
    ${chips([['repeat', '1 nov · mensile'], ['bank', 'Bonifico'], ['note-pencil', 'Affitto']])}
    <p class="t-small muted rulenote">Le modifiche valgono per i prossimi movimenti: quelli già aggiunti restano come sono.</p>
    ${categoryGrid('Casa', 2)}
    <div class="actions">${button('Interrompi', 'pause')}${button('Salva', 'check', 'primary')}</div>
    ${keypad}`],

  'movimento-generato': ['Un movimento della serie', 390, `${status}
    ${editorTop(['Uscita', 'Entrata'], 'Uscita', true)}
    ${amountLine('<span class="t-label">Modifica</span>', '−750,00')}
    ${chips([['calendar-blank', '1 nov'], ['bank', 'Bonifico'], ['note-pencil', 'Affitto']])}
    <div class="series">${icon('repeat', { size: 18, color: 'var(--color-ink-2)' })}<span class="t-small">Ogni mese</span><span class="link t-small">Modifica la serie</span></div>
    ${categoryGrid('Casa', 2)}
    <div class="actions">${button('Duplica', 'copy')}${button('Salva', 'check', 'primary')}</div>
    ${keypad}`],

  'movimenti-ricorrenti': ['Movimenti, righe ricorrenti', 390, `${status}
    <header class="page"><h1 class="t-title">Movimenti</h1></header>
    <div class="body">
      <div class="search">${icon('magnifying-glass', { size: 20, color: 'var(--color-ink-2)' })}<span class="muted">Cerca</span></div>
      <div class="day"><span class="t-label muted">Domenica · 1 novembre</span><span class="t-note muted">−762,99</span></div>
      <div class="card">
        ${row(catIcon('Casa'), 'Affitto', `<span class="rec">${icon('repeat', { size: 14 })}Casa · Bonifico</span>`, amount('−750,00'))}
        ${row(catIcon('Svago'), 'Netflix', `<span class="rec">${icon('repeat', { size: 14 })}Svago · Carta</span>`, amount('−12,99'))}
      </div>
      <div class="day"><span class="t-label muted">Sabato · 31 ottobre</span><span class="t-note muted">−24,30</span></div>
      <div class="card">
        ${row(catIcon('Spesa'), 'Esselunga', 'Spesa · Carta', amount('−24,30'))}
      </div>
    </div>
    <div class="toast"><span class="t-body">Aggiunti dalle ricorrenze: Affitto, Netflix</span></div>
    ${nav('Movimenti')}`],

  'impostazioni-ricorrenze': ['Impostazioni', 390, `${status}
    <header class="page"><h1 class="t-title">Impostazioni</h1></header>
    <div class="body">
      ${label('Conti e pagamenti')}
      <div class="card">
        ${row(icon('wallet'), 'Conti', '3 conti', caret)}
        ${row(icon('credit-card'), 'Tipi di pagamento', '5 tipi', caret)}
      </div>
      ${label('Ricorrenze')}
      <div class="card">${row(icon('repeat'), 'Movimenti ricorrenti', '4 attive', caret)}</div>
      ${label('Categorie')}
      <div class="card">${row(icon('shopping-cart'), 'Uscite ed entrate', '12 uscite · 4 entrate', caret)}</div>
    </div>${nav('Impostazioni')}`],
}

const extraCss = `
.t-title-s{margin:0;font-size:20px;font-weight:600}
.saldo{font:600 28px var(--font-mono);letter-spacing:-.03em}
.meter{display:block;height:8px;border-radius:4px;overflow:hidden;background:color-mix(in oklab,var(--meter) 18%,var(--color-card))}
.meter i{display:block;height:100%;border-radius:4px;background:var(--meter)}
.meter--ok{--meter:var(--color-pen)}.meter--near{--meter:var(--color-warning)}.meter--over{--meter:var(--color-danger)}
.bcard{padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.bcard__head,.bcard__foot{display:flex;justify-content:space-between;align-items:baseline}
.bcard__big{display:flex;align-items:baseline;gap:8px}
.bcard__day{display:flex;align-items:center;gap:6px;padding-top:8px;border-top:1px solid var(--color-line)}
.brow{display:grid;grid-template-columns:22px 1fr auto;column-gap:12px;row-gap:8px;align-items:center;padding:11px 14px}
.brow+.brow{border-top:1px solid var(--color-line)}
.brow__text,.brow__right{display:flex;flex-direction:column}
.brow__right{align-items:flex-end}
.brow__meter{grid-column:2 / 4}
.flag{display:inline-flex;align-items:center;gap:2px;margin-left:4px;font-weight:600;color:var(--color-ink)}
.flag--near .ic{color:var(--color-warning)}.flag--over .ic{color:var(--color-danger)}
.nobudget{justify-content:space-between;border-top:1px solid var(--color-line)}
.empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:40px 12px}
.empty p{margin:0}.empty .btn{flex:none;padding:0 22px}
.sub{margin:-6px 0 0}
.gap16{margin-top:16px;display:flex}
.cats{flex:1;min-height:0;overflow:hidden;padding:0 20px}
.cats .label{margin-top:12px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px 10px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px;font-size:13px}
.tile.on{border:2px solid var(--color-pen);padding:11px 3px 9px}
.chips{flex-wrap:wrap;row-gap:8px}
.iconbtn.danger{color:var(--color-danger)}
.editor-top .seg.grow{margin-right:0}
.rulenote{margin:10px 20px 0}
.series{display:flex;align-items:center;gap:8px;margin:10px 20px 0}
.link{color:var(--color-pen);font-weight:600;margin-left:auto}
.actions{flex:none;display:flex;gap:10px;padding:12px 20px;border-top:1px solid var(--color-line)}
.when{flex:none;width:48px;display:flex;flex-direction:column;line-height:1.2;white-space:nowrap}
.rec{display:inline-flex;align-items:center;gap:4px}
.pair{display:flex;gap:10px;margin-top:12px}
.mini{flex:1;display:flex;flex-direction:column;gap:6px}
.field.small{height:40px}
.sheet .card .row{min-height:40px;padding-block:6px}
`

writeMockups({ screens: SCREENS, narrowIds: ['budget', 'nuova-ricorrente', 'foglio-ripeti'], title: 'Mockup budget e ricorrenze', extraCss })
