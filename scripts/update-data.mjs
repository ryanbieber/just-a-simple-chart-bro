import { readFile, writeFile } from 'node:fs/promises'
import * as cheerio from 'cheerio'

const manifestPath = new URL('../src/data/model-manifest.json', import.meta.url)
const dashboardDataPath = new URL('../src/data/dashboard-data.json', import.meta.url)
const llmStatsBenchmarkUrl = 'https://llm-stats.com/benchmarks/swe-bench-pro'
const anthropicPricingUrl = 'https://docs.anthropic.com/en/docs/about-claude/pricing'

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const previous = JSON.parse(await readFile(dashboardDataPath, 'utf8'))

const benchmarkModels = await fetchLlmStatsBenchmarkModels()
const anthropicPriceMap = await fetchAnthropicPrices()

const hostedModels = []
for (const model of manifest.hostedModels) {
  const benchmark = findBenchmark(model.benchmarkSelector?.modelId, benchmarkModels)
  const pricing = await fetchHostedPricing(model.pricingSelector, anthropicPriceMap)
  const existing = previous.hostedModels.find((entry) => entry.modelId === model.modelId)

  hostedModels.push({
    modelId: model.modelId,
    provider: model.provider,
    modelName: model.modelName,
    inputUsdPerM: pricing?.inputUsdPerM ?? existing?.inputUsdPerM ?? null,
    outputUsdPerM: pricing?.outputUsdPerM ?? existing?.outputUsdPerM ?? null,
    cachedInputUsdPerM: pricing?.cachedInputUsdPerM ?? existing?.cachedInputUsdPerM ?? null,
    estimatedTokensPerSecond:
      model.estimatedTokensPerSecond ?? existing?.estimatedTokensPerSecond ?? null,
    sweBenchVerifiedPct:
      benchmark?.score !== undefined ? roundPct(benchmark.score * 100) : existing?.sweBenchVerifiedPct ?? null,
    pricingSourceUrl: model.pricingSourceUrl,
    benchmarkSourceUrl: model.benchmarkSourceUrl,
    benchmarkLabel: benchmark
      ? `${benchmark.model_name} on LLM Stats SWE-Bench Pro`
      : model.benchmarkLabel,
    lastUpdated: currentDate(),
  })
}

const localModels = []
for (const model of manifest.localModels) {
  const benchmark = findBenchmark(model.benchmarkSelector?.modelId, benchmarkModels)
  const existing = previous.localModels.find((entry) => entry.modelId === model.modelId)

  if (model.benchmarkSelector?.modelId && !benchmark) {
    console.warn(`Benchmark refresh warning: "${model.benchmarkSelector.modelId}" not found.`)
  }

  localModels.push({
    modelId: model.modelId,
    modelName: model.modelName,
    quantization: model.quantization,
    minTolerableHardware: model.minTolerableHardware,
    hardwareCostUsd: model.hardwareCostUsd ?? existing?.hardwareCostUsd ?? null,
    estimatedTokensPerSecond:
      model.estimatedTokensPerSecond ?? existing?.estimatedTokensPerSecond ?? null,
    sweBenchVerifiedPct:
      benchmark?.score !== undefined ? roundPct(benchmark.score * 100) : existing?.sweBenchVerifiedPct ?? null,
    hardwareSourceUrl: model.hardwareSourceUrl,
    benchmarkSourceUrl: model.benchmarkSourceUrl,
    benchmarkLabel: benchmark
      ? `${benchmark.model_name} on LLM Stats SWE-Bench Pro`
      : model.benchmarkLabel,
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

async function fetchLlmStatsBenchmarkModels() {
  const html = await fetchText(llmStatsBenchmarkUrl)
  const marker = 'initialBenchmarkData\\":'
  const markerIndex = html.indexOf(marker)

  if (markerIndex === -1) {
    throw new Error('Unable to locate LLM Stats benchmark payload.')
  }

  const startIndex = html.indexOf('{', markerIndex)
  const endIndex = findMatchingBrace(html, startIndex)

  const payload = JSON.parse(
    html
      .slice(startIndex, endIndex + 1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/'),
  )

  return payload.models
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

function findBenchmark(modelId, results) {
  if (!modelId) {
    return null
  }

  return results.find((entry) => entry.model_id === modelId) ?? null
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

function roundPct(value) {
  return Math.round(value * 10) / 10
}

function findMatchingBrace(text, startIndex) {
  let depth = 0

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  throw new Error('Unable to find the end of the LLM Stats benchmark payload.')
}
