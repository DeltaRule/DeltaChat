<script setup lang="ts">
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  isActive: { type: Boolean, default: false },
  asChild: { type: Boolean, default: false },
  as: { type: [String, Object], default: 'a' },
  size: { type: String, default: 'md' },
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <Primitive
    data-slot="sidebar-menu-sub-button"
    :data-active="isActive"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="
      cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
        props.class,
      )
    "
  >
    <slot />
  </Primitive>
</template>
