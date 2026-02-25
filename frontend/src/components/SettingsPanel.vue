<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-tabs v-model="activeTab" color="primary">
          <v-tab value="providers">Providers</v-tab>
          <v-tab value="embedding">Embedding</v-tab>
          <v-tab value="webhooks">Webhooks</v-tab>
          <v-tab value="mcp">MCP</v-tab>
          <v-tab value="system">System</v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab" class="mt-4">
          <!-- Providers -->
          <v-tabs-window-item value="providers">
            <v-row>
              <v-col v-for="provider in providers" :key="provider.key" cols="12" md="6">
                <v-card>
                  <v-card-title class="d-flex align-center">
                    {{ provider.name }}
                    <v-spacer />
                    <v-switch v-model="providerEnabled[provider.key]" hide-details density="compact" color="primary" />
                  </v-card-title>
                  <v-card-text v-if="providerEnabled[provider.key]">
                    <v-text-field
                      v-model="providerKeys[provider.key]"
                      :label="provider.keyLabel || 'API Key'"
                      variant="outlined"
                      :type="showKey[provider.key] ? 'text' : 'password'"
                      :append-inner-icon="showKey[provider.key] ? 'mdi-eye-off' : 'mdi-eye'"
                      @click:append-inner="showKey[provider.key] = !showKey[provider.key]"
                      class="mb-2"
                      density="compact"
                    />
                    <v-text-field
                      v-if="provider.hasUrl"
                      v-model="providerUrls[provider.key]"
                      :label="provider.urlLabel || 'Base URL'"
                      variant="outlined"
                      density="compact"
                      class="mb-2"
                    />
                    <v-text-field
                      v-if="provider.hasModel"
                      v-model="providerModels[provider.key]"
                      label="Default Model"
                      variant="outlined"
                      density="compact"
                    />
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <v-btn color="primary" class="mt-4" @click="saveProviderSettings" :loading="saving">Save Providers</v-btn>
          </v-tabs-window-item>

          <!-- Embedding -->
          <v-tabs-window-item value="embedding">
            <v-card>
              <v-card-title>Embedding Configuration</v-card-title>
              <v-card-text>
                <v-select v-model="localSettings.embeddingProvider" :items="['openai', 'ollama', 'local']" label="Embedding Provider" variant="outlined" class="mb-3" />
                <v-text-field v-model="localSettings.embeddingModel" label="Embedding Model" variant="outlined" class="mb-3" />
                <v-text-field v-model="localSettings.embeddingDimensions" label="Dimensions" type="number" variant="outlined" />
              </v-card-text>
              <v-card-actions>
                <v-btn color="primary" @click="saveAll" :loading="saving">Save</v-btn>
              </v-card-actions>
            </v-card>
          </v-tabs-window-item>

          <!-- Webhooks -->
          <v-tabs-window-item value="webhooks">
            <v-card class="mb-4">
              <v-card-title class="d-flex align-center">
                Webhooks
                <v-spacer />
                <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="showAddWebhook = true">Add</v-btn>
              </v-card-title>
              <v-list>
                <v-list-item v-for="wh in settingsStore.webhooks" :key="wh.id" :title="wh.name" :subtitle="wh.url">
                  <template #append>
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="settingsStore.deleteWebhook(wh.id)" />
                  </template>
                </v-list-item>
                <v-list-item v-if="!settingsStore.webhooks.length" subtitle="No webhooks configured" />
              </v-list>
            </v-card>
          </v-tabs-window-item>

          <!-- MCP -->
          <v-tabs-window-item value="mcp">
            <v-card>
              <v-card-title>MCP Server Configuration</v-card-title>
              <v-card-text>
                <v-text-field v-model="localSettings.mcpServerUrl" label="MCP Server URL" variant="outlined" class="mb-3" placeholder="http://localhost:8080" />
                <v-switch v-model="localSettings.mcpEnabled" label="Enable MCP" color="primary" />
              </v-card-text>
              <v-card-actions>
                <v-btn color="primary" @click="saveAll" :loading="saving">Save</v-btn>
              </v-card-actions>
            </v-card>
          </v-tabs-window-item>

          <!-- System -->
          <v-tabs-window-item value="system">
            <v-card>
              <v-card-title>System Settings</v-card-title>
              <v-card-text>
                <v-text-field v-model="localSettings.systemPrompt" label="System Prompt" variant="outlined" rows="4" auto-grow class="mb-3" />
                <v-text-field v-model="localSettings.maxTokens" label="Max Tokens" type="number" variant="outlined" class="mb-3" />
                <v-slider v-model="localSettings.temperature" label="Temperature" min="0" max="2" step="0.1" thumb-label class="mb-3" />
              </v-card-text>
              <v-card-actions>
                <v-btn color="primary" @click="saveAll" :loading="saving">Save</v-btn>
              </v-card-actions>
            </v-card>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-col>
    </v-row>

    <!-- Add Webhook Dialog -->
    <v-dialog v-model="showAddWebhook" max-width="500">
      <v-card>
        <v-card-title>Add Webhook</v-card-title>
        <v-card-text>
          <v-text-field v-model="newWebhook.name" label="Name" variant="outlined" class="mb-2" />
          <v-text-field v-model="newWebhook.url" label="URL" variant="outlined" class="mb-2" />
          <v-combobox v-model="newWebhook.events" label="Events" multiple chips variant="outlined"
            :items="['message.created', 'chat.created', 'chat.deleted']" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showAddWebhook = false">Cancel</v-btn>
          <v-btn color="primary" @click="addWebhook">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()
const activeTab = ref('providers')
const saving = ref(false)
const showAddWebhook = ref(false)
const newWebhook = reactive({ name: '', url: '', events: [] })

const localSettings = reactive({
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-ada-002',
  embeddingDimensions: 1536,
  mcpServerUrl: '',
  mcpEnabled: false,
  systemPrompt: '',
  maxTokens: 2048,
  temperature: 0.7
})

const providers = [
  { key: 'openai', name: 'OpenAI', keyLabel: 'API Key', hasModel: true },
  { key: 'anthropic', name: 'Anthropic', keyLabel: 'API Key', hasModel: true },
  { key: 'ollama', name: 'Ollama', keyLabel: 'API Key (optional)', hasUrl: true, urlLabel: 'Base URL', hasModel: true },
  { key: 'groq', name: 'Groq', keyLabel: 'API Key', hasModel: true },
  { key: 'gemini', name: 'Google Gemini', keyLabel: 'API Key', hasModel: true },
  { key: 'azure', name: 'Azure OpenAI', keyLabel: 'API Key', hasUrl: true, urlLabel: 'Azure Endpoint', hasModel: true },
]

const providerEnabled = reactive({})
const providerKeys = reactive({})
const providerUrls = reactive({})
const providerModels = reactive({})
const showKey = reactive({})

providers.forEach(p => {
  providerEnabled[p.key] = false
  providerKeys[p.key] = ''
  providerUrls[p.key] = ''
  providerModels[p.key] = ''
  showKey[p.key] = false
})

watch(() => settingsStore.settings, (s) => {
  if (!s || !Object.keys(s).length) return
  Object.assign(localSettings, s)
  providers.forEach(p => {
    providerEnabled[p.key] = s[p.key]?.enabled || false
    providerKeys[p.key] = s[p.key]?.apiKey || ''
    providerUrls[p.key] = s[p.key]?.baseUrl || ''
    providerModels[p.key] = s[p.key]?.defaultModel || ''
  })
}, { immediate: true })

async function saveProviderSettings() {
  saving.value = true
  const providerData = {}
  providers.forEach(p => {
    providerData[p.key] = { enabled: providerEnabled[p.key], apiKey: providerKeys[p.key], baseUrl: providerUrls[p.key], defaultModel: providerModels[p.key] }
  })
  try { await settingsStore.saveSettings({ ...localSettings, ...providerData }) } finally { saving.value = false }
}

async function saveAll() {
  saving.value = true
  try { await settingsStore.saveSettings({ ...localSettings }) } finally { saving.value = false }
}

async function addWebhook() {
  await settingsStore.createWebhook({ ...newWebhook })
  showAddWebhook.value = false
  Object.assign(newWebhook, { name: '', url: '', events: [] })
}

onMounted(async () => {
  await settingsStore.loadSettings()
  await settingsStore.loadWebhooks()
})
</script>
