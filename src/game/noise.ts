// Deterministic hashing and value noise. Everything in the world is derived
// from these, so the same seed always produces the same terrain.

export function hash2(x: number, z: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
export function hash3(x: number, y: number, z: number, seed: number): number {
  return hash2(x + Math.imul(y, 7919), z - Math.imul(y, 104729), seed)
}
export function valueNoise(x: number, z: number, seed: number): number {
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
/** fractal noise in 0..1 */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let value = 0
  let amplitude = 0.5
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise(x, z, seed + i * 31)
    total += amplitude
    x *= 2.03
    z *= 2.03
    amplitude *= 0.5
  }
  return value / total
}
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}
