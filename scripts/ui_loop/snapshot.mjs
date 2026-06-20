import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, createReadStream, createWriteStream } from 'node:fs'
import path from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'scan', path: '/scan' },
  { name: 'map', path: '/map' },
  { name: 'gallery', path: '/gallery' },
  { name: 'community', path: '/community' },
  { name: 'profile', path: '/profile' },
  { name: 'catdetail', path: '/cats/1' },
  { name: 'feed', path: '/feed' },
  { name: 'badges', path: '/badges' },
  { name: 'weekly', path: '/weekly-report' },
  { name: 'login', path: '/login' },
  { name: 'admin', path: '/admin' },
]

const VIEWPORT = { width: 390, height: 844 }

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.split('=')
      return [k.replace(/^--/, ''), v]
    })
  )
  return {
    url: args.url || 'http://localhost:5173',
    out: args.out || '.loop/snap',
    baseline: args.baseline || null,
    wait: parseInt(args.wait || '2500', 10),
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function readPng(file) {
  return new Promise((resolve, reject) => {
    const png = new PNG()
    png.on('parsed', () => resolve(png))
    png.on('error', reject)
    createReadStream(file).pipe(png)
  })
}

async function diffOne(name, afterFile, baselineDir, diffDir) {
  const baseFile = path.join(baselineDir, `${name}.png`)
  if (!existsSync(baseFile)) return { name, changed: null, reason: 'no-baseline' }
  const a = await readPng(baseFile)
  const b = await readPng(afterFile)
  const w = Math.max(a.width, b.width)
  const h = Math.max(a.height, b.height)
  const diff = new PNG({ width: w, height: h })
  const changed = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 })
  const diffFile = path.join(diffDir, `${name}.png`)
  await new Promise((r) => { diff.pack().pipe(createWriteStream(diffFile)).on('finish', r) })
  const total = w * h
  const pct = (changed / total) * 100
  return { name, changed, total, pct }
}

async function main() {
  const cfg = parseArgs()
  const outDir = path.resolve(__dirname, '..', '..', cfg.out)
  const diffDir = path.resolve(outDir, '_diff')
  await ensureDir(outDir)
  if (cfg.baseline) await ensureDir(diffDir)

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 })
  const consoleErrors = []
  const page = await context.newPage()
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()}: ${m.text()}`) })

  const results = []
  for (const r of ROUTES) {
    const url = cfg.url + r.path
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    }
    await page.waitForTimeout(cfg.wait)
    const file = path.join(outDir, `${r.name}.png`)
    await page.screenshot({ path: file, fullPage: true })
    let diff = null
    if (cfg.baseline) {
      const baseDir = path.resolve(__dirname, '..', '..', cfg.baseline)
      diff = await diffOne(r.name, file, baseDir, diffDir)
    }
    results.push({ ...r, file, diff })
    console.log(`  ✓ ${r.name} (${r.path})${diff?.pct != null ? ` diff=${diff.pct.toFixed(2)}%` : ''}`)
  }

  await browser.close()

  const summary = {
    out: cfg.out,
    baseline: cfg.baseline,
    routes: results.length,
    consoleErrors,
    diffs: results.filter((r) => r.diff).map((r) => ({ name: r.name, pct: r.diff.pct, changed: r.diff.changed })),
  }
  const summaryFile = path.join(outDir, '_summary.json')
  await writeFile(summaryFile, JSON.stringify(summary, null, 2))
  console.log(`\n摘要: ${results.length} 路由, ${consoleErrors.length} console 错误, 写入 ${summaryFile}`)
  if (consoleErrors.length) {
    console.log('console errors:')
    consoleErrors.slice(0, 10).forEach((e) => console.log('  ! ' + e))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
