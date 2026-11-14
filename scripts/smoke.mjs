// End-to-end smoke test for OutpostOS. Builds must already exist in dist/ (`pnpm build`).
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const port = 4300 + Math.floor(Math.random() * 500)
const url = `http://127.0.0.1:${port}/`
const out = process.env.SHOTS_DIR ?? 'shots'
mkdirSync(out, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' })
let browser
const guard = setTimeout(() => fail('timed out'), 120_000)

function cleanup() {
  clearTimeout(guard)
  try { server.kill('SIGTERM') } catch {}
}
async function fail(message) {
  console.error(`smoke: FAIL — ${message}`)
  await browser?.close().catch(() => {})
  cleanup()
  process.exit(1)
}
async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('preview server did not start')
}

async function openGame(context, errors) {
  const page = await context.newPage()
  page.on('console', message => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', error => errors.push(String(error)))
  page.on('response', response => response.status() >= 400 && errors.push(`HTTP ${response.status()} ${response.url()}`))
  await page.goto(url)
  await page.waitForSelector('.launch-screen', { timeout: 30_000 })
  await page.evaluate(async () => {
    await document.fonts.ready
    const family = getComputedStyle(document.querySelector('.launch-copy h1')).fontFamily
    if (!family.startsWith('"ManusCC0"') && !family.startsWith('ManusCC0,')) throw new Error(`Unexpected game font: ${family}`)
  })
  return page
}

try {
  await waitForServer()
  browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--ignore-gpu-blocklist'], channel: 'chrome' }))
  const errors = []
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, locale: 'en-US' })
  const page = await openGame(context, errors)
  await page.screenshot({ path: `${out}/01-launch.png` })

  await page.click('[data-action="start"]')
  await page.waitForSelector('.app-shell')
  const before = await page.evaluate(() => ({ sol: window.__game.game.state.sol, oxygen: window.__game.game.state.resources.oxygen }))
  await page.click('[data-action="simulate"]')
  await page.waitForSelector('.debrief-banner')
  const after = await page.evaluate(() => ({ sol: window.__game.game.state.sol, notebook: window.__game.game.state.notebook.length, replay: window.__game.game.state.replay.length, oxygen: window.__game.game.state.resources.oxygen }))
  if (after.sol !== before.sol + 1) throw new Error(`expected sol ${before.sol + 1}, got ${after.sol}`)
  if (after.notebook !== 1 || after.replay < 3) throw new Error(`simulation did not write notebook/replay (${after.notebook}/${after.replay})`)
  if (after.oxygen === before.oxygen) throw new Error('oxygen did not update')
  await page.screenshot({ path: `${out}/02-debrief.png` })

  await page.click('[data-view="notebook"]')
  await page.waitForSelector('.notebook-entry')
  await page.screenshot({ path: `${out}/03-notebook.png` })
  await page.click('[data-view="replay"]')
  await page.waitForSelector('.replay-step')
  await page.screenshot({ path: `${out}/04-replay.png` })
  await context.close()

  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' })
  const phonePage = await openGame(phone, errors)
  await phonePage.tap('[data-action="start"]')
  await phonePage.waitForSelector('.app-shell')
  await phonePage.screenshot({ path: `${out}/05-phone-dashboard.png` })
  await phone.close()

  if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`)
  await browser.close()
  cleanup()
  console.log(`smoke: OK — moved through simulation, notebook, replay and mobile dashboard; screenshots in ${out}/`)
} catch (error) {
  await fail(error?.message ?? String(error))
}
