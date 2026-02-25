import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import router from './router'
import App from './App.vue'

const pinia = createPinia()
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: { colors: { primary: '#7C4DFF', secondary: '#03DAC6' } },
      light: { colors: { primary: '#6200EE', secondary: '#03DAC6' } }
    }
  }
})

createApp(App).use(pinia).use(router).use(vuetify).mount('#app')
