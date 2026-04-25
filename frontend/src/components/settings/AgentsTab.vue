<template>
  <div>
    <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
      <h2 class="text-xl font-bold">Agents</h2>
      <Button size="sm" @click="openAgentDialog()"> <Plus class="h-4 w-4 mr-2" />New Agent </Button>
    </div>
    <p class="text-sm text-muted-foreground mb-4">
      Agents combine a system prompt, knowledge stores, and tools.
    </p>

    <div v-if="!agentsStore.agents.length" class="flex flex-col items-center py-14 text-center">
      <Bot class="h-16 w-16 text-muted-foreground/25 mb-4" />
      <h3 class="text-lg font-semibold mb-2">No agents yet</h3>
      <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
        Agents combine a system prompt, tools, and knowledge stores.
      </p>
      <Button @click="openAgentDialog()"><Plus class="h-4 w-4 mr-2" />New Agent</Button>
    </div>

    <Card v-else>
      <div class="divide-y divide-border">
        <div
          v-for="agent in agentsStore.agents"
          :key="agent.id"
          class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
        >
          <Bot class="h-4 w-4 text-muted-foreground shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ agent.name }}</div>
            <div class="text-xs text-muted-foreground">
              {{ agent.provider || 'No provider' }}
              <span v-if="agent.providerModel"> · {{ agent.providerModel }}</span>
              <span v-if="agent.knowledgeStoreIds?.length">
                · {{ agent.knowledgeStoreIds.length }} KB</span
              >
              <span v-if="agent.toolIds?.length"> · {{ agent.toolIds.length }} tools</span>
            </div>
          </div>
          <Badge v-if="agent._sharedWithMe" variant="outline" class="text-[10px]">Shared</Badge>
          <Button
            v-if="canManage(agent)"
            variant="ghost"
            size="icon-xs"
            @click.stop="emit('openShareDialog', 'agent', agent.id, agent.name)"
          >
            <Share2 class="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" @click.stop="openAgentDialog(agent)">
            <Pencil class="h-3 w-3" />
          </Button>
          <Button
            v-if="canManage(agent)"
            variant="ghost"
            size="icon-xs"
            class="text-destructive"
            @click.stop="agentsStore.deleteAgent(agent.id)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>

    <!-- Agent dialog -->
    <Dialog :open="showAgentDialog" @update:open="showAgentDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingAgent?.id ? 'Edit Agent' : 'Add Agent' }}</DialogTitle>
          <DialogDescription>Configure agent settings.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Name</Label>
            <Input v-model="agentForm.name" placeholder="Agent name" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Description</Label>
            <Textarea v-model="agentForm.description" placeholder="Optional description" rows="2" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Provider</Label>
            <Select v-model="agentForm.provider">
              <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in providerKeysList" :key="p" :value="p">{{ p }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Model Name</Label>
            <Input v-model="agentForm.providerModel" placeholder="Model name" />
          </div>
          <div v-if="agentForm.provider === 'azure'">
            <Label class="mb-1.5 block text-xs">Azure Deployment Name</Label>
            <Input v-model="agentForm.deploymentName" placeholder="e.g. gpt-4o-mini-agent" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">System Prompt</Label>
            <Textarea v-model="agentForm.systemPrompt" placeholder="System prompt…" rows="4" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Knowledge Stores</Label>
            <div class="max-h-32 overflow-y-auto space-y-1.5 rounded-md border p-2">
              <div
                v-if="!knowledgeStore.knowledgeStores.length"
                class="text-xs text-muted-foreground py-1"
              >
                No knowledge stores available
              </div>
              <label
                v-for="ks in knowledgeStore.knowledgeStores"
                :key="ks.id"
                class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
              >
                <Checkbox
                  :checked="agentForm.knowledgeStoreIds.includes(ks.id)"
                  @update:checked="toggleAgentKs(ks.id)"
                />
                <span class="text-xs">{{ ks.name }}</span>
              </label>
            </div>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Tools</Label>
            <div class="max-h-32 overflow-y-auto space-y-1.5 rounded-md border p-2">
              <div v-if="!toolItems.length" class="text-xs text-muted-foreground py-1">
                No tools available
              </div>
              <label
                v-for="tool in toolItems"
                :key="tool.value"
                class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
              >
                <Checkbox
                  :checked="agentForm.toolIds.includes(tool.value)"
                  @update:checked="toggleAgentTool(tool.value)"
                />
                <span class="text-xs">{{ tool.title }}</span>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAgentDialog = false">Cancel</Button>
          <Button :disabled="!agentForm.name.trim()" @click="saveAgent">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useSettingsInject } from '../../composables/useSettingsState'
import type { Agent, Tool } from '../../types'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Checkbox } from '../ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Bot, Plus, Pencil, Trash2, Share2 } from 'lucide-vue-next'

const emit = defineEmits<{
  openShareDialog: [resourceType: string, resourceId: string, label: string]
}>()

const { agentsStore, toolsStore, knowledgeStore, canManage, providerKeysList, notify } =
  useSettingsInject()

const toolItems = computed(() =>
  toolsStore.tools.map((t: Tool) => ({ title: t.name, value: t.id })),
)

const showAgentDialog = ref(false)
const editingAgent = ref<Agent | null>(null)
const agentForm = reactive({
  name: '',
  description: '',
  provider: null as string | null,
  providerModel: '',
  deploymentName: '',
  systemPrompt: '',
  knowledgeStoreIds: [] as string[],
  toolIds: [] as string[],
})

function openAgentDialog(agent: Agent | null = null) {
  editingAgent.value = agent
  if (agent)
    Object.assign(agentForm, {
      name: agent.name,
      description: agent.description || '',
      provider: agent.provider || null,
      providerModel: agent.providerModel || '',
      deploymentName: (agent as any).deploymentName || '',
      systemPrompt: agent.systemPrompt || '',
      knowledgeStoreIds: agent.knowledgeStoreIds || [],
      toolIds: agent.toolIds || [],
    })
  else
    Object.assign(agentForm, {
      name: '',
      description: '',
      provider: null,
      providerModel: '',
      deploymentName: '',
      systemPrompt: '',
      knowledgeStoreIds: [],
      toolIds: [],
    })
  showAgentDialog.value = true
}

function toggleAgentKs(ksId: string) {
  const idx = agentForm.knowledgeStoreIds.indexOf(ksId)
  if (idx >= 0) agentForm.knowledgeStoreIds.splice(idx, 1)
  else agentForm.knowledgeStoreIds.push(ksId)
}

function toggleAgentTool(toolId: string) {
  const idx = agentForm.toolIds.indexOf(toolId)
  if (idx >= 0) agentForm.toolIds.splice(idx, 1)
  else agentForm.toolIds.push(toolId)
}

async function saveAgent() {
  const payload = {
    ...agentForm,
    provider: agentForm.provider || undefined,
    deploymentName: agentForm.deploymentName || undefined,
  }
  try {
    if (editingAgent.value?.id) {
      await agentsStore.updateAgent(editingAgent.value.id, payload)
      notify.success('Agent updated!')
    } else {
      await agentsStore.createAgent(payload)
      notify.success('Agent created!')
    }
    showAgentDialog.value = false
  } catch {
    notify.error('Failed to save agent.')
  }
}
</script>
