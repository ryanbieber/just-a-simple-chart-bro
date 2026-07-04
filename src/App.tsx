import { useMemo, useState } from 'react'
import './App.css'
import dashboardData from './data/dashboard-data.json'
import {
  calculateHostedBlendedCostPerM,
  calculateLocalCostPerM,
  formatCurrency,
  parsePositiveNumber,
} from './lib/calc'
import type { DashboardData } from './lib/types'
import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

type TokenPresetKey = 'codingAgent' | 'chatHeavy' | 'outputHeavy'

type AppProps = {
  data?: DashboardData
}

type PlotRow = {
  id: string
  name: string
  category: 'Cloud' | 'Local'
  costPerM: number
  sweScore: number
  estimatedTokensPerSecond: number | null
  hardwareOrProvider: string
}

const presetRatios: Record<TokenPresetKey, { inputRatio: number; outputRatio: number }> = {
  codingAgent: { inputRatio: 0.68, outputRatio: 0.32 },
  chatHeavy: { inputRatio: 0.82, outputRatio: 0.18 },
  outputHeavy: { inputRatio: 0.45, outputRatio: 0.55 },
}

function App({ data = dashboardData as DashboardData }: AppProps) {
  const [preset, setPreset] = useState<TokenPresetKey>('codingAgent')
  const [inputRatio, setInputRatio] = useState(presetRatios.codingAgent.inputRatio)
  const [monthlyTokens, setMonthlyTokens] = useState(50)
  const [amortizationMonths, setAmortizationMonths] = useState(24)

  const outputRatio = Math.max(0, 1 - inputRatio)

  const cloudRows = useMemo<PlotRow[]>(
    () =>
      data.hostedModels
        .filter((model) => model.sweBenchVerifiedPct !== null)
        .map((model) => ({
          id: model.modelId,
          name: model.modelName,
          category: 'Cloud',
          costPerM: calculateHostedBlendedCostPerM(
            model.inputUsdPerM,
            model.outputUsdPerM,
            inputRatio,
            outputRatio,
          ),
          sweScore: model.sweBenchVerifiedPct ?? 0,
          estimatedTokensPerSecond: model.estimatedTokensPerSecond,
          hardwareOrProvider: model.provider,
        })),
    [data.hostedModels, inputRatio, outputRatio],
  )

  const localRows = useMemo<PlotRow[]>(
    () =>
      data.localModels
        .filter((model) => model.sweBenchVerifiedPct !== null)
        .map((model) => ({
          id: model.modelId,
          name: model.modelName,
          category: 'Local',
          costPerM: calculateLocalCostPerM(
            model.hardwareCostUsd,
            amortizationMonths,
            monthlyTokens,
          ),
          sweScore: model.sweBenchVerifiedPct ?? 0,
          estimatedTokensPerSecond: model.estimatedTokensPerSecond,
          hardwareOrProvider: model.minTolerableHardware,
        })),
    [amortizationMonths, data.localModels, monthlyTokens],
  )

  const plotRows = [...cloudRows, ...localRows].map((row) => ({
    ...row,
    speedBubble: row.estimatedTokensPerSecond ?? 12,
  }))

  const bestCloud = pickBestModel(cloudRows)
  const bestLocal = pickBestModel(localRows)

  function handlePresetChange(nextPreset: TokenPresetKey) {
    setPreset(nextPreset)
    setInputRatio(presetRatios[nextPreset].inputRatio)
  }

  return (
    <main className="app-shell">
      <section className="topline">
        <div>
          <p className="eyebrow">LLM coding cost map</p>
          <h1>Cost vs SWE-Bench Pro.</h1>
          <p className="summary">
            X is blended cost per 1M tokens. Y is SWE-Bench Pro score. Bubble size reflects
            tokens/sec when we have a usable estimate. Frontier tok/s is approximate where it
            comes from published char/sec data rather than direct token/sec reporting.
          </p>
        </div>
        <div className="dataset-meta">
          <span>Dataset</span>
          <strong>{data.generatedAt}</strong>
        </div>
      </section>

      <section className="controls-band" aria-label="Dashboard controls">
        <div className="control-group control-group-wide">
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
          <p className="control-note">Output ratio {Math.round(outputRatio * 100)}%</p>
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
      </section>

      <section className="panel chart-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Main plot</p>
            <h2>Cheaper and smarter is up-left</h2>
          </div>
          <p>Bubble size represents tokens/sec. Local cost responds to your amortization and monthly usage settings.</p>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 12, right: 18, left: 8, bottom: 20 }}>
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis
                type="number"
                dataKey="costPerM"
                name="Cost per 1M"
                tickFormatter={(value: number) => formatCurrency(value)}
                domain={[0, 'dataMax + 5']}
              />
              <YAxis
                type="number"
                dataKey="sweScore"
                name="SWE-Bench Pro"
                tickFormatter={(value: number) => `${value}%`}
                domain={[35, 85]}
              />
              <ZAxis type="number" dataKey="speedBubble" range={[90, 900]} />
              <Tooltip
                cursor={{ strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null
                  }

                  const row = payload[0]?.payload as PlotRow & { speedBubble: number }
                  return (
                    <div className="plot-tooltip">
                      <strong>{row.name}</strong>
                      <span>{row.category}</span>
                      <span>{formatCurrency(row.costPerM)} / 1M</span>
                      <span>{row.sweScore}% SWE-Bench Pro</span>
                      <span>
                        {row.estimatedTokensPerSecond === null
                          ? 'tok/s unavailable'
                          : `~${row.estimatedTokensPerSecond} tok/s`}
                      </span>
                    </div>
                  )
                }}
              />
              <Legend />
              <Scatter name="Cloud" data={plotRows.filter((row) => row.category === 'Cloud')} fill="#13736b" />
              <Scatter name="Local" data={plotRows.filter((row) => row.category === 'Local')} fill="#d97706" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel summary-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Quick picks</p>
            <h2>Best cloud and local</h2>
          </div>
          <p>Best means highest SWE-Bench Pro score, with lower cost as the tiebreaker.</p>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Model</th>
              <th>Cost / 1M</th>
              <th>SWE Pro</th>
              <th>Speed</th>
              <th>Target hardware / provider</th>
            </tr>
          </thead>
          <tbody>
            {[bestCloud, bestLocal].filter(isDefined).map((row) => (
              <tr key={row.id}>
                <td>{row.category}</td>
                <td>{row.name}</td>
                <td>{formatCurrency(row.costPerM)}</td>
                <td>{row.sweScore}%</td>
                <td>
                  {row.estimatedTokensPerSecond === null
                    ? 'N/A'
                    : `~${row.estimatedTokensPerSecond} tok/s`}
                </td>
                <td>{row.hardwareOrProvider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function pickBestModel(rows: PlotRow[]) {
  return [...rows].sort((left, right) => {
    if (right.sweScore !== left.sweScore) {
      return right.sweScore - left.sweScore
    }

    return left.costPerM - right.costPerM
  })[0]
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export default App
