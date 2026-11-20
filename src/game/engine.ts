import type { ChunkGeometry } from './mesher'
import * as THREE from 'three'
import { AIR, BEACON, BEDROCK, BLOCK_NAMES, getAtlas, HOTBAR, IRON, isSolid, LAMP_OFF, WATER } from './blocks'
import { meshChunk } from './mesher'
import { controls, game } from './state'
import { CENTER_X, CENTER_Z, CHUNK, PLAZA_Y, World, WORLD_X, WORLD_Y, WORLD_Z } from './world'

export interface TowerNode {
  uuid: string
  name: string
  online: boolean
  /** 0..100, the busiest of CPU / memory */
  load: number
  line: string
}

const EDITS_KEY = 'blockworld:edits'
const REACH = 6
const EYE = 1.62
const PLAYER_HALF = 0.3
const PLAYER_HEIGHT = 1.8
const TOWER_SPACING = 5

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

/** Grid cells around the centre, nearest first; the centre itself stays free for the spawn point. */
function towerSlots(count: number): [number, number][] {
  const slots: [number, number, number][] = []
  const reach = Math.ceil(Math.sqrt(count + 1)) + 2
  for (let gz = -reach; gz <= reach; gz++) {
    for (let gx = -reach; gx <= reach; gx++) {
      if (gx === 0 && gz === 0)
        continue
      slots.push([gx, gz, Math.hypot(gx, gz)])
    }
  }
  slots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0])
  return slots.slice(0, count).map(([gx, gz]) => [CENTER_X + gx * TOWER_SPACING, CENTER_Z + gz * TOWER_SPACING])
}

function statusColor(node: TowerNode): number {
  if (node.load >= 90)
    return 0xFF5544
  if (node.load >= 70)
    return 0xFFC83D
  return 0x5DFFB0
}

export function createEngine(canvas: HTMLCanvasElement, seed: number, night: boolean) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  const scene = new THREE.Scene()
  const skyColor = new THREE.Color(night ? 0x0A1024 : 0x8EC5FF)
  scene.background = skyColor
  scene.fog = new THREE.Fog(skyColor, 46, 120)
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400)

  const atlas = new THREE.CanvasTexture(getAtlas())
  atlas.magFilter = THREE.NearestFilter
  atlas.minFilter = THREE.NearestFilter
  atlas.colorSpace = THREE.SRGBColorSpace
  const daylight = new THREE.Color(night ? 0x6A7CB0 : 0xFFFFFF)
  const opaqueMaterial = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, color: daylight, alphaTest: 0.5 })
  const transparentMaterial = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, color: daylight, transparent: true, depthWrite: false, side: THREE.DoubleSide })

  if (night) {
    const stars = new Float32Array(600 * 3)
    for (let i = 0; i < 600; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random())
      stars[i * 3] = CENTER_X + 300 * Math.sin(phi) * Math.cos(theta)
      stars[i * 3 + 1] = 300 * Math.cos(phi)
      stars[i * 3 + 2] = CENTER_Z + 300 * Math.sin(phi) * Math.sin(theta)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3))
    scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 1.6, sizeAttenuation: false, fog: false })))
  }

  // ===== world =====
  let world = new World(seed, 22)
  const chunksX = WORLD_X / CHUNK
  const chunksZ = WORLD_Z / CHUNK
  const chunkMeshes = new Map<string, THREE.Mesh[]>()
  const dirty = new Set<string>()
  const protectedBlocks = new Map<number, string>()
  let towers: Tower[] = []
  let towerSignature = ''

  function loadEdits(): [number, number][] {
    try {
      const saved = JSON.parse(localStorage.getItem(EDITS_KEY) || 'null')
      if (saved?.seed === seed && Array.isArray(saved.edits))
        return saved.edits
    }
    catch {}
    return []
  }
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  function saveEdits() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(EDITS_KEY, JSON.stringify({ seed, edits: [...world.edits].slice(-6000) }))
      }
      catch {}
    }, 800)
  }
  world.applyEdits(loadEdits())

  function toBufferGeometry(data: ChunkGeometry): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(data.color, 3))
    geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
    geometry.computeBoundingSphere()
    return geometry
  }
  function rebuildChunk(key: string) {
    const [cx, cz] = key.split(',').map(Number) as [number, number]
    for (const mesh of chunkMeshes.get(key) ?? []) {
      scene.remove(mesh)
      mesh.geometry.dispose()
    }
    const data = meshChunk(world, cx, cz)
    const meshes: THREE.Mesh[] = []
    if (data.opaque.index.length)
      meshes.push(new THREE.Mesh(toBufferGeometry(data.opaque), opaqueMaterial))
    if (data.transparent.index.length) {
      const mesh = new THREE.Mesh(toBufferGeometry(data.transparent), transparentMaterial)
      mesh.renderOrder = 1
      meshes.push(mesh)
    }
    for (const mesh of meshes)
      scene.add(mesh)
    chunkMeshes.set(key, meshes)
  }
  function markDirty(x: number, z: number) {
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    for (const [dx, dz] of [[0, 0], [x % CHUNK === 0 ? -1 : 0, 0], [x % CHUNK === CHUNK - 1 ? 1 : 0, 0], [0, z % CHUNK === 0 ? -1 : 0], [0, z % CHUNK === CHUNK - 1 ? 1 : 0]] as const) {
      const nx = cx + dx
      const nz = cz + dz
      if (nx >= 0 && nx < chunksX && nz >= 0 && nz < chunksZ)
        dirty.add(`${nx},${nz}`)
    }
  }
  function rebuildAll() {
    for (let cz = 0; cz < chunksZ; cz++) {
      for (let cx = 0; cx < chunksX; cx++)
        dirty.add(`${cx},${cz}`)
    }
  }
  rebuildAll()

  // ===== node towers =====
  const beamGeometry = new THREE.BoxGeometry(0.36, 70, 0.36)
  const glowGeometry = new THREE.BoxGeometry(0.8, 70, 0.8)
  function drawLabel(tower: Tower) {
    const text = `${tower.node.name}\n${tower.node.line}`
    if (text === tower.labelText)
      return
    tower.labelText = text
    const texture = tower.label.material.map as THREE.CanvasTexture
    const labelCanvas = texture.image as HTMLCanvasElement
    const ctx = labelCanvas.getContext('2d')!
    ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
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
  function setNodes(nodes: TowerNode[]) {
    const signature = nodes.map(node => node.uuid).join(',')
    if (signature !== towerSignature) {
      // layout changed: regenerate the terrain with a plaza big enough, then rebuild every tower
      towerSignature = signature
      for (const tower of towers) {
        scene.remove(tower.beam, tower.glow, tower.label)
        ;(tower.label.material.map as THREE.Texture).dispose()
        tower.label.material.dispose()
        ;(tower.beam.material as THREE.Material).dispose()
        ;(tower.glow.material as THREE.Material).dispose()
      }
      const edits = [...world.edits]
      const radius = Math.max(14, (Math.ceil(Math.sqrt(nodes.length + 1)) / 2 + 1.5) * TOWER_SPACING)
      world = new World(seed, Math.min(radius, WORLD_X / 2 - 12))
      protectedBlocks.clear()
      const slots = towerSlots(nodes.length)
      towers = nodes.map((node, i) => {
        const [x, z] = slots[i]!
        const y = PLAZA_Y + 1
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            world.set(x + dx, y, z + dz, IRON)
            protectedBlocks.set(world.index(x + dx, y, z + dz), node.uuid)
            protectedBlocks.set(world.index(x + dx, y - 1, z + dz), node.uuid)
          }
        }
        protectedBlocks.set(world.index(x, y + 1, z), node.uuid)
        const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: night ? 0.85 : 0.8, depthWrite: false, fog: false }))
        const glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false, fog: false }))
        beam.position.set(x + 0.5, y + 2 + 35, z + 0.5)
        glow.position.copy(beam.position)
        const labelCanvas = document.createElement('canvas')
        labelCanvas.width = 384
        labelCanvas.height = 108
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), transparent: true, depthWrite: false }))
        label.scale.set(3.4, 0.96, 1)
        label.position.set(x + 0.5, y + 3.3, z + 0.5)
        label.renderOrder = 3
        scene.add(beam, glow, label)
        return { node, x, z, y, beam, glow, label, labelText: '' }
      })
      // player edits survive, except where a tower now stands
      world.applyEdits(edits.filter(([index]) => !protectedBlocks.has(index)))
      rebuildAll()
    }
    nodes.forEach((node, i) => {
      const tower = towers[i]!
      tower.node = node
      const top = node.online ? BEACON : LAMP_OFF
      if (world.get(tower.x, tower.y + 1, tower.z) !== top) {
        world.set(tower.x, tower.y + 1, tower.z, top)
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
  const position = new THREE.Vector3(CENTER_X + 0.5, PLAZA_Y + 1.01, CENTER_Z + 0.5)
  const velocity = new THREE.Vector3()
  let yaw = Math.PI * 0.25
  let pitch = -0.1
  let onGround = false
  const keys = new Set<string>()
  let lastSpace = 0

  function collides(x: number, y: number, z: number): boolean {
    for (let by = Math.floor(y); by <= Math.floor(y + PLAYER_HEIGHT - 0.001); by++) {
      for (let bz = Math.floor(z - PLAYER_HALF); bz <= Math.floor(z + PLAYER_HALF); bz++) {
        for (let bx = Math.floor(x - PLAYER_HALF); bx <= Math.floor(x + PLAYER_HALF); bx++) {
          if (isSolid(world.get(bx, by, bz)))
            return true
        }
      }
    }
    // invisible walls at the edge of the world
    return x < PLAYER_HALF || z < PLAYER_HALF || x > WORLD_X - PLAYER_HALF || z > WORLD_Z - PLAYER_HALF
  }
  function respawn() {
    position.set(CENTER_X + 0.5, world.surface(CENTER_X, CENTER_Z) + 1.01, CENTER_Z + 0.5)
    velocity.set(0, 0, 0)
  }
  function updatePlayer(dt: number) {
    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
    const speed = (game.flying ? 11 : 4.4) * (keys.has('ControlLeft') ? 1.5 : 1)
    const sin = Math.sin(yaw)
    const cos = Math.cos(yaw)
    const length = Math.hypot(forward, strafe) || 1
    velocity.x = (-sin * forward + cos * strafe) / length * speed
    velocity.z = (-cos * forward - sin * strafe) / length * speed
    if (game.flying) {
      velocity.y = ((keys.has('Space') ? 1 : 0) - (keys.has('ShiftLeft') ? 1 : 0)) * 8
    }
    else {
      const inWater = world.get(Math.floor(position.x), Math.floor(position.y + 0.4), Math.floor(position.z)) === WATER
      velocity.y -= (inWater ? 8 : 26) * dt
      if (inWater) {
        velocity.y = Math.max(velocity.y, -2.5)
        if (keys.has('Space'))
          velocity.y = 3
      }
      else if (keys.has('Space') && onGround) {
        velocity.y = 8.2
      }
    }
    // move one axis at a time so the player slides along walls
    const nextX = position.x + velocity.x * dt
    if (!collides(nextX, position.y, position.z))
      position.x = nextX
    const nextZ = position.z + velocity.z * dt
    if (!collides(position.x, position.y, nextZ))
      position.z = nextZ
    const nextY = position.y + velocity.y * dt
    if (!collides(position.x, nextY, position.z)) {
      position.y = nextY
      onGround = false
    }
    else {
      if (velocity.y < 0) {
        position.y = Math.floor(nextY) + 1.001
        onGround = true
      }
      velocity.y = 0
    }
    if (position.y < -20 || position.y > WORLD_Y + 60)
      respawn()
  }

  // ===== aiming =====
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75 }),
  )
  outline.visible = false
  scene.add(outline)
  let target: { x: number, y: number, z: number, nx: number, ny: number, nz: number } | null = null
  const direction = new THREE.Vector3()

  function raycast() {
    camera.getWorldDirection(direction)
    let x = Math.floor(camera.position.x)
    let y = Math.floor(camera.position.y)
    let z = Math.floor(camera.position.z)
    const step = [Math.sign(direction.x), Math.sign(direction.y), Math.sign(direction.z)]
    const delta = [Math.abs(1 / direction.x), Math.abs(1 / direction.y), Math.abs(1 / direction.z)]
    const origin = [camera.position.x, camera.position.y, camera.position.z]
    const cell = [x, y, z]
    const side = [0, 1, 2].map(i => (step[i]! > 0 ? cell[i]! + 1 - origin[i]! : origin[i]! - cell[i]!) * delta[i]!)
    let normal = [0, 0, 0]
    target = null
    for (let i = 0; i < 64; i++) {
      const id = world.get(x, y, z)
      if (id !== AIR && id !== WATER) {
        target = { x, y, z, nx: normal[0]!, ny: normal[1]!, nz: normal[2]! }
        break
      }
      const axis = side[0]! < side[1]! ? (side[0]! < side[2]! ? 0 : 2) : (side[1]! < side[2]! ? 1 : 2)
      if (side[axis]! > REACH)
        break
      side[axis] = side[axis]! + delta[axis]!
      normal = [0, 0, 0]
      normal[axis] = -step[axis]!
      if (axis === 0)
        x += step[0]!
      else if (axis === 1)
        y += step[1]!
      else z += step[2]!
    }
    outline.visible = !!target && game.playing
    if (target) {
      outline.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
      game.targetNode = protectedBlocks.get(world.index(target.x, target.y, target.z)) ?? null
      game.targetBlock = BLOCK_NAMES[world.get(target.x, target.y, target.z)] ?? ''
    }
    else {
      game.targetNode = null
      game.targetBlock = ''
    }
  }
  function editBlock(x: number, y: number, z: number, id: number) {
    const index = world.index(x, y, z)
    world.set(x, y, z, id)
    world.edits.set(index, id)
    markDirty(x, z)
    saveEdits()
  }
  function breakBlock() {
    if (!target)
      return
    const { x, y, z } = target
    if (protectedBlocks.has(world.index(x, y, z)) || world.get(x, y, z) === BEDROCK)
      return
    editBlock(x, y, z, AIR)
  }
  function placeBlock() {
    if (!target)
      return
    if (game.targetNode) {
      // right click on a node's tower opens that node
      game.openedNode = game.targetNode
      document.exitPointerLock()
      return
    }
    const x = target.x + target.nx
    const y = target.y + target.ny
    const z = target.z + target.nz
    if (!world.inside(x, y, z) || protectedBlocks.has(world.index(x, y, z)))
      return
    const id = world.get(x, y, z)
    if (id !== AIR && id !== WATER)
      return
    // never place a block inside the player
    const overlapsPlayer = x + 1 > position.x - PLAYER_HALF && x < position.x + PLAYER_HALF
      && z + 1 > position.z - PLAYER_HALF && z < position.z + PLAYER_HALF
      && y + 1 > position.y && y < position.y + PLAYER_HEIGHT
    if (!overlapsPlayer)
      editBlock(x, y, z, HOTBAR[game.slot]!)
  }

  // ===== input =====
  function onPointerLockChange() {
    game.playing = document.pointerLockElement === canvas
    if (!game.playing)
      keys.clear()
  }
  function onMouseMove(event: MouseEvent) {
    if (!game.playing)
      return
    yaw -= event.movementX * 0.0024
    pitch = Math.max(-1.55, Math.min(1.55, pitch - event.movementY * 0.0024))
  }
  function onMouseDown(event: MouseEvent) {
    if (!game.playing)
      return
    if (event.button === 0)
      breakBlock()
    else if (event.button === 2)
      placeBlock()
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!game.playing)
      return
    event.preventDefault()
    keys.add(event.code)
    if (event.code.startsWith('Digit')) {
      const slot = Number(event.code.slice(5)) - 1
      if (slot >= 0 && slot < HOTBAR.length)
        game.slot = slot
    }
    if (event.code === 'KeyF' && !event.repeat)
      game.flying = !game.flying
    if (event.code === 'KeyR' && !event.repeat)
      respawn()
    if (event.code === 'KeyE' && !event.repeat && game.targetNode) {
      game.openedNode = game.targetNode
      document.exitPointerLock()
    }
    if (event.code === 'Space' && !event.repeat) {
      // double tap toggles flying, as in creative mode
      const now = performance.now()
      if (now - lastSpace < 280)
        game.flying = !game.flying
      lastSpace = now
    }
  }
  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code)
  }
  function onWheel(event: WheelEvent) {
    if (!game.playing)
      return
    game.slot = (game.slot + (event.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length
  }
  const onContextMenu = (event: Event) => event.preventDefault()
  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('wheel', onWheel, { passive: true })
  canvas.addEventListener('contextmenu', onContextMenu)

  controls.enter = () => {
    game.openedNode = null
    canvas.requestPointerLock()
  }
  controls.resetWorld = () => {
    try {
      localStorage.removeItem(EDITS_KEY)
    }
    catch {}
    world.edits.clear()
    towerSignature = ''
    setNodes(towers.map(tower => tower.node))
    respawn()
  }

  // ===== loop =====
  let frame = 0
  let running = true
  let paused = false
  let last = performance.now()
  let orbit = 0
  let frames = 0
  let fpsAt = last
  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
    }
  }
  function tick(now: number) {
    if (!running)
      return
    frame = requestAnimationFrame(tick)
    const dt = Math.min(0.05, (now - last) / 1000)
    if (paused || document.hidden) {
      last = now
      return
    }
    // the menu panorama does not need more than ~30 fps
    if (!game.playing && now - last < 30)
      return
    last = now
    resize()
    // rebuild at most a few chunks per frame so edits never stall a frame
    let budget = game.ready ? 3 : 64
    for (const key of dirty) {
      rebuildChunk(key)
      dirty.delete(key)
      if (--budget <= 0)
        break
    }
    if (game.playing) {
      updatePlayer(dt)
      camera.position.set(position.x, position.y + EYE, position.z)
      camera.rotation.set(pitch, yaw, 0, 'YXZ')
      raycast()
      game.position = [position.x, position.y, position.z]
    }
    else {
      // title-screen panorama: a slow orbit around the plaza
      orbit += dt * 0.05
      const radius = world.plazaRadius + 16
      camera.position.set(CENTER_X + Math.cos(orbit) * radius, PLAZA_Y + 17, CENTER_Z + Math.sin(orbit) * radius)
      camera.lookAt(CENTER_X, PLAZA_Y + 4, CENTER_Z)
      outline.visible = false
    }
    renderer.render(scene, camera)
    game.ready = true
    frames++
    if (now - fpsAt >= 1000) {
      game.fps = Math.round(frames * 1000 / (now - fpsAt))
      frames = 0
      fpsAt = now
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
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
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
