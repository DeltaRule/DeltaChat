<script setup>
import { cn } from '@/lib/utils'
import { provideSidebar, SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from '@/composables/useSidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

const props = defineProps({
  defaultOpen: { type: Boolean, default: true },
  open: { type: Boolean, default: undefined },
  class: { type: [String, Object, Array], required: false },
})

const sidebar = provideSidebar(props.defaultOpen)
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      data-slot="sidebar-provider"
      :style="{
        '--sidebar-width': SIDEBAR_WIDTH,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      }"
      :class="cn('group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-full w-full', props.class)"
    >
      <slot :open="sidebar.open.value" :state="sidebar.state.value" :is-mobile="sidebar.isMobile.value" :toggle="sidebar.toggleSidebar" />
    </div>
  </TooltipProvider>
</template>
