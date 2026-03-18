<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <div data-slot="sidebar-group-content" :class="cn('w-full text-sm', props.class)">
    <slot />
  </div>
</template>
