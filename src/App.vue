<script setup lang="ts">
import { computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameHud from '@/components/mc/GameHud.vue'
import GameWorld from '@/components/mc/GameWorld.vue'
import { Toaster } from '@/components/ui/sonner'
import { game } from '@/game/state'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { destroyInitManager, initApp } from '@/utils/init'
import ConnectionBanner from './components/ConnectionBanner.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'

const appStore = useAppStore()
const nodesStore = useNodesStore()
const route = useRoute()
const router = useRouter()
const buildVersion = __BUILD_VERSION__

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
const showAdmin = computed(() => appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut)
const isHome = computed(() => route.name === 'home')

watchEffect(() => {
  const total = nodesStore.nodes.length
  const online = nodesStore.nodes.filter(node => node.online).length
  document.title = total > 0 ? `${sitename.value} · ${online}/${total} 在线` : sitename.value
})
function openAdmin() {
  location.href = appStore.isLoggedIn ? '/admin/dashboard' : '/admin/login'
}

onMounted(async () => {
  try {
    await initApp()
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
  }
})
onUnmounted(() => destroyInitManager())
</script>

<template>
  <Provider>
    <div class="mc-backdrop" aria-hidden="true" />
    <GameWorld v-if="!appStore.loading && appStore.enableWorld" />
    <!-- 详情页盖一层暗色，世界只作背景 -->
    <div v-if="!isHome" class="mc-dim" aria-hidden="true" />
    <LoadingCover v-if="appStore.loading" />
    <GameHud v-if="game.playing" />
    <template v-if="!game.playing">
      <nav class="mc-topbar">
        <button v-if="!isHome" type="button" class="mc-button mc-button-small" @click="router.push('/')">
          返回服务器列表
        </button>
        <span class="flex-1" />
        <button v-if="showAdmin" type="button" class="mc-button mc-button-small" @click="openAdmin">
          {{ appStore.isLoggedIn ? '后台管理' : '登录' }}
        </button>
      </nav>
      <ConnectionBanner />
      <main v-if="!appStore.loading" class="relative z-10">
        <RouterView v-slot="{ Component }">
          <KeepAlive :include="['HomeView']">
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </main>
      <footer v-if="!appStore.loading" class="mc-footer">
        <span>Blockworld {{ buildVersion }}</span>
        <span>Powered by <a href="https://github.com/komari-monitor/komari" target="_blank" rel="noopener">Komari</a> · 非官方作品，与 Mojang / Microsoft 无关</span>
      </footer>
    </template>
    <Toaster rich-colors close-button position="top-center" theme="dark" />
  </Provider>
</template>
