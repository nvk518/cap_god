import { parsePlayers, type Player, type PlayerEra } from '../schemas/player'
import type { EraId } from '../types/game'

const SUPPORTED_SCHEMA_VERSION = '1.1.0'
const DATA_BASE = `${import.meta.env.BASE_URL}data/players`

type EraCacheKey = PlayerEra | 'merged'

interface EraManifestEntry {
  file: string
  count: number
}

interface PlayerManifest {
  schemaVersion: string
  eras: Record<PlayerEra, EraManifestEntry>
}

const poolCache = new Map<EraCacheKey, Player[]>()
let manifestPromise: Promise<PlayerManifest> | null = null

async function fetchManifest(): Promise<PlayerManifest> {
  if (!manifestPromise) {
    manifestPromise = (async () => {
      const response = await fetch(`${DATA_BASE}/manifest.json`)
      if (!response.ok) {
        throw new Error(`Failed to load player manifest (${response.status})`)
      }

      const manifest = (await response.json()) as PlayerManifest

      if (manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
        throw new Error(
          `Unsupported player data version ${manifest.schemaVersion}. Expected ${SUPPORTED_SCHEMA_VERSION}.`,
        )
      }

      return manifest
    })()
  }

  return manifestPromise
}

async function fetchEraPlayers(era: PlayerEra): Promise<Player[]> {
  const cached = poolCache.get(era)
  if (cached) {
    return cached
  }

  const manifest = await fetchManifest()
  const eraEntry = manifest.eras[era]
  if (!eraEntry?.file) {
    throw new Error(`Player manifest is missing era entry for ${era}`)
  }

  const response = await fetch(`${DATA_BASE}/${eraEntry.file}`)

  if (!response.ok) {
    throw new Error(`Failed to load ${era} player pool (${response.status})`)
  }

  const raw = await response.json()
  const players = parsePlayers(raw)
  poolCache.set(era, players)
  return players
}

async function fetchMergedPlayers(): Promise<Player[]> {
  const cached = poolCache.get('merged')
  if (cached) {
    return cached
  }

  const eras: PlayerEra[] = ['2000s', '2010s', '2020s']
  const eraPools = await Promise.all(eras.map((era) => fetchEraPlayers(era)))
  const merged = eraPools.flat()
  poolCache.set('merged', merged)
  return merged
}

export async function loadPlayerPool(eraId: EraId): Promise<Player[]> {
  if (eraId === 'timeMachine') {
    return fetchMergedPlayers()
  }

  return fetchEraPlayers(eraId)
}

export function clearPlayerPoolCache(): void {
  poolCache.clear()
  manifestPromise = null
}
