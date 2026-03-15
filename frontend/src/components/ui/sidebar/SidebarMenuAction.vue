<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  showOnHover: { type: Boolean, default: false },
  class: { type: [String, Object, Array], required: false },
  asChild: { type: Boolean, default: false },
  as: { type: [String, Object], default: 'button' },
})
</script>

<template>
  <component
    :is="as"
    data-slot="sidebar-menu-action"
    data-sidebar="menu-action"
    :class="cn(
      'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
      'after:absolute after:-inset-2 after:md:hidden',
      'group-data-[collapsible=icon]:hidden',
      showOnHover && 'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
      props.class,
    )"
  >
    <slot />
  </component>
</template>
