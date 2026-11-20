import * as THREE from 'three'

// Sky colour, a square sun and moon, stars and a blocky cloud layer. The
// clouds are one big plane with a generated texture that scrolls and stays
// anchored to the world while the plane follows the player.

const DAY = new THREE.Color(0x7CB4FF)
const NIGHT = new THREE.Color(0x060A1A)
const DUSK = new THREE.Color(0xF2955A)

function pixelTexture(size: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  paint(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

export function createSky(scene: THREE.Scene) {
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 46),
    new THREE.MeshBasicMaterial({
      map: pixelTexture(8, (ctx) => {
        ctx.fillStyle = '#fff6b0'
        ctx.fillRect(0, 0, 8, 8)
        ctx.fillStyle = '#ffffe6'
        ctx.fillRect(1, 1, 6, 6)
      }),
      fog: false,
      depthWrite: false,
      transparent: true,
    }),
  )
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({
      map: pixelTexture(8, (ctx) => {
        ctx.fillStyle = '#dfe5ee'
        ctx.fillRect(0, 0, 8, 8)
        ctx.fillStyle = '#b4bdcc'
        for (const [x, y] of [[1, 2], [5, 1], [3, 4], [6, 5], [2, 6]] as const)
          ctx.fillRect(x, y, 1, 1)
        ctx.fillRect(4, 5, 2, 1)
      }),
      fog: false,
      depthWrite: false,
      transparent: true,
    }),
  )
  sun.renderOrder = moon.renderOrder = -2

  const starPositions = new Float32Array(900 * 3)
  for (let i = 0; i < 900; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    starPositions[i * 3] = 360 * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = 360 * Math.cos(phi)
    starPositions[i * 3 + 2] = 360 * Math.sin(phi) * Math.sin(theta)
  }
  const starGeometry = new THREE.BufferGeometry()
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xFFFFFF, size: 1.8, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }))
  stars.renderOrder = -3

  // clouds: threshold a small noise grid into solid cells
  const CLOUD_CELLS = 64
  const CLOUD_SIZE = 12
  const cloudTexture = pixelTexture(CLOUD_CELLS, (ctx) => {
    const grid = Array.from({ length: CLOUD_CELLS * CLOUD_CELLS }, () => Math.random())
    const sample = (x: number, y: number) => grid[((y + CLOUD_CELLS) % CLOUD_CELLS) * CLOUD_CELLS + ((x + CLOUD_CELLS) % CLOUD_CELLS)]!
    ctx.clearRect(0, 0, CLOUD_CELLS, CLOUD_CELLS)
    ctx.fillStyle = '#ffffff'
    for (let y = 0; y < CLOUD_CELLS; y++) {
      for (let x = 0; x < CLOUD_CELLS; x++) {
        // average a neighbourhood so cells clump into cloud shapes
        let sum = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -3; dx <= 3; dx++)
            sum += sample(x + dx, y + dy)
        }
        if (sum / 35 > 0.535)
          ctx.fillRect(x, y, 1, 1)
      }
    }
  })
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping
  const span = CLOUD_CELLS * CLOUD_SIZE
  const cloudPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 2, span * 2),
    new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.86, side: THREE.DoubleSide, fog: false, depthWrite: false, alphaTest: 0.05 }),
  )
  cloudTexture.repeat.set(2, 2)
  cloudPlane.rotation.x = -Math.PI / 2
  cloudPlane.position.y = 104
  cloudPlane.renderOrder = 2
  scene.add(sun, moon, stars, cloudPlane)

  const sky = new THREE.Color()
  const cloudTint = new THREE.Color()
  let drift = 0
  return {
    color: sky,
    /** brightness of the world, 0.24 at night to 1 at noon */
    daylight: 1,
    /** time: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight */
    update(time: number, dt: number, camera: THREE.Camera) {
      const angle = time * Math.PI * 2
      const height = Math.sin(angle)
      const day = THREE.MathUtils.smoothstep(height, -0.18, 0.22)
      const dusk = Math.max(0, 1 - Math.abs(height) / 0.28) * 0.75
      sky.copy(NIGHT).lerp(DAY, day).lerp(DUSK, dusk * (0.35 + 0.65 * (1 - day)))
      this.daylight = 0.24 + 0.76 * day
      // the sun rises in the east (+x) and the moon sits opposite
      const distance = 320
      sun.position.set(camera.position.x + Math.cos(angle) * distance, camera.position.y + Math.sin(angle) * distance, camera.position.z + 40)
      moon.position.set(camera.position.x - Math.cos(angle) * distance, camera.position.y - Math.sin(angle) * distance, camera.position.z - 40)
      sun.lookAt(camera.position)
      moon.lookAt(camera.position)
      ;(sun.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.smoothstep(height, -0.12, 0.02)
      ;(moon.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.smoothstep(-height, -0.12, 0.02)
      stars.position.copy(camera.position)
      stars.rotation.z = angle
      ;(stars.material as THREE.PointsMaterial).opacity = 1 - day
      // clouds drift west to east; the texture offset keeps them fixed in the world as the plane follows the camera
      drift += dt * 1.1
      cloudPlane.position.x = camera.position.x
      cloudPlane.position.z = camera.position.z
      cloudTexture.offset.set((camera.position.x - drift) / span, -camera.position.z / span)
      ;(cloudPlane.material as THREE.MeshBasicMaterial).color.copy(cloudTint.setScalar(0.3 + 0.7 * day).lerp(DUSK, dusk * 0.4))
    },
  }
}
