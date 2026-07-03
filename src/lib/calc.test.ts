import {
  calculateBreakEvenMonthlyTokens,
  calculateHostedBlendedCostPerM,
  calculateLocalCostPerM,
  calculateMonthlyAmortizedCost,
  calculateSweNormalizedCost,
} from './calc'

describe('cost formulas', () => {
  it('blends hosted prices with the active token mix', () => {
    expect(calculateHostedBlendedCostPerM(2, 10, 0.7, 0.3)).toBeCloseTo(4.4)
  })

  it('computes monthly amortized hardware cost', () => {
    expect(calculateMonthlyAmortizedCost(1440, 24)).toBeCloseTo(60)
  })

  it('computes local cost per million tokens', () => {
    expect(calculateLocalCostPerM(1440, 24, 50)).toBeCloseTo(1.2)
  })

  it('treats zero local usage as non-comparable', () => {
    expect(calculateLocalCostPerM(1440, 24, 0)).toBe(Number.POSITIVE_INFINITY)
  })

  it('computes break-even token volume', () => {
    expect(calculateBreakEvenMonthlyTokens(1440, 24, 4)).toBeCloseTo(15)
  })

  it('computes SWE-normalized cost', () => {
    expect(calculateSweNormalizedCost(6, 50, 75)).toBeCloseTo(9)
  })
})
