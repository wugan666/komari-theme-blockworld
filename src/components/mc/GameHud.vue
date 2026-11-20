<script setup lang="ts">
import { computed } from 'vue'
import { BLOCK_NAMES, getAtlas, HOTBAR, iconTile } from '@/game/blocks'
import { game } from '@/game/state'
import { useNodesStore } from '@/stores/nodes'

// 游戏中的界面：准星、快捷栏、坐标和操作提示
const nodesStore = useNodesStore()
const atlasUrl = getAtlas().toDataURL()
const slots = HOTBAR.map((id) => {
  const tile = iconTile(id)
  return {
    id,
    name: BLOCK_NAMES[id] ?? '',
    style: {
      backgroundImage: `url(${atlasUrl})`,
      backgroundSize: `${tile.cols * 100}% ${tile.rows * 100}%`,
      backgroundPosition: `${tile.col / (tile.cols - 1) * 100}% ${tile.row / (tile.rows - 1) * 100}%`,
    },
  }
})
const targetName = computed(() => nodesStore.nodes.find(node => node.uuid === game.targetNode)?.name)
const coords = computed(() => game.position.map(value => value.toFixed(1)).join(' / '))
</script>

<template>
  <div class="mc-hud" aria-live="polite">
    <div class="mc-crosshair" />
    <div class="mc-debug">
      <div>Blockworld · {{ game.fps }} fps</div>
      <div>XYZ: {{ coords }}</div>
      <div v-if="game.flying">
        飞行中
      </div>
    </div>
    <div class="mc-keys">
      <div>WASD 移动 · 空格 跳跃 · 双击空格/F 飞行 · Ctrl 疾跑</div>
      <div>左键 破坏 · 右键 放置 · 1-9/滚轮 选方块 · R 回出生点 · Esc 返回菜单</div>
    </div>
    <div v-if="targetName" class="mc-tip">
      {{ targetName }} —— 右键或按 E 查看
    </div>
    <div v-else-if="game.targetBlock" class="mc-tip mc-tip-dim">
      {{ game.targetBlock }}
    </div>
    <div class="mc-hotbar">
      <div v-for="(slot, index) in slots" :key="slot.id" class="mc-slot" :class="{ 'mc-slot-active': index === game.slot }" :title="slot.name">
        <i :style="slot.style" /><span>{{ index + 1 }}</span>
      </div>
    </div>
    <div class="mc-hotbar-name">
      {{ slots[game.slot]?.name }}
    </div>
  </div>
</template>
