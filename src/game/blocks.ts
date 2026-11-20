// Block table and the texture atlas. Every texture is painted by code at
// startup, so the theme ships no game assets.

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
export const SNOW = 15
export const BRICK = 16
export const ICE = 17
export const COAL_ORE = 18
export const IRON_ORE = 19
export const GOLD_ORE = 20
export const DIAMOND_ORE = 21
export const SANDSTONE = 22
export const STONE_BRICK = 23
export const CACTUS = 24
export const TALL_GRASS = 25
export const POPPY = 26
export const DANDELION = 27
export const OBSIDIAN = 28
export const BOOKSHELF = 29
export const BIRCH_PLANKS = 30
export const WOOL_WHITE = 31
export const WOOL_RED = 32
export const WOOL_BLUE = 33
export const WOOL_YELLOW = 34
export const WOOL_GREEN = 35
export const WOOL_BLACK = 36
export const GOLD_BLOCK = 37
export const DIAMOND_BLOCK = 38
export const SNOWY_GRASS = 39

export const TILE = 16
const COLS = 8
const ROWS = 8
const T = {
  grassTop: 0, grassSide: 1, dirt: 2, stone: 3, cobble: 4, planks: 5, logSide: 6, logTop: 7,
  leaves: 8, glass: 9, sand: 10, lamp: 11, water: 12, bedrock: 13, iron: 14, beacon: 15,
  snow: 16, brick: 17, ice: 18, coal: 19, ironOre: 20, goldOre: 21, diamondOre: 22, sandstone: 23,
  sandstoneTop: 24, stoneBrick: 25, cactus: 26, cactusTop: 27, tallGrass: 28, poppy: 29, dandelion: 30, obsidian: 31,
  bookshelf: 32, birch: 33, woolWhite: 34, woolRed: 35, woolBlue: 36, woolYellow: 37, woolGreen: 38, woolBlack: 39,
  gold: 40, diamond: 41, snowySide: 42,
  crack0: 48, crack1: 49, crack2: 50, crack3: 51, crack4: 52,
}

type Sound = 'stone' | 'dirt' | 'wood' | 'glass' | 'sand' | 'plant' | 'cloth'
interface BlockDef {
  name: string
  /** [top, bottom, side] */
  tiles: [number, number, number]
  /** blocks movement */
  solid?: boolean
  /** lets neighbouring faces show through */
  transparent?: boolean
  /** drawn as two crossed planes (flowers, grass) */
  cross?: boolean
  /** needs alpha testing */
  cutout?: boolean
  /** ignores the time of day */
  emissive?: boolean
  /** seconds of digging */
  hardness: number
  sound: Sound
}
const same = (tile: number): [number, number, number] => [tile, tile, tile]
const DEFS: Record<number, BlockDef> = {
  [GRASS]: { name: '草方块', tiles: [T.grassTop, T.dirt, T.grassSide], hardness: 0.35, sound: 'dirt' },
  [SNOWY_GRASS]: { name: '积雪的草方块', tiles: [T.snow, T.dirt, T.snowySide], hardness: 0.35, sound: 'dirt' },
  [DIRT]: { name: '泥土', tiles: same(T.dirt), hardness: 0.3, sound: 'dirt' },
  [STONE]: { name: '石头', tiles: same(T.stone), hardness: 0.75, sound: 'stone' },
  [COBBLE]: { name: '圆石', tiles: same(T.cobble), hardness: 0.8, sound: 'stone' },
  [PLANKS]: { name: '橡木木板', tiles: same(T.planks), hardness: 0.55, sound: 'wood' },
  [BIRCH_PLANKS]: { name: '白桦木板', tiles: same(T.birch), hardness: 0.55, sound: 'wood' },
  [LOG]: { name: '橡木原木', tiles: [T.logTop, T.logTop, T.logSide], hardness: 0.6, sound: 'wood' },
  [LEAVES]: { name: '树叶', tiles: same(T.leaves), transparent: true, cutout: true, hardness: 0.15, sound: 'plant' },
  [GLASS]: { name: '玻璃', tiles: same(T.glass), transparent: true, cutout: true, hardness: 0.2, sound: 'glass' },
  [SAND]: { name: '沙子', tiles: same(T.sand), hardness: 0.3, sound: 'sand' },
  [SANDSTONE]: { name: '砂岩', tiles: [T.sandstoneTop, T.sandstoneTop, T.sandstone], hardness: 0.6, sound: 'stone' },
  [LAMP]: { name: '荧石', tiles: same(T.lamp), emissive: true, hardness: 0.25, sound: 'glass' },
  [WATER]: { name: '水', tiles: same(T.water), solid: false, transparent: true, hardness: 9, sound: 'sand' },
  [BEDROCK]: { name: '基岩', tiles: same(T.bedrock), hardness: Infinity, sound: 'stone' },
  [IRON]: { name: '铁块', tiles: same(T.iron), hardness: 0.9, sound: 'stone' },
  [GOLD_BLOCK]: { name: '金块', tiles: same(T.gold), hardness: 0.8, sound: 'stone' },
  [DIAMOND_BLOCK]: { name: '钻石块', tiles: same(T.diamond), hardness: 0.9, sound: 'stone' },
  [BEACON]: { name: '信标', tiles: same(T.beacon), emissive: true, hardness: 0.6, sound: 'glass' },
  [SNOW]: { name: '雪块', tiles: same(T.snow), hardness: 0.25, sound: 'sand' },
  [ICE]: { name: '冰', tiles: same(T.ice), hardness: 0.3, sound: 'glass' },
  [BRICK]: { name: '红砖块', tiles: same(T.brick), hardness: 0.8, sound: 'stone' },
  [STONE_BRICK]: { name: '石砖', tiles: same(T.stoneBrick), hardness: 0.8, sound: 'stone' },
  [COAL_ORE]: { name: '煤矿石', tiles: same(T.coal), hardness: 0.85, sound: 'stone' },
  [IRON_ORE]: { name: '铁矿石', tiles: same(T.ironOre), hardness: 0.9, sound: 'stone' },
  [GOLD_ORE]: { name: '金矿石', tiles: same(T.goldOre), hardness: 0.9, sound: 'stone' },
  [DIAMOND_ORE]: { name: '钻石矿石', tiles: same(T.diamondOre), hardness: 1, sound: 'stone' },
  [OBSIDIAN]: { name: '黑曜石', tiles: same(T.obsidian), hardness: 1.4, sound: 'stone' },
  [BOOKSHELF]: { name: '书架', tiles: [T.planks, T.planks, T.bookshelf], hardness: 0.5, sound: 'wood' },
  [CACTUS]: { name: '仙人掌', tiles: [T.cactusTop, T.cactusTop, T.cactus], hardness: 0.25, sound: 'cloth' },
  [TALL_GRASS]: { name: '草丛', tiles: same(T.tallGrass), solid: false, transparent: true, cross: true, cutout: true, hardness: 0.05, sound: 'plant' },
  [POPPY]: { name: '虞美人', tiles: same(T.poppy), solid: false, transparent: true, cross: true, cutout: true, hardness: 0.05, sound: 'plant' },
  [DANDELION]: { name: '蒲公英', tiles: same(T.dandelion), solid: false, transparent: true, cross: true, cutout: true, hardness: 0.05, sound: 'plant' },
  [WOOL_WHITE]: { name: '白色羊毛', tiles: same(T.woolWhite), hardness: 0.3, sound: 'cloth' },
  [WOOL_RED]: { name: '红色羊毛', tiles: same(T.woolRed), hardness: 0.3, sound: 'cloth' },
  [WOOL_BLUE]: { name: '蓝色羊毛', tiles: same(T.woolBlue), hardness: 0.3, sound: 'cloth' },
  [WOOL_YELLOW]: { name: '黄色羊毛', tiles: same(T.woolYellow), hardness: 0.3, sound: 'cloth' },
  [WOOL_GREEN]: { name: '绿色羊毛', tiles: same(T.woolGreen), hardness: 0.3, sound: 'cloth' },
  [WOOL_BLACK]: { name: '黑色羊毛', tiles: same(T.woolBlack), hardness: 0.3, sound: 'cloth' },
}

// flat lookup tables: these are read millions of times while meshing
const SOLID = new Uint8Array(64)
const TRANSPARENT = new Uint8Array(64)
const CROSS = new Uint8Array(64)
const CUTOUT = new Uint8Array(64)
const EMISSIVE = new Uint8Array(64)
TRANSPARENT[AIR] = 1
for (const [key, def] of Object.entries(DEFS)) {
  const id = Number(key)
  SOLID[id] = def.solid === false ? 0 : 1
  TRANSPARENT[id] = def.transparent ? 1 : 0
  CROSS[id] = def.cross ? 1 : 0
  CUTOUT[id] = def.cutout ? 1 : 0
  EMISSIVE[id] = def.emissive ? 1 : 0
}
export const isSolid = (id: number) => SOLID[id] === 1
export const isTransparent = (id: number) => TRANSPARENT[id] === 1
export const isCross = (id: number) => CROSS[id] === 1
export const isCutout = (id: number) => CUTOUT[id] === 1
export const isEmissive = (id: number) => EMISSIVE[id] === 1
export const blockName = (id: number) => DEFS[id]?.name ?? ''
export const blockHardness = (id: number) => DEFS[id]?.hardness ?? 0.5
export const blockSound = (id: number): Sound => DEFS[id]?.sound ?? 'stone'

/** blocks offered in the creative inventory, in display order */
export const INVENTORY = [
  GRASS, DIRT, STONE, COBBLE, STONE_BRICK, SAND, SANDSTONE, SNOW, ICE,
  PLANKS, BIRCH_PLANKS, LOG, LEAVES, BOOKSHELF, BRICK, GLASS, LAMP, OBSIDIAN,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, IRON, GOLD_BLOCK, DIAMOND_BLOCK, CACTUS, TALL_GRASS,
  POPPY, DANDELION, WOOL_WHITE, WOOL_RED, WOOL_YELLOW, WOOL_GREEN, WOOL_BLUE, WOOL_BLACK, SNOWY_GRASS,
]
export const DEFAULT_HOTBAR = [GRASS, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, SAND, LAMP]

/** face: 0 top, 1 bottom, 2 side */
export function tileOf(id: number, face: 0 | 1 | 2): number {
  return DEFS[id]?.tiles[face] ?? T.stone
}
export function crackTile(stage: number): number {
  return T.crack0 + Math.max(0, Math.min(4, stage))
}
export function tileUV(tile: number): [number, number, number, number] {
  const inset = 0.02 / TILE
  const u = (tile % COLS) / COLS
  const v = 1 - (Math.floor(tile / COLS) + 1) / ROWS
  return [u + inset, v + inset, u + 1 / COLS - inset, v + 1 / ROWS - inset]
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}
type RGB = [number, number, number]
function shade([r, g, b]: RGB, k: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `rgb(${c(r)},${c(g)},${c(b)})`
}

let atlasCanvas: HTMLCanvasElement | null = null
const tileColors: RGB[] = []
export function getAtlas(): HTMLCanvasElement {
  if (atlasCanvas)
    return atlasCanvas
  const canvas = document.createElement('canvas')
  canvas.width = COLS * TILE
  canvas.height = ROWS * TILE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const at = (tile: number) => [(tile % COLS) * TILE, Math.floor(tile / COLS) * TILE] as const
  const clear = (tile: number) => {
    const [ox, oy] = at(tile)
    ctx.clearRect(ox, oy, TILE, TILE)
  }
  const px = (tile: number, x: number, y: number, w: number, h: number, color: string) => {
    const [ox, oy] = at(tile)
    ctx.fillStyle = color
    ctx.fillRect(ox + x, oy + y, w, h)
  }
  // per-pixel brightness noise over a base colour
  const speckle = (tile: number, base: RGB, spread: number, seed: number) => {
    const rand = rng(seed)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++)
        px(tile, x, y, 1, 1, shade(base, 1 - spread / 2 + rand() * spread))
    }
  }
  // soft blotches: darker and lighter patches a few pixels wide, as on stone
  const blotch = (tile: number, base: RGB, seed: number, count: number, spread: number) => {
    const rand = rng(seed)
    for (let i = 0; i < count; i++) {
      const w = 2 + Math.floor(rand() * 4)
      const h = 1 + Math.floor(rand() * 2)
      px(tile, Math.floor(rand() * TILE), Math.floor(rand() * TILE), w, h, shade(base, 1 - spread / 2 + rand() * spread))
    }
  }
  const frame = (tile: number, light: string, dark: string) => {
    px(tile, 0, 0, TILE, 1, light)
    px(tile, 0, 0, 1, TILE, light)
    px(tile, 0, 15, TILE, 1, dark)
    px(tile, 15, 0, 1, TILE, dark)
  }
  const ore = (tile: number, color: RGB, seed: number) => {
    speckle(tile, [127, 127, 127], 0.12, seed)
    blotch(tile, [127, 127, 127], seed + 1, 14, 0.22)
    const rand = rng(seed + 2)
    for (let i = 0; i < 7; i++) {
      const x = 1 + Math.floor(rand() * 12)
      const y = 1 + Math.floor(rand() * 12)
      px(tile, x, y, 2, 2, shade(color, 1))
      px(tile, x + 1, y - 1, 1, 1, shade(color, 1.15))
      px(tile, x - 1, y + 1, 1, 1, shade(color, 0.7))
    }
  }
  const planks = (tile: number, base: RGB, seed: number) => {
    speckle(tile, base, 0.1, seed)
    const line = shade(base, 0.62)
    for (const y of [3, 7, 11, 15])
      px(tile, 0, y, TILE, 1, line)
    for (const [x, y] of [[5, 0], [11, 4], [3, 8], [13, 12]] as const)
      px(tile, x, y, 1, 3, line)
    const rand = rng(seed + 9)
    for (let i = 0; i < 10; i++)
      px(tile, Math.floor(rand() * 15), Math.floor(rand() * 15), 2, 1, shade(base, 0.86))
  }
  const wool = (tile: number, base: RGB, seed: number) => {
    speckle(tile, base, 0.14, seed)
    const rand = rng(seed + 4)
    for (let i = 0; i < 22; i++)
      px(tile, Math.floor(rand() * 15), Math.floor(rand() * 16), 2, 1, shade(base, 0.82 + rand() * 0.3))
  }

  const GREEN: RGB = [106, 170, 72]
  const DIRT_BROWN: RGB = [134, 96, 67]
  speckle(T.grassTop, GREEN, 0.26, 11)
  blotch(T.grassTop, GREEN, 111, 18, 0.3)
  speckle(T.dirt, DIRT_BROWN, 0.22, 12)
  blotch(T.dirt, DIRT_BROWN, 112, 16, 0.34)
  for (const [tile, top, seed] of [[T.grassSide, GREEN, 13], [T.snowySide, [240, 246, 250] as RGB, 14]] as const) {
    speckle(tile, DIRT_BROWN, 0.22, seed)
    blotch(tile, DIRT_BROWN, seed + 100, 16, 0.34)
    const rand = rng(seed + 50)
    for (let x = 0; x < TILE; x++) {
      const depth = 2 + Math.floor(rand() * 4)
      for (let y = 0; y < depth; y++)
        px(tile, x, y, 1, 1, shade(top, 0.86 + rand() * 0.24))
    }
  }
  speckle(T.stone, [127, 127, 127], 0.1, 15)
  blotch(T.stone, [127, 127, 127], 115, 22, 0.24)
  speckle(T.cobble, [118, 118, 118], 0.2, 16)
  {
    const rand = rng(116)
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(rand() * 13)
      const y = Math.floor(rand() * 13)
      const w = 3 + Math.floor(rand() * 3)
      const h = 2 + Math.floor(rand() * 3)
      px(T.cobble, x, y, w, h, shade([150, 150, 150], 0.82 + rand() * 0.3))
      px(T.cobble, x, y + h, w + 1, 1, 'rgba(50,50,50,0.7)')
      px(T.cobble, x + w, y, 1, h, 'rgba(60,60,60,0.6)')
    }
  }
  planks(T.planks, [178, 144, 90], 18)
  planks(T.birch, [215, 203, 141], 118)
  speckle(T.logSide, [106, 84, 52], 0.18, 19)
  for (const x of [1, 4, 6, 9, 12, 14])
    px(T.logSide, x, 0, 1, TILE, 'rgba(48,34,16,0.5)')
  speckle(T.logTop, [178, 144, 90], 0.1, 20)
  frame(T.logTop, shade([106, 84, 52], 1), shade([86, 66, 40], 1))
  for (const r of [3, 5, 7]) {
    ctx.strokeStyle = 'rgba(96,70,36,0.5)'
    const [ox, oy] = at(T.logTop)
    ctx.strokeRect(ox + r + 0.5, oy + r + 0.5, 15 - 2 * r, 15 - 2 * r)
  }
  clear(T.leaves)
  {
    const rand = rng(21)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        if (rand() < 0.16)
          continue
        px(T.leaves, x, y, 1, 1, shade([58, 128, 46], 0.68 + rand() * 0.6))
      }
    }
  }
  clear(T.glass)
  px(T.glass, 0, 0, TILE, TILE, 'rgba(200,232,255,0.16)')
  frame(T.glass, 'rgba(228,244,255,0.95)', 'rgba(190,220,240,0.95)')
  px(T.glass, 3, 3, 3, 1, 'rgba(255,255,255,0.85)')
  px(T.glass, 3, 4, 1, 2, 'rgba(255,255,255,0.85)')
  px(T.glass, 10, 11, 2, 1, 'rgba(255,255,255,0.6)')
  speckle(T.sand, [220, 208, 164], 0.1, 22)
  blotch(T.sand, [220, 208, 164], 122, 10, 0.14)
  speckle(T.sandstone, [216, 202, 152], 0.07, 23)
  px(T.sandstone, 0, 0, TILE, 2, shade([216, 202, 152], 1.08))
  for (const y of [5, 10, 14])
    px(T.sandstone, 0, y, TILE, 1, shade([216, 202, 152], 0.84))
  speckle(T.sandstoneTop, [220, 206, 158], 0.08, 123)
  speckle(T.lamp, [226, 170, 74], 0.22, 24)
  {
    const rand = rng(124)
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(rand() * 13)
      const y = Math.floor(rand() * 13)
      px(T.lamp, x, y, 3, 3, 'rgba(255,232,150,0.9)')
      px(T.lamp, x + 1, y + 1, 1, 1, 'rgba(255,255,230,1)')
    }
  }
  clear(T.water)
  {
    const rand = rng(25)
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++)
        px(T.water, x, y, 1, 1, `rgba(${44 + rand() * 16},${96 + rand() * 22},${212 + rand() * 30},0.68)`)
    }
    for (let i = 0; i < 6; i++)
      px(T.water, Math.floor(rand() * 12), Math.floor(rand() * 16), 4, 1, 'rgba(150,196,255,0.35)')
  }
  speckle(T.bedrock, [84, 84, 84], 0.3, 26)
  blotch(T.bedrock, [60, 60, 60], 126, 26, 0.9)
  speckle(T.iron, [222, 222, 222], 0.05, 27)
  frame(T.iron, 'rgba(255,255,255,0.85)', 'rgba(120,120,120,0.8)')
  for (const y of [5, 10])
    px(T.iron, 1, y, 14, 1, 'rgba(160,160,160,0.5)')
  speckle(T.gold, [248, 210, 62], 0.1, 28)
  frame(T.gold, 'rgba(255,248,170,0.95)', 'rgba(176,130,24,0.9)')
  px(T.gold, 4, 4, 5, 1, 'rgba(255,250,190,0.8)')
  speckle(T.diamond, [98, 220, 214], 0.1, 29)
  frame(T.diamond, 'rgba(210,255,250,0.95)', 'rgba(40,140,138,0.9)')
  px(T.diamond, 4, 4, 5, 1, 'rgba(225,255,252,0.85)')
  clear(T.beacon)
  px(T.beacon, 0, 0, TILE, TILE, 'rgba(170,232,238,0.55)')
  frame(T.beacon, 'rgba(236,252,255,0.98)', 'rgba(150,214,224,0.98)')
  px(T.beacon, 4, 4, 8, 8, 'rgba(120,214,226,0.95)')
  px(T.beacon, 5, 5, 6, 6, 'rgba(236,255,255,1)')
  px(T.beacon, 2, 13, 12, 2, 'rgba(34,24,48,0.95)')
  speckle(T.snow, [242, 247, 250], 0.05, 30)
  speckle(T.brick, [152, 84, 68], 0.14, 31)
  for (const y of [3, 7, 11, 15])
    px(T.brick, 0, y, TILE, 1, 'rgba(206,198,188,0.92)')
  for (const [x, y] of [[7, 0], [3, 4], [11, 4], [7, 8], [3, 12], [11, 12]] as const)
    px(T.brick, x, y, 1, 3, 'rgba(206,198,188,0.92)')
  speckle(T.stoneBrick, [124, 124, 124], 0.1, 32)
  for (const y of [7, 15])
    px(T.stoneBrick, 0, y, TILE, 1, 'rgba(70,70,70,0.9)')
  for (const [x, y] of [[7, 0], [15, 0], [3, 8], [11, 8]] as const)
    px(T.stoneBrick, x, y, 1, 7, 'rgba(70,70,70,0.9)')
  px(T.stoneBrick, 0, 0, 7, 1, 'rgba(170,170,170,0.5)')
  px(T.stoneBrick, 8, 0, 7, 1, 'rgba(170,170,170,0.5)')
  clear(T.ice)
  px(T.ice, 0, 0, TILE, TILE, 'rgba(150,196,250,0.72)')
  for (const [x, y, w] of [[2, 3, 5], [8, 6, 6], [1, 10, 4], [9, 13, 5]] as const)
    px(T.ice, x, y, w, 1, 'rgba(214,234,255,0.8)')
  ore(T.coal, [38, 38, 38], 33)
  ore(T.ironOre, [216, 175, 147], 34)
  ore(T.goldOre, [252, 238, 75], 35)
  ore(T.diamondOre, [93, 236, 245], 36)
  speckle(T.cactus, [22, 128, 46], 0.12, 37)
  for (const x of [1, 5, 9, 13])
    px(T.cactus, x, 0, 1, TILE, 'rgba(10,84,30,0.9)')
  for (const [x, y] of [[3, 3], [7, 8], [11, 5], [3, 12], [14, 11]] as const)
    px(T.cactus, x, y, 1, 1, 'rgba(230,240,210,0.95)')
  speckle(T.cactusTop, [22, 128, 46], 0.12, 137)
  frame(T.cactusTop, 'rgba(10,84,30,0.9)', 'rgba(10,84,30,0.9)')
  clear(T.tallGrass)
  {
    const rand = rng(38)
    for (let blade = 0; blade < 9; blade++) {
      let x = 1 + Math.floor(rand() * 14)
      const height = 6 + Math.floor(rand() * 9)
      for (let i = 0; i < height; i++) {
        px(T.tallGrass, x, 15 - i, 1, 1, shade(GREEN, 0.72 + rand() * 0.45))
        if (rand() < 0.25)
          x = Math.max(0, Math.min(15, x + (rand() < 0.5 ? -1 : 1)))
      }
    }
  }
  for (const [tile, petal, heart] of [[T.poppy, 'rgb(214,38,34)', 'rgb(40,24,24)'], [T.dandelion, 'rgb(250,214,40)', 'rgb(236,160,24)']] as const) {
    clear(tile)
    px(tile, 7, 8, 1, 8, 'rgb(46,120,38)')
    px(tile, 5, 11, 2, 1, 'rgb(58,140,46)')
    px(tile, 8, 13, 2, 1, 'rgb(58,140,46)')
    px(tile, 6, 4, 4, 4, petal)
    px(tile, 5, 5, 6, 2, petal)
    px(tile, 7, 5, 2, 2, heart)
  }
  speckle(T.obsidian, [28, 22, 44], 0.3, 39)
  blotch(T.obsidian, [60, 44, 92], 139, 8, 0.4)
  planks(T.bookshelf, [178, 144, 90], 40)
  px(T.bookshelf, 1, 2, 14, 5, 'rgb(58,40,22)')
  px(T.bookshelf, 1, 9, 14, 5, 'rgb(58,40,22)')
  {
    const rand = rng(140)
    const spines = ['rgb(170,48,44)', 'rgb(52,96,170)', 'rgb(56,140,70)', 'rgb(200,170,60)', 'rgb(120,70,150)', 'rgb(200,200,190)']
    for (const row of [2, 9]) {
      for (let x = 1; x < 15; x += 2)
        px(T.bookshelf, x, row + (rand() < 0.3 ? 1 : 0), 2, 5, spines[Math.floor(rand() * spines.length)]!)
    }
  }
  wool(T.woolWhite, [234, 236, 237], 41)
  wool(T.woolRed, [161, 39, 34], 42)
  wool(T.woolBlue, [53, 57, 157], 43)
  wool(T.woolYellow, [249, 198, 39], 44)
  wool(T.woolGreen, [84, 109, 27], 45)
  wool(T.woolBlack, [26, 27, 32], 46)
  // digging cracks: five stages, each adds more jagged lines
  {
    const rand = rng(47)
    const lines: [number, number, number, number][] = []
    for (let stage = 0; stage < 5; stage++) {
      for (let i = 0; i < 3; i++) {
        let x = 4 + Math.floor(rand() * 8)
        let y = 4 + Math.floor(rand() * 8)
        for (let step = 0; step < 5 + stage; step++) {
          lines.push([x, y, 1, 1])
          x = Math.max(0, Math.min(15, x + Math.round(rand() * 2 - 1)))
          y = Math.max(0, Math.min(15, y + Math.round(rand() * 2 - 1)))
        }
      }
      clear(T.crack0 + stage)
      for (const [x, y, w, h] of lines)
        px(T.crack0 + stage, x, y, w, h, 'rgba(0,0,0,0.62)')
    }
  }

  // average colour of every tile, for particles
  for (let tile = 0; tile < COLS * ROWS; tile++) {
    const [ox, oy] = at(tile)
    const data = ctx.getImageData(ox, oy, TILE, TILE).data
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! < 40)
        continue
      r += data[i]!
      g += data[i + 1]!
      b += data[i + 2]!
      n++
    }
    tileColors[tile] = n ? [r / n / 255, g / n / 255, b / n / 255] : [0.5, 0.5, 0.5]
  }
  atlasCanvas = canvas
  return canvas
}
export function blockColor(id: number): RGB {
  getAtlas()
  return tileColors[tileOf(id, 2)] ?? [0.5, 0.5, 0.5]
}

const tileUrls = new Map<number, string>()
/** one tile as a data URL, for CSS backgrounds and item icons */
export function tileUrl(tile: number): string {
  let url = tileUrls.get(tile)
  if (!url) {
    const canvas = document.createElement('canvas')
    canvas.width = TILE
    canvas.height = TILE
    canvas.getContext('2d')!.drawImage(getAtlas(), (tile % COLS) * TILE, Math.floor(tile / COLS) * TILE, TILE, TILE, 0, 0, TILE, TILE)
    url = canvas.toDataURL()
    tileUrls.set(tile, url)
  }
  return url
}
export const blockIcon = (id: number) => tileUrl(tileOf(id, 2))
export const dirtTextureUrl = () => tileUrl(T.dirt)
