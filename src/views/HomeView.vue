<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { Screen } from '@/game/state'
import { useEventListener } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import McSlider from '@/components/mc/McSlider.vue'
import ServerEntry from '@/components/mc/ServerEntry.vue'
import { playClick } from '@/game/audio'
import { blockIcon, blockName, INVENTORY } from '@/game/blocks'
import { controls, game, options } from '@/game/state'
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
const SPLASHES = ['服务器也要晒太阳！', '挖三填一！', '信标亮着就是在线！', '100% 程序生成！', '别挖信标塔！', '试试双击空格！']
const splash = computed(() => game.ready ? SPLASHES[new Date().getMinutes() % SPLASHES.length]! : '加载世界中…')
const worldAvailable = computed(() => appStore.enableWorld && !game.unavailable)
const canPlay = computed(() => worldAvailable.value && matchMedia('(pointer: fine)').matches)
const showAdmin = computed(() => appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut)

// ===== 界面切换 =====
// “选项”可以从标题画面或暂停菜单进入，完成后回到来的地方
const optionsFrom = ref<Screen>('title')
function open(screen: Screen) {
  playClick()
  if (screen === 'options')
    optionsFrom.value = game.screen === 'pause' ? 'pause' : 'title'
  game.screen = screen
}
function play() {
  playClick()
  controls.enter()
}
function openDetail(uuid: string) {
  playClick()
  game.openedNode = null
  router.push(`/instance/${uuid}`)
}
function openAdmin() {
  location.href = appStore.isLoggedIn ? '/admin/dashboard' : '/admin/login'
}
function resetWorld() {
  controls.resetWorld()
  window.$message?.success('世界已重置，你搭建的方块已清空')
}
const TIME_LABELS = { site: '跟随站点', cycle: '昼夜交替', day: '永昼', night: '永夜' }
const TIME_ORDER = ['site', 'cycle', 'day', 'night'] as const
function cycleTime() {
  playClick()
  options.value.time = TIME_ORDER[(TIME_ORDER.indexOf(options.value.time) + 1) % TIME_ORDER.length]!
}
function toggle(key: 'bobbing' | 'sound' | 'mobs') {
  options.value[key] = !options.value[key]
  playClick()
}

// ===== 物品栏 =====
const hovered = ref('')
function pick(id: number) {
  game.hotbar[game.slot] = id
  playClick()
}
useEventListener('keydown', (event: KeyboardEvent) => {
  // E 再按一次关闭物品栏并回到游戏（按键本身就是允许重新锁定指针的用户操作）
  if (game.screen === 'inventory' && event.code === 'KeyE' && !event.repeat)
    controls.enter()
  else if (game.screen === 'inventory' && event.code.startsWith('Digit')) {
    const slot = Number(event.code.slice(5)) - 1
    if (slot >= 0 && slot < game.hotbar.length)
      game.slot = slot
  }
})

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
// 列表里选中的服务器，在世界里高亮它的信标塔
watch(selected, (uuid) => {
  game.selectedNode = uuid
})
// 在世界里右键信标塔时选中对应的节点
watch(() => game.openedNode, (uuid) => {
  if (uuid)
    selected.value = uuid
})
</script>

<template>
  <Transition name="mc-screen" mode="out-in">
    <!-- 在世界里右键信标塔打开的“箱子”界面 -->
    <div v-if="openedNode && !game.playing" key="chest" class="mc-overlay">
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
          <button type="button" class="mc-button mc-button-primary" @click="play">
            回到游戏
          </button>
          <button type="button" class="mc-button" @click="game.openedNode = null; open('servers')">
            服务器列表
          </button>
        </div>
      </div>
    </div>

    <!-- 标题画面 -->
    <div v-else-if="!game.playing && game.screen === 'title'" key="title" class="mc-screen mc-title-screen">
      <header class="mc-title">
        <h1>{{ sitename }}</h1>
        <span class="mc-splash">{{ splash }}</span>
      </header>
      <div class="mc-stack">
        <button type="button" class="mc-button mc-button-wide" :disabled="!canPlay || !game.ready" :title="canPlay ? '' : '需要鼠标和键盘'" @click="play">
          {{ !worldAvailable ? '世界不可用' : !canPlay ? '单人游戏（需要鼠标和键盘）' : game.ready ? '单人游戏' : '世界加载中…' }}
        </button>
        <button type="button" class="mc-button mc-button-wide" @click="open('servers')">
          多人游戏 · {{ online }}/{{ nodesStore.nodes.length }} 在线
        </button>
        <div class="mc-stack-row">
          <button type="button" class="mc-button" @click="open('options')">
            选项…
          </button>
          <button v-if="showAdmin" type="button" class="mc-button" @click="openAdmin">
            {{ appStore.isLoggedIn ? '后台管理' : '登录' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 多人游戏：服务器列表 -->
    <div v-else-if="!game.playing && game.screen === 'servers'" key="servers" class="mc-screen mc-dirt">
      <h2 class="mc-screen-title">
        多人游戏
      </h2>
      <div class="mc-status" aria-label="总览">
        <div class="mc-hearts" :title="`在线 ${online}/${nodesStore.nodes.length}`">
          <i v-for="(heart, index) in hearts" :key="index" :data-state="heart" />
        </div>
        <div class="mc-xp" :title="`全部节点内存占用 ${memoryPercent.toFixed(1)}%`">
          <span class="mc-level">{{ online }}</span>
          <div><i :style="{ width: `${memoryPercent}%` }" /></div>
        </div>
        <div class="text-center text-xs text-white/75">
          生命 = 在线比例 · 经验条 = 总内存占用 {{ memoryPercent.toFixed(0) }}% · {{ totals }}
        </div>
      </div>
      <section class="mc-panel" aria-label="服务器列表">
        <div class="mc-panel-head">
          <div class="flex gap-1">
            <button v-for="item in ([['all', '全部'], ['online', '在线'], ['offline', '离线']] as const)" :key="item[0]" type="button" class="mc-tab" :class="{ 'mc-tab-active': filter === item[0] }" :aria-pressed="filter === item[0]" @click="filter = item[0]">
              {{ item[1] }}
            </button>
          </div>
          <input v-model="appStore.nodeSearchText" type="search" class="mc-input" placeholder="搜索服务器…" aria-label="搜索服务器">
        </div>
        <TransitionGroup tag="ul" name="mc-row" class="mc-list">
          <ServerEntry v-for="node in nodes" :key="node.uuid" :node="node" :selected="selected === node.uuid" @select="selected = node.uuid" @open="openDetail(node.uuid)" />
          <li v-if="!nodes.length" key="empty" class="py-10 text-center text-white/60">
            {{ nodesStore.nodes.length ? '没有匹配的服务器' : '暂无服务器' }}
          </li>
        </TransitionGroup>
      </section>
      <div class="mc-actions">
        <button type="button" class="mc-button" :disabled="!selectedNode" @click="selectedNode && openDetail(selectedNode.uuid)">
          加入服务器
        </button>
        <button v-if="canPlay" type="button" class="mc-button mc-button-primary" :disabled="!game.ready" @click="play">
          进入世界
        </button>
        <button type="button" class="mc-button" @click="open('title')">
          返回
        </button>
      </div>
    </div>

    <!-- 选项 -->
    <div v-else-if="!game.playing && game.screen === 'options'" key="options" class="mc-screen mc-dirt">
      <h2 class="mc-screen-title">
        选项
      </h2>
      <div class="mc-options">
        <McSlider v-model="options.fov" label="视野" :min="50" :max="100" :step="1" />
        <McSlider v-model="options.renderDistance" label="渲染距离" :min="3" :max="10" :step="1" suffix=" 区块" />
        <button type="button" class="mc-button" @click="toggle('bobbing')">
          视角摇晃：{{ options.bobbing ? '开' : '关' }}
        </button>
        <button type="button" class="mc-button" @click="toggle('sound')">
          音效：{{ options.sound ? '开' : '关' }}
        </button>
        <button type="button" class="mc-button" @click="toggle('mobs')">
          动物：{{ options.mobs ? '开' : '关' }}
        </button>
        <button type="button" class="mc-button" @click="cycleTime">
          时间：{{ TIME_LABELS[options.time] }}
        </button>
        <button type="button" class="mc-button" :disabled="!game.ready" @click="resetWorld">
          重置世界
        </button>
      </div>
      <div class="mc-actions">
        <button type="button" class="mc-button mc-button-wide" @click="open(optionsFrom)">
          完成
        </button>
      </div>
    </div>

    <!-- 暂停菜单 -->
    <div v-else-if="!game.playing && game.screen === 'pause'" key="pause" class="mc-screen mc-pause">
      <h2 class="mc-screen-title">
        游戏菜单
      </h2>
      <div class="mc-stack">
        <button type="button" class="mc-button mc-button-wide mc-button-primary" @click="play">
          回到游戏
        </button>
        <button type="button" class="mc-button mc-button-wide" @click="open('servers')">
          多人游戏 · {{ online }}/{{ nodesStore.nodes.length }} 在线
        </button>
        <button type="button" class="mc-button mc-button-wide" @click="open('options')">
          选项…
        </button>
        <button type="button" class="mc-button mc-button-wide" @click="open('title')">
          回到标题画面
        </button>
      </div>
    </div>

    <!-- 创造模式物品栏 -->
    <div v-else-if="!game.playing && game.screen === 'inventory'" key="inventory" class="mc-overlay">
      <div class="mc-chest mc-inventory" role="dialog" aria-label="物品栏">
        <div class="mc-chest-title">
          物品栏 <small>{{ hovered || '点击方块放进选中的快捷栏格子' }}</small>
        </div>
        <div class="mc-grid">
          <button v-for="id in INVENTORY" :key="id" type="button" class="mc-item" :aria-label="blockName(id)" @mouseenter="hovered = blockName(id)" @mouseleave="hovered = ''" @click="pick(id)">
            <i :style="{ backgroundImage: `url(${blockIcon(id)})` }" />
          </button>
        </div>
        <div class="mc-chest-title">
          快捷栏
        </div>
        <div class="mc-grid">
          <button v-for="(id, index) in game.hotbar" :key="index" type="button" class="mc-item" :class="{ 'mc-item-active': index === game.slot }" :aria-label="`快捷栏 ${index + 1}：${blockName(id)}`" @click="game.slot = index">
            <i :key="id" :style="{ backgroundImage: `url(${blockIcon(id)})` }" />
          </button>
        </div>
        <div class="mc-actions">
          <button type="button" class="mc-button mc-button-primary" @click="play">
            回到游戏（E）
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
