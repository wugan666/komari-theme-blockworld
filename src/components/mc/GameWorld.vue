<script setup lang="ts">
import type { TowerNode } from '@/game/engine'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { game } from '@/game/state'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'

// 3D 世界的画布：引擎和 three.js 按需加载，离开首页时暂停渲染
const appStore = useAppStore()
const nodesStore = useNodesStore()
const route = useRoute()
const canvas = ref<HTMLCanvasElement>()
let engine: Awaited<ReturnType<typeof start>> | undefined
let disposed = false

function towerNodes(): TowerNode[] {
  return [...nodesStore.nodes]
    .sort((a, b) => a.weight - b.weight || a.name.localeCompare(b.name))
    .map((node) => {
      const memory = node.mem_total > 0 ? (node.ram ?? 0) / node.mem_total * 100 : 0
      return {
        uuid: node.uuid,
        name: node.name,
        online: node.online,
        load: Math.max(node.cpu ?? 0, memory),
        line: node.online ? `CPU ${(node.cpu ?? 0).toFixed(0)}%  RAM ${memory.toFixed(0)}%` : 'OFFLINE',
      }
    })
}
async function start() {
  const { createEngine } = await import('@/game/engine')
  return createEngine(canvas.value!, appStore.worldSeed, appStore.worldNight)
}

onMounted(async () => {
  try {
    // 像素字体就绪后再画名牌，否则第一批名牌会用系统字体
    await document.fonts?.load('bold 30px "Pixelify Sans"').catch(() => {})
    const created = await start()
    if (disposed) {
      created.dispose()
      return
    }
    engine = created
    engine.setNodes(towerNodes())
    engine.setPaused(route.name !== 'home')
  }
  catch (error) {
    console.warn('[Blockworld] 3D world unavailable:', error)
    game.unavailable = true
  }
})
watch(() => nodesStore.nodes, () => engine?.setNodes(towerNodes()), { deep: true })
watch(() => route.name, name => engine?.setPaused(name !== 'home'))
onBeforeUnmount(() => {
  disposed = true
  engine?.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="mc-world" aria-hidden="true" />
</template>
