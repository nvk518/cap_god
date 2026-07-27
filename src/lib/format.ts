import type { EraId } from '../types/game'

const MILLION = 1_000_000
const THOUSAND = 1_000

export function formatMillions(dollars: number): string {
  if (dollars < 100_000) {
    return `$${(dollars / THOUSAND).toFixed(0)}K`
  }
  const millions = dollars / MILLION
  return `$${millions.toFixed(1)}M`
}

export function formatSalary(salary: number): string {
  return formatMillions(salary)
}

export function formatCapPoints(points: number): string {
  return `${points} CP`
}

export function formatCapSpend(value: number, eraId: EraId): string {
  if (eraId === 'timeMachine') {
    return formatCapPoints(value)
  }
  return formatMillions(value)
}

export function formatCapLimit(cap: number, eraId: EraId): string {
  if (eraId === 'timeMachine') {
    return `${cap} Cap Points`
  }
  return formatMillions(cap)
}

export function formatStat(value: number): string {
  return value.toFixed(1)
}
