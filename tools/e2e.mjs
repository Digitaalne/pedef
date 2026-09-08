import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 4319
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const problems = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

await page.goto(`http://localhost:${PORT}/`)
await page.setInputFiles('input[type=file]', 'samples/sample.pdf')
await page.waitForSelector('.page-frame', { timeout: 10000 })
await page.waitForTimeout(1200)

// ---- text: place, type, commit ----
await page.click('header button[title*="Add text"]')
const overlay = page.locator('.page-frame').first().locator('.page-overlay')
const box = await overlay.boundingBox()
await page.mouse.click(box.x + 200, box.y + 200)
await page.waitForTimeout(400)
console.log('text editing textarea visible:', (await page.locator('.el-text-edit').count()) === 1)
await page.keyboard.type('Hello edited text')
await page.mouse.click(box.x + 400, box.y + 120)
await page.waitForTimeout(300)
console.log('committed:', await page.locator('.el-text-line').count(), 'line(s)')
await page.screenshot({ path: 'shots/text-ok.png' })

// ---- stamp: typed signature with a newly added font (Sacramento) ----
await page.click('header button[title*="Create a signature"]')
await page.waitForSelector('.dialog', { timeout: 5000 })
await page.click('.tab:has-text("Type")')
await page.fill('input[placeholder="Your name…"]', 'Jane Smith')
// pick Sacramento explicitly (new font)
await page.selectOption('.type-tab select', { label: 'Sacramento' })
await page.waitForTimeout(600)
await page.screenshot({ path: 'shots/type-dialog.png' })
await page.click('button:has-text("Save & place")')
await page.waitForTimeout(400)
await page.mouse.click(box.x + 320, box.y + 420)
await page.waitForTimeout(300)
console.log('stamps placed:', await page.locator('.el-stamp').count())
await page.screenshot({ path: 'shots/stamp-placed.png' })

// ---- verify last-used font ordering ----
await page.click('header button[title*="Create a signature"]')
await page.waitForSelector('.dialog', { timeout: 5000 })
await page.click('.tab:has-text("Type")')
await page.waitForSelector('.type-tab select', { timeout: 5000 })
const firstOption = await page.locator('.type-tab select option').first().innerText()
console.log('first font option after re-open:', JSON.stringify(firstOption))
await page.keyboard.press('Escape')
await page.mouse.click(700, 500)

// ---- download the edited PDF and verify content ----
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.click('button:has-text("Download PDF")'),
])
const path = 'shots/exported.pdf'
await download.saveAs(path)
console.log('downloaded:', download.suggestedFilename())
writeFileSync('shots/exported.bin', Buffer.from(await download.path()).subarray ? '' : '')
await browser.close()
server.kill('SIGTERM')

// verify with pdf.js in node (same checks as export tests)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: new Uint8Array((await import('node:fs')).readFileSync(path)) }).promise
const txt = await (await doc.getPage(1)).getTextContent()
console.log('page1 text items:', txt.items.filter((i) => i.str).map((i) => i.str))
const ops = await (await doc.getPage(1)).getOperatorList()
const paint = ops.fnArray.filter((f) => f === pdfjs.OPS.paintImageXObject)
console.log('page1 image ops:', paint.length)

console.log('--- problems ---')
console.log(problems.filter((p) => !p.startsWith('log: Download')).join('\n') || 'none')
process.exit(0)
