import { useDeferredValue, useMemo, useState } from 'react'
import './App.css'
import dashboardData from './data/dashboard-data.json'
import {
  calculateBreakEvenMonthlyTokens,
  calculateHostedBlendedCostPerM,
  calculateLocalCostPerM,
  calculateSweNormalizedCost,
  formatCompactNumber,
  formatCurrency,
  parsePositiveNumber,
} from './lib/calc'
import type { DashboardData } from './lib/types'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type TokenPresetKey = 'codingAgent' | 'chatHeavy' | 'outputHeavy'

type AppProps = {
  data?: DashboardData
}

const presetRatios: Record<TokenPresetKey, { inputRatio: number; outputRatio: number }> = {
  codingAgent: { inputRatio: 0.68, outputRatio: 0.32 },
  chatHeavy: { inputRatio: 0.82, outputRatio: 0.18 },
  outputHeavy: { inputRatio: 0.45, outputRatio: 0.55 },
}

function App({ data = dashboardData as DashboardData }: AppProps) {
  const baselineOptions = data.hostedModels.filter((model) => model.sweBenchVerifiedPct !== null)
  const [preset, setPreset] = useState<TokenPresetKey>('codingAgent')
  const [inputRatio, setInputRatio] = useState(presetRatios.codingAgent.inputRatio)
  const [monthlyTokens, setMonthlyTokens] = useState(50)
  const [amortizationMonths, setAmortizationMonths] = useState(24)
  const [baselineId, setBaselineId] = useState(baselineOptions[0]?.modelId ?? '')

  const outputRatio = Math.max(0, 1 - inputRatio)
  const deferredMonthlyTokens = useDeferredValue(monthlyTokens)
  const deferredAmortizationMonths = useDeferredValue(amortizationMonths)
  const baselineModel =
    baselineOptions.find((model) => model.modelId === baselineId) ?? baselineOptions[0] ?? null
  const baselineSweScore = baselineModel?.sweBenchVerifiedPct ?? null
  const baselineCostPerM =
    baselineModel === null
      ? null
      : calculateHostedBlendedCostPerM(
          baselineModel.inputUsdPerM,
          baselineModel.outputUsdPerM,
          inputRatio,
          outputRatio,
        )

  const hostedRows = useMemo(
    () =>
      data.hostedModels.map((model) => {
        const rawCostPerM = calculateHostedBlendedCostPerM(
          model.inputUsdPerM,
          model.outputUsdPerM,
          inputRatio,
          outputRatio,
        )

        return {
          id: model.modelId,
          name: model.modelName,
          provider: model.provider,
          rawCostPerM,
          normalizedCostPerM:
            baselineSweScore !== null && model.sweBenchVerifiedPct !== null
              ? calculateSweNormalizedCost(
                  rawCostPerM,
                  model.sweBenchVerifiedPct,
                  baselineSweScore,
                )
              : null,
          sweBenchVerifiedPct: model.sweBenchVerifiedPct,
          category: 'Hosted',
        }
      }),
    [baselineSweScore, data.hostedModels, inputRatio, outputRatio],
  )

  const localRows = useMemo(
    () =>
      data.localModels.map((model) => {
        const rawCostPerM = calculateLocalCostPerM(
          model.hardwareCostUsd,
          deferredAmortizationMonths,
          deferredMonthlyTokens,
        )

        return {
          id: model.modelId,
          name: model.modelName,
          provider: 'Local',
          rawCostPerM,
          normalizedCostPerM:
            baselineSweScore !== null && model.sweBenchVerifiedPct !== null
              ? calculateSweNormalizedCost(
                  rawCostPerM,
                  model.sweBenchVerifiedPct,
                  baselineSweScore,
                )
              : null,
          sweBenchVerifiedPct: model.sweBenchVerifiedPct,
          breakEvenMonthlyTokens:
            baselineCostPerM === null
              ? null
              : calculateBreakEvenMonthlyTokens(
                  model.hardwareCostUsd,
                  deferredAmortizationMonths,
                  baselineCostPerM,
                ),
          category: 'Local',
          hardware: model.minTolerableHardware,
          estimatedTokensPerSecond: model.estimatedTokensPerSecond,
        }
      }),
    [
      baselineCostPerM,
      baselineSweScore,
      data.localModels,
      deferredAmortizationMonths,
      deferredMonthlyTokens,
    ],
  )

  const chartRows = [...hostedRows, ...localRows]
  const intelligenceRows = chartRows.filter((row) => row.sweBenchVerifiedPct !== null)
  const rawCostExtent = Math.max(...chartRows.map((row) => row.rawCostPerM), 1)

  function handlePresetChange(nextPreset: TokenPresetKey) {
    setPreset(nextPreset)
    setInputRatio(presetRatios[nextPreset].inputRatio)
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">GitHub Pages dashboard</p>
          <h1>LLM coding economics under one roof.</h1>
          <p className="hero-summary">
            Hosted API pricing, local amortized cost, break-even token volume, and
            SWE-bench Verified scores in one view. Local model benchmark rows stay clearly
            labeled as published agent runs, not abstract model IQ.
          </p>
        </div>
        <div className="hero-meta">
          <div>
            <span>Dataset</span>
            <strong>{data.generatedAt}</strong>
          </div>
          <div>
            <span>Hosted models</span>
            <strong>{data.hostedModels.length}</strong>
          </div>
          <div>
            <span>Local models</span>
            <strong>{data.localModels.length}</strong>
          </div>
        </div>
      </section>

      <section className="controls-band" aria-label="Dashboard controls">
        <div className="control-group">
          <label htmlFor="preset">Token mix preset</label>
          <div className="segmented" role="tablist" aria-label="Token mix presets">
            {Object.entries({
              codingAgent: 'Coding agent',
              chatHeavy: 'Chat-heavy',
              outputHeavy: 'Output-heavy',
            }).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={preset === value}
                className={preset === value ? 'active' : undefined}
                onClick={() => handlePresetChange(value as TokenPresetKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="input-ratio">
            Input ratio <strong>{Math.round(inputRatio * 100)}%</strong>
          </label>
          <input
            id="input-ratio"
            type="range"
            min="0"
            max="100"
            value={Math.round(inputRatio * 100)}
            onChange={(event) => {
              const nextValue = parsePositiveNumber(event.currentTarget.value, 0)
              setInputRatio(Math.min(1, nextValue / 100))
            }}
          />
          <p className="control-note">
            Output ratio <strong>{Math.round(outputRatio * 100)}%</strong>
          </p>
        </div>

        <div className="control-group">
          <label htmlFor="monthlyTokens">Monthly tokens in millions</label>
          <input
            id="monthlyTokens"
            type="number"
            min="0.1"
            step="0.1"
            value={monthlyTokens}
            onChange={(event) => {
              setMonthlyTokens(parsePositiveNumber(event.currentTarget.value, 0.1))
            }}
          />
        </div>

        <div className="control-group">
          <label htmlFor="amortizationMonths">Amortization months</label>
          <input
            id="amortizationMonths"
            type="number"
            min="1"
            step="1"
            value={amortizationMonths}
            onChange={(event) => {
              setAmortizationMonths(parsePositiveNumber(event.currentTarget.value, 1))
            }}
          />
        </div>

        <div className="control-group">
          <label htmlFor="baseline">SWE baseline frontier model</label>
          <select
            id="baseline"
            value={baselineId}
            onChange={(event) => setBaselineId(event.currentTarget.value)}
          >
            {baselineOptions.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.provider} {model.modelName}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="metrics-band">
        <article className="metric-panel">
          <span>Current baseline raw cost</span>
          <strong>
            {baselineModel
              ? formatCurrency(
                  calculateHostedBlendedCostPerM(
                    baselineModel.inputUsdPerM,
                    baselineModel.outputUsdPerM,
                    inputRatio,
                    outputRatio,
                  ),
                )
              : 'Unavailable'}
          </strong>
          <p>Blended per 1M tokens at the active input/output mix.</p>
        </article>
        <article className="metric-panel">
          <span>Cheapest hosted</span>
          <strong>
            {formatCurrency(
              Math.min(...hostedRows.map((row) => row.rawCostPerM), Number.POSITIVE_INFINITY),
            )}
          </strong>
          <p>Best raw hosted token cost among the seeded coding models.</p>
        </article>
        <article className="metric-panel">
          <span>Cheapest local at current usage</span>
          <strong>
            {formatCurrency(
              Math.min(...localRows.map((row) => row.rawCostPerM), Number.POSITIVE_INFINITY),
            )}
          </strong>
          <p>Amortized hardware cost only. Power is excluded in v1.</p>
        </article>
      </section>

      <section className="grid-band">
        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Raw economics</p>
              <h2>Cost per 1M tokens</h2>
            </div>
            <p>Hosted bars use blended API pricing. Local bars use amortized hardware cost.</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartRows} margin={{ top: 12, right: 10, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" angle={-18} textAnchor="end" height={72} interval={0} />
                <YAxis
                  tickFormatter={(value: number) => `$${formatCompactNumber(value)}`}
                  domain={[0, Math.ceil(rawCostExtent * 1.15)]}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 12, border: '1px solid #c9d3db' }}
                />
                <Legend />
                <Bar dataKey="rawCostPerM" name="Raw cost / 1M">
                  {chartRows.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={entry.category === 'Hosted' ? '#13736b' : '#d97706'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Cost quality view</p>
              <h2>Intelligence vs spend</h2>
            </div>
            <p>SWE-normalized cost uses the active baseline to show how much weaker models pay in extra tokens.</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 12, right: 18, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="sweBenchVerifiedPct"
                  name="SWE-bench Verified"
                  tickFormatter={(value: number) => `${value}%`}
                />
                <YAxis
                  type="number"
                  dataKey="rawCostPerM"
                  name="Raw cost"
                  tickFormatter={(value: number) => `$${formatCompactNumber(value)}`}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  formatter={(value, name) =>
                    name === 'SWE-bench Verified'
                      ? `${Number(value)}%`
                      : formatCurrency(Number(value))
                  }
                />
                <ReferenceLine
                  x={baselineModel?.sweBenchVerifiedPct ?? undefined}
                  stroke="#b45309"
                  strokeDasharray="3 3"
                />
                <Scatter name="Hosted" data={intelligenceRows.filter((row) => row.category === 'Hosted')} fill="#13736b" />
                <Scatter name="Local" data={intelligenceRows.filter((row) => row.category === 'Local')} fill="#d97706" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid-band secondary-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Break-even</p>
              <h2>Local monthly break-even tokens</h2>
            </div>
            <p>How many millions of tokens per month you need before local hardware beats the selected hosted baseline.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Hardware</th>
                <th>Cost / 1M</th>
                <th>Break-even</th>
                <th>TPS</th>
              </tr>
            </thead>
            <tbody>
              {localRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.hardware}</td>
                  <td>{formatCurrency(row.rawCostPerM)}</td>
                  <td>
                    {row.breakEvenMonthlyTokens === null
                      ? 'Unavailable'
                      : `${formatCompactNumber(row.breakEvenMonthlyTokens)}M/mo`}
                  </td>
                  <td>{row.estimatedTokensPerSecond} tok/s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">SWE-normalized view</p>
              <h2>Adjusted cost per 1M</h2>
            </div>
            <p>Missing scores stay visible but do not get normalized.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Category</th>
                <th>Raw</th>
                <th>Normalized</th>
                <th>SWE</th>
              </tr>
            </thead>
            <tbody>
              {chartRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{formatCurrency(row.rawCostPerM)}</td>
                  <td>
                    {row.normalizedCostPerM === null
                      ? 'No direct SWE score'
                      : formatCurrency(row.normalizedCostPerM)}
                  </td>
                  <td>
                    {row.sweBenchVerifiedPct === null
                      ? 'Missing'
                      : `${row.sweBenchVerifiedPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="panel sources-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Source ledger</p>
            <h2>Model and hardware assumptions</h2>
          </div>
          <p>Pricing and benchmark sources stay linked in the shipped dataset.</p>
        </div>

        <div className="table-stack">
          <h3>Hosted models</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Pricing</th>
                <th>Benchmark run</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {data.hostedModels.map((model) => (
                <tr key={model.modelId}>
                  <td>
                    <strong>{model.provider}</strong> {model.modelName}
                  </td>
                  <td>
                    <a href={model.pricingSourceUrl} target="_blank" rel="noreferrer">
                      Official pricing
                    </a>
                  </td>
                  <td>
                    <a href={model.benchmarkSourceUrl} target="_blank" rel="noreferrer">
                      {model.benchmarkLabel}
                    </a>
                  </td>
                  <td>{model.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Local models</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Hardware note</th>
                <th>Benchmark run</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {data.localModels.map((model) => (
                <tr key={model.modelId}>
                  <td>
                    <strong>{model.modelName}</strong>
                    <p className="subtle-line">{model.quantization}</p>
                  </td>
                  <td>
                    <a href={model.hardwareSourceUrl} target="_blank" rel="noreferrer">
                      {model.minTolerableHardware}
                    </a>
                    <p className="subtle-line">{model.notes}</p>
                  </td>
                  <td>
                    <a href={model.benchmarkSourceUrl} target="_blank" rel="noreferrer">
                      {model.benchmarkLabel}
                    </a>
                  </td>
                  <td>{model.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
