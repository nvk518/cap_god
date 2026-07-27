import { describe, expect, it } from 'vitest'
import { pickRandomChampion } from '../data/champions'

function createRng(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0
    index += 1
    return value
  }
}

describe('pickRandomChampion', () => {
  it('selects uniformly from the era pool', () => {
    const champion = pickRandomChampion('2000s', createRng([0.5]))
    expect(champion.era).toBe('2000s')
  })

  it('excludes the previous opponent when possible', () => {
    const excludeId = '2000-lakers'
    for (let index = 0; index < 50; index += 1) {
      const champion = pickRandomChampion('2000s', () => index / 50, excludeId)
      expect(champion.id).not.toBe(excludeId)
    }
  })
})
