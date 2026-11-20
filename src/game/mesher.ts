import type { World } from './world'
import { AIR, isCross, isCutout, isEmissive, isTransparent, tileOf, tileUV, WATER } from './blocks'
import { CHUNK, HEIGHT } from './world'

export interface MeshData {
  position: Float32Array
  uv: Float32Array
  /** face shading multiplied by ambient occlusion */
  light: Float32Array
  /** 0 normal, 1 emissive, 2 water surface, 3 swaying plant top */
  kind: Float32Array
  index: Uint32Array
}

// six faces: normal, corners counter-clockwise seen from outside, shading, atlas face.
// The corner order is bottom-left, bottom-right, top-right, top-left of the texture.
const FACES = [
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], light: 1, face: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], light: 0.5, face: 1 },
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], light: 0.62, face: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], light: 0.62, face: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], light: 0.8, face: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], light: 0.8, face: 2 },
] as const
const AO = [0.5, 0.68, 0.84, 1]

class Builder {
  position: number[] = []
  uv: number[] = []
  light: number[] = []
  kind: number[] = []
  index: number[] = []
  pack(): MeshData {
    return {
      position: new Float32Array(this.position),
      uv: new Float32Array(this.uv),
      light: new Float32Array(this.light),
      kind: new Float32Array(this.kind),
      index: new Uint32Array(this.index),
    }
  }
}

/**
 * Mesh one chunk into three buckets: opaque blocks, alpha-tested ones (leaves,
 * glass, plants) and blended ones (water, ice). Each vertex carries smooth
 * ambient occlusion sampled from the three blocks around its corner.
 */
export function meshChunk(world: World, cx: number, cz: number): { opaque: MeshData, cutout: MeshData, blended: MeshData } {
  const opaque = new Builder()
  const cutout = new Builder()
  const blended = new Builder()
  const x0 = cx * CHUNK
  const z0 = cz * CHUNK
  // copy this chunk plus a one-block border into a flat array so neighbour lookups are cheap
  const S = CHUNK + 2
  const pad = new Uint8Array(S * (HEIGHT + 2) * S)
  const at = (x: number, y: number, z: number) => pad[((y + 1) * S + (z + 1)) * S + (x + 1)]!
  for (let y = 0; y < HEIGHT; y++) {
    for (let z = -1; z <= CHUNK; z++) {
      for (let x = -1; x <= CHUNK; x++)
        pad[((y + 1) * S + (z + 1)) * S + (x + 1)] = world.get(x0 + x, y, z0 + z)
    }
  }
  const occludes = (x: number, y: number, z: number) => {
    const id = at(x, y, z)
    return id !== AIR && !isTransparent(id) ? 1 : 0
  }

  for (let y = 0; y < HEIGHT; y++) {
    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const id = at(x, y, z)
        if (id === AIR)
          continue
        const wx = x0 + x
        const wz = z0 + z
        if (isCross(id)) {
          // two crossed planes; the top vertices sway in the vertex shader
          const [u0, v0, u1, v1] = tileUV(tileOf(id, 2))
          for (const [ax, az, bx, bz] of [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]] as const) {
            const base = cutout.position.length / 3
            cutout.position.push(wx + ax, y, wz + az, wx + bx, y, wz + bz, wx + bx, y + 1, wz + bz, wx + ax, y + 1, wz + az)
            cutout.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
            cutout.light.push(0.95, 0.95, 0.95, 0.95)
            cutout.kind.push(0, 0, 3, 3)
            cutout.index.push(base, base + 1, base + 2, base, base + 2, base + 3)
          }
          continue
        }
        const transparent = isTransparent(id)
        const out = id === WATER || (transparent && !isCutout(id)) ? blended : isCutout(id) ? cutout : opaque
        const emissive = isEmissive(id) ? 1 : 0
        for (const def of FACES) {
          const nx = x + def.n[0]
          const ny = y + def.n[1]
          const nz = z + def.n[2]
          const neighbour = ny < 0 ? id : at(nx, ny, nz)
          // hidden behind an opaque block, or between two blocks of the same see-through kind
          if (!isTransparent(neighbour) || (transparent && neighbour === id))
            continue
          const [u0, v0, u1, v1] = tileUV(tileOf(id, def.face))
          const base = out.position.length / 3
          const water = id === WATER
          const lights = [0, 0, 0, 0]
          for (let i = 0; i < 4; i++) {
            const corner = def.c[i]!
            // the two edge neighbours and the diagonal one, in the layer in front of the face
            let side1 = 0
            let side2 = 0
            let diagonal = 0
            if (!transparent) {
              const sx = corner[0] * 2 - 1
              const sy = corner[1] * 2 - 1
              const sz = corner[2] * 2 - 1
              if (def.n[0] !== 0) {
                side1 = occludes(nx, y + sy, z)
                side2 = occludes(nx, y, z + sz)
                diagonal = occludes(nx, y + sy, z + sz)
              }
              else if (def.n[1] !== 0) {
                side1 = occludes(x + sx, ny, z)
                side2 = occludes(x, ny, z + sz)
                diagonal = occludes(x + sx, ny, z + sz)
              }
              else {
                side1 = occludes(x + sx, y, nz)
                side2 = occludes(x, y + sy, nz)
                diagonal = occludes(x + sx, y + sy, nz)
              }
            }
            const level = side1 && side2 ? 0 : 3 - side1 - side2 - diagonal
            lights[i] = def.light * AO[level]!
            out.position.push(wx + corner[0], y + corner[1], wz + corner[2])
            out.light.push(lights[i]!)
            out.kind.push(water && corner[1] === 1 ? 2 : emissive)
          }
          out.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
          // split the quad along the brighter diagonal so occlusion gradients do not flip direction
          if (lights[0]! + lights[2]! > lights[1]! + lights[3]!)
            out.index.push(base, base + 1, base + 2, base, base + 2, base + 3)
          else
            out.index.push(base + 1, base + 2, base + 3, base + 1, base + 3, base)
        }
      }
    }
  }
  return { opaque: opaque.pack(), cutout: cutout.pack(), blended: blended.pack() }
}
