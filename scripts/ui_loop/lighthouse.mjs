import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.split('=')
      return [k.replace(/^--/, ''), v]
    })
  )
  return {
    url: args.url || 'http://localhost:5173',
    out: args.out || '.loop/lighthouse.json',
  }
}

function runLighthouse(url) {
  return new Promise((resolve, reject) => {
    const lh = path.join(__dirname, 'node_modules', '.bin', 'lighthouse')
    const args = [
      url,
      '--output=json',
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--only-categories=performance',
      '--emulated-form-factor=mobile',
    ]
    const child = spawn(lh, args, { shell: true, cwd: __dirname })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (code) => {
      try { resolve(JSON.parse(stdout)) }
      catch { reject(new Error(`lighthouse exit ${code} (no JSON): ${stderr.slice(0, 500)}`)) }
    })
  })
}

async function main() {
  const cfg = parseArgs()
  console.log(`  跑 Lighthouse 第 1 次 (冷启动)...`)
  await runLighthouse(cfg.url).catch(() => {})
  console.log(`  跑 Lighthouse 第 2 次 (取值)...`)
  const report = await runLighthouse(cfg.url)
  const audits = report.audits || {}
  const metrics = {
    url: cfg.url,
    lcp: audits['largest-contentful-paint']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    fcp: audits['first-contentful-paint']?.numericValue ?? null,
    tbt: audits['total-blocking-time']?.numericValue ?? null,
    score: report.categories?.performance?.score ?? null,
    timestamp: new Date().toISOString(),
  }
  const outFile = path.resolve(__dirname, '..', '..', cfg.out)
  await mkdir(path.dirname(outFile), { recursive: true })
  await writeFile(outFile, JSON.stringify(metrics, null, 2))
  console.log(`  LCP=${metrics.lcp?.toFixed(2)}ms CLS=${metrics.cls?.toFixed(4)} FCP=${metrics.fcp?.toFixed(2)}ms score=${metrics.score?.toFixed(2)}`)
  console.log(`  写入 ${outFile}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
