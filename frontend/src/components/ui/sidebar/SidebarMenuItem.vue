<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <li
    data-slot="sidebar-menu-item"
    :class="cn('group/menu-item relative', props.class)"
  >
    <slot />
  </li>
</template>
