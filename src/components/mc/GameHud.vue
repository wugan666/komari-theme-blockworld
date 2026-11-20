<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { blockIcon, blockName } from '@/game/blocks'
import { game } from '@/game/state'
import { useNodesStore } from '@/stores/nodes'

// 游戏中的界面：准星、快捷栏、调试信息和操作提示
const nodesStore = useNodesStore()
const slots = computed(() => game.hotbar.map(id => ({ id, name: blockName(id), icon: blockIcon(id) })))
const targetName = computed(() => nodesStore.nodes.find(node => node.uuid === game.targetNode)?.name)
const coords = computed(() => game.position.map(value => value.toFixed(1)).join(' / '))
const clock = computed(() => {
  // 0 = 06:00 日出，0.25 = 正午
  const minutes = Math.floor(((game.time + 0.25) % 1) * 1440)
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

// 切换物品时，物品名浮现两秒后淡出
const nameVisible = ref(true)
const nameKey = ref(0)
let nameTimer: ReturnType<typeof setTimeout> | undefined
watch(() => [game.slot, game.hotbar[game.slot]], () => {
  nameKey.value++
  nameVisible.value = true
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => {
    nameVisible.value = false
  }, 2000)
}, { immediate: true })
</script>

<template>
  <div class="mc-hud">
    <div class="mc-crosshair" />
    <div class="mc-debug">
      <div>Blockworld · {{ game.fps }} fps · {{ game.chunks }} 区块</div>
      <div>XYZ: {{ coords }}</div>
      <div>{{ game.biome }} · {{ clock }}<template v-if="game.flying"> · 飞行中</template></div>
    </div>
    <div class="mc-keys">
      <div>WASD 移动 · 空格 跳跃 · 双击 W / Ctrl 疾跑 · Shift 潜行 · 双击空格 飞行</div>
      <div>按住左键 挖掘 · 右键 放置 · 中键 选取 · E 物品栏 · 1-9 / 滚轮 · Esc 菜单</div>
    </div>
    <Transition name="mc-tip">
      <div v-if="targetName" class="mc-tip">
        {{ targetName }} —— 右键或按 E 查看
      </div>
    </Transition>
    <Transition name="mc-item-name">
      <div v-if="nameVisible" :key="nameKey" class="mc-hotbar-name">
        {{ slots[game.slot]?.name }}
      </div>
    </Transition>
    <div class="mc-hotbar">
      <div v-for="(slot, index) in slots" :key="index" class="mc-slot" :class="{ 'mc-slot-active': index === game.slot }">
        <i :key="slot.id" :style="{ backgroundImage: `url(${slot.icon})` }" /><span>{{ index + 1 }}</span>
      </div>
    </div>
  </div>
</template>
