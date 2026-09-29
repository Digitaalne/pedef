/**
 * Verifies cursor-anchored ctrl+wheel zoom and center-stable button zoom.
 * Run: node tools/zoom-check.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 4321
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), stdio: 'pipe' })
void new Promise((r) => server.stdout.on('data', r))

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error('vite did not start')
}

mkdirSync('shots', { recursive: true })
await waitForServer(`http://localhost:${PORT}/`)
console.log('server up')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

await page.goto(`http://localhost:${PORT}/`)
await page.setInputFiles('input[type=file]', 'samples/sample.pdf')
await page.waitForSelector('.page-frame canvas', { timeout: 10000 })
await page.waitForTimeout(800)

const zoomPct = () => page.locator('.zoom-value').innerText()

// helper: viewport coords of a content point (fraction fx,fy of page 0)
const contentPointViewport = (fx, fy) =>
  page.evaluate(
    ([fx, fy]) => {
      const frame = document.querySelectorAll('.page-frame')[0]
      const r = frame.getBoundingClientRect()
      return { x: r.left + fx * r.width, y: r.top + fy * r.height }
    },
    [fx, fy],
  )

// ---- 1. ctrl+wheel zoom-in anchored at an off-center point ----
const fx = 0.7
const fy = 0.4
const before = await contentPointViewport(fx, fy)
await page.mouse.move(before.x, before.y)
await page.keyboard.down('Control')
for (let i = 0; i < 5; i++) {
  await page.mouse.wheel(0, -120)
  await page.waitForTimeout(80)
}
await page.keyboard.up('Control')
await page.waitForTimeout(600)

check('ctrl+wheel zooms in', (await zoomPct()) !== '100%', `zoom=${await zoomPct()}`)

// vertical anchoring is exact from the start (vertical scroll range always
// exists); horizontal anchoring kicks in once the page overflows the viewer
// (while it fits, the browser keeps it centered — nothing to scroll)
const after = await contentPointViewport(fx, fy)
check('vertical anchor holds while zooming', Math.abs(after.y - before.y) < 8, `dy=${(after.y - before.y).toFixed(1)}px`)
await page.screenshot({ path: 'shots/zoom-wheel.png' })

// once fully zoomed (page overflows), anchoring is exact in both axes:
// move the cursor onto the content point again and zoom one more step
await page.mouse.move(after.x, after.y)
await page.keyboard.down('Control')
await page.mouse.wheel(0, -120)
await page.keyboard.up('Control')
await page.waitForTimeout(600)
const after2 = await contentPointViewport(fx, fy)
const drift = Math.hypot(after2.x - after.x, after2.y - after.y)
check('content point stays under cursor when scrollable', drift < 8, `drift=${drift.toFixed(1)}px`)

// ---- 2. ctrl+wheel zooms back out ----
const zoomedIn = await zoomPct()
await page.keyboard.down('Control')
await page.mouse.wheel(0, 120)
await page.keyboard.up('Control')
await page.waitForTimeout(600)
check('ctrl+wheel zooms back out', parseInt(await zoomPct()) < parseInt(zoomedIn), `${zoomedIn} -> ${await zoomPct()}`)
await page.keyboard.press('Control+0')
await page.waitForTimeout(400)

// ---- 3. toolbar zoom keeps the viewport center stable ----
// pick the content point currently at the scroller's center
const centerInfo = await page.evaluate(() => {
  const scroll = document.getElementById('viewer-scroll')
  const sRect = scroll.getBoundingClientRect()
  const cx = sRect.left + scroll.clientWidth / 2
  const cy = sRect.top + scroll.clientHeight / 2
  const frames = [...document.querySelectorAll('.page-frame')]
  for (let i = 0; i < frames.length; i++) {
    const r = frames[i].getBoundingClientRect()
    if (cy >= r.top && cy <= r.bottom) return { index: i, fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height }
  }
  return null
})
await page.click('header button[title="Zoom in"]')
await page.waitForTimeout(500)
check('toolbar zoom-in works', (await zoomPct()) === '125%', `zoom=${await zoomPct()}`)
if (centerInfo) {
  const c = await page.evaluate(
    ({ index, fx, fy }) => {
      const scroll = document.getElementById('viewer-scroll')
      const sRect = scroll.getBoundingClientRect()
      const r = document.querySelectorAll('.page-frame')[index].getBoundingClientRect()
      return {
        dx: r.left + fx * r.width - (sRect.left + scroll.clientWidth / 2),
        dy: r.top + fy * r.height - (sRect.top + scroll.clientHeight / 2),
      }
    },
    centerInfo,
  )
  const cDrift = Math.hypot(c.dx, c.dy)
  check('viewport center stays put on toolbar zoom', cDrift < 8, `drift=${cDrift.toFixed(1)}px`)
}

// ---- 4. keyboard ctrl+plus / ctrl+0 ----
await page.keyboard.press('Control+=')
await page.waitForTimeout(300)
check('ctrl+plus zooms in', (await zoomPct()) !== '125%', `zoom=${await zoomPct()}`)
await page.keyboard.press('Control+0')
await page.waitForTimeout(300)
check('ctrl+0 resets to 100%', (await zoomPct()) === '100%', `zoom=${await zoomPct()}`)

// ---- 5. plain wheel still scrolls (no zoom) ----
const yBefore = await page.evaluate(() => document.getElementById('viewer-scroll').scrollTop)
await page.mouse.move(600, 400)
await page.mouse.wheel(0, 300)
await page.waitForTimeout(300)
const yAfter = await page.evaluate(() => document.getElementById('viewer-scroll').scrollTop)
check('plain wheel scrolls, does not zoom', yAfter > yBefore && (await zoomPct()) === '100%')

// ---- 6. supersampled canvas: raster at least 2x CSS size ----
const ratio = await page.evaluate(() => {
  const c = document.querySelector('.page-canvas')
  return c.width / c.getBoundingClientRect().width
})
check('canvas supersampled >= 2x', ratio >= 2, `ratio=${ratio.toFixed(2)}`)

await page.screenshot({ path: 'shots/zoom-final.png' })
await browser.close()
server.kill('SIGTERM')

console.log('--- problems ---')
console.log(problems.join('\n') || 'none')
process.exit(failures > 0 || problems.length > 0 ? 1 : 0)
