import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [
        ['github'],
        [
          'html',
          { open: 'never' },
        ],
      ]
    : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'it-IT',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // In CI la build è già stata fatta da uno step precedente.
    command: `${isCI ? '' : 'pnpm build && '}pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
})
