// Block ids and the texture atlas. Every texture is drawn procedurally at
// runtime, so the theme ships no game assets.

export const AIR = 0
export const GRASS = 1
export const DIRT = 2
export const STONE = 3
export const COBBLE = 4
export const PLANKS = 5
export const LOG = 6
export const LEAVES = 7
export const GLASS = 8
export const SAND = 9
export const LAMP = 10
export const WATER = 11
export const BEDROCK = 12
export const IRON = 13
export const BEACON = 14
export const LAMP_OFF = 15
export const BRICK = 16
export const SNOW = 17

export const BLOCK_NAMES: Record<number, string> = {
  [GRASS]: '草方块',
  [DIRT]: '泥土',
  [STONE]: '石头',
  [COBBLE]: '圆石',
  [PLANKS]: '木板',
  [LOG]: '原木',
  [LEAVES]: '树叶',
  [GLASS]: '玻璃',
  [SAND]: '沙子',
  [LAMP]: '荧石灯',
  [BRICK]: '砖块',
  [SNOW]: '雪块',
}

/** 快捷栏里可以放置的方块 */
export const HOTBAR = [GRASS, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, SAND, LAMP]

const TRANSPARENT = new Set([AIR, LEAVES, GLASS, WATER])
const NON_SOLID = new Set([AIR, WATER])
export const isTransparent = (id: number) => TRANSPARENT.has(id)
export const isSolid = (id: number) => !NON_SOLID.has(id)

// ===== atlas =====
export const TILE = 16
const COLS = 8
const ROWS = 4
const T = {
  grassTop: 0, grassSide: 1, dirt: 2, stone: 3, cobble: 4, planks: 5, logSide: 6, logTop: 7,
  leaves: 8, glass: 9, sand: 10, lamp: 11, water: 12, bedrock: 13, iron: 14, beacon: 15,
  lampOff: 16, brick: 17, snow: 18,
}

/** [top, bottom, side] tile for each block */
const FACES: Record<number, [number, number, number]> = {
  [GRASS]: [T.grassTop, T.dirt, T.grassSide],
  [DIRT]: [T.dirt, T.dirt, T.dirt],
  [STONE]: [T.stone, T.stone, T.stone],
  [COBBLE]: [T.cobble, T.cobble, T.cobble],
  [PLANKS]: [T.planks, T.planks, T.planks],
  [LOG]: [T.logTop, T.logTop, T.logSide],
  [LEAVES]: [T.leaves, T.leaves, T.leaves],
  [GLASS]: [T.glass, T.glass, T.glass],
  [SAND]: [T.sand, T.sand, T.sand],
  [LAMP]: [T.lamp, T.lamp, T.lamp],
  [WATER]: [T.water, T.water, T.water],
  [BEDROCK]: [T.bedrock, T.bedrock, T.bedrock],
  [IRON]: [T.iron, T.iron, T.iron],
  [BEACON]: [T.beacon, T.beacon, T.beacon],
  [LAMP_OFF]: [T.lampOff, T.lampOff, T.lampOff],
  [BRICK]: [T.brick, T.brick, T.brick],
  [SNOW]: [T.snow, T.snow, T.snow],
}

/** face: 0 top, 1 bottom, 2 side */
export function tileOf(id: number, face: 0 | 1 | 2): number {
  return FACES[id]?.[face] ?? T.stone
}
export function tileUV(tile: number): [number, number, number, number] {
  const inset = 0.02 / TILE
  const u = (tile % COLS) / COLS
  const v = 1 - (Math.floor(tile / COLS) + 1) / ROWS
  return [u + inset, v + inset, u + 1 / COLS - inset, v + 1 / ROWS - inset]
}
/** CSS background-position (in tiles) for drawing a block icon from the atlas */
export function iconTile(id: number): { col: number, row: number, cols: number, rows: number } {
  const tile = tileOf(id, 2)
  return { col: tile % COLS, row: Math.floor(tile / COLS), cols: COLS, rows: ROWS }
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
type RGB = [number, number, number]
function shade([r, g, b]: RGB, k: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${c(r)},${c(g)},${c(b)})`
}

let atlasCanvas: HTMLCanvasElement | null = null
export function getAtlas(): HTMLCanvasElement {
  if (atlasCanvas)
    return atlasCanvas
  const canvas = document.createElement('canvas')
  canvas.width = COLS * TILE
  canvas.height = ROWS * TILE
  const ctx = canvas.getContext('2d')!
  const at = (tile: number) => [(tile % COLS) * TILE, Math.floor(tile / COLS) * TILE] as const

  // speckled fill: base colour with per-pixel brightness noise
  const speckle = (tile: number, base: RGB, spread: number, seed: number) => {
    const [ox, oy] = at(tile)
    const rand = rng(seed)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        ctx.fillStyle = shade(base, 1 - spread / 2 + rand() * spread)
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
  const px = (tile: number, x: number, y: number, w: number, h: number, color: string) => {
    const [ox, oy] = at(tile)
    ctx.fillStyle = color
    ctx.fillRect(ox + x, oy + y, w, h)
  }

  speckle(T.grassTop, [104, 168, 72], 0.3, 11)
  speckle(T.dirt, [134, 96, 67], 0.3, 12)
  speckle(T.grassSide, [134, 96, 67], 0.3, 13)
  {
    const rand = rng(14)
    for (let x = 0; x < TILE; x++) {
      const depth = 3 + Math.floor(rand() * 3)
      for (let y = 0; y < depth; y++)
        px(T.grassSide, x, y, 1, 1, shade([104, 168, 72], 0.85 + rand() * 0.3))
    }
  }
  speckle(T.stone, [128, 128, 128], 0.18, 15)
  speckle(T.cobble, [122, 122, 122], 0.42, 16)
  {
    const rand = rng(17)
    for (let i = 0; i < 9; i++)
      px(T.cobble, Math.floor(rand() * 14), Math.floor(rand() * 14), 3, 1, 'rgba(40,40,40,0.55)')
  }
  speckle(T.planks, [176, 142, 88], 0.14, 18)
  for (const y of [3, 7, 11, 15])
    px(T.planks, 0, y, TILE, 1, 'rgba(70,50,25,0.55)')
  px(T.planks, 5, 0, 1, 3, 'rgba(70,50,25,0.45)')
  px(T.planks, 11, 4, 1, 3, 'rgba(70,50,25,0.45)')
  px(T.planks, 3, 8, 1, 3, 'rgba(70,50,25,0.45)')
  px(T.planks, 13, 12, 1, 3, 'rgba(70,50,25,0.45)')
  speckle(T.logSide, [104, 82, 50], 0.22, 19)
  for (const x of [2, 6, 9, 13])
    px(T.logSide, x, 0, 1, TILE, 'rgba(50,36,18,0.5)')
  speckle(T.logTop, [176, 142, 88], 0.12, 20)
  px(T.logTop, 0, 0, TILE, 1, shade([104, 82, 50], 1))
  px(T.logTop, 0, 15, TILE, 1, shade([104, 82, 50], 1))
  px(T.logTop, 0, 0, 1, TILE, shade([104, 82, 50], 1))
  px(T.logTop, 15, 0, 1, TILE, shade([104, 82, 50], 1))
  for (const r of [3, 5]) {
    px(T.logTop, r, r, 16 - 2 * r, 1, 'rgba(90,64,32,0.45)')
    px(T.logTop, r, 15 - r, 16 - 2 * r, 1, 'rgba(90,64,32,0.45)')
    px(T.logTop, r, r, 1, 16 - 2 * r, 'rgba(90,64,32,0.45)')
    px(T.logTop, 15 - r, r, 1, 16 - 2 * r, 'rgba(90,64,32,0.45)')
  }
  {
    // leaves: opaque greens with see-through holes
    const [ox, oy] = at(T.leaves)
    const rand = rng(21)
    ctx.clearRect(ox, oy, TILE, TILE)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        if (rand() < 0.2)
          continue
        ctx.fillStyle = shade([62, 132, 50], 0.75 + rand() * 0.5)
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
  {
    const [ox, oy] = at(T.glass)
    ctx.clearRect(ox, oy, TILE, TILE)
    ctx.fillStyle = 'rgba(200,230,255,0.18)'
    ctx.fillRect(ox, oy, TILE, TILE)
    ctx.strokeStyle = 'rgba(225,242,255,0.95)'
    ctx.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1)
    px(T.glass, 3, 3, 3, 1, 'rgba(255,255,255,0.8)')
    px(T.glass, 3, 4, 1, 2, 'rgba(255,255,255,0.8)')
  }
  speckle(T.sand, [219, 207, 163], 0.12, 22)
  speckle(T.lamp, [248, 208, 110], 0.3, 23)
  px(T.lamp, 4, 4, 8, 8, 'rgba(255,246,200,0.55)')
  {
    const [ox, oy] = at(T.water)
    ctx.clearRect(ox, oy, TILE, TILE)
    const rand = rng(24)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        ctx.fillStyle = `rgba(${48 + rand() * 18},${104 + rand() * 24},${214 + rand() * 30},0.62)`
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }
    }
  }
  speckle(T.bedrock, [70, 70, 70], 0.7, 25)
  speckle(T.iron, [216, 216, 216], 0.08, 26)
  px(T.iron, 0, 0, TILE, 1, 'rgba(255,255,255,0.7)')
  px(T.iron, 0, 15, TILE, 1, 'rgba(110,110,110,0.7)')
  px(T.iron, 0, 5, TILE, 1, 'rgba(150,150,150,0.45)')
  px(T.iron, 0, 10, TILE, 1, 'rgba(150,150,150,0.45)')
  speckle(T.beacon, [150, 226, 232], 0.12, 27)
  px(T.beacon, 0, 0, TILE, 1, 'rgba(235,252,255,0.95)')
  px(T.beacon, 0, 15, TILE, 1, 'rgba(235,252,255,0.95)')
  px(T.beacon, 0, 0, 1, TILE, 'rgba(235,252,255,0.95)')
  px(T.beacon, 15, 0, 1, TILE, 'rgba(235,252,255,0.95)')
  px(T.beacon, 5, 5, 6, 6, 'rgba(255,255,255,0.92)')
  speckle(T.lampOff, [78, 52, 44], 0.3, 28)
  px(T.lampOff, 4, 4, 8, 8, 'rgba(40,24,20,0.6)')
  speckle(T.brick, [150, 82, 66], 0.16, 29)
  for (const y of [3, 7, 11, 15])
    px(T.brick, 0, y, TILE, 1, 'rgba(205,196,186,0.9)')
  for (const [x, y] of [[7, 0], [3, 4], [11, 4], [7, 8], [3, 12], [11, 12]] as const)
    px(T.brick, x, y, 1, 3, 'rgba(205,196,186,0.9)')
  speckle(T.snow, [240, 246, 250], 0.06, 30)

  atlasCanvas = canvas
  return canvas
}
