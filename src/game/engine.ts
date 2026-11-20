import type { MeshData } from './mesher'
import * as THREE from 'three'
import { playBreak, playDig, playPlace, playStep, unlockAudio } from './audio'
import { AIR, BEACON, BEDROCK, blockHardness, blockName, blockSound, crackTile, getAtlas, INVENTORY, IRON, isCross, isSolid, OBSIDIAN, tileUV, WATER } from './blocks'
import { createHand, createMobs, createParticles } from './effects'
import { meshChunk } from './mesher'
import { createSky } from './sky'
import { controls, game, options } from './state'
import { blockKey, CHUNK, chunkKey, HEIGHT, PLAZA_Y, World } from './world'

export interface TowerNode {
  uuid: string
  name: string
  online: boolean
  /** 0..100, the busiest of CPU / memory */
  load: number
  line: string
}
export type TimeMode = 'cycle' | 'day' | 'night'

const EDITS_KEY = 'blockworld:edits'
const REACH = 5.5
const PLAYER_HALF = 0.3
const PLAYER_HEIGHT = 1.8
const TOWER_SPACING = 6
const DAY_LENGTH = 600
const BIOME_NAMES = { plains: '平原', forest: '森林', desert: '沙漠', snow: '雪原' }

interface Tower {
  node: TowerNode
  x: number
  z: number
  y: number
  beam: THREE.Mesh
  glow: THREE.Mesh
  label: THREE.Sprite
  labelText: string
}

/** Grid cells around the origin, nearest first; the centre stays free for the spawn point. */
function towerSlots(count: number): [number, number][] {
  const slots: [number, number, number][] = []
  const reach = Math.ceil(Math.sqrt(count + 1)) + 2
  for (let gz = -reach; gz <= reach; gz++) {
    for (let gx = -reach; gx <= reach; gx++) {
      if (gx !== 0 || gz !== 0)
        slots.push([gx, gz, Math.hypot(gx, gz)])
    }
  }
  slots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0])
  return slots.slice(0, count).map(([gx, gz]) => [gx * TOWER_SPACING, gz * TOWER_SPACING])
}
function statusColor(node: TowerNode): number {
  return node.load >= 90 ? 0xFF4A38 : node.load >= 70 ? 0xFFC83D : 0x42F5A1
}

const VERTEX_SHADER = `
attribute float light;
attribute float kind;
uniform float uTime;
varying vec2 vUv;
varying float vLight;
varying float vGlow;
varying float vDistance;
void main() {
  vec3 p = position;
  if (kind > 1.5 && kind < 2.5) {
    // water surface: sits a little below the block edge and ripples
    p.y += sin(uTime * 1.6 + p.x * 0.9 + p.z * 0.7) * 0.045 - 0.11;
  }
  else if (kind > 2.5) {
    // tops of grass and flowers sway in the wind
    p.x += sin(uTime * 1.7 + p.x * 0.6 + p.z * 0.8) * 0.07;
    p.z += cos(uTime * 1.3 + p.x * 0.5) * 0.05;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vLight = light;
  vGlow = (kind > 0.5 && kind < 1.5) ? 1.0 : 0.0;
  vDistance = length(mv.xyz);
}`
const FRAGMENT_SHADER = `
uniform sampler2D uMap;
uniform float uDay;
uniform float uAlphaTest;
uniform float uOpacity;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUv;
varying float vLight;
varying float vGlow;
varying float vDistance;
void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < uAlphaTest) discard;
  vec3 color = texel.rgb * mix(vLight * uDay, 1.0, vGlow);
  color = mix(color, uFogColor, smoothstep(uFogNear, uFogFar, vDistance));
  gl_FragColor = vec4(color, texel.a * uOpacity);
}`

export function createEngine(canvas: HTMLCanvasElement, seed: number, siteTime: TimeMode) {
  // textures are painted in sRGB and shown as they are: skip colour management altogether
  THREE.ColorManagement.enabled = false
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.autoClear = false
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x7CB4FF, 40, 100)
  const camera = new THREE.PerspectiveCamera(options.value.fov, 1, 0.08, 800)

  const atlas = new THREE.CanvasTexture(getAtlas())
  atlas.magFilter = THREE.NearestFilter
  atlas.minFilter = THREE.NearestFilter
  atlas.generateMipmaps = false
  const shared = {
    uMap: { value: atlas },
    uDay: { value: 1 },
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 40 },
    uFogFar: { value: 100 },
  }
  const terrainMaterial = (alphaTest: number, extra: THREE.ShaderMaterialParameters) => new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: { ...shared, uAlphaTest: { value: alphaTest }, uOpacity: { value: 1 } },
    ...extra,
  })
  const opaqueMaterial = terrainMaterial(0, {})
  const cutoutMaterial = terrainMaterial(0.5, { side: THREE.DoubleSide })
  const blendedMaterial = terrainMaterial(0.02, { transparent: true, depthWrite: false, side: THREE.DoubleSide })

  const sky = createSky(scene)
  let world = new World(seed)
  const particles = createParticles(scene, () => world)
  const mobs = createMobs(scene, () => world)
  const hand = createHand(atlas)

  // ===== saved edits =====
  try {
    const saved = JSON.parse(localStorage.getItem(EDITS_KEY) || 'null')
    if (saved?.seed === seed && saved.chunks) {
      for (const [key, entries] of Object.entries(saved.chunks as Record<string, [number, number][]>))
        world.edits.set(key, new Map(entries))
    }
  }
  catch {}
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  function saveEdits() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const chunks: Record<string, [number, number][]> = {}
      let total = 0
      for (const [key, edits] of world.edits) {
        if (total > 40000)
          break
        chunks[key] = [...edits]
        total += edits.size
      }
      try {
        localStorage.setItem(EDITS_KEY, JSON.stringify({ seed, chunks }))
      }
      catch {}
    }, 900)
  }

  // ===== chunk meshes =====
  const loaded = new Map<string, THREE.Mesh[]>()
  const dirty = new Set<string>()
  function geometryOf(data: MeshData): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2))
    geometry.setAttribute('light', new THREE.BufferAttribute(data.light, 1))
    geometry.setAttribute('kind', new THREE.BufferAttribute(data.kind, 1))
    geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
    geometry.computeBoundingSphere()
    return geometry
  }
  function unload(key: string) {
    for (const mesh of loaded.get(key) ?? []) {
      scene.remove(mesh)
      mesh.geometry.dispose()
    }
    loaded.delete(key)
  }
  function build(cx: number, cz: number) {
    const key = chunkKey(cx, cz)
    unload(key)
    const data = meshChunk(world, cx, cz)
    const meshes: THREE.Mesh[] = []
    if (data.opaque.index.length)
      meshes.push(new THREE.Mesh(geometryOf(data.opaque), opaqueMaterial))
    if (data.cutout.index.length)
      meshes.push(new THREE.Mesh(geometryOf(data.cutout), cutoutMaterial))
    if (data.blended.index.length) {
      const mesh = new THREE.Mesh(geometryOf(data.blended), blendedMaterial)
      mesh.renderOrder = 1
      meshes.push(mesh)
    }
    for (const mesh of meshes)
      scene.add(mesh)
    loaded.set(key, meshes)
  }
  function markDirty(x: number, z: number) {
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    const lx = x - cx * CHUNK
    const lz = z - cz * CHUNK
    // a block on a chunk edge also changes the faces and shading of its neighbours
    const dxs = lx === 0 ? [0, -1] : lx === CHUNK - 1 ? [0, 1] : [0]
    const dzs = lz === 0 ? [0, -1] : lz === CHUNK - 1 ? [0, 1] : [0]
    for (const dx of dxs) {
      for (const dz of dzs) {
        const key = chunkKey(cx + dx, cz + dz)
        if (loaded.has(key))
          dirty.add(key)
      }
    }
  }
  /** load the nearest missing chunks and rebuild edited ones, within a time budget */
  function streamChunks(centerX: number, centerZ: number, budgetMs: number) {
    const started = performance.now()
    for (const key of dirty) {
      const [cx, cz] = key.split(',').map(Number) as [number, number]
      build(cx, cz)
      dirty.delete(key)
    }
    const radius = Math.max(2, Math.min(12, options.value.renderDistance))
    const pcx = Math.floor(centerX / CHUNK)
    const pcz = Math.floor(centerZ / CHUNK)
    for (const key of loaded.keys()) {
      const [cx, cz] = key.split(',').map(Number) as [number, number]
      if (Math.hypot(cx - pcx, cz - pcz) > radius + 1.5) {
        unload(key)
        world.dropChunk(cx, cz)
      }
    }
    // rings outwards from the player so the ground underfoot always comes first
    let built = 0
    outer: for (let ring = 0; ring <= radius; ring++) {
      for (let dz = -ring; dz <= ring; dz++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring || Math.hypot(dx, dz) > radius + 0.5)
            continue
          if (loaded.has(chunkKey(pcx + dx, pcz + dz)))
            continue
          build(pcx + dx, pcz + dz)
          built++
          if (performance.now() - started > budgetMs)
            break outer
        }
      }
    }
    game.chunks = loaded.size
    const far = radius * CHUNK
    shared.uFogNear.value = far * 0.55
    shared.uFogFar.value = far - 4
    const fog = scene.fog as THREE.Fog
    fog.near = shared.uFogNear.value
    fog.far = shared.uFogFar.value
    return built
  }
  function reloadAll() {
    for (const key of [...loaded.keys()])
      unload(key)
    dirty.clear()
    world.invalidate()
  }

  // ===== node towers =====
  const protectedBlocks = new Map<string, string>()
  let towers: Tower[] = []
  let towerSignature = ''
  const beamGeometry = new THREE.BoxGeometry(0.42, 240, 0.42)
  const glowGeometry = new THREE.BoxGeometry(0.86, 240, 0.86)
  function drawLabel(tower: Tower) {
    const text = `${tower.node.name}\n${tower.node.line}`
    if (text === tower.labelText)
      return
    tower.labelText = text
    const texture = tower.label.material.map as THREE.CanvasTexture
    const labelCanvas = texture.image as HTMLCanvasElement
    const ctx = labelCanvas.getContext('2d')!
    ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 30px "Pixelify Sans", system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(tower.node.name.slice(0, 22), labelCanvas.width / 2, 34, labelCanvas.width - 16)
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.fillStyle = tower.node.online ? `#${statusColor(tower.node).toString(16).padStart(6, '0')}` : '#ff6b5e'
    ctx.fillText(tower.node.line, labelCanvas.width / 2, 78, labelCanvas.width - 16)
    texture.needsUpdate = true
  }
  function structureEntry(x: number, y: number, z: number, id: number) {
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    const key = chunkKey(cx, cz)
    const list = world.structures.get(key) ?? []
    const index = World.index(x - cx * CHUNK, y, z - cz * CHUNK)
    const existing = list.find(entry => entry[0] === index)
    if (existing)
      existing[1] = id
    else list.push([index, id])
    world.structures.set(key, list)
  }
  function setNodes(nodes: TowerNode[]) {
    const signature = nodes.map(node => node.uuid).join(',')
    if (signature !== towerSignature) {
      towerSignature = signature
      for (const tower of towers) {
        scene.remove(tower.beam, tower.glow, tower.label)
        ;(tower.label.material.map as THREE.Texture).dispose()
        tower.label.material.dispose()
        ;(tower.beam.material as THREE.Material).dispose()
        ;(tower.glow.material as THREE.Material).dispose()
      }
      world.plazaRadius = Math.max(14, (Math.ceil(Math.sqrt(nodes.length + 1)) / 2 + 1.6) * TOWER_SPACING)
      world.structures = new Map()
      protectedBlocks.clear()
      const slots = towerSlots(nodes.length)
      towers = nodes.map((node, i) => {
        const [x, z] = slots[i]!
        const y = PLAZA_Y + 1
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            structureEntry(x + dx, y, z + dz, IRON)
            protectedBlocks.set(blockKey(x + dx, y, z + dz), node.uuid)
            protectedBlocks.set(blockKey(x + dx, y - 1, z + dz), node.uuid)
          }
        }
        structureEntry(x, y + 1, z, node.online ? BEACON : OBSIDIAN)
        protectedBlocks.set(blockKey(x, y + 1, z), node.uuid)
        const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.82, depthWrite: false, fog: false }))
        const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false, fog: false }))
        beam.position.set(x + 0.5, y + 2 + 120, z + 0.5)
        glow.position.copy(beam.position)
        beam.renderOrder = glow.renderOrder = 3
        const labelCanvas = document.createElement('canvas')
        labelCanvas.width = 384
        labelCanvas.height = 108
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthWrite: false, fog: false }))
        label.position.set(x + 0.5, y + 3.3, z + 0.5)
        label.renderOrder = 4
        scene.add(beam, glow, label)
        return { node, x, z, y, beam, glow, label, labelText: '' }
      })
      // the plaza size follows the number of nodes, so the terrain has to be regenerated
      reloadAll()
    }
    nodes.forEach((node, i) => {
      const tower = towers[i]!
      tower.node = node
      const top = node.online ? BEACON : OBSIDIAN
      if (world.get(tower.x, tower.y + 1, tower.z) !== top) {
        structureEntry(tower.x, tower.y + 1, tower.z, top)
        world.set(tower.x, tower.y + 1, tower.z, top, false)
        markDirty(tower.x, tower.z)
      }
      tower.beam.visible = tower.glow.visible = node.online
      const color = statusColor(node)
      ;(tower.beam.material as THREE.MeshBasicMaterial).color.setHex(color)
      ;(tower.glow.material as THREE.MeshBasicMaterial).color.setHex(color)
      drawLabel(tower)
    })
  }

  // ===== player =====
  const position = new THREE.Vector3(0.5, PLAZA_Y + 1.01, 0.5)
  const velocity = new THREE.Vector3()
  let yaw = Math.PI * 0.25
  let pitch = -0.08
  let onGround = false
  let eyeHeight = 1.62
  let bobPhase = 0
  let bobAmount = 0
  let landDip = 0
  let lastStep = 0
  const keys = new Set<string>()
  let lastSpace = 0
  let lastForward = 0
  let sprinting = false

  function collides(x: number, y: number, z: number): boolean {
    for (let by = Math.floor(y); by <= Math.floor(y + PLAYER_HEIGHT - 0.001); by++) {
      for (let bz = Math.floor(z - PLAYER_HALF); bz <= Math.floor(z + PLAYER_HALF); bz++) {
        for (let bx = Math.floor(x - PLAYER_HALF); bx <= Math.floor(x + PLAYER_HALF); bx++) {
          if (isSolid(world.get(bx, by, bz)))
            return true
        }
      }
    }
    return false
  }
  function respawn() {
    position.set(0.5, world.surface(0, 0) + 1.01, 0.5)
    velocity.set(0, 0, 0)
  }
  function updatePlayer(dt: number) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
    const sneaking = keys.has('ShiftLeft') && !game.flying
    if (forward <= 0)
      sprinting = false
    else if (keys.has('ControlLeft'))
      sprinting = true
    const speed = game.flying ? (sprinting ? 21 : 10.5) : sneaking ? 1.4 : sprinting ? 5.7 : 4.3
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    const length = Math.hypot(forward, strafe) || 1
    const targetX = (-sin * forward + cos * strafe) / length * speed
    const targetZ = (-cos * forward - sin * strafe) / length * speed
    // ease into and out of motion instead of snapping
    const ease = Math.min(1, dt * (onGround || game.flying ? 12 : 3))
    velocity.x += (targetX - velocity.x) * ease
    velocity.z += (targetZ - velocity.z) * ease
    const feet = world.get(Math.floor(position.x), Math.floor(position.y + 0.4), Math.floor(position.z))
    const inWater = feet === WATER
    if (game.flying) {
      const lift = ((keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') ? 1 : 0)) * 8
      velocity.y += (lift - velocity.y) * Math.min(1, dt * 10)
    }
    else {
      velocity.y -= (inWater ? 7 : 28) * dt
      if (inWater) {
        velocity.y = Math.max(velocity.y, -2.4)
        velocity.x *= 0.7
        velocity.z *= 0.7
        if (keys.has('Space'))
          velocity.y = 2.8
      }
      else if (keys.has('Space') && onGround) {
        velocity.y = 8.6
      }
    }
    const nextX = position.x + velocity.x * dt
    if (!collides(nextX, position.y, position.z))
      position.x = nextX
    else velocity.x = 0
    const nextZ = position.z + velocity.z * dt
    if (!collides(position.x, position.y, nextZ))
      position.z = nextZ
    else velocity.z = 0
    const nextY = position.y + velocity.y * dt
    const wasOnGround = onGround
    if (!collides(position.x, nextY, position.z)) {
      position.y = nextY
      onGround = false
    }
    else {
      if (velocity.y < 0) {
        position.y = Math.floor(nextY) + 1.001
        onGround = true
        if (!wasOnGround && velocity.y < -9)
          landDip = Math.min(0.28, -velocity.y * 0.014)
        if (game.flying)
          game.flying = false
      }
      velocity.y = 0
    }
    if (position.y < -24)
      respawn()

    // view bobbing follows the distance actually walked
    const moving = Math.hypot(velocity.x, velocity.z)
    const walking = onGround && moving > 0.6 && !game.flying
    bobAmount += ((walking && options.value.bobbing ? 1 : 0) - bobAmount) * Math.min(1, dt * 8)
    if (walking) {
      bobPhase += moving * dt * 1.9
      if (bobPhase - lastStep > Math.PI) {
        lastStep = bobPhase
        playStep(blockSound(world.get(Math.floor(position.x), Math.floor(position.y - 0.5), Math.floor(position.z))))
      }
    }
    landDip *= Math.max(0, 1 - dt * 9)
    eyeHeight += ((sneaking ? 1.42 : 1.62) - eyeHeight) * Math.min(1, dt * 12)
    const fov = options.value.fov * (sprinting && moving > 4.5 ? 1.14 : 1) * (game.flying ? 1.04 : 1)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 8)
      camera.updateProjectionMatrix()
    }
  }

  // ===== aiming, digging, placing =====
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, fog: false }),
  )
  outline.visible = false
  const crackGeometry = new THREE.BoxGeometry(1.008, 1.008, 1.008)
  const crack = new THREE.Mesh(crackGeometry, new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, fog: false }))
  crack.visible = false
  crack.renderOrder = 2
  scene.add(outline, crack)
  let crackStage = -1
  function setCrackStage(stage: number) {
    if (stage === crackStage)
      return
    crackStage = stage
    const [u0, v0, u1, v1] = tileUV(crackTile(stage))
    const uv = crackGeometry.attributes.uv as THREE.BufferAttribute
    for (let face = 0; face < 6; face++) {
      uv.setXY(face * 4, u0, v1)
      uv.setXY(face * 4 + 1, u1, v1)
      uv.setXY(face * 4 + 2, u0, v0)
      uv.setXY(face * 4 + 3, u1, v0)
    }
    uv.needsUpdate = true
  }
  let target: { x: number, y: number, z: number, nx: number, ny: number, nz: number } | null = null
  const direction = new THREE.Vector3()
  let digging = false
  let digKey = ''
  let digProgress = 0
  let digCooldown = 0
  let digPulse = 0
  let placing = false
  let placeCooldown = 0

  function raycast() {
    camera.getWorldDirection(direction)
    const origin = [camera.position.x, camera.position.y, camera.position.z]
    const dir = [direction.x, direction.y, direction.z]
    const cell = origin.map(Math.floor)
    const step = dir.map(Math.sign)
    const delta = dir.map(value => Math.abs(1 / value))
    const side = [0, 1, 2].map(i => (step[i]! > 0 ? cell[i]! + 1 - origin[i]! : origin[i]! - cell[i]!) * delta[i]!)
    let normal = [0, 0, 0]
    target = null
    for (let i = 0; i < 48; i++) {
      const id = world.get(cell[0]!, cell[1]!, cell[2]!)
      if (id !== AIR && id !== WATER) {
        target = { x: cell[0]!, y: cell[1]!, z: cell[2]!, nx: normal[0]!, ny: normal[1]!, nz: normal[2]! }
        break
      }
      const axis = side[0]! < side[1]! ? (side[0]! < side[2]! ? 0 : 2) : (side[1]! < side[2]! ? 1 : 2)
      if (side[axis]! > REACH)
        break
      side[axis] = side[axis]! + delta[axis]!
      normal = [0, 0, 0]
      normal[axis] = -step[axis]!
      cell[axis] = cell[axis]! + step[axis]!
    }
    outline.visible = !!target
    if (target) {
      outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
      game.targetNode = protectedBlocks.get(blockKey(target.x, target.y, target.z)) ?? null
      game.targetBlock = blockName(world.get(target.x, target.y, target.z))
    }
    else {
      game.targetNode = null
      game.targetBlock = ''
    }
  }
  function changeBlock(x: number, y: number, z: number, id: number) {
    world.set(x, y, z, id, true)
    markDirty(x, z)
    saveEdits()
  }
  function breakTarget() {
    if (!target)
      return
    const { x, y, z } = target
    const id = world.get(x, y, z)
    changeBlock(x, y, z, AIR)
    particles.burst(x, y, z, id, isCross(id) ? 8 : 26, sky.daylight)
    playBreak(blockSound(id))
    // a flower or grass tuft cannot float once the block under it is gone
    const above = world.get(x, y + 1, z)
    if (isCross(above)) {
      changeBlock(x, y + 1, z, AIR)
      particles.burst(x, y + 1, z, above, 6, sky.daylight)
    }
  }
  function updateDigging(dt: number) {
    digCooldown -= dt
    if (!digging || !target || digCooldown > 0) {
      crack.visible = false
      if (!digging)
        digProgress = 0
      return
    }
    const key = blockKey(target.x, target.y, target.z)
    if (key !== digKey) {
      digKey = key
      digProgress = 0
    }
    const id = world.get(target.x, target.y, target.z)
    digPulse -= dt
    if (digPulse <= 0) {
      digPulse = 0.24
      hand.swing()
      playDig(blockSound(id))
      particles.burst(target.x + target.nx * 0.4, target.y + target.ny * 0.4, target.z + target.nz * 0.4, id, 2, sky.daylight)
    }
    if (protectedBlocks.has(key) || id === BEDROCK) {
      crack.visible = false
      return
    }
    digProgress += dt / blockHardness(id)
    if (digProgress >= 1) {
      breakTarget()
      digProgress = 0
      digCooldown = 0.12
      crack.visible = false
      return
    }
    crack.visible = true
    crack.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
    setCrackStage(Math.floor(digProgress * 5))
  }
  function openNode(uuid: string) {
    game.openedNode = uuid
    document.exitPointerLock()
  }
  function placeBlock() {
    if (!target)
      return
    if (game.targetNode) {
      // right click on a node's tower opens that node
      openNode(game.targetNode)
      return
    }
    // plants are replaced; otherwise build against the face that was hit
    const replace = isCross(world.get(target.x, target.y, target.z))
    const x = replace ? target.x : target.x + target.nx
    const y = replace ? target.y : target.y + target.ny
    const z = replace ? target.z : target.z + target.nz
    if (y < 1 || y >= HEIGHT || protectedBlocks.has(blockKey(x, y, z)))
      return
    const existing = world.get(x, y, z)
    if (existing !== AIR && existing !== WATER && !isCross(existing))
      return
    const id = game.hotbar[game.slot]!
    const overlapsPlayer = x + 1 > position.x - PLAYER_HALF && x < position.x + PLAYER_HALF
      && z + 1 > position.z - PLAYER_HALF && z < position.z + PLAYER_HALF
      && y + 1 > position.y && y < position.y + PLAYER_HEIGHT
    if (isSolid(id) && overlapsPlayer)
      return
    // plants need solid ground
    if (isCross(id) && !isSolid(world.get(x, y - 1, z)))
      return
    changeBlock(x, y, z, id)
    hand.swing()
    playPlace(blockSound(id))
  }
  function pickBlock() {
    if (!target)
      return
    const id = world.get(target.x, target.y, target.z)
    if (!INVENTORY.includes(id))
      return
    const existing = game.hotbar.indexOf(id)
    if (existing >= 0)
      game.slot = existing
    else game.hotbar[game.slot] = id
  }

  // ===== input =====
  function onPointerLockChange() {
    game.playing = document.pointerLockElement === canvas
    if (game.playing) {
      game.screen = null
      return
    }
    keys.clear()
    digging = false
    placing = false
    sprinting = false
    // leaving the pointer lock without having opened something means "pause"
    if (!game.openedNode && game.screen !== 'inventory')
      game.screen = 'pause'
  }
  function onPointerLockError() {
    game.screen = 'title'
  }
  function onMouseMove(event: MouseEvent) {
    if (!game.playing)
      return
    yaw -= event.movementX * 0.0023
    pitch = Math.max(-1.55, Math.min(1.55, pitch - event.movementY * 0.0023))
    hand.nudge(event.movementX, event.movementY)
  }
  function onMouseDown(event: MouseEvent) {
    if (!game.playing)
      return
    if (event.button === 0) {
      digging = true
      digPulse = 0
    }
    else if (event.button === 2) {
      placing = true
      placeCooldown = 0.26
      placeBlock()
    }
    else if (event.button === 1) {
      event.preventDefault()
      pickBlock()
    }
  }
  function onMouseUp(event: MouseEvent) {
    if (event.button === 0)
      digging = false
    else if (event.button === 2)
      placing = false
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!game.playing)
      return
    event.preventDefault()
    if (!event.repeat) {
      const now = performance.now()
      if (event.code.startsWith('Digit')) {
        const slot = Number(event.code.slice(5)) - 1
        if (slot >= 0 && slot < game.hotbar.length)
          game.slot = slot
      }
      else if (event.code === 'KeyF') {
        game.flying = !game.flying
      }
      else if (event.code === 'KeyR') {
        respawn()
      }
      else if (event.code === 'KeyE') {
        if (game.targetNode) {
          openNode(game.targetNode)
        }
        else {
          game.screen = 'inventory'
          document.exitPointerLock()
        }
      }
      else if (event.code === 'Space') {
        // double tap toggles flying, as in creative mode
        if (now - lastSpace < 280)
          game.flying = !game.flying
        lastSpace = now
      }
      else if (event.code === 'KeyW') {
        // double tap forward to sprint
        if (now - lastForward < 280)
          sprinting = true
        lastForward = now
      }
    }
    keys.add(event.code)
  }
  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code)
  }
  function onWheel(event: WheelEvent) {
    if (game.playing)
      game.slot = (game.slot + (event.deltaY > 0 ? 1 : -1) + game.hotbar.length) % game.hotbar.length
  }
  const onContextMenu = (event: Event) => event.preventDefault()
  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('pointerlockerror', onPointerLockError)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('wheel', onWheel, { passive: true })
  canvas.addEventListener('contextmenu', onContextMenu)

  controls.enter = () => {
    unlockAudio()
    game.openedNode = null
    canvas.requestPointerLock()
  }
  controls.resetWorld = () => {
    try {
      localStorage.removeItem(EDITS_KEY)
    }
    catch {}
    world.edits.clear()
    reloadAll()
    respawn()
  }

  // ===== loop =====
  let frame = 0
  let running = true
  let paused = false
  let last = performance.now()
  let clock = 0
  let orbit = 0
  let orbitHeight = PLAZA_Y + 24
  let blend = 0
  let frames = 0
  let fpsAt = last
  let infoAt = 0
  const menuPosition = new THREE.Vector3()
  const menuQuaternion = new THREE.Quaternion()
  const playQuaternion = new THREE.Quaternion()
  const playPosition = new THREE.Vector3()
  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  const lookAt = new THREE.Matrix4()
  const up = new THREE.Vector3(0, 1, 0)
  const origin = new THREE.Vector3()
  let handAspect = 1

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const ratio = renderer.getPixelRatio()
    if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      handAspect = camera.aspect
    }
  }
  function timeOfDay(dt: number): number {
    const mode = options.value.time === 'site' ? siteTime : options.value.time
    if (mode === 'day')
      game.time += (0.25 - game.time) * Math.min(1, dt * 2)
    else if (mode === 'night')
      game.time += (0.75 - game.time) * Math.min(1, dt * 2)
    else
      game.time = (game.time + dt / DAY_LENGTH) % 1
    return game.time
  }
  function tick(now: number) {
    if (!running)
      return
    frame = requestAnimationFrame(tick)
    const elapsed = now - last
    if (paused || document.hidden) {
      last = now
      return
    }
    // the menu panorama does not need more than ~30 fps
    if (!game.playing && blend < 0.01 && elapsed < 30)
      return
    last = now
    const dt = Math.min(0.05, elapsed / 1000)
    clock += dt
    resize()

    // camera: blend between the slow menu orbit and the player's eyes
    blend += ((game.playing ? 1 : 0) - blend) * Math.min(1, dt * 3.2)
    if (Math.abs((game.playing ? 1 : 0) - blend) < 0.002)
      blend = game.playing ? 1 : 0
    if (game.playing) {
      updatePlayer(dt)
      game.position = [position.x, position.y, position.z]
    }
    orbit += dt * 0.045
    const radius = world.plazaRadius + 20
    // stay clear of hills and treetops along the orbit
    const orbitX = Math.cos(orbit) * radius
    const orbitZ = Math.sin(orbit) * radius
    const clearance = Math.max(PLAZA_Y + 18, world.heightAt(Math.round(orbitX), Math.round(orbitZ)) + 15)
    orbitHeight += (clearance - orbitHeight) * Math.min(1, dt * 1.5)
    menuPosition.set(orbitX, orbitHeight, orbitZ)
    lookAt.lookAt(menuPosition, origin.set(0, PLAZA_Y + 5, 0), up)
    menuQuaternion.setFromRotationMatrix(lookAt)
    const bobX = Math.sin(bobPhase) * 0.045 * bobAmount
    const bobY = -Math.abs(Math.cos(bobPhase)) * 0.05 * bobAmount
    euler.set(pitch, yaw, Math.sin(bobPhase) * 0.005 * bobAmount)
    playQuaternion.setFromEuler(euler)
    playPosition.set(position.x + Math.cos(yaw) * bobX, position.y + eyeHeight + bobY - landDip, position.z - Math.sin(yaw) * bobX)
    const eased = blend * blend * (3 - 2 * blend)
    camera.position.lerpVectors(menuPosition, playPosition, eased)
    camera.quaternion.slerpQuaternions(menuQuaternion, playQuaternion, eased)
    camera.updateMatrixWorld()

    // the first frames get a large budget so the world is there when the cover lifts
    streamChunks(camera.position.x, camera.position.z, game.ready ? 5 : 220)

    const time = timeOfDay(dt)
    sky.update(time, dt, camera)
    scene.background = sky.color
    ;(scene.fog as THREE.Fog).color.copy(sky.color)
    shared.uFogColor.value.copy(sky.color)
    shared.uDay.value = sky.daylight
    shared.uTime.value = clock
    particles.material.color.setScalar(1)

    if (game.playing && blend > 0.9) {
      raycast()
      updateDigging(dt)
      placeCooldown -= dt
      if (placing && placeCooldown <= 0) {
        placeCooldown = 0.22
        placeBlock()
      }
    }
    else {
      outline.visible = false
      crack.visible = false
      game.targetNode = null
      game.targetBlock = ''
    }
    particles.update(dt)
    mobs.update(dt, camera.position.x, camera.position.z, options.value.mobs, sky.daylight)

    // beacons: beams turn slowly; name plates only where they are readable
    const pulse = 1.9 + Math.sin(now / 260) * 0.5
    for (const tower of towers) {
      const selected = tower.node.uuid === game.selectedNode
      tower.beam.rotation.y += dt * 0.7
      tower.glow.rotation.y -= dt * 0.4
      const near = Math.hypot(tower.x - camera.position.x, tower.z - camera.position.z) < 22
      tower.label.visible = blend > 0.5 ? near : selected
      const scale = selected ? pulse : 1
      tower.glow.scale.set(scale, 1, scale)
      tower.label.scale.set(blend > 0.5 ? 3.4 : 9, blend > 0.5 ? 0.96 : 2.54, 1)
    }

    renderer.clear()
    renderer.render(scene, camera)
    if (blend > 0.55) {
      hand.show(game.hotbar[game.slot]!)
      hand.update(dt, bobX, bobY, handAspect, 0.35 + 0.65 * sky.daylight)
      renderer.clearDepth()
      renderer.render(hand.scene, hand.camera)
    }
    game.ready = true
    frames++
    if (now - fpsAt >= 1000) {
      game.fps = Math.round(frames * 1000 / (now - fpsAt))
      frames = 0
      fpsAt = now
    }
    if (now - infoAt > 500 && game.playing) {
      infoAt = now
      game.biome = BIOME_NAMES[world.biomeAt(Math.floor(position.x), Math.floor(position.z))]
    }
  }
  frame = requestAnimationFrame(tick)

  return {
    setNodes,
    setPaused(value: boolean) {
      paused = value
    },
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      clearTimeout(saveTimer)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('pointerlockerror', onPointerLockError)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      if (document.pointerLockElement === canvas)
        document.exitPointerLock()
      renderer.dispose()
      game.ready = false
      game.playing = false
    },
  }
}
