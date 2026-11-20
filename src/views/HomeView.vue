<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ServerEntry from '@/components/mc/ServerEntry.vue'
import { controls, game } from '@/game/state'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatUptimeWithFormat } from '@/utils/helper'
import { getOSName } from '@/utils/osImageHelper'
import { getRegionDisplayName } from '@/utils/regionHelper'

defineOptions({ name: 'HomeView' })

const appStore = useAppStore()
const nodesStore = useNodesStore()
const router = useRouter()

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
const online = computed(() => nodesStore.nodes.filter(node => node.online).length)
const filter = ref<'all' | 'online' | 'offline'>('all')
const selected = ref<string | null>(null)

const nodes = computed(() => {
  const keyword = appStore.nodeSearchText.trim().toLowerCase()
  return [...nodesStore.nodes]
    .filter(node => filter.value === 'all' || (filter.value === 'online') === node.online)
    .filter(node => !keyword || [node.name, node.os, node.group, node.tags, getRegionDisplayName(node.region)].some(text => text?.toLowerCase().includes(keyword)))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.weight - b.weight || a.name.localeCompare(b.name))
})
const selectedNode = computed(() => nodesStore.nodes.find(node => node.uuid === selected.value))
const openedNode = computed(() => nodesStore.nodes.find(node => node.uuid === game.openedNode))

// 生命值 = 在线比例（10 颗心）；经验条 = 全部节点的内存占用，等级 = 在线台数
const hearts = computed(() => {
  const total = nodesStore.nodes.length
  const filled = total ? Math.round(online.value / total * 20) : 0
  return Array.from({ length: 10 }, (_, i) => filled >= (i + 1) * 2 ? 'full' : filled === i * 2 + 1 ? 'half' : 'empty')
})
const memoryPercent = computed(() => {
  let used = 0
  let total = 0
  for (const node of nodesStore.nodes) {
    used += node.ram || 0
    total += node.mem_total || 0
  }
  return total > 0 ? used / total * 100 : 0
})
const totals = computed(() => {
  let up = 0
  let down = 0
  for (const node of nodesStore.nodes) {
    if (node.online) {
      up += node.net_out || 0
      down += node.net_in || 0
    }
  }
  return `↑ ${formatBytesPerSecondWithConfig(up, appStore.byteDecimals)}  ↓ ${formatBytesPerSecondWithConfig(down, appStore.byteDecimals)}`
})
const splash = computed(() => `${online.value}/${nodesStore.nodes.length} 在线！`)
const canPlay = computed(() => appStore.enableWorld && !game.unavailable && matchMedia('(pointer: fine)').matches)

function openDetail(uuid: string) {
  game.openedNode = null
  router.push(`/instance/${uuid}`)
}
function chestRows(node: NodeData): [string, string][] {
  const bytes = (value: number) => formatBytesWithConfig(value, appStore.byteDecimals)
  const speed = (value: number) => formatBytesPerSecondWithConfig(value, appStore.byteDecimals)
  if (!node.online)
    return [['状态', '离线'], ['系统', `${getOSName(node.os)} · ${node.cpu_cores} 核`], ['地区', getRegionDisplayName(node.region) || '-']]
  return [
    ['CPU', `${(node.cpu ?? 0).toFixed(1)}%  ·  负载 ${(node.load ?? 0).toFixed(2)}`],
    ['内存', `${bytes(node.ram ?? 0)} / ${bytes(node.mem_total ?? 0)}`],
    ['硬盘', `${bytes(node.disk ?? 0)} / ${bytes(node.disk_total ?? 0)}`],
    ['网速', `↑ ${speed(node.net_out ?? 0)}  ↓ ${speed(node.net_in ?? 0)}`],
    ['流量', `↑ ${bytes(node.net_total_up ?? 0)}  ↓ ${bytes(node.net_total_down ?? 0)}`],
    ['连接', `TCP ${node.connections ?? 0} · UDP ${node.connections_udp ?? 0}`],
    ['运行', formatUptimeWithFormat(node.uptime ?? 0, 'hour')],
    ['系统', `${getOSName(node.os)} · ${node.cpu_cores} 核 · ${node.arch}`],
  ]
}
function resetWorld() {
  controls.resetWorld()
  window.$message?.success('世界已重置，你搭建的方块已清空')
}
// 在世界里右键信标塔时选中对应的节点
watch(() => game.openedNode, (uuid) => {
  if (uuid)
    selected.value = uuid
})
</script>

<template>
  <div v-show="!game.playing && !openedNode" class="mc-menu">
    <header class="mc-title">
      <h1>{{ sitename }}</h1>
      <span class="mc-splash">{{ splash }}</span>
    </header>

    <section class="mc-panel" aria-label="服务器列表">
      <div class="mc-panel-head">
        <span class="mc-heading">多人游戏</span>
        <div class="flex gap-1">
          <button v-for="item in ([['all', '全部'], ['online', '在线'], ['offline', '离线']] as const)" :key="item[0]" type="button" class="mc-tab" :class="{ 'mc-tab-active': filter === item[0] }" :aria-pressed="filter === item[0]" @click="filter = item[0]">
            {{ item[1] }}
          </button>
        </div>
        <input v-model="appStore.nodeSearchText" type="search" class="mc-input" placeholder="搜索服务器…" aria-label="搜索服务器">
      </div>
      <ul class="mc-list">
        <ServerEntry v-for="node in nodes" :key="node.uuid" :node="node" :selected="selected === node.uuid" @select="selected = node.uuid" @open="openDetail(node.uuid)" />
        <li v-if="!nodes.length" class="py-10 text-center text-white/60">
          {{ nodesStore.nodes.length ? '没有匹配的服务器' : '暂无服务器' }}
        </li>
      </ul>
      <div class="mc-actions">
        <button type="button" class="mc-button" :disabled="!selectedNode" @click="selectedNode && openDetail(selectedNode.uuid)">
          查看服务器
        </button>
        <button v-if="canPlay" type="button" class="mc-button mc-button-primary" :disabled="!game.ready" @click="controls.enter()">
          {{ game.ready ? '进入世界' : '世界加载中…' }}
        </button>
        <button v-if="canPlay" type="button" class="mc-button" :disabled="!game.ready" @click="resetWorld">
          重置世界
        </button>
      </div>
    </section>

    <div class="mc-status" aria-label="总览">
      <div class="mc-hearts" :title="`在线 ${online}/${nodesStore.nodes.length}`">
        <i v-for="(heart, index) in hearts" :key="index" :data-state="heart" />
      </div>
      <div class="mc-xp" :title="`全部节点内存占用 ${memoryPercent.toFixed(1)}%`">
        <span class="mc-level">{{ online }}</span>
        <div><i :style="{ width: `${memoryPercent}%` }" /></div>
      </div>
      <div class="text-center text-xs text-white/75">
        生命 = 在线比例 · 经验条 = 总内存占用 {{ memoryPercent.toFixed(0)}}% · {{ totals }}
      </div>
    </div>
  </div>

  <!-- 在世界里右键信标塔打开的“箱子”界面 -->
  <div v-if="openedNode && !game.playing" class="mc-overlay" @click.self="game.openedNode = null">
    <div class="mc-chest" role="dialog" :aria-label="`${openedNode.name} 状态`">
      <div class="mc-chest-title">
        {{ openedNode.name }}
      </div>
      <div class="mc-chest-grid">
        <template v-for="row in chestRows(openedNode)" :key="row[0]">
          <span class="mc-chest-key">{{ row[0] }}</span><span class="mc-chest-value">{{ row[1] }}</span>
        </template>
      </div>
      <div class="mc-actions">
        <button type="button" class="mc-button" @click="openDetail(openedNode.uuid)">
          详情与图表
        </button>
        <button type="button" class="mc-button mc-button-primary" @click="controls.enter()">
          回到游戏
        </button>
        <button type="button" class="mc-button" @click="game.openedNode = null">
          服务器列表
        </button>
      </div>
    </div>
  </div>
</template>
