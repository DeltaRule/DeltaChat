<script setup>
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { useSidebar, SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from '@/composables/useSidebar'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'

const props = defineProps({
  side: { type: String, default: 'left' },
  variant: { type: String, default: 'sidebar' },
  collapsible: { type: String, default: 'offcanvas' },
  class: { type: [String, Object, Array], required: false },
})

const { isMobile, state, openMobile, setOpenMobile } = useSidebar()
</script>

<template>
  <template v-if="collapsible === 'none'">
    <div
      data-slot="sidebar"
      :class="cn('bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col', props.class)"
    >
      <slot />
    </div>
  </template>

  <template v-else-if="isMobile">
    <Sheet :open="openMobile" @update:open="setOpenMobile">
      <SheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        class="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
        :style="{ '--sidebar-width': SIDEBAR_WIDTH }"
        :side="side"
      >
        <SheetTitle class="sr-only">Sidebar</SheetTitle>
        <SheetDescription class="sr-only">Navigation sidebar</SheetDescription>
        <div class="flex h-full w-full flex-col">
          <slot />
        </div>
      </SheetContent>
    </Sheet>
  </template>

  <template v-else>
    <div
      class="group peer text-sidebar-foreground hidden md:block"
      :data-state="state"
      :data-collapsible="state === 'collapsed' ? collapsible : ''"
      :data-variant="variant"
      :data-side="side"
    >
      <!-- gap on the page when sidebar collapses -->
      <div
        :class="cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear h-full',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'floating' || variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
        )"
      />
      <div
        data-slot="sidebar"
        :class="cn(
          'fixed top-12 bottom-0 z-10 hidden w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+theme(spacing.4)+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          props.class,
        )"
      >
        <div
          data-sidebar="sidebar"
          :class="cn(
            'bg-sidebar flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm',
          )"
        >
          <slot />
        </div>
      </div>
    </div>
  </template>
</template>
