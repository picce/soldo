// Renders the mockups and reports anything that overflows its screen. Usage: node shoot.js <outDir>
const path = require('node:path')
const { chromium } = require('playwright')

const out = process.argv[2]

function overflowing(root) {
  const bad = []
  const box = root.getBoundingClientRect()
  for (const el of root.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.filters'))
      continue
    const r = el.getBoundingClientRect()
    if (r.width && (r.right > box.right + 0.5 || r.left < box.left - 0.5))
      bad.push(`${root.dataset.id}: ${el.className || el.tagName} x-overflow ${Math.round(r.right - box.right)}px`)
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'visible' && el.clientWidth)
      bad.push(`${root.dataset.id}: ${el.className || el.tagName} text-overflow`)
  }
  const body = root.querySelector('.body')
  if (body && body.scrollHeight > body.clientHeight + 1)
    bad.push(`${root.dataset.id}: body y-overflow ${body.scrollHeight - body.clientHeight}px`)
  return bad
}

(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2100, height: 1400 }, deviceScaleFactor: 2 })
  for (const theme of ['chiaro', 'scuro']) {
    await page.goto(`file://${path.resolve(out, `mockup-${theme}.html`)}`)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: path.join(out, `mockup-${theme}.png`), fullPage: true })
    const screens = await page.$$('.screen')
    for (const screen of screens) {
      const id = await screen.getAttribute('data-id')
      await screen.screenshot({ path: path.join(out, `${id}-${theme}.png`) })
      const bad = await screen.evaluate(overflowing)
      if (theme === 'chiaro')
        bad.forEach(line => console.log(line))
    }
  }
  await page.goto(`file://${path.resolve(out, 'narrow.html')}`)
  await page.evaluate(() => document.fonts.ready)
  const narrow = await page.$('.screen')
  await narrow.screenshot({ path: path.join(out, 'nuovo-trasferimento-360-chiaro.png') })
  ;(await narrow.evaluate(overflowing)).forEach(line => console.log(line))
  await browser.close()
  console.log('rendered')
})()
