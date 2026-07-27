import { z } from 'zod'

export const playerEraSchema = z.enum(['2000s', '2010s', '2020s'])

export const positionSchema = z.enum(['PG', 'SG', 'SF', 'PF', 'C'])

export const playerSchema = z.object({
  id: z.string().min(1),
  player: z.string().min(1),
  year: z.string().regex(/^\d{4}-\d{2}$/),
  yearEnd: z.number().int().min(2000).max(2100),
  pts: z.number().min(0),
  ast: z.number().min(0),
  trb: z.number().min(0),
  mp: z.number().min(0),
  salary: z.number().int().min(0),
  rating: z.number().int().min(0).max(99),
  era: playerEraSchema,
  positions: z.array(positionSchema).min(1).max(5),
})

export const playerArraySchema = z.array(playerSchema)

export type PlayerEra = z.infer<typeof playerEraSchema>
export type Position = z.infer<typeof positionSchema>
export type Player = z.infer<typeof playerSchema>

export function parsePlayer(data: unknown): Player {
  return playerSchema.parse(data)
}

export function parsePlayers(data: unknown): Player[] {
  return playerArraySchema.parse(data)
}

export function safeParsePlayers(data: unknown) {
  return playerArraySchema.safeParse(data)
}

export function playerEligibleAt(player: Player, slot: Position): boolean {
  return player.positions.includes(slot)
}

export function formatPositions(positions: readonly Position[]): string {
  return positions.join(' / ')
}
