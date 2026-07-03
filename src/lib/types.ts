export type HostedModel = {
  modelId: string
  provider: string
  modelName: string
  inputUsdPerM: number
  outputUsdPerM: number
  cachedInputUsdPerM: number | null
  sweBenchVerifiedPct: number | null
  pricingSourceUrl: string
  benchmarkSourceUrl: string
  benchmarkLabel: string
  lastUpdated: string
}

export type LocalModel = {
  modelId: string
  modelName: string
  quantization: string
  minTolerableHardware: string
  hardwareCostUsd: number
  estimatedTokensPerSecond: number
  sweBenchVerifiedPct: number | null
  hardwareSourceUrl: string
  benchmarkSourceUrl: string
  benchmarkLabel: string
  notes: string
  lastUpdated: string
}

export type DashboardData = {
  generatedAt: string
  notes: string[]
  hostedModels: HostedModel[]
  localModels: LocalModel[]
}
