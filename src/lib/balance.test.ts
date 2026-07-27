import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runBalanceSimulation } from './balance'

const dataDir = join(process.cwd(), 'public/data/players')

describe('balance simulation', () => {
  it('targets informed win rates in normal and hard ranges', () => {
    const metrics = runBalanceSimulation(dataDir, 120, 42)

    for (const entry of metrics) {
      expect(entry.duplicateOfferRate).toBe(0)

      if (entry.difficulty === 'normal') {
        expect(entry.informedWinRate).toBeGreaterThanOrEqual(0.2)
        expect(entry.informedWinRate).toBeLessThanOrEqual(0.65)
      } else {
        expect(entry.informedWinRate).toBeGreaterThanOrEqual(0.05)
        expect(entry.informedWinRate).toBeLessThanOrEqual(0.35)
      }

      expect(entry.randomWinRate).toBeLessThanOrEqual(entry.informedWinRate + 0.15)
    }

    // eslint-disable-next-line no-console
    console.table(
      metrics.map((entry) => ({
        era: entry.era,
        difficulty: entry.difficulty,
        informed: `${(entry.informedWinRate * 100).toFixed(1)}%`,
        random: `${(entry.randomWinRate * 100).toFixed(1)}%`,
        legalCap: `${(entry.legalCapRate * 100).toFixed(1)}%`,
        bust: `${(entry.bustRate * 100).toFixed(1)}%`,
      })),
    )
  }, 120_000)
})
