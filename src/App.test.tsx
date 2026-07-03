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
      estimatedTokensPerSecond: 18,
      sweBenchVerifiedPct: null,
      hardwareSourceUrl: 'https://example.com/hardware',
      benchmarkSourceUrl: 'https://example.com/benchmark',
      benchmarkLabel: 'Missing benchmark',
      notes: 'Single-box estimate',
      lastUpdated: '2026-07-03',
    },
  ],
}

describe('App', () => {
  it('shows missing SWE labels instead of forcing normalization', () => {
    render(<App data={fixture} />)
    expect(screen.getAllByText('No direct SWE score').length).toBeGreaterThan(0)
  })

  it('renders the local hardware notes table', () => {
    render(<App data={fixture} />)
    expect(screen.getAllByText('Used RTX 3090 tower')).toHaveLength(2)
  })

  it('keeps unusable break-even output out of the UI when baseline exists', () => {
    render(<App data={fixture} />)
    expect(screen.getByText(/M\/mo/)).toBeInTheDocument()
  })
})
