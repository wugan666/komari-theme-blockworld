import { useStorage } from '@vueuse/core'
import { reactive } from 'vue'
import { DEFAULT_HOTBAR } from './blocks'

export type Screen = 'title' | 'servers' | 'options' | 'pause' | 'inventory' | null

/** Per-visitor game options (the Options screen), kept in the browser. */
export const options = useStorage('blockworld:options', {
  fov: 70,
  renderDistance: 6,
  bobbing: true,
  sound: true,
  mobs: true,
  /** 'site' follows the theme setting; otherwise the visitor's own choice */
  time: 'site' as 'site' | 'cycle' | 'day' | 'night',
}, undefined, { mergeDefaults: true })

/** Shared between the 3D engine and the Vue interface. */
export const game = reactive({
  /** engine created and first frame drawn */
  ready: false,
  /** WebGL unavailable or the world is switched off */
  unavailable: false,
  /** pointer is locked: the visitor is playing */
  playing: false,
  /** which menu screen is open; null while playing */
  screen: 'title' as Screen,
  /** blocks in the hotbar */
  hotbar: [...DEFAULT_HOTBAR],
  /** selected hotbar slot */
  slot: 0,
  /** node whose tower the crosshair points at */
  targetNode: null as string | null,
  /** block name under the crosshair */
  targetBlock: '',
  /** node opened from inside the world (right click on its tower) */
  openedNode: null as string | null,
  /** node picked in the server list; its tower is highlighted in the world */
  selectedNode: null as string | null,
  flying: false,
  fps: 0,
  chunks: 0,
  position: [0, 0, 0] as [number, number, number],
  biome: '',
  /** 0..1, 0 = sunrise, 0.25 = noon */
  time: 0.1,
})

/** set by the engine once it exists */
export const controls = {
  enter: () => {},
  resetWorld: () => {},
}
