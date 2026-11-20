<script setup lang="ts">
import { computed } from 'vue'

// 选项界面里的滑条按钮：整条都能拖，滑块停在当前值上
const props = defineProps<{ label: string, min: number, max: number, step: number, modelValue: number, suffix?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const percent = computed(() => (props.modelValue - props.min) / (props.max - props.min) * 100)

function drag(event: PointerEvent) {
  const element = event.currentTarget as HTMLElement
  if (event.type === 'pointerdown')
    element.setPointerCapture(event.pointerId)
  else if (!element.hasPointerCapture(event.pointerId))
    return
  const rect = element.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - 8) / (rect.width - 16)))
  emit('update:modelValue', Math.round((props.min + ratio * (props.max - props.min)) / props.step) * props.step)
}
function nudge(direction: 1 | -1) {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, props.modelValue + direction * props.step)))
}
</script>

<template>
  <div
    class="mc-slider" role="slider" tabindex="0" :aria-label="label" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue"
    @pointerdown="drag" @pointermove="drag" @keydown.left.prevent="nudge(-1)" @keydown.right.prevent="nudge(1)"
  >
    <i :style="{ left: `calc(${percent}% - ${percent * 0.16}px)` }" />
    <span>{{ label }}: {{ modelValue }}{{ suffix }}</span>
  </div>
</template>
