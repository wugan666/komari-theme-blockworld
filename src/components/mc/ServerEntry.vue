<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatRelativeTime, formatUptimeWithFormat } from '@/utils/helper'
import { getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

// 多人游戏列表里的一行：图标、名字、两行说明，右上角是信号格
const props = defineProps<{ node: NodeData, selected: boolean }>()
defineEmits<{ select: [], open: [] }>()

const appStore = useAppStore()
const nodesStore = useNodesStore()
const memory = computed(() => props.node.mem_total > 0 ? (props.node.ram ?? 0) / props.node.mem_total * 100 : 0)
const disk = computed(() => props.node.disk_total > 0 ? (props.node.disk ?? 0) / props.node.disk_total * 100 : 0)
// 信号格：离线 0 格；在线时负载越高格数越少
const bars = computed(() => {
  if (!props.node.online)
    return 0
  const load = Math.max(props.node.cpu ?? 0, memory.value)
  return load >= 90 ? 1 : load >= 75 ? 2 : load >= 55 ? 3 : load >= 30 ? 4 : 5
})
const motd = computed(() => {
  const node = props.node
  return [getOSName(node.os), `${node.cpu_cores} 核`, formatBytesWithConfig(node.mem_total ?? 0, appStore.byteDecimals), getRegionDisplayName(node.region)].filter(Boolean).join(' · ')
})
const status = computed(() => {
  const node = props.node
  if (!node.online) {
    const seen = formatRelativeTime(node.time, nodesStore.now)
    return seen !== '-' ? `无法连接 · 最后在线 ${seen}` : '无法连接至服务器'
  }
  const speed = (value: number) => formatBytesPerSecondWithConfig(value, appStore.byteDecimals)
  return `CPU ${(node.cpu ?? 0).toFixed(1)}%  内存 ${memory.value.toFixed(0)}%  硬盘 ${disk.value.toFixed(0)}%  ↑${speed(node.net_out ?? 0)} ↓${speed(node.net_in ?? 0)}`
})
const uptime = computed(() => props.node.online ? formatUptimeWithFormat(props.node.uptime ?? 0, 'day') : '')
</script>

<template>
  <li>
    <div
      class="mc-server" :class="{ 'mc-server-selected': selected, 'mc-server-offline': !node.online }"
      role="button" tabindex="0" :aria-pressed="selected" :aria-label="`${node.name}，${node.online ? '在线' : '离线'}`"
      @click="$emit('select')" @dblclick="$emit('open')" @keydown.enter="$emit('open')" @keydown.space.prevent="$emit('select')"
    >
      <div class="mc-server-icon">
        <img v-if="node.region?.trim()" :src="`/images/flags/${getRegionCode(node.region)}.svg`" alt="">
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="mc-server-name truncate">{{ node.name }}</span>
          <span class="ml-auto shrink-0 text-xs text-white/55">{{ uptime }}</span>
          <span class="mc-signal" :data-bars="bars" :title="node.online ? `负载信号 ${bars}/5` : '离线'"><i /><i /><i /><i /><i /></span>
        </div>
        <div class="truncate text-[13px] text-white/60">
          {{ motd }}
        </div>
        <div class="truncate text-[13px]" :class="node.online ? 'text-[#7dff9b]' : 'text-[#ff6b5e]'">
          {{ status }}
        </div>
      </div>
    </div>
  </li>
</template>
