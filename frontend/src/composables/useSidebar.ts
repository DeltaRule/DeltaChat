import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  provide,
  inject,
  type InjectionKey,
  type Ref,
  type ComputedRef,
} from 'vue'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

export interface SidebarContext {
  state: ComputedRef<'expanded' | 'collapsed'>
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  isMobile: Ref<boolean>
  openMobile: Ref<boolean>
  setOpenMobile: (value: boolean) => void
  toggleSidebar: () => void
}

const SidebarSymbol: InjectionKey<SidebarContext> = Symbol('Sidebar')

export function useSidebar(): SidebarContext {
  const context = inject(SidebarSymbol)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export function provideSidebar(defaultOpen = true) {
  const isMobile = ref(false)
  const openMobile = ref(false)
  const open = ref(defaultOpen)

  function setOpen(value: boolean): void {
    open.value = value
  }

  function setOpenMobile(value: boolean): void {
    openMobile.value = value
  }

  function toggleSidebar(): void {
    if (isMobile.value) {
      openMobile.value = !openMobile.value
    } else {
      open.value = !open.value
    }
  }

  const state = computed(() => (open.value ? ('expanded' as const) : ('collapsed' as const)))

  function onResize(): void {
    isMobile.value = window.innerWidth < 768
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      toggleSidebar()
    }
  }

  onMounted(() => {
    onResize()
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
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

export { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, SIDEBAR_COOKIE_NAME, SIDEBAR_KEYBOARD_SHORTCUT }
