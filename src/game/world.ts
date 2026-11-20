import { AIR, BEDROCK, CACTUS, COAL_ORE, DANDELION, DIAMOND_ORE, DIRT, GOLD_ORE, GRASS, ICE, IRON_ORE, LEAVES, LOG, POPPY, SAND, SANDSTONE, SNOWY_GRASS, STONE, TALL_GRASS, WATER } from './blocks'
import { fbm, hash2, hash3, mod, valueNoise } from './noise'

export const CHUNK = 16
export const HEIGHT = 72
export const SEA_LEVEL = 30
export const PLAZA_Y = 34

export type Biome = 'plains' | 'forest' | 'desert' | 'snow'
export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`
export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`

/**
 * An endless world made of 16x16 columns that are generated the first time
 * something asks for them. Terrain is a pure function of the seed; whatever
 * the player built and the node towers are layered on top.
 */
export class World {
  private chunks = new Map<string, Uint8Array>()
  /** blocks the player changed, grouped by chunk: local index -> block id */
  readonly edits = new Map<string, Map<number, number>>()
  /** blocks that belong to node towers, grouped by chunk; applied on generation */
  structures = new Map<string, [index: number, id: number][]>()
  /** radius of the flat plaza around the origin */
  plazaRadius = 20

  constructor(readonly seed: number) {}

  /** forget generated terrain (after the plaza or the structures change); edits are kept */
  invalidate(): void {
    this.chunks.clear()
  }

  dropChunk(cx: number, cz: number): void {
    this.chunks.delete(chunkKey(cx, cz))
  }

  static index(lx: number, y: number, lz: number): number {
    return (y * CHUNK + lz) * CHUNK + lx
  }

  // ----- terrain as pure functions of the coordinates -----
  heightAt(x: number, z: number): number {
    const seed = this.seed
    const continental = fbm(x / 190, z / 190, seed, 4)
    const hills = fbm(x / 52, z / 52, seed + 17, 4)
    const detail = valueNoise(x / 11, z / 11, seed + 29)
    const natural = 20 + continental * 22 + hills * 16 * (0.35 + continental) + detail * 2
    const distance = Math.hypot(x, z)
    const blend = Math.min(1, Math.max(0, (distance - this.plazaRadius) / 14))
    const smooth = blend * blend * (3 - 2 * blend)
    return Math.max(4, Math.min(HEIGHT - 12, Math.round(PLAZA_Y + (natural - PLAZA_Y) * smooth)))
  }

  biomeAt(x: number, z: number, height = this.heightAt(x, z)): Biome {
    if (Math.hypot(x, z) < this.plazaRadius + 8)
      return 'plains'
    const temperature = fbm(x / 280 + 40, z / 280 - 70, this.seed + 53, 3)
    if (temperature < 0.4 || height > 52)
      return 'snow'
    if (temperature > 0.6 && height < 44)
      return 'desert'
    return fbm(x / 90 - 20, z / 90 + 35, this.seed + 71, 3) > 0.52 ? 'forest' : 'plains'
  }

  /** height of the trunk of the tree rooted in this column, or 0 */
  private treeAt(x: number, z: number): number {
    if (Math.hypot(x, z) < this.plazaRadius + 5)
      return 0
    const height = this.heightAt(x, z)
    if (height <= SEA_LEVEL + 1)
      return 0
    const biome = this.biomeAt(x, z, height)
    const chance = biome === 'forest' ? 0.045 : biome === 'plains' ? 0.004 : biome === 'snow' ? 0.008 : 0
    if (hash2(x, z, this.seed + 99) >= chance)
      return 0
    return 4 + Math.floor(hash2(x, z, this.seed + 5) * 3)
  }

  private generate(cx: number, cz: number): Uint8Array {
    const data = new Uint8Array(CHUNK * HEIGHT * CHUNK)
    const x0 = cx * CHUNK
    const z0 = cz * CHUNK
    const seed = this.seed
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx
        const z = z0 + lz
        const top = this.heightAt(x, z)
        const biome = this.biomeAt(x, z, top)
        const beach = top <= SEA_LEVEL + 1
        const sandy = beach || biome === 'desert'
        for (let y = 0; y <= top; y++) {
          let id = STONE
          if (y === 0) {
            id = BEDROCK
          }
          else if (y === top) {
            id = sandy ? SAND : biome === 'snow' ? SNOWY_GRASS : GRASS
          }
          else if (y > top - 4) {
            id = sandy ? (y > top - 2 ? SAND : SANDSTONE) : DIRT
          }
          else {
            const roll = hash3(x, y, z, seed + 7)
            if (roll < 0.014)
              id = COAL_ORE
            else if (roll < 0.021 && y < 30)
              id = IRON_ORE
            else if (roll < 0.0235 && y < 18)
              id = GOLD_ORE
            else if (roll < 0.0248 && y < 12)
              id = DIAMOND_ORE
          }
          data[World.index(lx, y, lz)] = id
        }
        for (let y = top + 1; y <= SEA_LEVEL; y++)
          data[World.index(lx, y, lz)] = y === SEA_LEVEL && biome === 'snow' ? ICE : WATER
        // small plants and cacti on dry ground outside the plaza
        if (top > SEA_LEVEL && Math.hypot(x, z) > this.plazaRadius + 2) {
          const roll = hash2(x, z, seed + 131)
          if (biome === 'desert') {
            if (roll < 0.006) {
              const size = 2 + Math.floor(hash2(x, z, seed + 133) * 2)
              for (let i = 1; i <= size; i++)
                data[World.index(lx, top + i, lz)] = CACTUS
            }
          }
          else if (biome !== 'snow' && !beach) {
            if (roll < 0.11)
              data[World.index(lx, top + 1, lz)] = TALL_GRASS
            else if (roll < 0.122)
              data[World.index(lx, top + 1, lz)] = POPPY
            else if (roll < 0.134)
              data[World.index(lx, top + 1, lz)] = DANDELION
          }
        }
      }
    }
    // trees: a tree rooted up to two columns outside the chunk still reaches into it
    for (let z = z0 - 2; z < z0 + CHUNK + 2; z++) {
      for (let x = x0 - 2; x < x0 + CHUNK + 2; x++) {
        const trunk = this.treeAt(x, z)
        if (!trunk)
          continue
        const ground = this.heightAt(x, z)
        const put = (wx: number, wy: number, wz: number, id: number, replace: boolean) => {
          const lx = wx - x0
          const lz = wz - z0
          if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy >= HEIGHT)
            return
          const index = World.index(lx, wy, lz)
          if (replace || data[index] === AIR || data[index] === TALL_GRASS)
            data[index] = id
        }
        for (let dy = -2; dy <= 1; dy++) {
          const radius = dy >= 0 ? 1 : 2
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && (dy === 1 || hash3(x + dx, dy, z + dz, seed + 3) < 0.5))
                continue
              put(x + dx, ground + trunk + dy, z + dz, LEAVES, false)
            }
          }
        }
        for (let i = 1; i <= trunk; i++)
          put(x, ground + i, z, LOG, true)
      }
    }
    const key = chunkKey(cx, cz)
    for (const [index, id] of this.structures.get(key) ?? [])
      data[index] = id
    for (const [index, id] of this.edits.get(key) ?? [])
      data[index] = id
    return data
  }

  chunk(cx: number, cz: number): Uint8Array {
    const key = chunkKey(cx, cz)
    let data = this.chunks.get(key)
    if (!data) {
      data = this.generate(cx, cz)
      this.chunks.set(key, data)
    }
    return data
  }

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT)
      return AIR
    return this.chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK))[World.index(mod(x, CHUNK), y, mod(z, CHUNK))]!
  }

  /** change a block; `remember` records it as a player edit so it survives regeneration */
  set(x: number, y: number, z: number, id: number, remember: boolean): void {
    if (y < 1 || y >= HEIGHT)
      return
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    const index = World.index(mod(x, CHUNK), y, mod(z, CHUNK))
    this.chunk(cx, cz)[index] = id
    if (remember) {
      const key = chunkKey(cx, cz)
      let edits = this.edits.get(key)
      if (!edits) {
        edits = new Map()
        this.edits.set(key, edits)
      }
      edits.set(index, id)
    }
  }

  /** y of the highest block a player can stand on in this column */
  surface(x: number, z: number): number {
    const data = this.chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK))
    const lx = mod(x, CHUNK)
    const lz = mod(z, CHUNK)
    for (let y = HEIGHT - 1; y > 0; y--) {
      const id = data[World.index(lx, y, lz)]!
      if (id !== AIR && id !== LEAVES && id !== LOG && id !== TALL_GRASS && id !== POPPY && id !== DANDELION)
        return y
    }
    return 0
  }
}
