import type { PlayerEra } from '../schemas/player'
import type { ChampionTeam, EraId } from '../types/game'

type RandomSource = () => number

export const CHAMPION_TEAMS: readonly ChampionTeam[] = [
  { id: '2000-lakers', name: "'00 Lakers", rating: 112, era: '2000s', seasonYear: 2000 },
  { id: '2001-lakers', name: "'01 Lakers", rating: 114, era: '2000s', seasonYear: 2001 },
  { id: '2002-lakers', name: "'02 Lakers", rating: 113, era: '2000s', seasonYear: 2002 },
  { id: '2003-spurs', name: "'03 Spurs", rating: 110, era: '2000s', seasonYear: 2003 },
  { id: '2004-pistons', name: "'04 Pistons", rating: 109, era: '2000s', seasonYear: 2004 },
  { id: '2005-spurs', name: "'05 Spurs", rating: 111, era: '2000s', seasonYear: 2005 },
  { id: '2006-heat', name: "'06 Heat", rating: 110, era: '2000s', seasonYear: 2006 },
  { id: '2007-spurs', name: "'07 Spurs", rating: 112, era: '2000s', seasonYear: 2007 },
  { id: '2008-celtics', name: "'08 Celtics", rating: 112, era: '2000s', seasonYear: 2008 },
  { id: '2009-lakers', name: "'09 Lakers", rating: 111, era: '2000s', seasonYear: 2009 },
  { id: '2010-lakers', name: "'10 Lakers", rating: 111, era: '2010s', seasonYear: 2010 },
  { id: '2011-mavericks', name: "'11 Mavs", rating: 108, era: '2010s', seasonYear: 2011 },
  { id: '2012-heat', name: "'12 Heat", rating: 114, era: '2010s', seasonYear: 2012 },
  { id: '2013-heat', name: "'13 Heat", rating: 115, era: '2010s', seasonYear: 2013 },
  { id: '2014-spurs', name: "'14 Spurs", rating: 112, era: '2010s', seasonYear: 2014 },
  { id: '2015-warriors', name: "'15 Warriors", rating: 114, era: '2010s', seasonYear: 2015 },
  { id: '2016-cavs', name: "'16 Cavs", rating: 113, era: '2010s', seasonYear: 2016 },
  { id: '2017-warriors', name: "'17 Warriors", rating: 118, era: '2010s', seasonYear: 2017 },
  { id: '2018-warriors', name: "'18 Warriors", rating: 116, era: '2010s', seasonYear: 2018 },
  { id: '2019-raptors', name: "'19 Raptors", rating: 111, era: '2010s', seasonYear: 2019 },
  { id: '2020-lakers', name: "'20 Lakers", rating: 111, era: '2020s', seasonYear: 2020 },
  { id: '2021-bucks', name: "'21 Bucks", rating: 112, era: '2020s', seasonYear: 2021 },
  { id: '2022-warriors', name: "'22 Warriors", rating: 110, era: '2020s', seasonYear: 2022 },
  { id: '2023-nuggets', name: "'23 Nuggets", rating: 113, era: '2020s', seasonYear: 2023 },
  { id: '2024-celtics', name: "'24 Celtics", rating: 114, era: '2020s', seasonYear: 2024 },
  { id: '2025-thunder', name: "'25 Thunder", rating: 113, era: '2020s', seasonYear: 2025 },
] as const

const CHAMPIONS_BY_ERA: Record<PlayerEra, readonly ChampionTeam[]> = {
  '2000s': CHAMPION_TEAMS.filter((champion) => champion.era === '2000s'),
  '2010s': CHAMPION_TEAMS.filter((champion) => champion.era === '2010s'),
  '2020s': CHAMPION_TEAMS.filter((champion) => champion.era === '2020s'),
}

const CHAMPIONS_BY_ERA_ORDERED: Record<PlayerEra, readonly ChampionTeam[]> = {
  '2000s': [...CHAMPIONS_BY_ERA['2000s']].sort((a, b) => a.seasonYear - b.seasonYear),
  '2010s': [...CHAMPIONS_BY_ERA['2010s']].sort((a, b) => a.seasonYear - b.seasonYear),
  '2020s': [...CHAMPIONS_BY_ERA['2020s']].sort((a, b) => a.seasonYear - b.seasonYear),
}

const TIME_MACHINE_ORDERED = [...CHAMPION_TEAMS].sort((a, b) => a.seasonYear - b.seasonYear)

export function getChampionsByEra(era: PlayerEra): readonly ChampionTeam[] {
  return CHAMPIONS_BY_ERA[era]
}

export function getChampionsByEraOrdered(eraId: EraId): readonly ChampionTeam[] {
  if (eraId === 'timeMachine') {
    return TIME_MACHINE_ORDERED
  }
  return CHAMPIONS_BY_ERA_ORDERED[eraId]
}

export function getChampionById(id: string): ChampionTeam | undefined {
  return CHAMPION_TEAMS.find((champion) => champion.id === id)
}

export function getNextChampion(
  eraId: EraId,
  defeatedIds: readonly string[],
): ChampionTeam | null {
  const champions = getChampionsByEraOrdered(eraId)
  return champions.find((champion) => !defeatedIds.includes(champion.id)) ?? null
}

export function isEraComplete(eraId: EraId, defeatedIds: readonly string[]): boolean {
  const champions = getChampionsByEraOrdered(eraId)
  return champions.length > 0 && champions.every((champion) => defeatedIds.includes(champion.id))
}

export function pickRandomChampion(eraId: EraId, rng: RandomSource): ChampionTeam {
  const pool = eraId === 'timeMachine' ? CHAMPION_TEAMS : CHAMPIONS_BY_ERA[eraId]
  const index = Math.floor(rng() * pool.length)
  const champion = pool[index]

  if (!champion) {
    throw new RangeError(`No champion available for era ${eraId}`)
  }

  return champion
}
