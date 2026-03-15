<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <div
    data-slot="sidebar-header"
    :class="cn('flex flex-col gap-2 p-2', props.class)"
  >
    <slot />
  </div>
</template>
