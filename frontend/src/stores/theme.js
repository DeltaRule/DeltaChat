import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import Cookies from 'js-cookie'

const COOKIE_KEY = 'deltachat-theme-colors'
const THEME_KEY = 'deltachat-theme'

// Default color presets
const defaultColors = {
  primary: '160 84% 39%',       // Emerald (#10B981)
  primaryHex: '#10B981',
}

const presets = {
  emerald: { primary: '160 84% 39%', primaryHex: '#10B981' },
  purple: { primary: '262 83% 58%', primaryHex: '#7C4DFF' },
  blue: { primary: '217 91% 60%', primaryHex: '#3B82F6' },
  green: { primary: '142 71% 45%', primaryHex: '#22C55E' },
  rose: { primary: '346 77% 50%', primaryHex: '#E11D48' },
  orange: { primary: '25 95% 53%', primaryHex: '#F97316' },
  cyan: { primary: '189 94% 43%', primaryHex: '#06B6D4' },
}

export const useThemeStore = defineStore('theme', () => {
  // Load from cookie or use defaults
  const savedColors = Cookies.get(COOKIE_KEY)
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark'

  const isDark = ref(savedTheme === 'dark')
  const colors = ref(savedColors ? JSON.parse(savedColors) : { ...defaultColors })

  const currentPreset = computed(() => {
    const hex = colors.value.primaryHex
    for (const [name, preset] of Object.entries(presets)) {
      if (preset.primaryHex === hex) return name
    }
    return 'custom'
  })

  function setPreset(name) {
    if (presets[name]) {
      colors.value = { ...presets[name] }
    }
  }

  function setCustomColor(hex) {
    const hsl = hexToHSL(hex)
    colors.value = { primary: hsl, primaryHex: hex }
  }

  function toggleTheme() {
    isDark.value = !isDark.value
  }

  // Apply theme to DOM
  function applyTheme() {
    const root = document.documentElement
    if (isDark.value) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    // Apply primary color using hex (valid CSS color)
    const hex = colors.value.primaryHex
    if (hex) {
      root.style.setProperty('--primary', hex)
      root.style.setProperty('--ring', hex)
      root.style.setProperty('--sidebar-primary', hex)
      root.style.setProperty('--sidebar-ring', hex)
      root.style.setProperty('--chart-1', hex)
      // Compute a contrasting foreground color
      const fg = getContrastForeground(hex)
      root.style.setProperty('--primary-foreground', fg)
      root.style.setProperty('--sidebar-primary-foreground', fg)
    }
  }

  function getContrastForeground(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return luminance > 0.5 ? '#0a0a0a' : '#fafafa'
  }

  // Watch and persist
  watch(isDark, (val) => {
    localStorage.setItem(THEME_KEY, val ? 'dark' : 'light')
    applyTheme()
  })

  watch(colors, (val) => {
    Cookies.set(COOKIE_KEY, JSON.stringify(val), { expires: 365 })
    applyTheme()
  }, { deep: true })

  // Apply on init
  applyTheme()

  return {
    isDark,
    colors,
    presets,
    currentPreset,
    setPreset,
    setCustomColor,
    toggleTheme,
    applyTheme,
  }
})

// Helper: convert hex to HSL string "h s% l%"
function hexToHSL(hex) {
  let r = 0, g = 0, b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16) / 255
    g = parseInt(hex[2] + hex[2], 16) / 255
    b = parseInt(hex[3] + hex[3], 16) / 255
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255
    g = parseInt(hex.slice(3, 5), 16) / 255
    b = parseInt(hex.slice(5, 7), 16) / 255
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
