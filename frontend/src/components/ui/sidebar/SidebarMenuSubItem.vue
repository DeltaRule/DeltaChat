<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <li data-slot="sidebar-menu-sub-item" :class="cn('', props.class)">
    <slot />
  </li>
</template>
