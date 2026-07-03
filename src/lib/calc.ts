export function calculateHostedBlendedCostPerM(
  inputUsdPerM: number,
  outputUsdPerM: number,
  inputRatio: number,
  outputRatio: number,
) {
  return inputUsdPerM * inputRatio + outputUsdPerM * outputRatio
}

export function calculateMonthlyAmortizedCost(hardwareCostUsd: number, amortizationMonths: number) {
  if (amortizationMonths <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return hardwareCostUsd / amortizationMonths
}

export function calculateLocalCostPerM(
  hardwareCostUsd: number,
  amortizationMonths: number,
  monthlyTokensMillions: number,
) {
  if (monthlyTokensMillions <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return calculateMonthlyAmortizedCost(hardwareCostUsd, amortizationMonths) / monthlyTokensMillions
}

export function calculateBreakEvenMonthlyTokens(
  hardwareCostUsd: number,
  amortizationMonths: number,
  hostedBlendedUsdPerM: number,
) {
  if (hostedBlendedUsdPerM <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return calculateMonthlyAmortizedCost(hardwareCostUsd, amortizationMonths) / hostedBlendedUsdPerM
}

export function calculateSweNormalizedCost(
  rawCostPerM: number,
  modelSweScore: number,
  baselineSweScore: number,
) {
  if (modelSweScore <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return rawCostPerM * (baselineSweScore / modelSweScore)
}

export function parsePositiveNumber(input: string, fallback: number) {
  const parsed = Number(input)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function formatCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 'N/A'
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 10 ? 1 : 2,
  }).format(value)
}
