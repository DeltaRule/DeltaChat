<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { SplitterGroup, useForwardPropsEmits } from 'reka-ui'
import type { PropType } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  id: { type: [String, null], required: false },
  autoSaveId: { type: [String, null], required: false },
  direction: { type: String as PropType<'horizontal' | 'vertical'>, required: true },
  keyboardResizeBy: { type: [Number, null], required: false },
  storage: {
    type: Object as PropType<{
      getItem: (name: string) => string | null
      setItem: (name: string, value: string) => void
    }>,
    required: false,
  },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
})
const emits = defineEmits(['layout'])

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SplitterGroup
    v-slot="slotProps"
    data-slot="resizable-panel-group"
    v-bind="forwarded"
    :class="cn('flex h-full w-full data-[orientation=vertical]:flex-col', props.class)"
  >
    <slot v-bind="slotProps" />
  </SplitterGroup>
</template>
