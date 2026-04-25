<template>
  <div>
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 mb-5 pb-3 border-b-2 border-primary/15">
      <Tabs v-model="modelSubTab">
        <TabsList>
          <TabsTrigger value="general">Models</TabsTrigger>
          <TabsTrigger value="embedding">Embedding</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button
        class="ml-auto"
        size="sm"
        @click="openModelDialog(null, modelSubTab === 'embedding' ? 'embedding' : 'model')"
      >
        <Plus class="h-4 w-4 mr-2" />
        {{ modelSubTab === 'embedding' ? 'New Embedding' : 'New Model' }}
      </Button>
    </div>

    <p class="text-xs text-muted-foreground mb-3">
      Click the checkbox next to a model to set it as default.
    </p>

    <!-- General models list -->
    <template v-if="modelSubTab === 'general'">
      <p class="text-sm text-muted-foreground mb-4">
        Models are named configurations that users chat with. Includes standard models, webhooks,
        and agents.
      </p>
      <div v-if="!generalModels.length" class="flex flex-col items-center py-14 text-center">
        <Brain class="h-16 w-16 text-muted-foreground/25 mb-4" />
        <h3 class="text-lg font-semibold mb-2">No models yet</h3>
        <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
          Create a named model configuration.
        </p>
        <Button @click="openModelDialog(null, 'model')"
          ><Plus class="h-4 w-4 mr-2" />New Model</Button
        >
      </div>
      <Card v-else>
        <div class="divide-y divide-border">
          <div
            v-for="m in generalModels"
            :key="m.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <Tooltip :delay-duration="200">
              <TooltipTrigger as-child>
                <Checkbox
                  :checked="m.id === defaultModelId"
                  @update:checked="toggleDefaultModel(m.id)"
                />
              </TooltipTrigger>
              <TooltipContent>{{
                m.id === defaultModelId ? 'Default model' : 'Set as default'
              }}</TooltipContent>
            </Tooltip>
            <component
              :is="m.type === 'agent' ? Bot : m.type === 'webhook' ? Webhook : Brain"
              class="h-4 w-4 text-muted-foreground shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ m.name }}</div>
              <div class="text-xs text-muted-foreground">
                {{
                  m.type === 'agent'
                    ? 'Agent'
                    : m.type === 'webhook'
                      ? 'Webhook'
                      : m.provider || 'No provider'
                }}
                <span v-if="m.providerModel"> · {{ m.providerModel }}</span>
              </div>
            </div>
            <Badge v-if="m.id === defaultModelId" variant="default" class="text-[10px]"
              >Default</Badge
            >
            <Badge v-if="m._sharedWithMe" variant="outline" class="text-[10px]">Shared</Badge>
            <Badge :variant="m.enabled !== false ? 'success' : 'outline'">
              {{ m.enabled !== false ? 'Active' : 'Disabled' }}
            </Badge>
            <Button
              v-if="canManage(m)"
              variant="ghost"
              size="icon-xs"
              @click.stop="openShareDialog('ai_model', m.id, m.name)"
            >
              <Share2 class="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" @click.stop="openModelDialog(m)">
              <Pencil class="h-3 w-3" />
            </Button>
            <Button
              v-if="canManage(m)"
              variant="ghost"
              size="icon-xs"
              class="text-destructive"
              @click.stop="confirmDeleteModel(m)"
            >
              <Trash2 class="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Card>
    </template>

    <!-- Embedding models list -->
    <template v-else>
      <p class="text-sm text-muted-foreground mb-4">
        Embedding models convert text into vectors for knowledge store search and RAG.
      </p>
      <div v-if="!embeddingModels.length" class="flex flex-col items-center py-14 text-center">
        <Database class="h-16 w-16 text-muted-foreground/25 mb-4" />
        <h3 class="text-lg font-semibold mb-2">No embedding models yet</h3>
        <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
          Create an embedding model configuration.
        </p>
        <Button @click="openModelDialog(null, 'embedding')"
          ><Plus class="h-4 w-4 mr-2" />New Embedding</Button
        >
      </div>
      <Card v-else>
        <div class="divide-y divide-border">
          <div
            v-for="m in embeddingModels"
            :key="m.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <Tooltip :delay-duration="200">
              <TooltipTrigger as-child>
                <Checkbox
                  :checked="m.id === defaultEmbeddingModelId"
                  @update:checked="toggleDefaultEmbedding(m.id)"
                />
              </TooltipTrigger>
              <TooltipContent>{{
                m.id === defaultEmbeddingModelId ? 'Default embedding' : 'Set as default'
              }}</TooltipContent>
            </Tooltip>
            <Database class="h-4 w-4 text-muted-foreground shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ m.name }}</div>
              <div class="text-xs text-muted-foreground">
                {{ m.provider || 'No provider' }}
                <span v-if="m.providerModel"> · {{ m.providerModel }}</span>
                <span v-if="m.chunkSize"> · {{ m.chunkSize }}cs</span>
                <span v-if="m.chunkOverlap"> / {{ m.chunkOverlap }}co</span>
                <span v-if="m.topK"> · top{{ m.topK }}</span>
              </div>
            </div>
            <Badge v-if="m.id === defaultEmbeddingModelId" variant="default" class="text-[10px]"
              >Default</Badge
            >
            <Badge v-if="m._sharedWithMe" variant="outline" class="text-[10px]">Shared</Badge>
            <Badge :variant="m.enabled !== false ? 'success' : 'outline'">
              {{ m.enabled !== false ? 'Active' : 'Disabled' }}
            </Badge>
            <Button
              v-if="canManage(m)"
              variant="ghost"
              size="icon-xs"
              @click.stop="openShareDialog('ai_model', m.id, m.name)"
            >
              <Share2 class="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon-xs" @click.stop="openModelDialog(m)">
              <Pencil class="h-3 w-3" />
            </Button>
            <Button
              v-if="canManage(m)"
              variant="ghost"
              size="icon-xs"
              class="text-destructive"
              @click.stop="confirmDeleteModel(m)"
            >
              <Trash2 class="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Card>
    </template>

    <!-- Model dialog -->
    <Dialog :open="showModelDialog" @update:open="showModelDialog = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingModel?.id ? 'Edit Model' : 'Add Model' }}</DialogTitle>
          <DialogDescription>Configure the model settings below.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Display Name</Label>
            <Input v-model="modelForm.name" placeholder="Display Name" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Type</Label>
            <Select v-model="modelForm.type">
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="model">Model</SelectItem>
                <SelectItem value="embedding">Embedding</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-if="modelForm.type === 'model' || modelForm.type === 'embedding'">
            <div>
              <Label class="mb-1.5 block text-xs">Provider</Label>
              <Select v-model="modelForm.provider">
                <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="p in modelForm.type === 'embedding'
                      ? embeddingProviderKeys
                      : providerKeysList"
                    :key="p"
                    :value="p"
                    >{{ p }}</SelectItem
                  >
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Model Name</Label>
              <Input
                v-model="modelForm.providerModel"
                :placeholder="
                  modelForm.type === 'embedding' ? 'e.g. nomic-embed-text' : 'e.g. gpt-4o'
                "
              />
            </div>
            <div v-if="modelForm.provider === 'azure'">
              <Label class="mb-1.5 block text-xs">Azure Deployment Name</Label>
              <Input v-model="modelForm.deploymentName" placeholder="e.g. gpt-4o-mini-prod" />
              <p class="mt-1 text-[11px] text-muted-foreground">
                This is the Azure deployment identifier, not the base model family.
              </p>
            </div>
            <template v-if="modelForm.type === 'embedding'">
              <Separator />
              <p class="text-xs text-muted-foreground">
                Default chunking & retrieval settings for knowledge stores using this embedding
                model.
              </p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <Label class="mb-1.5 block text-xs">Chunk Size</Label>
                  <Input v-model.number="modelForm.chunkSize" type="number" placeholder="1000" />
                </div>
                <div>
                  <Label class="mb-1.5 block text-xs">Chunk Overlap</Label>
                  <Input v-model.number="modelForm.chunkOverlap" type="number" placeholder="200" />
                </div>
                <div>
                  <Label class="mb-1.5 block text-xs">Top K</Label>
                  <Input v-model.number="modelForm.topK" type="number" placeholder="5" />
                </div>
              </div>
            </template>
            <template v-if="modelForm.type === 'model'">
              <div>
                <Label class="mb-1.5 block text-xs">System Prompt</Label>
                <Textarea v-model="modelForm.systemPrompt" placeholder="System prompt…" rows="3" />
              </div>
              <div>
                <Label class="mb-1.5 block text-xs">Temperature</Label>
                <Input v-model="modelForm.temperature" type="number" placeholder="0.7" />
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
                      :checked="modelForm.knowledgeStoreIds.includes(ks.id)"
                      @update:checked="toggleModelKs(ks.id)"
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
                      :checked="modelForm.toolIds.includes(tool.value)"
                      @update:checked="toggleModelTool(tool.value)"
                    />
                    <span class="text-xs">{{ tool.title }}</span>
                  </label>
                </div>
              </div>
            </template>
          </template>
          <template v-else-if="modelForm.type === 'webhook'">
            <div>
              <Label class="mb-1.5 block text-xs">Webhook</Label>
              <Select v-model="modelForm.webhookId">
                <SelectTrigger><SelectValue placeholder="Select webhook…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="w in webhookItems" :key="w.value" :value="w.value">{{
                    w.title
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </template>
          <template v-else-if="modelForm.type === 'agent'">
            <div>
              <Label class="mb-1.5 block text-xs">Agent</Label>
              <Select v-model="modelForm.agentId">
                <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="a in agentItems" :key="a.value" :value="a.value">{{
                    a.title
                  }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </template>
          <div class="flex items-center justify-between">
            <Label>Enabled</Label>
            <Switch
              :model-value="modelForm.enabled"
              @update:model-value="modelForm.enabled = $event"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showModelDialog = false">Cancel</Button>
          <Button :disabled="!modelForm.name.trim()" @click="saveModel">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete model confirmation -->
    <Dialog :open="showDeleteModelDialog" @update:open="showDeleteModelDialog = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Model</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{{ deletingModel?.name }}</strong
          >?
        </p>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteModelDialog = false">Cancel</Button>
          <Button variant="destructive" @click="executeDeleteModel">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useSettingsInject } from '../../composables/useSettingsState'
import type { AiModel, Tool } from '../../types'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Checkbox } from '../ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Brain, Bot, Webhook, Database, Plus, Pencil, Trash2, Share2 } from 'lucide-vue-next'

const emit = defineEmits<{
  openShareDialog: [resourceType: string, resourceId: string, label: string]
}>()

const {
  modelsStore,
  agentsStore,
  toolsStore,
  knowledgeStore,
  settingsStore,
  notify,
  canManage,
  defaultModelId,
  defaultEmbeddingModelId,
  embeddingModels,
  generalModels,
  embeddingProviderKeys,
  providerKeysList,
  toggleDefaultModel,
  toggleDefaultEmbedding,
} = useSettingsInject()

const modelSubTab = ref('general')

const toolItems = computed(() =>
  toolsStore.tools.map((t: Tool) => ({ title: t.name, value: t.id })),
)
const webhookItems = computed(() =>
  settingsStore.webhooks.map((w: { id: string; name?: string }) => ({
    title: w.name,
    value: w.id,
  })),
)
const agentItems = computed(() =>
  agentsStore.agents.map((a: { id: string; name: string }) => ({ title: a.name, value: a.id })),
)

function openShareDialog(resourceType: string, resourceId: string, label: string) {
  emit('openShareDialog', resourceType, resourceId, label)
}

// ── Model form ──
const showModelDialog = ref(false)
const editingModel = ref<AiModel | null>(null)
const modelForm = reactive({
  name: '',
  type: 'model' as AiModel['type'],
  provider: null as string | null,
  providerModel: '',
  deploymentName: '',
  systemPrompt: '',
  temperature: 0.7,
  knowledgeStoreIds: [] as string[],
  toolIds: [] as string[],
  webhookId: null as string | null,
  agentId: null as string | null,
  enabled: true,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
})
const showDeleteModelDialog = ref(false)
const deletingModel = ref<AiModel | null>(null)

function toggleModelKs(ksId: string) {
  const idx = modelForm.knowledgeStoreIds.indexOf(ksId)
  if (idx >= 0) modelForm.knowledgeStoreIds.splice(idx, 1)
  else modelForm.knowledgeStoreIds.push(ksId)
}

function toggleModelTool(toolId: string) {
  const idx = modelForm.toolIds.indexOf(toolId)
  if (idx >= 0) modelForm.toolIds.splice(idx, 1)
  else modelForm.toolIds.push(toolId)
}

function openModelDialog(model: AiModel | null = null, defaultType: AiModel['type'] = 'model') {
  editingModel.value = model
  if (model) {
    Object.assign(modelForm, {
      name: model.name,
      type: model.type || 'model',
      provider: model.provider || null,
      providerModel: model.providerModel || '',
      deploymentName: (model as any).deploymentName || '',
      systemPrompt: model.systemPrompt || '',
      temperature: model.temperature ?? 0.7,
      knowledgeStoreIds: model.knowledgeStoreIds || [],
      toolIds: model.toolIds || [],
      webhookId: (model as any).webhookId || null,
      agentId: (model as any).agentId || null,
      enabled: model.enabled !== false,
      chunkSize: (model as any).chunkSize ?? 1000,
      chunkOverlap: (model as any).chunkOverlap ?? 200,
      topK: (model as any).topK ?? 5,
    })
  } else {
    const firstProvider =
      defaultType === 'embedding'
        ? embeddingProviderKeys.value.length
          ? embeddingProviderKeys.value[0]
          : null
        : providerKeysList.value.length
          ? providerKeysList.value[0]
          : null
    Object.assign(modelForm, {
      name: '',
      type: defaultType,
      provider: firstProvider,
      providerModel: '',
      deploymentName: '',
      systemPrompt: '',
      temperature: 0.7,
      knowledgeStoreIds: [],
      toolIds: [],
      webhookId: null,
      agentId: null,
      enabled: true,
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 5,
    })
  }
  showModelDialog.value = true
}

async function saveModel() {
  const payload = {
    ...modelForm,
    provider: modelForm.provider || undefined,
    deploymentName: modelForm.deploymentName || undefined,
  }
  try {
    if (editingModel.value?.id) {
      await modelsStore.updateModel(editingModel.value.id, payload)
      notify.success('Model updated!')
    } else {
      await modelsStore.createModel(payload)
      notify.success('Model created!')
    }
    showModelDialog.value = false
  } catch {
    notify.error('Failed to save model.')
  }
}

function confirmDeleteModel(model: AiModel) {
  deletingModel.value = model
  showDeleteModelDialog.value = true
}

async function executeDeleteModel() {
  if (deletingModel.value) {
    await modelsStore.deleteModel(deletingModel.value.id)
    notify.success('Model deleted.')
  }
  showDeleteModelDialog.value = false
  deletingModel.value = null
}
</script>
