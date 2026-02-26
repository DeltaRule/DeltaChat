<template>
  <div class="settings-layout">
    <!-- Left sidebar tabs -->
    <aside class="settings-nav">
      <div class="settings-nav__title pa-3 text-caption text-uppercase text-disabled font-weight-bold">
        Settings
      </div>
      <v-list density="compact" nav>
        <v-list-item
          v-for="tab in tabs"
          :key="tab.value"
          :prepend-icon="tab.icon"
          :title="tab.label"
          :active="activeTab === tab.value"
          rounded="lg"
          class="mb-1"
          @click="activeTab = tab.value"
        />
      </v-list>
    </aside>

    <!-- Right content area -->
    <main class="settings-content">
      <!-- ── Model Providers ─────────────────────────────── -->
      <template v-if="activeTab === 'providers'">
        <div class="settings-section-title">Model Providers</div>
        <v-row>
          <v-col v-for="provider in providers" :key="provider.key" cols="12" sm="6">
            <v-card elevation="1">
              <v-card-title class="d-flex align-center py-3 px-4">
                <v-avatar
                  :color="provider.iconColor + ICON_BG_ALPHA"
                  size="36"
                  rounded="sm"
                  class="mr-3"
                  style="flex-shrink:0"
                >
                  <v-icon :icon="provider.icon" :color="provider.iconColor" size="20" />
                </v-avatar>
                <div class="flex-grow-1 min-width-0">
                  <div class="text-body-1 font-weight-bold">{{ provider.name }}</div>
                  <div class="text-caption text-disabled text-truncate">{{ provider.description }}</div>
                </div>
                <v-switch v-model="providerEnabled[provider.key]" hide-details density="compact" color="primary" class="ml-2 flex-shrink-0" />
              </v-card-title>
              <v-divider v-if="providerEnabled[provider.key]" />
              <v-card-text v-if="providerEnabled[provider.key]" class="pt-3">
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
        <v-btn color="primary" class="mt-4" prepend-icon="mdi-content-save" @click="saveProviderSettings" :loading="saving">
          Save Providers
        </v-btn>
      </template>

      <!-- ── Models ─────────────────────────────────────── -->
      <template v-else-if="activeTab === 'models'">
        <div class="settings-section-title d-flex align-center">
          Models
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" variant="tonal" @click="openModelDialog()">
            Add Model
          </v-btn>
        </div>
        <p class="text-body-2 text-disabled mb-4">
          Models are named configurations that users chat with. Each model references a provider, an optional
          system prompt, knowledge stores, and tools.
        </p>
        <!-- Empty state -->
        <div v-if="!modelsStore.aiModels.length" class="d-flex flex-column align-center justify-center py-14 text-center">
          <v-icon icon="mdi-brain" size="72" class="mb-4" style="opacity:0.25" />
          <div class="text-h6 mb-2">No models yet</div>
          <div class="text-body-2 text-disabled mb-6" style="max-width:340px">
            Create a named model configuration — each model can reference a provider,
            system prompt, knowledge stores and tools.
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" variant="tonal" @click="openModelDialog()">
            Add First Model
          </v-btn>
        </div>
        <v-card v-else elevation="1">
          <v-list density="compact">
            <v-list-item
              v-for="m in modelsStore.aiModels"
              :key="m.id"
              :title="m.name"
              rounded="lg"
              class="ma-1"
            >
              <template #subtitle>
                <span class="text-caption">
                  {{ m.type === 'agent' ? 'Agent' : m.type === 'webhook' ? 'Webhook' : m.provider || 'No provider' }}
                  <span v-if="m.providerModel"> · {{ m.providerModel }}</span>
                </span>
              </template>
              <template #prepend>
                <v-icon :icon="m.type === 'agent' ? 'mdi-robot' : m.type === 'webhook' ? 'mdi-webhook' : 'mdi-brain'" size="small" class="mr-1" />
              </template>
              <template #append>
                <v-chip :color="m.enabled !== false ? 'success' : 'default'" size="x-small" class="mr-2">
                  {{ m.enabled !== false ? 'Active' : 'Disabled' }}
                </v-chip>
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="openModelDialog(m)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="modelsStore.deleteModel(m.id)" />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </template>

      <!-- ── Knowledge Stores ───────────────────────────── -->
      <template v-else-if="activeTab === 'knowledge'">
        <div class="settings-section-title d-flex align-center">
          Knowledge Stores
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" variant="tonal" @click="showCreateKs = true">
            New Store
          </v-btn>
        </div>
        <v-row>
          <v-col cols="12" md="4">
            <!-- Empty state for left panel when no stores exist -->
            <div v-if="!knowledgeStore.knowledgeStores.length"
              class="d-flex flex-column align-center justify-center py-10 text-center"
              style="border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px;"
            >
              <v-icon icon="mdi-database-outline" size="48" class="mb-3" style="opacity:0.3" />
              <div class="text-body-2 text-disabled mb-3">No knowledge stores yet</div>
              <v-btn color="primary" size="small" variant="tonal" prepend-icon="mdi-plus" @click="showCreateKs = true">
                Create Store
              </v-btn>
            </div>
            <v-card v-else elevation="1">
              <v-list density="compact">
                <v-list-item
                  v-for="ks in knowledgeStore.knowledgeStores"
                  :key="ks.id"
                  :title="ks.name"
                  :subtitle="`${ks.documentCount || 0} documents`"
                  :active="selectedKs?.id === ks.id"
                  rounded="lg"
                  class="ma-1"
                  @click="selectKs(ks)"
                >
                  <template #prepend>
                    <v-icon icon="mdi-database" size="small" />
                  </template>
                  <template #append>
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="knowledgeStore.deleteKnowledgeStore(ks.id)" />
                  </template>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>
          <v-col cols="12" md="8">
            <v-card v-if="selectedKs" elevation="1">
              <v-card-title class="py-3 text-body-1 font-weight-bold">{{ selectedKs.name }}</v-card-title>
              <v-divider />
              <v-card-text>
                <div
                  class="drop-zone pa-6 text-center mb-4"
                  :class="{ dragging: isDragging }"
                  @dragover.prevent="isDragging = true"
                  @dragleave="isDragging = false"
                  @drop.prevent="handleDrop"
                  @click="$refs.docInput.click()"
                >
                  <v-icon icon="mdi-cloud-upload" size="40" class="mb-2 text-medium-emphasis" />
                  <div class="text-body-2">Drop files here or click to upload</div>
                  <div class="text-caption text-disabled mt-1">PDF, TXT, MD, DOCX supported</div>
                </div>
                <input ref="docInput" type="file" multiple style="display:none" @change="handleFileSelect" />
                <v-list v-if="ksDocs.length" density="compact">
                  <v-list-item v-for="doc in ksDocs" :key="doc.id" :title="doc.name || doc.filename" rounded="lg" class="mb-1">
                    <template #subtitle>
                      <v-chip :color="statusColor(doc.status)" size="x-small" class="mt-1">{{ doc.status || 'ready' }}</v-chip>
                    </template>
                    <template #append>
                      <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="knowledgeStore.deleteDocument(selectedKs.id, doc.id)" />
                    </template>
                  </v-list-item>
                </v-list>
                <div v-else class="text-center text-disabled py-4">No documents uploaded yet</div>
              </v-card-text>
            </v-card>
            <!-- Right-panel placeholder when no store selected -->
            <div v-else class="d-flex flex-column align-center justify-center text-center py-16"
              style="border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 8px; min-height: 240px;"
            >
              <v-icon icon="mdi-arrow-left-circle-outline" size="40" class="mb-3" style="opacity:0.3" />
              <div class="text-body-2 text-disabled">{{ ksRightPanelHint }}</div>
            </div>
          </v-col>
        </v-row>
      </template>

      <!-- ── Agents ─────────────────────────────────────── -->
      <template v-else-if="activeTab === 'agents'">
        <div class="settings-section-title d-flex align-center">
          Agents
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" variant="tonal" @click="openAgentDialog()">
            Add Agent
          </v-btn>
        </div>
        <p class="text-body-2 text-disabled mb-4">
          Agents combine a system prompt, knowledge stores, and tools. Add an agent as a Model so users can chat with it.
        </p>
        <!-- Empty state -->
        <div v-if="!agentsStore.agents.length" class="d-flex flex-column align-center justify-center py-14 text-center">
          <v-icon icon="mdi-robot-outline" size="72" class="mb-4" style="opacity:0.25" />
          <div class="text-h6 mb-2">No agents yet</div>
          <div class="text-body-2 text-disabled mb-6" style="max-width:340px">
            Agents combine a system prompt, tools, and knowledge stores into a reusable AI persona.
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" variant="tonal" @click="openAgentDialog()">
            Add First Agent
          </v-btn>
        </div>
        <v-card v-else elevation="1">
          <v-list density="compact">
            <v-list-item
              v-for="agent in agentsStore.agents"
              :key="agent.id"
              :title="agent.name"
              rounded="lg"
              class="ma-1"
            >
              <template #subtitle>
                <span class="text-caption">
                  {{ agent.provider || 'No provider' }}
                  <span v-if="agent.providerModel"> · {{ agent.providerModel }}</span>
                  <span v-if="agent.knowledgeStoreIds?.length"> · {{ agent.knowledgeStoreIds.length }} KB</span>
                  <span v-if="agent.toolIds?.length"> · {{ agent.toolIds.length }} tools</span>
                </span>
              </template>
              <template #prepend>
                <v-icon icon="mdi-robot" size="small" />
              </template>
              <template #append>
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="openAgentDialog(agent)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="agentsStore.deleteAgent(agent.id)" />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </template>

      <!-- ── Tools ──────────────────────────────────────── -->
      <template v-else-if="activeTab === 'tools'">
        <div class="settings-section-title d-flex align-center">
          Tools
          <v-spacer />
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" variant="tonal" @click="openToolDialog()">
            Add Tool
          </v-btn>
        </div>
        <p class="text-body-2 text-disabled mb-4">
          Connect tools via MCP, or define custom Python / TypeScript functions in the specified format.
        </p>
        <!-- Empty state -->
        <div v-if="!toolsStore.tools.length" class="d-flex flex-column align-center justify-center py-14 text-center">
          <v-icon icon="mdi-tools" size="72" class="mb-4" style="opacity:0.25" />
          <div class="text-h6 mb-2">No tools yet</div>
          <div class="text-body-2 text-disabled mb-6" style="max-width:340px">
            Add MCP tool servers or define custom Python / TypeScript functions to extend AI capabilities.
          </div>
          <v-btn color="primary" prepend-icon="mdi-plus" variant="tonal" @click="openToolDialog()">
            Add First Tool
          </v-btn>
        </div>
        <v-card v-else elevation="1">
          <v-list density="compact">
            <v-list-item
              v-for="tool in toolsStore.tools"
              :key="tool.id"
              :title="tool.name"
              rounded="lg"
              class="ma-1"
            >
              <template #subtitle>
                <v-chip size="x-small" class="mr-1">{{ tool.type }}</v-chip>
                <span class="text-caption">{{ tool.description || '' }}</span>
              </template>
              <template #prepend>
                <v-icon :icon="toolIcon(tool.type)" size="small" />
              </template>
              <template #append>
                <v-chip :color="tool.enabled !== false ? 'success' : 'default'" size="x-small" class="mr-2">
                  {{ tool.enabled !== false ? 'Active' : 'Disabled' }}
                </v-chip>
                <v-btn icon="mdi-pencil" size="x-small" variant="text" @click.stop="openToolDialog(tool)" />
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="toolsStore.deleteTool(tool.id)" />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </template>
    </main>

    <!-- ── Dialogs ──────────────────────────────────────────────────────────── -->

    <!-- Model dialog -->
    <v-dialog v-model="showModelDialog" max-width="560">
      <v-card>
        <v-card-title class="pt-4">{{ editingModel?.id ? 'Edit Model' : 'Add Model' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="modelForm.name" label="Display Name" variant="outlined" class="mb-3" autofocus />
          <v-select v-model="modelForm.type" :items="['model', 'webhook', 'agent']" label="Type" variant="outlined" class="mb-3" />
          <template v-if="modelForm.type === 'model'">
            <v-select v-model="modelForm.provider" :items="providerKeys_list" label="Provider" variant="outlined" class="mb-3" clearable />
            <v-text-field v-model="modelForm.providerModel" label="Model Name (e.g. gpt-4o)" variant="outlined" class="mb-3" />
            <v-textarea v-model="modelForm.systemPrompt" label="System Prompt" variant="outlined" rows="3" class="mb-3" />
            <v-text-field v-model.number="modelForm.temperature" label="Temperature" type="number" step="0.1" min="0" max="2" variant="outlined" class="mb-3" />
            <v-combobox
              v-model="modelForm.knowledgeStoreIds"
              :items="knowledgeStoreItems"
              item-title="title"
              item-value="value"
              label="Knowledge Stores"
              multiple
              chips
              variant="outlined"
              class="mb-3"
            />
            <v-combobox
              v-model="modelForm.toolIds"
              :items="toolItems"
              item-title="title"
              item-value="value"
              label="Tools"
              multiple
              chips
              variant="outlined"
            />
          </template>
          <template v-else-if="modelForm.type === 'webhook'">
            <v-select
              v-model="modelForm.webhookId"
              :items="webhookItems"
              item-title="title"
              item-value="value"
              label="Webhook"
              variant="outlined"
            />
          </template>
          <template v-else-if="modelForm.type === 'agent'">
            <v-select
              v-model="modelForm.agentId"
              :items="agentItems"
              item-title="title"
              item-value="value"
              label="Agent"
              variant="outlined"
            />
          </template>
          <v-switch v-model="modelForm.enabled" label="Enabled" color="primary" hide-details class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showModelDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveModel">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Agent dialog -->
    <v-dialog v-model="showAgentDialog" max-width="560">
      <v-card>
        <v-card-title class="pt-4">{{ editingAgent?.id ? 'Edit Agent' : 'Add Agent' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="agentForm.name" label="Name" variant="outlined" class="mb-3" autofocus />
          <v-textarea v-model="agentForm.description" label="Description (optional)" variant="outlined" rows="2" class="mb-3" />
          <v-select v-model="agentForm.provider" :items="providerKeys_list" label="Provider" variant="outlined" class="mb-3" clearable />
          <v-text-field v-model="agentForm.providerModel" label="Model Name" variant="outlined" class="mb-3" />
          <v-textarea v-model="agentForm.systemPrompt" label="System Prompt" variant="outlined" rows="4" class="mb-3" />
          <v-combobox
            v-model="agentForm.knowledgeStoreIds"
            :items="knowledgeStoreItems"
            item-title="title"
            item-value="value"
            label="Knowledge Stores"
            multiple
            chips
            variant="outlined"
            class="mb-3"
            hint="Each selected store adds a retrieve() tool automatically"
            persistent-hint
          />
          <v-combobox
            v-model="agentForm.toolIds"
            :items="toolItems"
            item-title="title"
            item-value="value"
            label="Tools"
            multiple
            chips
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAgentDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveAgent">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Tool dialog -->
    <v-dialog v-model="showToolDialog" max-width="560">
      <v-card>
        <v-card-title class="pt-4">{{ editingTool?.id ? 'Edit Tool' : 'Add Tool' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="toolForm.name" label="Name" variant="outlined" class="mb-3" autofocus />
          <v-textarea v-model="toolForm.description" label="Description" variant="outlined" rows="2" class="mb-3" />
          <v-select v-model="toolForm.type" :items="['mcp', 'python', 'typescript']" label="Type" variant="outlined" class="mb-3" />
          <template v-if="toolForm.type === 'mcp'">
            <v-text-field v-model="toolForm.config.serverUrl" label="MCP Server URL" variant="outlined" class="mb-2" />
            <v-text-field v-model="toolForm.config.toolName" label="Tool Name" variant="outlined" />
          </template>
          <template v-else>
            <v-textarea v-model="toolForm.config.code" label="Function Code" variant="outlined" rows="6" font-family="monospace" />
          </template>
          <v-switch v-model="toolForm.enabled" label="Enabled" color="primary" hide-details class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showToolDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveTool">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create knowledge store dialog -->
    <v-dialog v-model="showCreateKs" max-width="400">
      <v-card>
        <v-card-title class="pt-4">Create Knowledge Store</v-card-title>
        <v-card-text>
          <v-text-field v-model="newKsName" label="Name" variant="outlined" class="mb-3" autofocus />
          <v-textarea v-model="newKsDesc" label="Description (optional)" variant="outlined" rows="2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateKs = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!newKsName.trim()" @click="createKs">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useModelsStore } from '../stores/models'
import { useAgentsStore } from '../stores/agents'
import { useToolsStore } from '../stores/tools'
import { useKnowledgeStore } from '../stores/knowledge'

const settingsStore = useSettingsStore()
const modelsStore = useModelsStore()
const agentsStore = useAgentsStore()
const toolsStore = useToolsStore()
const knowledgeStore = useKnowledgeStore()

// Reusable item lists for comboboxes/selects
const knowledgeStoreItems = computed(() =>
  knowledgeStore.knowledgeStores.map(k => ({ title: k.name, value: k.id }))
)
const toolItems = computed(() =>
  toolsStore.tools.map(t => ({ title: t.name, value: t.id }))
)
const webhookItems = computed(() =>
  settingsStore.webhooks.map(w => ({ title: w.name, value: w.id }))
)
const agentItems = computed(() =>
  agentsStore.agents.map(a => ({ title: a.name, value: a.id }))
)

// Hint for the knowledge-store right panel when nothing is selected
const ksRightPanelHint = computed(() =>
  knowledgeStore.knowledgeStores.length
    ? 'Select a store to manage its documents'
    : 'Create a knowledge store first'
)

// 13 % opacity hex suffix for provider icon background tints
const ICON_BG_ALPHA = '22'

const activeTab = ref('providers')
const saving = ref(false)

const tabs = [
  { value: 'providers', label: 'Model Providers', icon: 'mdi-key' },
  { value: 'models', label: 'Models', icon: 'mdi-brain' },
  { value: 'knowledge', label: 'Knowledge Stores', icon: 'mdi-database' },
  { value: 'agents', label: 'Agents', icon: 'mdi-robot' },
  { value: 'tools', label: 'Tools', icon: 'mdi-tools' },
]

// ── Provider settings ───────────────────────────────────────────────────────

const providers = [
  { key: 'openai', name: 'OpenAI', keyLabel: 'API Key', hasModel: true, icon: 'mdi-brain', iconColor: '#10a37f', description: 'GPT-4o, GPT-4, GPT-3.5 and more' },
  { key: 'anthropic', name: 'Anthropic', keyLabel: 'API Key', hasModel: true, icon: 'mdi-robot-excited-outline', iconColor: '#d97706', description: 'Claude 3.5 Sonnet, Claude 3 Opus and more' },
  { key: 'ollama', name: 'Ollama', keyLabel: 'API Key (optional)', hasUrl: true, urlLabel: 'Base URL', hasModel: true, icon: 'mdi-layers-triple', iconColor: '#0ea5e9', description: 'Run models locally, no API key needed' },
  { key: 'groq', name: 'Groq', keyLabel: 'API Key', hasModel: true, icon: 'mdi-lightning-bolt', iconColor: '#f59e0b', description: 'Ultra-fast inference — Llama, Mixtral and more' },
  { key: 'gemini', name: 'Google Gemini', keyLabel: 'API Key', hasModel: true, icon: 'mdi-google', iconColor: '#4285f4', description: 'Gemini 1.5 Pro, Flash and more' },
  { key: 'azure', name: 'Azure OpenAI', keyLabel: 'API Key', hasUrl: true, urlLabel: 'Azure Endpoint', hasModel: true, icon: 'mdi-microsoft-azure', iconColor: '#0078d4', description: 'OpenAI models hosted on Microsoft Azure' },
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

const providerKeys_list = computed(() =>
  providers.filter(p => providerEnabled[p.key]).map(p => p.key)
)

watch(() => settingsStore.settings, (s) => {
  if (!s || !Object.keys(s).length) return
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
  try { await settingsStore.saveSettings(providerData) } finally { saving.value = false }
}

// ── Model dialog ────────────────────────────────────────────────────────────

const showModelDialog = ref(false)
const editingModel = ref(null)
const modelForm = reactive({
  name: '', type: 'model', provider: null, providerModel: '', systemPrompt: '',
  temperature: 0.7, knowledgeStoreIds: [], toolIds: [], webhookId: null, agentId: null, enabled: true,
})

function openModelDialog(model = null) {
  editingModel.value = model
  if (model) {
    Object.assign(modelForm, {
      name: model.name, type: model.type || 'model',
      provider: model.provider || null, providerModel: model.providerModel || '',
      systemPrompt: model.systemPrompt || '', temperature: model.temperature ?? 0.7,
      knowledgeStoreIds: model.knowledgeStoreIds || [], toolIds: model.toolIds || [],
      webhookId: model.webhookId || null, agentId: model.agentId || null,
      enabled: model.enabled !== false,
    })
  } else {
    Object.assign(modelForm, {
      name: '', type: 'model', provider: null, providerModel: '', systemPrompt: '',
      temperature: 0.7, knowledgeStoreIds: [], toolIds: [], webhookId: null, agentId: null, enabled: true,
    })
  }
  showModelDialog.value = true
}

async function saveModel() {
  const payload = { ...modelForm }
  if (editingModel.value?.id) {
    await modelsStore.updateModel(editingModel.value.id, payload)
  } else {
    await modelsStore.createModel(payload)
  }
  showModelDialog.value = false
}

// ── Agent dialog ─────────────────────────────────────────────────────────────

const showAgentDialog = ref(false)
const editingAgent = ref(null)
const agentForm = reactive({
  name: '', description: '', provider: null, providerModel: '',
  systemPrompt: '', knowledgeStoreIds: [], toolIds: [],
})

function openAgentDialog(agent = null) {
  editingAgent.value = agent
  if (agent) {
    Object.assign(agentForm, {
      name: agent.name, description: agent.description || '',
      provider: agent.provider || null, providerModel: agent.providerModel || '',
      systemPrompt: agent.systemPrompt || '',
      knowledgeStoreIds: agent.knowledgeStoreIds || [],
      toolIds: agent.toolIds || [],
    })
  } else {
    Object.assign(agentForm, { name: '', description: '', provider: null, providerModel: '', systemPrompt: '', knowledgeStoreIds: [], toolIds: [] })
  }
  showAgentDialog.value = true
}

async function saveAgent() {
  if (editingAgent.value?.id) {
    await agentsStore.updateAgent(editingAgent.value.id, { ...agentForm })
  } else {
    await agentsStore.createAgent({ ...agentForm })
  }
  showAgentDialog.value = false
}

// ── Tool dialog ───────────────────────────────────────────────────────────────

const showToolDialog = ref(false)
const editingTool = ref(null)
const toolForm = reactive({ name: '', description: '', type: 'mcp', config: { serverUrl: '', toolName: '', code: '' }, enabled: true })

function toolIcon(type) {
  return { mcp: 'mdi-connection', python: 'mdi-language-python', typescript: 'mdi-language-typescript' }[type] || 'mdi-tools'
}

function openToolDialog(tool = null) {
  editingTool.value = tool
  if (tool) {
    Object.assign(toolForm, {
      name: tool.name, description: tool.description || '', type: tool.type,
      config: { serverUrl: tool.config?.serverUrl || '', toolName: tool.config?.toolName || '', code: tool.config?.code || '' },
      enabled: tool.enabled !== false,
    })
  } else {
    Object.assign(toolForm, { name: '', description: '', type: 'mcp', config: { serverUrl: '', toolName: '', code: '' }, enabled: true })
  }
  showToolDialog.value = true
}

async function saveTool() {
  const payload = { ...toolForm, config: { ...toolForm.config } }
  if (editingTool.value?.id) {
    await toolsStore.updateTool(editingTool.value.id, payload)
  } else {
    await toolsStore.createTool(payload)
  }
  showToolDialog.value = false
}

// ── Knowledge stores ──────────────────────────────────────────────────────────

const selectedKs = ref(null)
const showCreateKs = ref(false)
const newKsName = ref('')
const newKsDesc = ref('')
const isDragging = ref(false)
const docInput = ref(null)
const ksDocs = computed(() => selectedKs.value ? (knowledgeStore.documents[selectedKs.value.id] || []) : [])

async function selectKs(ks) {
  selectedKs.value = ks
  await knowledgeStore.loadDocuments(ks.id)
}

async function createKs() {
  await knowledgeStore.createKnowledgeStore(newKsName.value, newKsDesc.value)
  showCreateKs.value = false
  newKsName.value = ''
  newKsDesc.value = ''
}

async function handleDrop(e) {
  isDragging.value = false
  if (!selectedKs.value) return
  for (const file of e.dataTransfer.files) await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}

async function handleFileSelect(e) {
  if (!selectedKs.value) return
  for (const file of e.target.files) await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}

function statusColor(status) {
  return { ready: 'success', processing: 'warning', failed: 'error' }[status] || 'info'
}

onMounted(async () => {
  await Promise.all([
    settingsStore.loadSettings(),
    settingsStore.loadWebhooks(),
    modelsStore.loadModels(),
    agentsStore.loadAgents(),
    toolsStore.loadTools(),
    knowledgeStore.loadKnowledgeStores(),
  ])
})
</script>

<style scoped>
.settings-layout {
  display: flex;
  height: calc(100vh - 48px);
  overflow: hidden;
}

.settings-nav {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  overflow-y: auto;
  background: rgb(var(--v-theme-surface));
}

.settings-nav__title {
  letter-spacing: 0.08em;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.settings-section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.drop-zone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.4);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}

@media (max-width: 600px) {
  .settings-nav {
    width: 56px;
    min-width: 56px;
  }
  .settings-nav .v-list-item__title,
  .settings-nav__title {
    display: none;
  }
}
</style>
