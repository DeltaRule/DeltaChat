<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <Badge
    data-slot="sidebar-menu-badge"
    :class="cn(
      'text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums',
      'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
      'group-data-[collapsible=icon]:hidden',
      props.class,
    )"
  >
    <slot />
  </Badge>
</template>
