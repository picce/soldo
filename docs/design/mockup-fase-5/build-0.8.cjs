// Mockups of docs/specs/released/statistiche.md, step 1, with the pieces of ../mockup-fase-4/build.cjs (same
// tokens, fonts and icons). Usage: node build-0.8.cjs <repo> <outDir>, then
// node ../mockup-fase-4/shoot.cjs <outDir>.
const { icon, cat, status, back, nav, label, button, amount, writeMockups } = require('../mockup-fase-4/build.cjs')

const caret = icon('caret-right', { size: 16, color: 'var(--color-ink-2)' })
const euro = cents => (cents / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const CATEGORIES = {
  Spesa: ['shopping-cart', 1],
  Casa: ['house', 2],
  Ristoranti: ['fork-knife', 3],
  Trasporti: ['bus', 4],
  Svago: ['popcorn', 5],
  Bollette: ['lightning', 7],
  Stipendio: ['briefcase', 6],
}
const catIcon = (name, size = 22) => icon(CATEGORIES[name][0], { size, color: cat(CATEGORIES[name][1]) })

const header = `${status}<header class="page"><h1 class="t-title">Statistiche</h1></header>`
const tabs = on => `<div class="tabs">${['Mese', 'Anno'].map(t => `<span class="${t === on ? 'on' : ''}">${t}</span>`).join('')}</div>`
const periodHead = title => `<div class="period"><h2 class="t-title">${title}</h2><span class="arrows"><span class="iconbtn big">${icon('caret-left', { size: 18 })}</span><span class="iconbtn big">${icon('caret-right', { size: 18 })}</span></span></div>`

/** «▲ 12% · +33,50 € rispetto a 1–7 ottobre»: arrow and words, no color, because more is not always worse. */
const delta = (up, text, against) => `<span class="delta t-small">${icon(up ? 'arrow-up-right' : 'arrow-down-right', { size: 14, regular: true })}<span>${text}</span><span class="muted">${against}</span></span>`

function summary(title, big, deltaHtml, figures) {
  return `<div class="card scard">
    <span class="t-label muted">${title}</span>
    <span class="saldo">${big} €</span>
    ${deltaHtml}
    <div class="figures">${figures.map(([name, value, cls = '']) => `<span><span class="t-note muted">${name}</span><span class="t-amount ${cls}">${value}</span></span>`).join('')}</div>
  </div>`
}

// Charts ----------------------------------------------------------------------------------------

const W = 318
const H = 150
const PAD = { top: 8, right: 8, bottom: 22, left: 40 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

function axisY(max, ticks) {
  return ticks.map((value) => {
    const y = PAD.top + plotH - (value / max) * plotH
    return `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}" class="grid"/><text x="${PAD.left - 6}" y="${y + 3.5}" class="tick" text-anchor="end">${value.toLocaleString('it-IT')}</text>`
  }).join('')
}

/** Expenses summed day by day: this month (pen) and the month before (grey, dashed). */
function lineChart({ current, previous, days, max, ticks, selected }) {
  const x = day => PAD.left + ((day - 1) / (days - 1)) * plotW
  const y = value => PAD.top + plotH - (value / max) * plotH
  const path = values => values.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const xTicks = [1, 8, 15, 22, days].map(d => `<text x="${x(d)}" y="${H - 6}" class="tick" text-anchor="middle">${d}</text>`).join('')
  const last = current.length
  const guide = selected
    ? `<line x1="${x(selected)}" x2="${x(selected)}" y1="${PAD.top}" y2="${PAD.top + plotH}" class="guide"/>
       <circle cx="${x(selected)}" cy="${y(previous[selected - 1])}" r="4" class="dot dot--prev"/>
       <circle cx="${x(selected)}" cy="${y(current[selected - 1])}" r="4" class="dot dot--now"/>`
    : `<circle cx="${x(last)}" cy="${y(current[last - 1])}" r="4" class="dot dot--now"/>`
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${axisY(max, ticks)}${xTicks}
    <path d="${path(previous)}" class="line line--prev"/>
    <path d="${path(current)}" class="line line--now"/>${guide}</svg>`
}

/** Income and expenses month by month: two bars side by side, 2px apart, rounded at the top. */
function barChart({ months, max, ticks, selected }) {
  const slot = plotW / months.length
  const bar = (slot - 2 - 6) / 2
  const shape = (x, value, cls) => {
    if (!value)
      return ''
    const h = (value / max) * plotH
    const top = PAD.top + plotH - h
    const r = Math.min(3, h)
    return `<path d="M${x},${PAD.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + bar - r} Q${x + bar},${top} ${x + bar},${top + r} V${PAD.top + plotH} Z" class="${cls}"/>`
  }
  const bars = months.map(([name, income, expense], i) => {
    const x0 = PAD.left + i * slot + 3
    const dim = selected !== undefined && i !== selected ? ' dim' : ''
    return `${shape(x0, income, `bar bar--income${dim}`)}${shape(x0 + bar + 2, expense, `bar bar--expense${dim}`)}
      <text x="${x0 + bar + 1}" y="${H - 6}" class="tick${i === selected ? ' tick--on' : ''}" text-anchor="middle">${name}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${axisY(max, ticks)}${bars}</svg>`
}

/** One category over 12 months, with the average as a dashed line labelled in the right margin. */
function trendChart({ months, max, ticks, average, selected, color }) {
  const margin = 30
  const slot = (plotW - margin) / months.length
  const bar = slot - 6
  const y = value => PAD.top + plotH - (value / max) * plotH
  const bars = months.map(([name, value], i) => {
    const x0 = PAD.left + i * slot + 3
    const h = (value / max) * plotH
    const top = PAD.top + plotH - h
    return `<path d="M${x0},${PAD.top + plotH} V${top + 3} Q${x0},${top} ${x0 + 3},${top} H${x0 + bar - 3} Q${x0 + bar},${top} ${x0 + bar},${top + 3} V${PAD.top + plotH} Z" style="fill:${color};${i === selected ? '' : 'fill-opacity:.38'}"/>
      <text x="${x0 + bar / 2}" y="${H - 6}" class="tick${i === selected ? ' tick--on' : ''}" text-anchor="middle">${name}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${axisY(max, ticks)}${bars}
    <line x1="${PAD.left}" x2="${W - PAD.right - margin + 2}" y1="${y(average)}" y2="${y(average)}" class="avg"/>
    <text x="${W - PAD.right - margin + 6}" y="${y(average) + 3.5}" class="tick tick--avg">media</text></svg>`
}

const legend = items => `<span class="legend">${items.map(([cls, text]) => `<span><i class="key ${cls}"></i>${text}</span>`).join('')}</span>`

function catRow(name, value, change) {
  return `<div class="row crow">${catIcon(name)}<span class="row__text"><span class="t-body">${name}</span><span class="t-small muted">${change}</span></span>${amount(value)}${caret}</div>`
}
const up = text => `<span class="chg">${icon('arrow-up-right', { size: 12, regular: true })}${text}</span>`
const down = text => `<span class="chg">${icon('arrow-down-right', { size: 12, regular: true })}${text}</span>`

// Data: Saturday 7 November 2026 ----------------------------------------------------------------

const NOV = [1240, 5820, 9680, 12030, 19860, 25100, 31240].map(v => v / 100)
const OCT_DAILY = [1820, 3110, 2460, 4550, 3870, 6120, 5960, 3440, 2210, 8830, 4120, 1830, 2970, 3550, 5540, 4320, 6690, 2010, 1450, 3880, 7720, 3120, 2560, 5210, 6330, 1920, 2440, 3970, 4180, 2050, 4930]
let sum = 0
const OCT = OCT_DAILY.map((v) => { sum += v; return sum / 100 })

const MONTHS = [
  ['G', 185000, 118000], ['F', 185000, 102000], ['M', 185000, 124000], ['A', 185000, 110500],
  ['M', 185000, 133000], ['G', 185000, 141000], ['L', 320000, 162000], ['A', 185000, 189000],
  ['S', 185000, 115000], ['O', 185000, 126430], ['N', 185000, 31240], ['D', 0, 0],
].map(([n, i, e]) => [n, i / 100, e / 100])

const TREND = [['N', 305.9], ['D', 312.0], ['G', 298.4], ['F', 276.1], ['M', 305.2], ['A', 289.7], ['M', 331.0], ['G', 342.5], ['L', 318.8], ['A', 296.3], ['S', 301.0], ['O', 322.6]]

const SCREENS = {
  'statistiche-mese': ['Statistiche · Mese, con un giorno toccato', 390, `${header}
    <div class="body">
      ${tabs('Mese')}${periodHead('Novembre 2026')}
      ${summary('Uscite', '312,40', delta(true, '12% · +33,50 €', 'rispetto a 1–7 ottobre'), [['Entrate', '1.850,00', 'income'], ['Risparmiato', '1.537,60'], ['Al giorno', '44,63']])}
      <div class="card ccard">
        <div class="ccard__head"><span class="t-label muted">Giorno per giorno</span><span class="readout t-small"><b>5 nov</b> 198,60 € · <span class="muted">ott 150,60 €</span></span></div>
        ${lineChart({ current: NOV, previous: OCT, days: 30, max: 1500, ticks: [0, 500, 1000, 1500], selected: 5 })}
        ${legend([['key--now', 'novembre'], ['key--prev', 'ottobre']])}
      </div>
      ${label('Uscite per categoria', 'rispetto a 1–7 ottobre')}
      <div class="card">
        ${catRow('Spesa', '128,40', up('18,20 €'))}
        ${catRow('Ristoranti', '86,00', up('42,00 €'))}
        ${catRow('Trasporti', '45,00', down('5,00 €'))}
      </div>
    </div>${nav('Statistiche')}`],

  'statistiche-anno': ['Statistiche · Anno, con un mese toccato', 390, `${header}
    <div class="body">
      ${tabs('Anno')}${periodHead('2026')}
      ${summary('Uscite', '13.521,70', delta(true, '5% · +641,60 €', 'rispetto al 2025, fino al 7 nov'), [['Entrate', '21.700,00', 'income'], ['Risparmiato', '8.178,30'], ['Al mese', '1.229,25']])}
      <div class="card ccard">
        <div class="ccard__head"><span class="t-label muted">Mese per mese</span><span class="readout t-small"><b>Ottobre</b> <span class="income">+1.850,00</span> · −1.264,30</span></div>
        ${barChart({ months: MONTHS, max: 3500, ticks: [0, 1000, 2000, 3000], selected: 9 })}
        <div class="ccard__foot">${legend([['key--income', 'entrate'], ['key--expense', 'uscite']])}<span class="link t-small">Apri ottobre ${icon('caret-right', { size: 12, regular: true })}</span></div>
      </div>
      ${label('Uscite per categoria', 'rispetto al 2025')}
      <div class="card">
        ${catRow('Casa', '5.400,00', up('300,00 €'))}
        ${catRow('Spesa', '3.392,00', down('128,40 €'))}
      </div>
    </div>${nav('Statistiche')}`],

  'andamento-categoria': ['Andamento di una categoria', 390, `${back('Spesa')}
    <div class="body">
      <div class="card scard">
        <span class="t-label muted">Ottobre 2026</span>
        <span class="saldo">322,60 €</span>
        ${delta(true, '5% · +14,31 €', 'sulla media')}
        <div class="figures"><span><span class="t-note muted">Media al mese</span><span class="t-amount">308,29</span></span><span><span class="t-note muted">Negli ultimi 12 mesi</span><span class="t-amount">3.699,50</span></span></div>
      </div>
      <div class="card ccard">
        <div class="ccard__head"><span class="t-label muted">Ultimi 12 mesi</span></div>
        ${trendChart({ months: TREND, max: 400, ticks: [0, 100, 200, 300, 400], average: 308.29, selected: 11, color: cat(1) })}
      </div>
      <div class="card gap">
        ${[['Ottobre 2026', '322,60'], ['Settembre 2026', '301,00'], ['Agosto 2026', '296,30']].map(([m, v]) => `<div class="row"><span class="row__text t-body">${m}</span>${amount(v)}</div>`).join('')}
      </div>
      <div class="gap16">${button('Vedi i movimenti di ottobre', 'receipt')}</div>
    </div>`],

  'statistiche-vuoto': ['Statistiche · Vuoto', 390, `${header}
    <div class="body">
      ${tabs('Mese')}${periodHead('Novembre 2026')}
      <div class="empty">
        ${icon('chart-line', { size: 40, color: 'var(--color-ink-2)' })}
        <p class="t-body-strong">Ancora niente da confrontare</p>
        <p class="t-body muted">Con i primi movimenti qui vedi come cambiano le spese: giorno per giorno, mese per mese e per categoria.</p>
        ${button('Aggiungi una spesa', 'plus', 'primary')}
      </div>
    </div>${nav('Statistiche')}`],
}

const extraCss = `
.saldo{font:600 28px var(--font-mono);letter-spacing:-.03em}
.scard{padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.delta{display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap}
.body>*{flex-shrink:0}
.figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;margin-top:6px;padding-top:10px;border-top:1px solid var(--color-line)}
.figures>span{display:flex;flex-direction:column;gap:2px;min-width:0}
.ccard{margin-top:12px;padding:12px 14px 10px}
.ccard__head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.ccard__foot{display:flex;justify-content:space-between;align-items:center}
.readout b{font-weight:600}
.chart{display:block;width:100%;height:auto;overflow:visible}
.chart .grid{stroke:var(--color-line);stroke-width:1}
.chart .tick{font:400 10px var(--font-mono);fill:var(--color-ink-2)}
.chart .tick--on{fill:var(--color-ink);font-weight:600}
.chart .tick--avg{fill:var(--color-ink-2)}
.chart .line{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.chart .line--now{stroke:var(--color-chart-expense)}
.chart .line--prev{stroke:var(--color-ink-2);stroke-dasharray:4 4;stroke-width:1.5}
.chart .guide{stroke:var(--color-ink-2);stroke-width:1}
.chart .dot{stroke:var(--color-card);stroke-width:2}
.chart .dot--now{fill:var(--color-chart-expense)}.chart .dot--prev{fill:var(--color-ink-2)}
.chart .bar--income{fill:var(--color-chart-income)}.chart .bar--expense{fill:var(--color-chart-expense)}
.chart .dim{fill-opacity:.38}
.chart .avg{stroke:var(--color-ink-2);stroke-width:1.5;stroke-dasharray:4 4}
.legend{display:flex;gap:14px;margin-top:6px;font-size:12px;color:var(--color-ink-2)}
.legend>span{display:inline-flex;align-items:center;gap:6px}
.key{display:inline-block;width:14px;height:3px;border-radius:2px}
.key--now,.key--expense{background:var(--color-chart-expense)}
.key--income{background:var(--color-chart-income)}
.key--prev{height:0;border-top:2px dashed var(--color-ink-2);background:none}
.key--income,.key--expense{height:10px;width:10px}
.crow .chg{display:inline-flex;align-items:center;gap:3px}
.link{display:inline-flex;align-items:center;gap:2px;color:var(--color-pen);font-weight:600}
.gap16{margin-top:16px;display:flex}
.empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:40px 12px}
.empty p{margin:0}.empty .btn{flex:none;padding:0 22px}
.theme--light{--color-chart-expense:var(--color-pen);--color-chart-income:var(--color-income)}
.theme--dark{--color-chart-expense:#6b84f2;--color-chart-income:#3aa86d}
`

writeMockups({ screens: SCREENS, narrowIds: ['statistiche-mese', 'statistiche-anno'], title: 'Mockup statistiche', extraCss })
