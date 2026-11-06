// Mockups of docs/specs/conti-pagamenti-trasferimenti.md, step 1, drawn in HTML with the project's
// tokens, fonts and Phosphor icons. Usage: node build.js <repo> <outDir>
const fs = require('node:fs')
const path = require('node:path')

const [repo, out] = process.argv.slice(2)
const nm = path.join(repo, 'node_modules')
const ph = JSON.parse(fs.readFileSync(path.join(nm, '@iconify-json/ph/icons.json'), 'utf8')).icons
const tokens = fs.readFileSync(path.join(repo, 'src/theme/tokens.css'), 'utf8').split('/*\n * Volver tokens')[0]

function font(pkg, family, weight) {
  const file = path.join(nm, `@fontsource/${pkg}/files/${pkg}-latin-${weight}-normal.woff2`)
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}) format('woff2')}`
}
const fonts = [400, 500, 600].flatMap(w => [font('ibm-plex-sans', 'IBM Plex Sans', w), font('ibm-plex-mono', 'IBM Plex Mono', w)]).join('\n')

function icon(name, { size = 22, color, regular = false, cls = '' } = {}) {
  const data = ph[regular ? name : `${name}-light`]
  if (!data)
    throw new Error(`No icon ${name}`)
  const style = `width:${size}px;height:${size}px;${color ? `color:${color};` : ''}`
  return `<svg class="ic ${cls}" viewBox="0 0 256 256" fill="currentColor" style="${style}" aria-hidden="true">${data.body}</svg>`
}

const cat = n => `var(--color-category-${n})`
const status = `<div class="status">9:41</div>`
const back = title => `${status}<header class="sub"><span class="iconbtn">${icon('caret-left', { size: 18 })}</span><h1 class="t-title">${title}</h1></header>`
const selector = (label, cls = '') => `<span class="selector ${cls}">${icon('wallet', { size: 18 })}<span class="selector__label">${label}</span>${icon('caret-down', { size: 14 })}</span>`
const handle = icon('dots-six-vertical', { size: 18, color: 'var(--color-ink-2)' })
const caret = icon('caret-right', { size: 16, color: 'var(--color-ink-2)' })
const check = icon('check', { size: 18, color: 'var(--color-pen)', regular: true })
const nav = (active, width) => `<nav class="nav">${[['house', 'Home'], ['receipt', 'Movimenti'], ['piggy-bank', 'Budget'], ['chart-pie-slice', 'Statistiche'], ['gear-six', 'Impostazioni']].map(([i, l]) => `<span class="nav__item ${l === active ? 'is-on' : ''}">${icon(i, { size: 24, regular: l === active })}<span>${l}</span></span>`).join('')}</nav>`
const label = (text, side = '') => `<div class="label"><span>${text}</span>${side ? `<span class="t-note">${side}</span>` : ''}</div>`
const button = (text, ic, kind = '') => `<span class="btn ${kind}">${ic ? icon(ic, { size: 20 }) : ''}${text}</span>`
const seg = (opts, on, cls = '') => `<span class="seg ${cls}">${opts.map(o => `<span class="${o === on ? 'on' : ''}">${o}</span>`).join('')}</span>`
const chip = (ic, text) => `<span class="chip">${icon(ic, { size: 18 })}${text}</span>`
const field = (value, suffix = '') => `<div class="field"><span>${value}</span>${suffix ? `<span class="field__suffix">${suffix}</span>` : ''}</div>`
const picker = (icons, on) => `<div class="icons">${icons.map(i => `<span class="${i === on ? 'on' : ''}">${icon(i, { size: 24 })}</span>`).join('')}</div>`
const colors = on => `<div class="colors">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<span class="${n === on ? 'on' : ''}"><i style="background:${cat(n)}">${n === on ? icon('check', { size: 16, color: '#fff' }) : ''}</i></span>`).join('')}</div>`
const sheet = (title, body) => `<div class="scrim"></div><div class="sheet"><span class="sheet__grip"></span><div class="sheet__head"><h2 class="t-title">${title}</h2>${icon('x', { size: 22 })}</div>${body}</div>`
const keypad = `<div class="keypad">${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', ',', '0', 'B', '+'].map(k => `<span class="${'÷×−+'.includes(k) ? 'op' : ''}">${k === 'B' ? icon('backspace', { size: 26 }) : k}</span>`).join('')}</div>`

const ACCOUNTS = [
  ['wallet', 1, 'Contanti', 'Predefinito', '84,50'],
  ['bank', 7, 'Banca', '', '2.341,20'],
  ['device-mobile', 2, 'Satispay', '', '36,00'],
]

function row(left, title, sub, right = '') {
  return `<div class="row">${left}<span class="row__text"><span class="t-body">${title}</span>${sub ? `<span class="t-small muted">${sub}</span>` : ''}</span>${right}</div>`
}
const amount = (text, cls = '') => `<span class="t-amount ${cls}">${text}</span>`

const SCREENS = {
  'impostazioni-conti': ['Impostazioni', 390, `${status}
    <header class="page"><h1 class="t-title">Impostazioni</h1></header>
    <div class="body">
      ${label('Lingua')}${seg(['Automatica', 'Italiano', 'English'], 'Automatica')}
      ${label('Conti e pagamenti')}
      <div class="card">
        ${row(icon('wallet'), 'Conti', '3 conti', caret)}
        ${row(icon('credit-card'), 'Tipi di pagamento', '5 tipi', caret)}
      </div>
      ${label('Categorie')}
      <div class="card">${row(icon('shopping-cart'), 'Uscite ed entrate', '12 uscite · 4 entrate', caret)}</div>
      ${label('Backup su file', 'ultimo: 3 giorni fa')}
      <div class="card">
        ${row(icon('export'), 'Esporta backup', 'File JSON con tutti i dati', caret)}
        ${row(icon('file-csv'), 'Esporta movimenti', 'File CSV per un foglio di calcolo', caret)}
      </div>
    </div>${nav('Impostazioni')}`],

  'conti': ['Conti', 390, `${back('Conti')}
    <div class="body">
      <div class="card total"><span class="t-body-strong">Totale</span><span class="dots"></span>${amount('2.461,70 €', 'strong')}</div>
      <div class="card gap">
        ${ACCOUNTS.map(([i, c, n, s, b]) => `<div class="row">${handle}<i class="sq" style="background:${cat(c)}"></i>${icon(i)}<span class="row__text"><span class="t-body">${n}</span>${s ? `<span class="t-small muted">${s}</span>` : ''}</span>${amount(b)}${caret}</div>`).join('')}
      </div>
      <div class="fold"><span class="t-label muted">Archiviati (1)</span>${icon('caret-down', { size: 16, color: 'var(--color-ink-2)' })}</div>
      <p class="t-small muted hint">Il primo è il conto predefinito: per cambiarlo, trascinane un altro in cima.</p>
    </div>
    <div class="bar">${button('Nuovo conto', 'plus', 'wide')}</div>`],

  'modifica-conto': ['Modifica conto', 390, `${back('Banca')}
    <div class="body">
      ${label('Nome')}${field('Banca')}
      ${label('Icona')}${picker(['wallet', 'credit-card', 'bank', 'piggy-bank', 'coins', 'vault'], 'bank')}
      ${label('Colore', 'Viola')}${colors(7)}
      ${label('Saldo iniziale')}
      <div class="balance">${field('1.200,00', '€')}${seg(['In attivo', 'In rosso'], 'In attivo')}</div>
      <p class="t-small muted hint">Quanto c'era sul conto prima del primo movimento.</p>
      <div class="card gap">${row(icon('receipt'), 'Vedi movimenti', 'Usato in 42 movimenti: per toglierlo, archivialo', caret)}</div>
    </div>
    <div class="bar">${button('Archivia', 'archive')}${button('Salva', 'check', 'primary')}</div>`],

  'tipi-pagamento': ['Tipi di pagamento', 390, `${back('Tipi di pagamento')}
    <div class="body">
      <div class="card">
        ${[['wallet', 'Contanti', 'Contanti'], ['credit-card', 'Carta', 'Banca'], ['device-mobile', 'Satispay', 'Satispay'], ['bank', 'Bonifico', 'Banca'], ['dots-three-outline', 'Altro', 'Contanti']].map(([i, n, a]) => `<div class="row">${handle}${icon(i)}<span class="row__text"><span class="t-body">${n}</span>${a !== n ? `<span class="t-small muted">${a}</span>` : ''}</span>${caret}</div>`).join('')}
      </div>
      <div class="fold"><span class="t-label muted">Archiviati (0)</span>${icon('caret-down', { size: 16, color: 'var(--color-ink-2)' })}</div>
      <p class="t-small muted hint">Ogni spesa parte dall'ultimo pagamento usato ed esce dal conto indicato qui.</p>
    </div>
    <div class="bar">${button('Nuovo tipo di pagamento', 'plus', 'wide')}</div>`],

  'modifica-pagamento': ['Modifica pagamento', 390, `${back('Carta')}
    <div class="body">
      ${label('Nome')}${field('Carta')}
      <p class="t-small muted hint">Nome predefinito: cambia con la lingua finché non lo modifichi.</p>
      ${label('Icona')}${picker(['wallet', 'credit-card', 'device-mobile', 'bank', 'money', 'dots-three-outline'], 'credit-card')}
      ${label('Conto collegato')}
      <div class="card">${row(icon('bank', { color: cat(7) }), 'Banca', '', caret)}</div>
      <p class="t-small muted hint">Le prossime spese pagate così escono da questo conto. Quelle già fatte restano dove sono.</p>
    </div>
    <div class="bar">${button('Archivia', 'archive')}${button('Salva', 'check', 'primary')}</div>`],

  'foglio-conto': ['Selettore del conto', 390, `${status}
    <header class="page"><span class="logo">soldo<b>.</b></span>${selector('Tutti i conti')}</header>
    <div class="body">
      <div class="tabs"><span>Giorno</span><span>Settimana</span><span class="on">Mese</span><span>Anno</span></div>
      <div class="period"><h2 class="t-title">Novembre 2026</h2></div>
    </div>
    ${sheet('Conto', `<div class="card">
        ${row(icon('wallet', { color: 'var(--color-ink-2)' }), '<b class="t-body-strong">Tutti i conti</b>', '', amount('2.461,70') + check)}
        ${ACCOUNTS.map(([i, c, n, , b]) => row(icon(i, { color: cat(c) }), n, '', amount(b) + '<span class="nocheck"></span>')).join('')}
      </div>
      <div class="manage">${icon('gear-six', { size: 18 })}Gestisci i conti</div>`)}`],

  'foglio-pagamento': ['Foglio del pagamento', 390, `${status}
    <header class="editor-top"><span class="iconbtn">${icon('x', { size: 18 })}</span>${seg(['Uscita', 'Entrata', 'Trasferimento'], 'Uscita', 'grow')}</header>
    <div class="amount"><span class="t-note muted">8,90 + 3,50</span><span class="big">−12,40 <small>€</small></span></div>
    <div class="chips">${chip('calendar-blank', 'Oggi')}${chip('credit-card', 'Carta')}${chip('note-pencil', 'Nota')}</div>
    ${sheet('Pagamento', `<div class="card">
        ${[['credit-card', 'Carta', 'Banca', true], ['wallet', 'Contanti', 'Contanti'], ['device-mobile', 'Satispay', 'Satispay'], ['bank', 'Bonifico', 'Banca'], ['dots-three-outline', 'Altro', 'Contanti']].map(([i, n, a, on]) => row(icon(i), n, a !== n ? a : '', on ? check : '<span class="nocheck"></span>')).join('')}
      </div>
      <div class="manage">${icon('gear-six', { size: 18 })}Gestisci i tipi di pagamento</div>`)}`],

  'nuovo-trasferimento': ['Nuovo trasferimento', 390, `${status}
    <header class="editor-top"><span class="iconbtn">${icon('x', { size: 18 })}</span>${seg(['Uscita', 'Entrata', 'Trasferimento'], 'Trasferimento', 'grow')}</header>
    <div class="amount"><span class="t-note muted">&nbsp;</span><span class="big">100,00 <small>€</small></span></div>
    <div class="chips">${chip('calendar-blank', 'Oggi')}${chip('note-pencil', 'Nota')}<span class="chip chip--end">${icon('arrows-down-up', { size: 18 })}Scambia</span></div>
    <div class="transfer">
      <div class="card">
        <div class="row"><span class="t-label muted from">Da</span>${icon('bank', { color: cat(7) })}<span class="row__text"><span class="t-body">Banca</span></span>${amount('2.341,20', 'muted')}${caret}</div>
        <div class="row"><span class="t-label muted from">A</span>${icon('wallet', { color: cat(1) })}<span class="row__text"><span class="t-body">Contanti</span></span>${amount('84,50', 'muted')}${caret}</div>
      </div>
    </div>
    <div class="savebar">${button('Salva', 'check', 'primary wide')}</div>
    ${keypad}`],

  'movimenti-trasferimento': ['Riga del trasferimento', 390, `${status}
    <header class="page"><h1 class="t-title">Movimenti</h1>${selector('Tutti i conti')}</header>
    <div class="body">
      <div class="search">${icon('magnifying-glass', { size: 20, color: 'var(--color-ink-2)' })}<span class="muted">Cerca</span></div>
      <div class="filters"><span class="on">Tutti</span><span>Uscite</span><span>Entrate</span><span>Trasferimenti</span><span>Categoria ${icon('caret-down', { size: 12 })}</span><span>Pagamento ${icon('caret-down', { size: 12 })}</span></div>
      <div class="day"><span class="t-label muted">Oggi · venerdì 6 novembre</span><span class="t-note muted">−24,30</span></div>
      <div class="card">
        ${row(icon('shopping-cart', { color: cat(1) }), 'Esselunga', 'Spesa · Carta', amount('−12,40', 'strong'))}
        ${row(icon('arrows-left-right', { color: 'var(--color-ink-2)' }), 'Prelievo', 'Banca → Contanti', amount('100,00', 'strong'))}
        ${row(icon('fork-knife', { color: cat(3) }), 'Pranzo', 'Ristoranti · Contanti', amount('−11,90', 'strong'))}
      </div>
      <div class="day"><span class="t-label muted">Ieri · giovedì 5 novembre</span><span class="t-note muted">−9,00</span></div>
      <div class="card">
        ${row(icon('arrows-left-right', { color: 'var(--color-ink-2)' }), 'Trasferimento', 'Banca → Satispay', amount('20,00', 'strong'))}
        ${row(icon('popcorn', { color: cat(5) }), 'Cinema', 'Svago · Satispay', amount('−9,00', 'strong'))}
      </div>
    </div>
    <div class="toast"><span class="t-body">Salvato: 100,00 € · Banca → Contanti</span><b>Annulla</b></div>
    ${nav('Movimenti')}`],

  'home-360': ['Home a 360 px, caso peggiore', 360, `${status}
    <header class="page"><span class="logo">soldo<b>.</b></span><span class="header-actions"><span class="today">${icon('calendar-dot', { size: 18 })}Oggi</span>${selector('Conto corrente')}</span></header>
    <div class="body">
      <div class="tabs"><span>Giorno</span><span>Settimana</span><span class="on">Mese</span><span>Anno</span></div>
      <div class="period"><h2 class="t-title">Ottobre 2026</h2><span class="arrows"><span class="iconbtn big">${icon('caret-left', { size: 18 })}</span><span class="iconbtn big">${icon('caret-right', { size: 18 })}</span></span></div>
      <div class="card summary">
        <div class="sumrow"><span class="muted">Entrate</span><i></i><span class="t-amount income">2.450,00</span></div>
        <div class="sumrow"><span class="muted">Uscite</span><i></i><span class="t-amount">−1.284,30</span></div>
        <div class="sumtotal"><b class="t-body-strong">Saldo</b><span class="saldo">+1.165,70 €</span></div>
      </div>
      <div class="catbar"><i style="flex:32;background:${cat(1)}"></i><i style="flex:27;background:${cat(2)}"></i><i style="flex:15;background:${cat(3)}"></i><i style="flex:26;background:${cat(4)}"></i></div>
    </div>
    <div class="homebar">${button('Uscita', 'minus', 'primary')}${button('Entrata', 'plus')}</div>${nav('Home')}`],
}

const css = `
${fonts}
${tokens}
:root,.theme{--font-sans:'IBM Plex Sans',sans-serif;--font-mono:'IBM Plex Mono',monospace}
*{box-sizing:border-box}
html,body{margin:0;background:#8a8a86;font-family:var(--font-sans)}
.sheetgrid{display:flex;flex-wrap:wrap;gap:32px;padding:32px;width:calc(5 * 390px + 4 * 32px + 64px)}
.frame h3{margin:0 0 8px;color:#fff;font:500 14px var(--font-mono)}
.screen{position:relative;height:844px;overflow:hidden;display:flex;flex-direction:column;color:var(--color-ink);background-color:var(--color-paper);background-image:linear-gradient(var(--color-grid) 1px,transparent 1px),linear-gradient(90deg,var(--color-grid) 1px,transparent 1px);background-size:20px 20px;background-position:10px 10px;font-size:15px;line-height:1.4}
.ic{flex:none;display:block}
.status{flex:none;height:44px;padding:14px 34px 0;font-weight:600;font-size:15px}
.t-title{margin:0;font-size:24px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
.t-body{font-size:15px}.t-body-strong{font-size:15px;font-weight:600}
.t-small{font-size:13px;line-height:18px}
.t-label{font:500 12px var(--font-mono);text-transform:uppercase;letter-spacing:.02em}
.t-note{font:400 13px var(--font-mono);color:var(--color-ink-2)}
.t-amount{font:500 15px var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.t-amount.strong{font-weight:500}.income{color:var(--color-income)}
.muted{color:var(--color-ink-2)}
header.page{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 20px 8px;min-height:50px}
header.sub{flex:none;display:flex;align-items:center;gap:16px;padding:2px 20px 10px}
.iconbtn{flex:none;display:grid;place-items:center;width:34px;height:34px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px}
.logo{font:600 24px var(--font-mono);letter-spacing:-.04em}.logo b{color:var(--color-pen)}
.selector{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;min-width:0;height:36px}
.selector__label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.header-actions{display:flex;align-items:center;gap:8px;min-width:0}
.today{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 9px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px;font-size:14px;font-weight:500;flex:none}
.body{flex:1;padding:0 20px;min-height:0;display:flex;flex-direction:column}
.label{display:flex;justify-content:space-between;align-items:baseline;margin:16px 0 8px;font:500 12px var(--font-mono);text-transform:uppercase;letter-spacing:.02em}
.label .t-note{text-transform:none;letter-spacing:0}
.body>.label:first-child{margin-top:4px}
.card{background:var(--color-card);border:1px solid var(--color-line);border-radius:12px;overflow:hidden}
.card.gap{margin-top:12px}
.row{display:flex;align-items:center;gap:12px;min-height:44px;padding:9px 14px}
.row+.row{border-top:1px solid var(--color-line)}
.row__text{flex:1;min-width:0;display:flex;flex-direction:column}
.sq{flex:none;width:10px;height:10px;border-radius:2px}
.nocheck{flex:none;width:18px}
.total{display:flex;align-items:center;gap:8px;padding:12px 14px}
.total .dots{flex:1;border-bottom:1px dashed var(--color-line);height:0}
.fold{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--color-line)}
.hint{margin:8px 0 0}
.bar{flex:none;display:flex;gap:10px;padding:12px 20px 34px;border-top:1px solid var(--color-line);background:var(--color-paper)}
.homebar{flex:none;display:flex;gap:10px;padding:12px 20px;border-top:1px solid var(--color-line);background:var(--color-paper)}
.btn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:52px;border-radius:8px;border:1px solid var(--color-ink);background:var(--color-card);font-size:16px;font-weight:600}
.btn.primary{background:var(--color-pen);border-color:var(--color-pen);color:var(--color-on-pen)}
.seg{display:inline-flex;align-self:flex-start;padding:3px;background:var(--color-card);border:1px solid var(--color-line);border-radius:10px;font-size:14px;color:var(--color-ink-2)}
.seg>span{padding:6px 14px;border-radius:7px;text-align:center;white-space:nowrap}
.seg .on{background:var(--color-pen);color:var(--color-on-pen);font-weight:600}
.seg.grow{flex:1;min-width:0;align-self:center}
.seg.grow>span{flex:1 1 auto;padding:6px 8px}
.field{display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 13px;background:var(--color-card);border:1px solid var(--color-ink-2);border-radius:8px}
.field__suffix{font-family:var(--font-mono);color:var(--color-ink-2)}
.balance{display:flex;gap:10px;align-items:center}.balance .field{flex:1;min-width:0;font-family:var(--font-mono)}.balance .seg{align-self:center;flex:none}.balance .seg>span{padding:6px 10px}
.icons{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.icons>span{display:grid;place-items:center;height:46px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px}
.icons>.on{border:2px solid var(--color-pen);color:var(--color-pen)}
.colors{display:flex;justify-content:space-between}
.colors>span{display:grid;place-items:center;width:40px;height:40px;border:2px solid transparent;border-radius:8px}
.colors>.on{border-color:var(--color-ink)}
.colors i{display:grid;place-items:center;width:30px;height:30px;border-radius:5px}
.tabs{display:flex;gap:20px;border-bottom:1px solid var(--color-line);font-size:14px;color:var(--color-ink-2);padding-bottom:10px}
.tabs .on{color:var(--color-ink);font-weight:600;position:relative}
.tabs .on::after{content:'';position:absolute;left:0;right:0;bottom:-11px;height:2px;background:var(--color-pen)}
.period{display:flex;justify-content:space-between;align-items:center;margin:18px 0 14px}
.arrows{display:flex;gap:8px}
.summary{padding:14px 16px}
.sumrow{display:flex;align-items:center;gap:8px;min-height:28px}.sumrow i{flex:1;border-bottom:1px dashed var(--color-line)}
.sumtotal{display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:10px;border-top:1px solid var(--color-ink)}
.saldo{font:600 28px var(--font-mono);letter-spacing:-.03em}
.catbar{display:flex;gap:2px;height:10px;margin-top:22px;border-radius:3px;overflow:hidden}
.nav{flex:none;display:grid;grid-template-columns:repeat(5,1fr);padding:7px 0 20px;background:var(--color-card);border-top:1px solid var(--color-line);font-size:11px;color:var(--color-ink-2)}
.nav__item{display:flex;flex-direction:column;align-items:center;gap:2px;position:relative}
.nav__item.is-on{color:var(--color-ink);font-weight:600}
.nav__item.is-on::before{content:'';position:absolute;top:-8px;width:28px;height:2px;background:var(--color-pen)}
.scrim{position:absolute;inset:0;background:var(--color-scrim,rgb(0 0 0 / 40%));z-index:1}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:8px 20px 36px;background:var(--color-card);border-top:1px solid var(--color-line);border-radius:12px 12px 0 0}
.sheet__grip{display:block;width:36px;height:4px;margin:0 auto 14px;border-radius:2px;background:var(--color-line)}
.sheet__head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.manage{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;margin-top:10px;color:var(--color-pen);font-weight:600;font-size:15px}
.editor-top{flex:none;display:flex;align-items:center;gap:10px;padding:2px 20px 8px}
.amount{flex:none;display:flex;flex-direction:column;align-items:flex-end;padding:8px 20px 8px;margin:0 20px;padding-inline:0;border-bottom:1px solid var(--color-ink)}
.big{font:600 40px var(--font-mono);letter-spacing:-.03em;line-height:1.2}.big small{font-size:32px;color:var(--color-ink-2);font-weight:600}
.chips{flex:none;display:flex;gap:10px;padding:14px 20px}
.chip{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 11px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px;font-size:14px;font-weight:500}
.transfer{flex:none;position:relative;margin:2px 20px 0}
.from{width:18px}
.chip--end{margin-left:auto}
.savebar{flex:none;display:flex;padding:12px 20px}
.keypad{margin-top:auto;flex:none;display:grid;grid-template-columns:repeat(4,1fr);background:var(--color-line);gap:1px;border-block:1px solid var(--color-line);padding-bottom:0}
.keypad>span{display:grid;place-items:center;height:58px;background:var(--color-card);font:400 24px var(--font-mono)}
.keypad>.op{background:var(--color-paper);color:var(--color-ink-2)}
.search{display:flex;align-items:center;gap:10px;height:44px;padding:0 13px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px}
.filters{display:flex;gap:8px;margin:12px -20px 0;padding:0 20px;overflow:hidden;font-size:14px;font-weight:500}
.filters>span{flex:none;display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 11px;background:var(--color-card);border:1px solid var(--color-line);border-radius:8px}
.filters>.on{background:var(--color-pen);border-color:var(--color-pen);color:var(--color-on-pen)}
.day{display:flex;justify-content:space-between;margin:18px 0 8px}
.toast{position:absolute;left:20px;right:20px;bottom:76px;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 16px;background:var(--color-card);border:1px solid var(--color-ink);border-radius:10px}
.toast b{color:var(--color-pen);font-weight:600}
`

function page(theme) {
  const frames = Object.entries(SCREENS).map(([id, [title, width, html]]) =>
    `<div class="frame"><h3>${title}</h3><section class="screen theme ${theme}" data-id="${id}" style="width:${width}px">${html}</section></div>`).join('\n')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mockup conti e pagamenti</title><style>${css}</style></head><body><div class="sheetgrid">${frames}</div></body></html>`
}

fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'mockup-chiaro.html'), page('theme--light'))
fs.writeFileSync(path.join(out, 'mockup-scuro.html'), page('theme--dark'))

// Same layout at 360 px: the header and the three-segment control must still fit.
const narrow = Object.fromEntries(['nuovo-trasferimento'].map(id => [id, [SCREENS[id][0], 360, SCREENS[id][2]]]))
fs.writeFileSync(path.join(out, 'narrow.html'), `<!doctype html><meta charset="utf-8"><style>${css}</style><section class="screen theme theme--light" data-id="nuovo-trasferimento-360" style="width:360px">${narrow['nuovo-trasferimento'][2]}</section>`)
console.log('ok', Object.keys(SCREENS).length)
