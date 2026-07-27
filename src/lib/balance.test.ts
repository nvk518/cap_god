import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runBalanceSimulation } from './balance'

const dataDir = join(process.cwd(), 'public/data/players')

describe('balance simulation', () => {
  it('targets informed win rates in the 5–7% band per era', () => {
    const metrics = runBalanceSimulation(dataDir, 400, 42)

    // eslint-disable-next-line no-console
    console.table(
      metrics.map((entry) => ({
        era: entry.era,
        informed: `${(entry.informedWinRate * 100).toFixed(1)}%`,
        random: `${(entry.randomWinRate * 100).toFixed(1)}%`,
        legalCap: `${(entry.legalCapRate * 100).toFixed(1)}%`,
        bust: `${(entry.bustRate * 100).toFixed(1)}%`,
      })),
    )

    for (const entry of metrics) {
      expect(entry.duplicateOfferRate).toBe(0)
      expect(entry.informedWinRate).toBeGreaterThanOrEqual(0.05)
      expect(entry.informedWinRate).toBeLessThanOrEqual(0.07)

      const championRates = Object.entries(entry.perChampionWinRates).filter(
        ([championId]) => (entry.perChampionHands[championId] ?? 0) >= 20,
      )
      if (championRates.length > 0) {
        const maxRate = Math.max(...championRates.map(([, rate]) => rate))
        expect(maxRate).toBeLessThanOrEqual(0.35)
      }

      expect(entry.randomWinRate).toBeLessThanOrEqual(entry.informedWinRate + 0.05)
    }

    const aggregate =
      metrics.reduce((sum, entry) => sum + entry.informedWinRate, 0) / metrics.length
    expect(aggregate).toBeGreaterThanOrEqual(0.05)
    expect(aggregate).toBeLessThanOrEqual(0.07)
  }, 180_000)
})
