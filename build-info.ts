import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

/** Short commit of the build: Cloudflare Workers Builds, then GitHub Actions, then local git. */
function buildCommit(): string {
  const fromEnv = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA
  if (fromEnv)
    return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  }
  catch {
    return ''
  }
}

/**
 * Build-time constants shown in Settings (docs/specs/released/versione-app.md), for Vite's `define`.
 * Values are fixed in the bundle, so they are right offline too.
 */
export function appDefines() {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  return {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(buildCommit()),
  }
}
