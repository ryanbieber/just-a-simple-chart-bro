import { readFile, writeFile } from 'node:fs/promises'
import * as cheerio from 'cheerio'

const manifestPath = new URL('../src/data/model-manifest.json', import.meta.url)
const dashboardDataPath = new URL('../src/data/dashboard-data.json', import.meta.url)
const sweBenchUrl = 'https://www.swebench.com/'
const anthropicPricingUrl = 'https://docs.anthropic.com/en/docs/about-claude/pricing'

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const previous = JSON.parse(await readFile(dashboardDataPath, 'utf8'))

const sweBenchResults = await fetchSweBenchVerified()
const anthropicPriceMap = await fetchAnthropicPrices()

const hostedModels = []
for (const model of manifest.hostedModels) {
  const benchmark = findBenchmark(model.benchmarkSelector.resultName, sweBenchResults)
  const pricing = await fetchHostedPricing(model.pricingSelector, anthropicPriceMap)
  const existing = previous.hostedModels.find((entry) => entry.modelId === model.modelId)

  hostedModels.push({
    modelId: model.modelId,
    provider: model.provider,
    modelName: model.modelName,
    inputUsdPerM: pricing?.inputUsdPerM ?? existing?.inputUsdPerM ?? null,
    outputUsdPerM: pricing?.outputUsdPerM ?? existing?.outputUsdPerM ?? null,
    cachedInputUsdPerM: pricing?.cachedInputUsdPerM ?? existing?.cachedInputUsdPerM ?? null,
    sweBenchVerifiedPct: benchmark?.resolved ?? existing?.sweBenchVerifiedPct ?? null,
    pricingSourceUrl: model.pricingSourceUrl,
    benchmarkSourceUrl: model.benchmarkSourceUrl,
    benchmarkLabel: model.benchmarkLabel,
    lastUpdated: currentDate(),
  })
}

const localModels = []
for (const model of manifest.localModels) {
  const benchmark = findBenchmark(model.benchmarkSelector.resultName, sweBenchResults)
  const existing = previous.localModels.find((entry) => entry.modelId === model.modelId)

  if (!benchmark) {
    console.warn(`Benchmark refresh warning: "${model.benchmarkSelector.resultName}" not found.`)
  }

  localModels.push({
    modelId: model.modelId,
    modelName: model.modelName,
    quantization: model.quantization,
    minTolerableHardware: model.minTolerableHardware,
    hardwareCostUsd: model.hardwareCostUsd ?? existing?.hardwareCostUsd ?? null,
    estimatedTokensPerSecond:
      model.estimatedTokensPerSecond ?? existing?.estimatedTokensPerSecond ?? null,
    sweBenchVerifiedPct: benchmark?.resolved ?? existing?.sweBenchVerifiedPct ?? null,
    hardwareSourceUrl: model.hardwareSourceUrl,
    benchmarkSourceUrl: model.benchmarkSourceUrl,
    benchmarkLabel: model.benchmarkLabel,
    notes: model.notes,
    lastUpdated: currentDate(),
  })
}

const nextData = {
  generatedAt: currentDate(),
  notes: previous.notes,
  hostedModels,
  localModels,
}

await writeFile(dashboardDataPath, `${JSON.stringify(nextData, null, 2)}\n`)
console.log(`Updated dashboard dataset at ${dashboardDataPath.pathname}`)

async function fetchSweBenchVerified() {
  const html = await fetchText(sweBenchUrl)
  const match = html.match(
    /<script type="application\/json" id="leaderboard-data">\s*([\s\S]*?)<\/script>/,
  )

  if (!match) {
    throw new Error('Unable to locate SWE-bench leaderboard data payload.')
  }

  const payload = JSON.parse(match[1])
  const verified = payload.find((entry) => entry.name === 'Verified')

  if (!verified) {
    throw new Error('Unable to locate the Verified leaderboard in SWE-bench payload.')
  }

  return verified.results
}

async function fetchAnthropicPrices() {
  const html = await fetchText(anthropicPricingUrl)
  const $ = cheerio.load(html)
  const rows = new Map()

  $('table tbody tr').each((_, tr) => {
    const cells = $(tr)
      .find('td')
      .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get()

    if (cells.length < 6) {
      return
    }

    rows.set(cells[0], {
      inputUsdPerM: parseMoney(cells[1]),
      cachedInputUsdPerM: parseMoney(cells[4]),
      outputUsdPerM: parseMoney(cells[5]),
    })
  })

  return rows
}

async function fetchHostedPricing(selector, anthropicPriceMap) {
  if (selector.provider === 'openai-model-page') {
    const text = await fetchText(selector.modelPageUrl)
    const normalized = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const match = normalized.match(
      /Input \$([0-9.]+).*?Cached input \$([0-9.]+).*?Output \$([0-9.]+)/,
    )

    if (!match) {
      console.warn(`Pricing refresh warning: unable to parse ${selector.modelPageUrl}`)
      return null
    }

    return {
      inputUsdPerM: Number(match[1]),
      cachedInputUsdPerM: Number(match[2]),
      outputUsdPerM: Number(match[3]),
    }
  }

  if (selector.provider === 'anthropic-pricing-table') {
    const row = anthropicPriceMap.get(selector.rowLabel)

    if (!row) {
      console.warn(`Pricing refresh warning: Anthropic row "${selector.rowLabel}" not found.`)
      return null
    }

    return row
  }

  return null
}

function findBenchmark(resultName, results) {
  return results.find((entry) => entry.name === resultName) ?? null
}

function parseMoney(value) {
  const match = value.match(/\$([0-9.]+)/)
  return match ? Number(match[1]) : null
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

function currentDate() {
  return new Date().toISOString().slice(0, 10)
}
