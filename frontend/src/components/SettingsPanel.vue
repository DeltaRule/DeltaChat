<template>
  <div class="flex w-full h-full overflow-hidden">
    <!-- Settings sidebar -->
    <Sidebar collapsible="icon">
      <SidebarHeader class="flex items-center px-3 h-12">
        <span class="text-sm font-bold flex-1 group-data-[collapsible=icon]:hidden">Settings</span>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="tab in tabs" :key="tab.value">
                <SidebarMenuButton
                  :is-active="activeTab === tab.value"
                  :tooltip="tab.label"
                  @click="activeTab = tab.value"
                >
                  <component :is="tab.icon" class="h-4 w-4" />
                  <span>{{ tab.label }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>

    <!-- Content area -->
    <SidebarInset class="min-h-0 min-w-0">
      <div class="flex-1 h-full overflow-y-auto">
        <div class="p-6">
          <component :is="currentTabComponent" @open-share-dialog="openShareDialog" />
        </div>
      </div>

      <!-- Share Dialog -->
      <ShareDialog
        v-model:open="shareDialogOpen"
        :resource-type="shareTarget.type"
        :resource-id="shareTarget.id"
        :resource-label="shareTarget.label"
      />
    </SidebarInset>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, provide } from 'vue'
import { useSettingsState, SETTINGS_STATE_KEY } from '../composables/useSettingsState'
import { useSettingsStore } from '../stores/settings'
import { useModelsStore } from '../stores/models'
import { useAgentsStore } from '../stores/agents'
import { useToolsStore } from '../stores/tools'
import { useMcpConnectionsStore } from '../stores/mcpConnections'
import { useKnowledgeStore } from '../stores/knowledge'
import ShareDialog from './ShareDialog.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
  SidebarInset,
} from './ui/sidebar'
import ProvidersTab from './settings/ProvidersTab.vue'
import ModelsTab from './settings/ModelsTab.vue'
import VectorStoresTab from './settings/VectorStoresTab.vue'
import DocProcessorTab from './settings/DocProcessorTab.vue'
import KnowledgeTab from './settings/KnowledgeTab.vue'
import AgentsTab from './settings/AgentsTab.vue'
import ToolsTab from './settings/ToolsTab.vue'
import McpServersTab from './settings/McpServersTab.vue'
import ExecutorsTab from './settings/ExecutorsTab.vue'
import AppearanceTab from './settings/AppearanceTab.vue'
import {
  Key,
  Brain,
  Database,
  Bot,
  Wrench,
  Palette,
  Zap,
  HardDrive,
  FileSearch,
  Link,
} from 'lucide-vue-next'

const state = useSettingsState()
provide(SETTINGS_STATE_KEY, state)

const settingsStore = useSettingsStore()
const modelsStore = useModelsStore()
const agentsStore = useAgentsStore()
const toolsStore = useToolsStore()
const mcpStore = useMcpConnectionsStore()
const knowledgeStore = useKnowledgeStore()

const activeTab = ref('providers')

const tabs = [
  { value: 'providers', label: 'Providers', icon: Key },
  { value: 'models', label: 'Models', icon: Brain },
  { value: 'vectorstores', label: 'Vector Stores', icon: HardDrive },
  { value: 'docprocessor', label: 'Document Processor', icon: FileSearch },
  { value: 'knowledge', label: 'Knowledge', icon: Database },
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'tools', label: 'Tools', icon: Wrench },
  { value: 'mcpservers', label: 'MCP Servers', icon: Link },
  { value: 'executors', label: 'Executors', icon: Zap },
  { value: 'appearance', label: 'Appearance', icon: Palette },
]

const tabComponentMap: Record<string, object> = {
  providers: ProvidersTab,
  models: ModelsTab,
  vectorstores: VectorStoresTab,
  docprocessor: DocProcessorTab,
  knowledge: KnowledgeTab,
  agents: AgentsTab,
  tools: ToolsTab,
  mcpservers: McpServersTab,
  executors: ExecutorsTab,
  appearance: AppearanceTab,
}

const currentTabComponent = computed(() => tabComponentMap[activeTab.value])

const shareDialogOpen = ref(false)
const shareTarget = ref({ type: '', id: '', label: '' })
function openShareDialog(resourceType: string, resourceId: string, label: string) {
  shareTarget.value = { type: resourceType, id: resourceId, label }
  shareDialogOpen.value = true
}

onMounted(async () => {
  await Promise.all([
    settingsStore.loadSettings(),
    settingsStore.loadWebhooks(),
    modelsStore.loadModels(),
    agentsStore.loadAgents(),
    toolsStore.loadTools(),
    mcpStore.loadConnections(),
    knowledgeStore.loadKnowledgeStores(),
  ])
})
</script>
