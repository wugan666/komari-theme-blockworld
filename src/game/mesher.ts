import type { World } from './world'
import { AIR, isTransparent, tileOf, tileUV, WATER } from './blocks'
import { CHUNK, WORLD_Y } from './world'

export interface ChunkGeometry {
  position: Float32Array
  uv: Float32Array
  color: Float32Array
  index: Uint32Array
}

// six faces: normal, four corner offsets (counter-clockwise seen from outside), brightness, atlas face
const FACE_DEFS = [
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], light: 1, face: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], light: 0.5, face: 1 },
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], light: 0.8, face: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], light: 0.8, face: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], light: 0.65, face: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], light: 0.65, face: 2 },
] as const

/** Build the opaque and the transparent mesh data of one 16x16 column of the world. */
export function meshChunk(world: World, cx: number, cz: number): { opaque: ChunkGeometry, transparent: ChunkGeometry } {
  const buffers = [0, 1].map(() => ({ position: [] as number[], uv: [] as number[], color: [] as number[], index: [] as number[] }))
  const x0 = cx * CHUNK
  const z0 = cz * CHUNK
  for (let y = 0; y < WORLD_Y; y++) {
    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        const id = world.get(x, y, z)
        if (id === AIR)
          continue
        const transparent = isTransparent(id)
        const out = buffers[transparent ? 1 : 0]!
        for (const def of FACE_DEFS) {
          const neighbour = world.get(x + def.n[0], y + def.n[1], z + def.n[2])
          // hidden when the neighbour is opaque, or the same see-through block (water next to water)
          if (!isTransparent(neighbour) || (transparent && neighbour === id))
            continue
          // the world's outer walls below ground never need drawing
          if (!world.inside(x + def.n[0], y + def.n[1], z + def.n[2]) && def.n[1] === 0 && id !== WATER && y < 4)
            continue
          const [u0, v0, u1, v1] = tileUV(tileOf(id, def.face))
          const base = out.position.length / 3
          const top = id === WATER && def.n[1] === 1 ? 0.88 : 1
          for (const corner of def.c) {
            out.position.push(x + corner[0], y + (corner[1] === 1 ? top : 0), z + corner[2])
            out.color.push(def.light, def.light, def.light)
          }
          out.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
          out.index.push(base, base + 1, base + 2, base, base + 2, base + 3)
        }
      }
    }
  }
  const pack = (b: typeof buffers[number]): ChunkGeometry => ({
    position: new Float32Array(b.position),
    uv: new Float32Array(b.uv),
    color: new Float32Array(b.color),
    index: new Uint32Array(b.index),
  })
  return { opaque: pack(buffers[0]!), transparent: pack(buffers[1]!) }
}
