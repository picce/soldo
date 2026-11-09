// Builds src/assets/icons/ph.json: only the Phosphor icons the app uses, as an Iconify
// collection that main.ts registers with VolverPlugin (prefix "ph"). The app never
// downloads icons at runtime. After changing the lists below run `pnpm icons` and commit
// the generated file. Icon choices: docs/design/README.md, "Icone".
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'

/** Icons used in the Light weight (the default). */
const LIGHT = [
  // Navigation
  'house',
  'receipt',
  'piggy-bank',
  'chart-pie-slice',
  'gear-six',
  // Default categories and account (src/db/seed.ts)
  'shopping-cart',
  'fork-knife',
  'bus',
  'popcorn',
  'lightning',
  'first-aid',
  't-shirt',
  'gift',
  'airplane-tilt',
  'paw-print',
  'dots-three-outline',
  'hand-coins',
  'arrow-counter-clockwise',
  'wallet',
  // Accounts, payment methods and transfers
  'credit-card',
  'bank',
  'coins',
  'vault',
  'money',
  'arrows-left-right',
  'arrows-down-up',
  // Statistics: nothing to compare yet
  'chart-line',
  // Phone turned sideways (RotateNotice)
  'device-rotate',
  // Recurrences
  'repeat',
  'pause',
  'play',
  // Quick add and transaction editor
  'x',
  'calendar-blank',
  'note-pencil',
  'backspace',
  'trash',
  'copy',
  'check',
  // Home
  'caret-left',
  'caret-right',
  'calendar-dot',
  // Movimenti
  'magnifying-glass',
  'caret-down',
  // Onboarding
  'device-mobile',
  // Settings: backup
  'export',
  'file-csv',
  'file-arrow-up',
  'warning',
  // Settings: automatic backup, encryption and privacy
  'google-drive-logo',
  'shield-check',
  'lock',
  // Categories: drag handle, move buttons, archive
  'dots-six-vertical',
  'caret-up',
  'archive',
  // Icons offered for a category (src/features/categories/icons.ts), besides the defaults
  'shopping-bag',
  'coffee',
  'car',
  'train',
  'bicycle',
  'gas-pump',
  'pill',
  'barbell',
  'heart',
  'television',
  'game-controller',
  'music-notes',
  'book-open',
  'graduation-cap',
  'baby',
  'briefcase',
]

/** Icons also used in the Regular weight (active navigation item, − and + signs, solid states). */
const REGULAR = [
  'house',
  'receipt',
  'piggy-bank',
  'chart-pie-slice',
  'gear-six',
  'minus',
  'plus',
  // Checkboxes and the solid action under a swiped row
  'check',
  'trash',
  'copy',
  // Budget levels, small next to a percentage (BudgetFlag)
  'warning',
  'warning-circle',
  // Statistics: up or down from the period before
  'arrow-up-right',
  'arrow-down-right',
]

const OUTPUT = new URL('../src/assets/icons/ph.json', import.meta.url)

const require = createRequire(import.meta.url)
const source = JSON.parse(readFileSync(require.resolve('@iconify-json/ph/icons.json'), 'utf8'))
const info = JSON.parse(readFileSync(require.resolve('@iconify-json/ph/info.json'), 'utf8'))

const names = [
  ...LIGHT.map(name => `${name}-light`),
  ...REGULAR,
]
const missing = names.filter(name => !source.icons[name])
if (missing.length)
  throw new Error(`Unknown Phosphor icons: ${missing.join(', ')}`)

const collection = {
  prefix: source.prefix,
  info: { name: info.name, author: info.author, license: info.license },
  width: source.width,
  height: source.height,
  icons: Object.fromEntries(names.sort().map(name => [name, source.icons[name]])),
}

writeFileSync(OUTPUT, `${JSON.stringify(collection, null, 2)}\n`)
process.stdout.write(`Wrote ${names.length} icons to src/assets/icons/ph.json\n`)
