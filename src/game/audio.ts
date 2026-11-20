import { options } from './state'

// Tiny synthesised sound effects (filtered noise bursts). Nothing is sampled
// from any game; the context is created on the first click, as browsers require.

type Sound = 'stone' | 'dirt' | 'wood' | 'glass' | 'sand' | 'plant' | 'cloth'
const TONE: Record<Sound, [frequency: number, q: number]> = {
  stone: [900, 1.2],
  dirt: [420, 0.8],
  wood: [620, 2.2],
  glass: [2600, 3],
  sand: [1500, 0.5],
  plant: [1900, 0.7],
  cloth: [520, 0.6],
}

let context: AudioContext | null = null
let noise: AudioBuffer | null = null

export function unlockAudio(): void {
  if (context || typeof AudioContext === 'undefined')
    return
  try {
    context = new AudioContext()
    noise = context.createBuffer(1, context.sampleRate * 0.4, context.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++)
      data[i] = Math.random() * 2 - 1
  }
  catch {
    context = null
  }
}

function burst(sound: Sound, volume: number, duration: number, pitch = 1): void {
  if (!context || !noise || !options.value.sound)
    return
  if (context.state === 'suspended')
    void context.resume()
  const [frequency, q] = TONE[sound]
  const source = context.createBufferSource()
  source.buffer = noise
  source.playbackRate.value = 0.8 + Math.random() * 0.4
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = frequency * pitch * (0.9 + Math.random() * 0.2)
  filter.Q.value = q
  const gain = context.createGain()
  const now = context.currentTime
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  source.connect(filter).connect(gain).connect(context.destination)
  source.start(now, Math.random() * 0.2, duration)
}

export const playBreak = (sound: Sound) => burst(sound, 0.5, 0.22)
export const playPlace = (sound: Sound) => burst(sound, 0.42, 0.12, 0.8)
export const playDig = (sound: Sound) => burst(sound, 0.16, 0.07, 1.2)
export const playStep = (sound: Sound) => burst(sound, 0.09, 0.06, 0.9)
export const playClick = () => burst('wood', 0.25, 0.04, 2.4)
