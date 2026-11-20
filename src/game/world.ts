import { AIR, BEDROCK, DIRT, GRASS, LEAVES, LOG, SAND, SNOW, STONE, WATER } from './blocks'

export const WORLD_X = 96
export const WORLD_Y = 48
export const WORLD_Z = 96
export const CHUNK = 16
export const SEA_LEVEL = 11
export const PLAZA_Y = 14
export const CENTER_X = WORLD_X / 2
export const CENTER_Z = WORLD_Z / 2

function hash2(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 1442695041) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fz = z - z0
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const a = hash2(x0, z0, seed)
  const b = hash2(x0 + 1, z0, seed)
  const c = hash2(x0, z0 + 1, seed)
  const d = hash2(x0 + 1, z0 + 1, seed)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}

export class World {
  readonly blocks = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z)
  /** blocks the player changed: index -> block id (persisted by the engine) */
  readonly edits = new Map<number, number>()
  /** radius of the flat plaza the node towers stand on */
  plazaRadius = 22

  constructor(readonly seed: number, plazaRadius: number) {
    this.plazaRadius = plazaRadius
    this.generate()
  }

  index(x: number, y: number, z: number): number {
    return (y * WORLD_Z + z) * WORLD_X + x
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && x < WORLD_X && y >= 0 && y < WORLD_Y && z >= 0 && z < WORLD_Z
  }

  get(x: number, y: number, z: number): number {
    return this.inside(x, y, z) ? this.blocks[this.index(x, y, z)]! : AIR
  }

  set(x: number, y: number, z: number, id: number): void {
    if (this.inside(x, y, z))
      this.blocks[this.index(x, y, z)] = id
  }

  /** highest non-air, non-leaf block in a column */
  surface(x: number, z: number): number {
    for (let y = WORLD_Y - 1; y >= 0; y--) {
      const id = this.get(x, y, z)
      if (id !== AIR && id !== LEAVES && id !== LOG)
        return y
    }
    return 0
  }

  private height(x: number, z: number): number {
    const seed = this.seed
    const hills = valueNoise(x / 26, z / 26, seed) * 13 + valueNoise(x / 9, z / 9, seed + 7) * 4 + valueNoise(x / 4, z / 4, seed + 13) * 1.2
    const natural = 6 + hills
    // blend into a flat plaza around the centre
    const distance = Math.hypot(x - CENTER_X, z - CENTER_Z)
    const blend = Math.min(1, Math.max(0, (distance - this.plazaRadius) / 9))
    const smooth = blend * blend * (3 - 2 * blend)
    return Math.round(PLAZA_Y + (natural - PLAZA_Y) * smooth)
  }

  private generate(): void {
    for (let z = 0; z < WORLD_Z; z++) {
      for (let x = 0; x < WORLD_X; x++) {
        const top = Math.max(2, Math.min(WORLD_Y - 12, this.height(x, z)))
        const beach = top <= SEA_LEVEL + 1
        for (let y = 0; y <= top; y++) {
          let id = STONE
          if (y === 0)
            id = BEDROCK
          else if (y === top)
            id = beach ? SAND : top >= 25 ? SNOW : GRASS
          else if (y > top - 4)
            id = beach ? SAND : DIRT
          this.set(x, y, z, id)
        }
        for (let y = top + 1; y <= SEA_LEVEL; y++)
          this.set(x, y, z, WATER)
      }
    }
    // trees outside the plaza
    for (let z = 3; z < WORLD_Z - 3; z++) {
      for (let x = 3; x < WORLD_X - 3; x++) {
        if (hash2(x, z, this.seed + 99) > 0.012)
          continue
        if (Math.hypot(x - CENTER_X, z - CENTER_Z) < this.plazaRadius + 4)
          continue
        const ground = this.surface(x, z)
        if (this.get(x, ground, z) !== GRASS)
          continue
        const trunk = 4 + Math.floor(hash2(x, z, this.seed + 5) * 2)
        for (let y = 1; y <= trunk; y++)
          this.set(x, ground + y, z, LOG)
        for (let dy = -2; dy <= 1; dy++) {
          const radius = dy >= 0 ? 1 : 2
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 1 || hash2(x + dx, z + dz, dy + 40) < 0.5))
                continue
              const lx = x + dx
              const ly = ground + trunk + dy
              const lz = z + dz
              if (this.get(lx, ly, lz) === AIR)
                this.set(lx, ly, lz, LEAVES)
            }
          }
        }
      }
    }
  }

  applyEdits(entries: Iterable<[number, number]>): void {
    for (const [index, id] of entries) {
      if (index >= 0 && index < this.blocks.length) {
        this.blocks[index] = id
        this.edits.set(index, id)
      }
    }
  }
}
