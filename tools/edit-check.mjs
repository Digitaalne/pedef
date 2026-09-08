import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const PORT = 4319
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: process.cwd(), stdio: 'ignore' })
async function wait(u, t = 30000) { const s = Date.now(); while (Date.now() - s < t) { try { await fetch(u); return } catch { await new Promise(r => setTimeout(r, 300)) } } throw new Error('no server') }
await wait(`http://localhost:${PORT}/`)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(`http://localhost:${PORT}/`)
await page.setInputFiles('input[type=file]', 'samples/sample.pdf')
await page.waitForSelector('.page-frame', { timeout: 10000 })
await page.waitForTimeout(1000)
await page.click('header button[title*="Add text"]')
const overlay = page.locator('.page-frame').first().locator('.page-overlay')
const b = await overlay.boundingBox()
await page.mouse.click(b.x + 200, b.y + 200)
await page.waitForTimeout(400)
const ta = page.locator('.el-text-edit')
const styles = await ta.evaluate((el) => {
  const cs = getComputedStyle(el)
  const container = el.parentElement
  return { bg: cs.backgroundColor, outline: cs.outlineStyle, containerOutline: getComputedStyle(container).outlineStyle, containerClass: container.className }
})
console.log('textarea styles:', JSON.stringify(styles))
await page.keyboard.type('Sample text')
await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/editing-frame.png' })
// commit and check single dashed outline after commit (selected)
await page.mouse.click(b.x + 450, b.y + 120)
await page.waitForTimeout(300)
const after = await page.evaluate(() => {
  const el = document.querySelector('.el-text')
  return { cls: el.className, outline: getComputedStyle(el).outlineStyle, outlineColor: getComputedStyle(el).outlineColor }
})
console.log('after commit:', JSON.stringify(after))
await browser.close()
server.kill('SIGTERM')
process.exit(0)
