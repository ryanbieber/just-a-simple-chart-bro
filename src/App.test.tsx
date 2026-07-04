import { render, screen } from '@testing-library/react'
import App from './App'
import type { DashboardData } from './lib/types'

const fixture: DashboardData = {
  generatedAt: '2026-07-03',
  notes: [],
  hostedModels: [
    {
      modelId: 'baseline',
      provider: 'OpenAI',
      modelName: 'GPT-5',
      inputUsdPerM: 1,
      outputUsdPerM: 3,
      cachedInputUsdPerM: 0.1,
      estimatedTokensPerSecond: 50,
      sweBenchVerifiedPct: 70,
      pricingSourceUrl: 'https://example.com/pricing',
      benchmarkSourceUrl: 'https://example.com/benchmark',
      benchmarkLabel: 'Baseline run',
      lastUpdated: '2026-07-03',
    },
    {
      modelId: 'missing-swe',
      provider: 'Test',
      modelName: 'No SWE',
      inputUsdPerM: 2,
      outputUsdPerM: 6,
      cachedInputUsdPerM: null,
      estimatedTokensPerSecond: null,
      sweBenchVerifiedPct: null,
      pricingSourceUrl: 'https://example.com/pricing',
      benchmarkSourceUrl: 'https://example.com/benchmark',
      benchmarkLabel: 'No direct score',
      lastUpdated: '2026-07-03',
    },
  ],
  localModels: [
    {
      modelId: 'local',
      modelName: 'Qwen local',
      quantization: 'Q4',
      minTolerableHardware: 'Used RTX 3090 tower',
      hardwareCostUsd: 1200,
      estimatedTokensPerSecond: null,
      sweBenchVerifiedPct: 55,
      hardwareSourceUrl: 'https://example.com/hardware',
      benchmarkSourceUrl: 'https://example.com/benchmark',
      benchmarkLabel: 'Missing benchmark',
      notes: 'Single-box estimate',
      lastUpdated: '2026-07-03',
    },
  ],
}

describe('App', () => {
  it('shows the simplified plot header', () => {
    render(<App data={fixture} />)
    expect(screen.getByText('Cheaper and smarter is up-left')).toBeInTheDocument()
  })

  it('renders the quick picks table with the local hardware target', () => {
    render(<App data={fixture} />)
    expect(screen.getByText('Used RTX 3090 tower')).toBeInTheDocument()
  })

  it('shows an unavailable speed marker when a model is missing tok/s', () => {
    render(<App data={fixture} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })
})
