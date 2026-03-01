import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import './styles/global.css'
import router from './router'
import App from './App.vue'

const pinia = createPinia()
const vuetify = createVuetify({
  components,
  directives,
  defaults: {
    VBtn: { variant: 'flat', rounded: 'lg' },
    VCard: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'compact', color: 'primary' },
    VTextarea: { variant: 'outlined', color: 'primary' },
    VSelect: { variant: 'outlined', density: 'compact', color: 'primary' },
    VSwitch: { inset: true, color: 'primary' },
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          primary: '#7C4DFF',
          'primary-darken-1': '#651FFF',
          secondary: '#03DAC6',
          'secondary-darken-1': '#018786',
          background: '#0d0d11',
          surface: '#18182a',
          'surface-bright': '#20202e',
          'surface-variant': '#252536',
          'on-surface': '#e8e8f0',
          'on-background': '#e8e8f0',
          error: '#CF6679',
          info: '#64B5F6',
          success: '#4CAF50',
          warning: '#FFB74D',
        }
      },
      light: {
        dark: false,
        colors: {
          primary: '#6200EE',
          'primary-darken-1': '#3700B3',
          secondary: '#03DAC6',
          'secondary-darken-1': '#018786',
          background: '#f5f5fa',
          surface: '#ffffff',
          'surface-bright': '#ffffff',
          'surface-variant': '#f0f0f5',
          'on-surface': '#1c1b1f',
          'on-background': '#1c1b1f',
          error: '#B00020',
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FB8C00',
        }
      }
    }
  }
})

createApp(App).use(pinia).use(router).use(vuetify).mount('#app')
