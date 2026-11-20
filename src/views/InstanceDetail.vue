<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInstanceDetail } from '@/composables/useInstanceDetail'
import { playClick } from '@/game/audio'

// 方块世界的节点详情：一个泥土背景的游戏界面。
// 顶部是 Boss 血条样式的占用条，下面用按钮切换“概览 / 负载 / 延迟 / 回程”；
// 概览里的信息放在物品栏样式的格子里。
const LoadChart = defineAsyncComponent(() => import('@/components/LoadChart.vue'))
const PingChart = defineAsyncComponent(() => import('@/components/PingChart.vue'))
const ReturnRoutePanel = defineAsyncComponent(() => import('@/components/ReturnRoutePanel.vue'))

const router = useRouter()
const { data, orderedNodes, currentIndex, prevNode, nextNode, switchNode, metricCards, hardwareInfo, systemInfo, storageInfo, gauges, liveInfo, regionName, regionCode } = useInstanceDetail()

const TABS = [['overview', '概览'], ['load', '负载'], ['latency', '延迟'], ['route', '回程']] as const
const tab = ref<typeof TABS[number][0]>('overview')
function choose(id: typeof TABS[number][0]) {
  playClick()
  tab.value = id
}
function go(node: { uuid: string } | null | undefined) {
  playClick()
  switchNode(node)
}
// Boss 血条的颜色：按占用从绿到黄到红，和信标光柱一致
const barColor = (percent: number) => percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'green'
</script>

<template>
  <div class="mc-screen mc-dirt mc-detail">
    <template v-if="!data">
      <h2 class="mc-screen-title">
        无法连接至服务器
      </h2>
      <p class="text-white/70">
        节点不存在或已被删除
      </p>
      <button type="button" class="mc-button" @click="router.push('/')">
        返回服务器列表
      </button>
    </template>

    <template v-else>
      <header class="mc-detail-head">
        <div class="mc-server-icon">
          <img v-if="regionCode" :src="`/images/flags/${regionCode}.svg`" :alt="regionName">
        </div>
        <div class="min-w-0">
          <h1>{{ data.name }}</h1>
          <p :class="data.online ? 'text-[#7dff9b]' : 'text-[#ff6b5e]'">
            {{ data.online ? '已连接' : '无法连接至服务器' }}<span class="text-white/60"> · {{ regionName || '未知地区' }} · {{ currentIndex + 1 }} / {{ orderedNodes.length }}</span>
          </p>
        </div>
      </header>

      <!-- Boss 血条：每项占用一条 -->
      <div v-if="data.online" class="mc-bars">
        <div v-for="gauge in gauges" :key="gauge.key" class="mc-boss">
          <div class="mc-boss-label">
            <span>{{ gauge.label }}</span><span>{{ gauge.text }}</span>
          </div>
          <div class="mc-boss-bar" :data-color="barColor(gauge.percent)" role="progressbar" :aria-label="gauge.label" :aria-valuenow="Math.round(gauge.percent)" aria-valuemin="0" aria-valuemax="100">
            <i :style="{ width: `${gauge.percent}%` }" />
          </div>
        </div>
      </div>

      <div class="mc-detail-tabs" role="tablist">
        <button v-for="item in TABS" :key="item[0]" type="button" role="tab" class="mc-button" :class="{ 'mc-button-primary': tab === item[0] }" :aria-selected="tab === item[0]" @click="choose(item[0])">
          {{ item[1] }}
        </button>
      </div>

      <div class="mc-detail-body">
        <div v-if="tab === 'overview'" class="mc-detail-grid">
          <section v-if="data.online" class="mc-chest">
            <div class="mc-chest-title">
              实时
            </div>
            <div class="mc-chest-grid">
              <template v-for="item in liveInfo" :key="item.label">
                <span class="mc-chest-key">{{ item.label }}</span><span class="mc-chest-value">{{ item.value }}</span>
              </template>
            </div>
          </section>
          <section class="mc-chest">
            <div class="mc-chest-title">
              系统
            </div>
            <div class="mc-chest-grid">
              <template v-for="item in systemInfo" :key="item.label">
                <span class="mc-chest-key">{{ item.label }}</span><span class="mc-chest-value">{{ item.value }}</span>
              </template>
            </div>
          </section>
          <section class="mc-chest">
            <div class="mc-chest-title">
              硬件
            </div>
            <div class="mc-chest-grid">
              <template v-for="item in [...hardwareInfo, ...storageInfo]" :key="item.label">
                <span class="mc-chest-key">{{ item.label }}</span><span class="mc-chest-value">{{ item.value }}</span>
              </template>
            </div>
          </section>
          <section class="mc-chest">
            <div class="mc-chest-title">
              费用
            </div>
            <div class="mc-chest-grid">
              <template v-for="card in metricCards" :key="card.label">
                <span class="mc-chest-key">{{ card.label }}</span><span class="mc-chest-value">{{ card.value }} {{ card.unit }}</span>
              </template>
            </div>
          </section>
        </div>
        <section v-else class="mc-panel mc-detail-panel">
          <LoadChart v-if="tab === 'load'" :key="data.uuid" :uuid="data.uuid" />
          <PingChart v-else-if="tab === 'latency'" :key="data.uuid" :uuid="data.uuid" :online="data.online" :last-seen="data.time" />
          <ReturnRoutePanel v-else :key="data.uuid" :uuid="data.uuid" :online="data.online" />
        </section>
      </div>

      <div class="mc-actions">
        <button type="button" class="mc-button" :disabled="!prevNode" :title="prevNode?.name" @click="go(prevNode)">
          上一台
        </button>
        <button type="button" class="mc-button" @click="playClick(); router.push('/')">
          返回服务器列表
        </button>
        <button type="button" class="mc-button" :disabled="!nextNode" :title="nextNode?.name" @click="go(nextNode)">
          下一台
        </button>
      </div>
    </template>
  </div>
</template>
