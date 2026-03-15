<script setup>
import { computed, useAttrs } from 'vue'
import { Primitive } from 'reka-ui'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/composables/useSidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  isActive: { type: Boolean, default: false },
  asChild: { type: Boolean, default: false },
  as: { type: [String, Object], default: 'button' },
  tooltip: { type: [String, Object], default: undefined },
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'default' },
  class: { type: [String, Object, Array], required: false },
})

const attrs = useAttrs()

const { isMobile, state } = useSidebar()

const showTooltip = computed(() => {
  if (!props.tooltip) return false
  if (state.value === 'collapsed') return true
  return false
})

const tooltipContent = computed(() => {
  if (typeof props.tooltip === 'string') return { children: props.tooltip }
  return props.tooltip || {}
})
</script>

<template>
  <Tooltip v-if="showTooltip">
    <TooltipTrigger as-child>
      <Primitive
        v-bind="attrs"
        data-slot="sidebar-menu-button"
        :data-active="isActive"
        :data-size="size"
        :as="as"
        :as-child="asChild"
        :class="cn(
          'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary data-[active=true]:border-l-2 data-[active=true]:border-primary data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground',
          size === 'sm' && 'text-xs',
          size === 'lg' && 'text-sm group-data-[collapsible=icon]:p-0',
          'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
          variant === 'outline' && 'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
          props.class,
        )"
      >
        <slot />
      </Primitive>
    </TooltipTrigger>
    <TooltipContent side="right" align="center">
      {{ tooltipContent.children }}
    </TooltipContent>
  </Tooltip>

  <Primitive
    v-else
    v-bind="attrs"
    data-slot="sidebar-menu-button"
    :data-active="isActive"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn(
      'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary data-[active=true]:border-l-2 data-[active=true]:border-primary data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground',
      size === 'sm' && 'text-xs',
      size === 'lg' && 'text-sm group-data-[collapsible=icon]:p-0',
      'group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
      variant === 'outline' && 'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      props.class,
    )"
  >
    <slot />
  </Primitive>
</template>
