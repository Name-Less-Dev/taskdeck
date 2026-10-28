// Starts Playwright's Chromium with a remote debugging port, for Lighthouse
// (`lighthouse <url> --port=9222`), on machines where Lighthouse cannot launch
// a browser itself. Stops on Ctrl+C.
// Usage: node scripts/lighthouse-browser.mjs [port]
import { chromium } from '@playwright/test'

const port = Number(process.argv[2] ?? 9222)
const browser = await chromium.launch({ args: [`--remote-debugging-port=${String(port)}`] })
console.log(`Chromium ${browser.version()} listening for Lighthouse on port ${String(port)}`)

const stop = async () => {
  await browser.close()
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
await new Promise(() => undefined)
