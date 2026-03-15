import { ref, computed, onMounted, onUnmounted, provide, inject } from 'vue'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

const SidebarSymbol = Symbol('Sidebar')

export function useSidebar() {
  return inject(SidebarSymbol)
}

export function provideSidebar(defaultOpen = true) {
  const isMobile = ref(false)
  const openMobile = ref(false)
  const open = ref(defaultOpen)

  function setOpen(value) {
    open.value = value
  }

  function setOpenMobile(value) {
    openMobile.value = value
  }

  function toggleSidebar() {
    if (isMobile.value) {
      openMobile.value = !openMobile.value
    } else {
      open.value = !open.value
    }
  }

  const state = computed(() => open.value ? 'expanded' : 'collapsed')

  function onResize() {
    isMobile.value = window.innerWidth < 768
  }

  function onKeyDown(event) {
    if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      toggleSidebar()
    }
  }

  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
  })

  const context = {
    state,
    open,
    setOpen,
    isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar,
  }

  provide(SidebarSymbol, context)

  return context
}

export {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
}
