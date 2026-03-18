<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/composables/useSidebar'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})

const { toggleSidebar, setOpen } = useSidebar()

const isDragging = ref(false)
let startX = 0
let startWidth = 0
let hasMoved = false

function onMouseDown(e: MouseEvent) {
  hasMoved = false
  startX = e.clientX
  const provider = document.querySelector('[data-slot="sidebar-provider"]') as HTMLElement | null
  if (provider) {
    // Use actual rendered width to avoid rem→px parsing issues
    const sidebarInner = provider.querySelector('[data-slot="sidebar"] > div')
    startWidth = sidebarInner ? sidebarInner.getBoundingClientRect().width : 256
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  const delta = e.clientX - startX
  if (Math.abs(delta) < 4) return
  hasMoved = true
  isDragging.value = true
  const newWidth = Math.max(120, Math.min(startWidth + delta, 480))
  const provider = document.querySelector('[data-slot="sidebar-provider"]') as HTMLElement | null
  if (!provider) return

  setOpen(true)
  provider.style.setProperty('--sidebar-width', newWidth + 'px')
}

function onMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (!hasMoved) {
    // click-to-collapse disabled; only drag resizes
  }
}
</script>

<template>
  <button
    data-slot="sidebar-rail"
    aria-label="Toggle Sidebar"
    tabindex="-1"
    :class="
      cn(
        'hover:after:bg-sidebar-border absolute inset-y-0 hidden w-4 transition-all ease-linear group-data-[side=left]:right-[-8px] group-data-[side=right]:left-[-8px] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
        'in-data-[side=left]:cursor-col-resize in-data-[side=right]:cursor-col-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:hover:bg-sidebar group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        isDragging && 'after:bg-primary',
        props.class,
      )
    "
    @mousedown="onMouseDown"
  />
</template>
