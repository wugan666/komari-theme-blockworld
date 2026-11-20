import { reactive } from 'vue'

/** Shared between the 3D engine and the Vue interface. */
export const game = reactive({
  /** engine created and first frame drawn */
  ready: false,
  /** WebGL unavailable or the world is switched off */
  unavailable: false,
  /** pointer is locked: the visitor is playing */
  playing: false,
  /** selected hotbar slot */
  slot: 0,
  /** node whose tower the crosshair points at */
  targetNode: null as string | null,
  /** block name under the crosshair */
  targetBlock: '',
  /** node opened from inside the world (right click on its tower) */
  openedNode: null as string | null,
  flying: false,
  fps: 0,
  position: [0, 0, 0] as [number, number, number],
})

/** set by the engine once it exists */
export const controls = {
  enter: () => {},
  resetWorld: () => {},
}
