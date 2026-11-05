import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = !!process.env.CI
// With E2E_BASE_URL the tests run against a published site (e.g. production or a preview)
// instead of the local build.
const remoteBaseURL = process.env.E2E_BASE_URL

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
    baseURL: remoteBaseURL ?? `http://localhost:${PORT}`,
    locale: 'it-IT',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: remoteBaseURL
    ? undefined
    : {
        // In CI an earlier step has already built the app.
        command: `${isCI ? '' : 'pnpm build && '}pnpm preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
})
