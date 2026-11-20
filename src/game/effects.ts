import type { World } from './world'
import * as THREE from 'three'
import { blockColor, isCross, isSolid, tileOf, tileUV } from './blocks'

// ===== break / dig particles =====
const MAX_PARTICLES = 320
export function createParticles(scene: THREE.Scene, world: () => World) {
  const positions = new Float32Array(MAX_PARTICLES * 3)
  const colors = new Float32Array(MAX_PARTICLES * 3)
  const velocity = new Float32Array(MAX_PARTICLES * 3)
  const life = new Float32Array(MAX_PARTICLES)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  scene.add(points)
  let cursor = 0
  for (let i = 0; i < MAX_PARTICLES; i++)
    positions[i * 3 + 1] = -999

  return {
    material,
    /** spray fragments of a block from inside its cell */
    burst(x: number, y: number, z: number, id: number, count: number, daylight: number) {
      const [r, g, b] = blockColor(id)
      for (let n = 0; n < count; n++) {
        const i = cursor
        cursor = (cursor + 1) % MAX_PARTICLES
        positions[i * 3] = x + 0.15 + Math.random() * 0.7
        positions[i * 3 + 1] = y + 0.15 + Math.random() * 0.7
        positions[i * 3 + 2] = z + 0.15 + Math.random() * 0.7
        velocity[i * 3] = (Math.random() - 0.5) * 3
        velocity[i * 3 + 1] = Math.random() * 3.4 + 0.6
        velocity[i * 3 + 2] = (Math.random() - 0.5) * 3
        const shade = (0.7 + Math.random() * 0.4) * daylight
        colors[i * 3] = r * shade
        colors[i * 3 + 1] = g * shade
        colors[i * 3 + 2] = b * shade
        life[i] = 0.45 + Math.random() * 0.4
      }
      geometry.attributes.color!.needsUpdate = true
    },
    update(dt: number) {
      let alive = false
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (life[i]! <= 0)
          continue
        alive = true
        life[i] = life[i]! - dt
        if (life[i]! <= 0) {
          positions[i * 3 + 1] = -999
          continue
        }
        velocity[i * 3 + 1] = velocity[i * 3 + 1]! - 14 * dt
        const nx = positions[i * 3]! + velocity[i * 3]! * dt
        const ny = positions[i * 3 + 1]! + velocity[i * 3 + 1]! * dt
        const nz = positions[i * 3 + 2]! + velocity[i * 3 + 2]! * dt
        // settle on the ground instead of falling through it
        if (isSolid(world().get(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
          velocity[i * 3] = 0
          velocity[i * 3 + 1] = 0
          velocity[i * 3 + 2] = 0
        }
        else {
          positions[i * 3] = nx
          positions[i * 3 + 1] = ny
          positions[i * 3 + 2] = nz
        }
      }
      if (alive)
        geometry.attributes.position!.needsUpdate = true
    },
  }
}

// ===== the block held in the hand =====
function blockGeometry(id: number): THREE.BufferGeometry {
  if (isCross(id)) {
    // flowers and grass are held as a flat card
    const geometry = new THREE.PlaneGeometry(1, 1)
    const [u0, v0, u1, v1] = tileUV(tileOf(id, 2))
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([u0, v1, u1, v1, u0, v0, u1, v0]), 2))
    return geometry
  }
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const uv = geometry.attributes.uv as THREE.BufferAttribute
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; four vertices each
  const faces: (0 | 1 | 2)[] = [2, 2, 0, 1, 2, 2]
  for (let face = 0; face < 6; face++) {
    const [u0, v0, u1, v1] = tileUV(tileOf(id, faces[face]!))
    uv.setXY(face * 4, u0, v1)
    uv.setXY(face * 4 + 1, u1, v1)
    uv.setXY(face * 4 + 2, u0, v0)
    uv.setXY(face * 4 + 3, u1, v0)
  }
  const colors = new Float32Array(24 * 3)
  const shades = [0.62, 0.62, 1, 0.5, 0.8, 0.8]
  for (let i = 0; i < 24; i++)
    colors.fill(shades[Math.floor(i / 4)]!, i * 3, i * 3 + 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/** The first-person hand: its own tiny scene drawn over the world. */
export function createHand(atlas: THREE.Texture) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 10)
  const material = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide })
  const pivot = new THREE.Group()
  scene.add(pivot)
  let mesh: THREE.Mesh | null = null
  let shown = 0
  let swing = 1
  let equip = 1
  let swayX = 0
  let swayY = 0

  function show(id: number) {
    if (id === shown)
      return
    shown = id
    if (mesh) {
      pivot.remove(mesh)
      mesh.geometry.dispose()
    }
    mesh = new THREE.Mesh(blockGeometry(id), material)
    mesh.scale.setScalar(isCross(id) ? 0.42 : 0.33)
    pivot.add(mesh)
    equip = 0
  }
  return {
    scene,
    camera,
    material,
    show,
    swing() {
      swing = 0
    },
    /** mouse movement makes the hand lag behind a little */
    nudge(dx: number, dy: number) {
      swayX = THREE.MathUtils.clamp(swayX + dx * 0.0006, -0.08, 0.08)
      swayY = THREE.MathUtils.clamp(swayY + dy * 0.0006, -0.08, 0.08)
    },
    update(dt: number, bobX: number, bobY: number, aspect: number, daylight: number) {
      swing = Math.min(1, swing + dt * 4.2)
      equip = Math.min(1, equip + dt * 4.5)
      swayX *= Math.max(0, 1 - dt * 8)
      swayY *= Math.max(0, 1 - dt * 8)
      const arc = Math.sin(swing * Math.PI)
      const dip = (1 - equip) * 0.55
      pivot.position.set(0.66 - arc * 0.22 + bobX * 0.5 - swayX, -0.5 - arc * 0.12 - dip + bobY * 0.5 + swayY, -1.1 - arc * 0.18)
      pivot.rotation.set(0.12 - arc * 0.9, -0.62 + arc * 0.35, 0.02)
      material.color.setScalar(daylight)
      if (camera.aspect !== aspect) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
    },
  }
}

// ===== animals =====
interface Mob {
  group: THREE.Group
  legs: THREE.Mesh[]
  materials: { material: THREE.MeshBasicMaterial, base: THREE.Color }[]
  x: number
  y: number
  z: number
  yaw: number
  targetYaw: number
  vy: number
  walking: boolean
  timer: number
  phase: number
}
const KINDS = [
  { body: [0.9, 0.9, 1.3], color: 0xF0A5A2, head: 0xEE9E9A, leg: 0xE89490, legHeight: 0.4 }, // pig
  { body: [0.95, 0.95, 1.35], color: 0xF2F2F2, head: 0xC8B7A6, leg: 0xD8CEC2, legHeight: 0.55 }, // sheep
  { body: [0.9, 1, 1.5], color: 0x6B4A32, head: 0x5C3F2A, leg: 0x4B3322, legHeight: 0.65 }, // cow
] as const

export function createMobs(scene: THREE.Scene, world: () => World) {
  const mobs: Mob[] = []
  function build(kind: typeof KINDS[number]): Pick<Mob, 'group' | 'legs' | 'materials'> {
    const group = new THREE.Group()
    const materials: Mob['materials'] = []
    const part = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, shade = 1) => {
      const base = new THREE.Color(color).multiplyScalar(shade)
      const material = new THREE.MeshBasicMaterial({ color: base.clone() })
      materials.push({ material, base })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
      mesh.position.set(x, y, z)
      group.add(mesh)
      return mesh
    }
    const [bw, bh, bd] = kind.body
    part(bw, bh, bd, kind.color, 0, kind.legHeight + bh / 2, 0)
    part(bw * 0.72, bw * 0.72, bw * 0.7, kind.head, 0, kind.legHeight + bh * 0.72, bd / 2 + bw * 0.25, 0.94)
    const legs: THREE.Mesh[] = []
    for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
      const leg = part(0.26, kind.legHeight, 0.26, kind.leg, lx * (bw / 2 - 0.15), kind.legHeight / 2, lz * (bd / 2 - 0.18), 0.86)
      // pivot at the hip so the leg swings from its top
      leg.geometry.translate(0, -kind.legHeight / 2, 0)
      leg.position.y = kind.legHeight
      legs.push(leg)
    }
    return { group, legs, materials }
  }
  function spawn(px: number, pz: number): boolean {
    const angle = Math.random() * Math.PI * 2
    const distance = 18 + Math.random() * 22
    const x = Math.floor(px + Math.cos(angle) * distance)
    const z = Math.floor(pz + Math.sin(angle) * distance)
    const ground = world().surface(x, z)
    const below = world().get(x, ground, z)
    // only on grass, never in the node plaza
    if ((below !== 1 && below !== 39) || Math.hypot(x, z) < world().plazaRadius + 3)
      return false
    const built = build(KINDS[Math.floor(Math.random() * KINDS.length)]!)
    const mob: Mob = { ...built, x: x + 0.5, y: ground + 1, z: z + 0.5, yaw: Math.random() * 6.28, targetYaw: 0, vy: 0, walking: false, timer: Math.random() * 3, phase: 0 }
    mob.targetYaw = mob.yaw
    scene.add(mob.group)
    mobs.push(mob)
    return true
  }
  function remove(index: number) {
    const mob = mobs[index]!
    scene.remove(mob.group)
    mob.group.traverse((object) => {
      if (object instanceof THREE.Mesh)
        object.geometry.dispose()
    })
    for (const { material } of mob.materials)
      material.dispose()
    mobs.splice(index, 1)
  }
  return {
    update(dt: number, px: number, pz: number, enabled: boolean, daylight: number) {
      if (!enabled) {
        while (mobs.length) remove(0)
        return
      }
      if (mobs.length < 9 && Math.random() < dt * 0.8)
        spawn(px, pz)
      for (let i = mobs.length - 1; i >= 0; i--) {
        const mob = mobs[i]!
        if (Math.hypot(mob.x - px, mob.z - pz) > 80) {
          remove(i)
          continue
        }
        mob.timer -= dt
        if (mob.timer <= 0) {
          mob.walking = !mob.walking && Math.random() < 0.8
          mob.timer = mob.walking ? 1.5 + Math.random() * 3 : 1 + Math.random() * 4
          if (mob.walking)
            mob.targetYaw = mob.yaw + (Math.random() - 0.5) * 3
        }
        mob.yaw += (mob.targetYaw - mob.yaw) * Math.min(1, dt * 4)
        const w = world()
        if (mob.walking) {
          const nx = mob.x + Math.sin(mob.yaw) * dt * 1.1
          const nz = mob.z + Math.cos(mob.yaw) * dt * 1.1
          const fx = Math.floor(nx + Math.sin(mob.yaw) * 0.5)
          const fz = Math.floor(nz + Math.cos(mob.yaw) * 0.5)
          const feet = Math.floor(mob.y + 0.01)
          const ahead = w.get(fx, feet, fz)
          const drop = !isSolid(w.get(fx, feet - 1, fz)) && !isSolid(w.get(fx, feet - 2, fz))
          if (ahead === 11 || w.get(fx, feet - 1, fz) === 11 || drop) {
            // water or a cliff ahead: turn around
            mob.targetYaw = mob.yaw + Math.PI * (0.6 + Math.random() * 0.8)
            mob.timer = 1
          }
          else if (isSolid(ahead)) {
            if (!isSolid(w.get(fx, feet + 1, fz)) && mob.vy === 0)
              mob.vy = 6.4
            else if (mob.vy === 0)
              mob.targetYaw = mob.yaw + Math.PI / 2
          }
          else {
            mob.x = nx
            mob.z = nz
          }
          if (isSolid(ahead) && mob.vy > 0) {
            mob.x = nx
            mob.z = nz
          }
          mob.phase += dt * 9
        }
        else {
          mob.phase *= Math.max(0, 1 - dt * 6)
        }
        mob.vy -= 22 * dt
        const ny = mob.y + mob.vy * dt
        if (mob.vy <= 0 && isSolid(w.get(Math.floor(mob.x), Math.floor(ny), Math.floor(mob.z)))) {
          mob.y = Math.floor(ny) + 1
          mob.vy = 0
        }
        else {
          mob.y = ny
        }
        if (mob.y < -10) {
          remove(i)
          continue
        }
        mob.group.position.set(mob.x, mob.y, mob.z)
        mob.group.rotation.y = mob.yaw
        const swing = Math.sin(mob.phase) * 0.6 * (mob.walking ? 1 : 0.2)
        mob.legs[0]!.rotation.x = swing
        mob.legs[3]!.rotation.x = swing
        mob.legs[1]!.rotation.x = -swing
        mob.legs[2]!.rotation.x = -swing
        for (const { material, base } of mob.materials)
          material.color.copy(base).multiplyScalar(daylight)
      }
    },
    count: () => mobs.length,
  }
}
