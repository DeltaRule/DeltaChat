<template>
  <div>
    <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
      <h2 class="text-xl font-bold">Knowledge Stores</h2>
      <Button size="sm" @click="showCreateKs = true">
        <Plus class="h-4 w-4 mr-2" />New Store
      </Button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 w-full">
      <!-- Left: KS list -->
      <div>
        <div
          v-if="!knowledgeStore.knowledgeStores.length"
          class="flex flex-col items-center py-10 border border-dashed border-border rounded-lg text-center"
        >
          <Database class="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p class="text-sm text-muted-foreground mb-3">No knowledge stores yet</p>
          <Button size="sm" @click="showCreateKs = true"
            ><Plus class="h-4 w-4 mr-2" />New Store</Button
          >
        </div>
        <Card v-else>
          <div class="divide-y divide-border">
            <div
              v-for="ks in knowledgeStore.knowledgeStores"
              :key="ks.id"
              :class="[
                'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                selectedKs?.id === ks.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
              ]"
              @click="selectKs(ks)"
            >
              <Database class="h-4 w-4 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ ks.name }}</div>
                <div class="text-xs text-muted-foreground">
                  {{ ks.documentCount || 0 }} documents
                </div>
              </div>
              <Badge v-if="ks._sharedWithMe" variant="outline" class="text-[10px]">Shared</Badge>
              <Button
                v-if="canManage(ks)"
                variant="ghost"
                size="icon-xs"
                @click.stop="emit('openShareDialog', 'knowledge_store', ks.id, ks.name)"
              >
                <Share2 class="h-3 w-3" />
              </Button>
              <Button
                v-if="canManage(ks)"
                variant="ghost"
                size="icon-xs"
                class="text-destructive"
                @click.stop="knowledgeStore.deleteKnowledgeStore(ks.id)"
              >
                <Trash2 class="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right: documents panel -->
      <div>
        <Card v-if="selectedKs">
          <CardHeader>
            <CardTitle class="text-sm">{{ selectedKs.name }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div
              v-if="canManage(selectedKs)"
              class="border-2 border-dashed border-primary/25 rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
              :class="{ 'border-primary bg-primary/5': isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleDrop"
              @click="docInput?.click()"
            >
              <Upload class="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <div class="text-sm">Drop files here or click to upload</div>
              <div class="text-xs text-muted-foreground mt-1">PDF, TXT, MD, DOCX supported</div>
            </div>
            <input ref="docInput" type="file" multiple class="hidden" @change="handleFileSelect" />
            <div v-if="ksDocs.length" class="divide-y divide-border rounded-md border">
              <div v-for="doc in ksDocs" :key="doc.id" class="flex items-center gap-2 px-3 py-2">
                <FileText class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm flex-1 truncate">{{ doc.name || doc.filename }}</span>
                <Badge :variant="statusVariant(doc.status || 'ready')">{{
                  doc.status || 'ready'
                }}</Badge>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  @click="
                    knowledgeStore.downloadDocument(
                      selectedKs!.id,
                      doc.id,
                      doc.name || doc.filename || '',
                    )
                  "
                >
                  <Download class="h-3 w-3" />
                </Button>
                <Button
                  v-if="canManage(selectedKs)"
                  variant="ghost"
                  size="icon-xs"
                  class="text-destructive"
                  @click="knowledgeStore.deleteDocument(selectedKs!.id, doc.id)"
                >
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div v-else class="text-center text-muted-foreground py-6">
              <FileText class="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p class="text-sm">No documents uploaded yet</p>
            </div>
          </CardContent>
        </Card>
        <div
          v-else
          class="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg min-h-[240px]"
        >
          <ArrowLeft class="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p class="text-sm text-muted-foreground">{{ ksRightPanelHint }}</p>
        </div>
      </div>
    </div>

    <!-- Create KS dialog -->
    <Dialog :open="showCreateKs" @update:open="showCreateKs = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Knowledge Store</DialogTitle>
          <DialogDescription>Add a new knowledge store for your documents.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Name</Label>
            <Input v-model="newKsName" placeholder="Store name" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Description (optional)</Label>
            <Textarea v-model="newKsDesc" placeholder="Description…" rows="2" />
          </div>
          <Separator />
          <p class="text-xs text-muted-foreground">
            Pipeline configuration (pre-filled from defaults)
          </p>
          <div>
            <Label class="mb-1.5 block text-xs">Embedding Model</Label>
            <Select v-model="newKsEmbeddingModelId">
              <SelectTrigger><SelectValue placeholder="Select embedding model…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use default</SelectItem>
                <SelectItem v-for="m in embeddingModels" :key="m.id" :value="m.id">{{
                  m.name
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Vector Store</Label>
            <Select v-model="newKsVectorStoreType">
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local (built-in)</SelectItem>
                <SelectItem value="chroma">Chroma</SelectItem>
              </SelectContent>
            </Select>
            <div v-if="newKsVectorStoreType === 'chroma'" class="mt-2">
              <Label class="mb-1.5 block text-xs">Chroma URL</Label>
              <Input v-model="newKsVectorStoreUrl" placeholder="http://localhost:8000" />
            </div>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Document Processor</Label>
            <Select v-model="newKsDocProcessorType">
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="langchain">LangChain (local)</SelectItem>
                <SelectItem value="tika">Apache Tika</SelectItem>
                <SelectItem value="docling">Docling</SelectItem>
              </SelectContent>
            </Select>
            <div v-if="newKsDocProcessorType === 'tika'" class="mt-2">
              <Label class="mb-1.5 block text-xs">Tika URL</Label>
              <Input v-model="newKsDocProcessorUrl" placeholder="http://localhost:9998" />
            </div>
            <div v-if="newKsDocProcessorType === 'docling'" class="mt-2">
              <Label class="mb-1.5 block text-xs">Docling URL</Label>
              <Input v-model="newKsDocProcessorUrl" placeholder="http://localhost:5001" />
            </div>
          </div>
          <Separator />
          <p class="text-xs text-muted-foreground">Chunking configuration</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label class="mb-1.5 block text-xs">Chunk Size</Label>
              <Input v-model.number="newKsChunkSize" type="number" placeholder="1000" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Chunk Overlap</Label>
              <Input v-model.number="newKsChunkOverlap" type="number" placeholder="100" />
            </div>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Chunk Unit</Label>
            <Select v-model="newKsChunkUnit">
              <SelectTrigger><SelectValue placeholder="Select unit…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="characters">Characters</SelectItem>
                <SelectItem value="tokens">Tokens (approximate)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateKs = false">Cancel</Button>
          <Button :disabled="!newKsName.trim()" @click="createKs">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsInject } from '../../composables/useSettingsState'
import type { KnowledgeStore as KnowledgeStoreType } from '../../types'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import {
  Database,
  Plus,
  Trash2,
  Upload,
  Download,
  FileText,
  ArrowLeft,
  Share2,
} from 'lucide-vue-next'

const emit = defineEmits<{
  openShareDialog: [resourceType: string, resourceId: string, label: string]
}>()

const {
  knowledgeStore,
  canManage,
  embeddingModels,
  defaultVectorStoreType,
  vectorStoreUrls,
  defaultDocProcessorType,
  docProcessorUrls,
  defaultEmbeddingModelId,
  newKsEmbeddingModelId,
  newKsVectorStoreType,
  newKsVectorStoreUrl,
  newKsDocProcessorType,
  newKsDocProcessorUrl,
  newKsChunkSize,
  newKsChunkOverlap,
  newKsChunkUnit,
} = useSettingsInject()

const selectedKs = ref<KnowledgeStoreType | null>(null)
const showCreateKs = ref(false)
const newKsName = ref('')
const newKsDesc = ref('')
const isDragging = ref(false)
const docInput = ref<HTMLInputElement | null>(null)

const ksDocs = computed(() =>
  selectedKs.value ? knowledgeStore.documents[selectedKs.value.id] || [] : [],
)
const ksRightPanelHint = computed(() =>
  knowledgeStore.knowledgeStores.length
    ? 'Select a store to manage its documents'
    : 'Create a knowledge store first',
)

async function selectKs(ks: KnowledgeStoreType) {
  selectedKs.value = ks
  await knowledgeStore.loadDocuments(ks.id)
}

async function createKs() {
  const vectorStoreConfig: Record<string, string> = { type: newKsVectorStoreType.value }
  if (newKsVectorStoreType.value === 'chroma' && newKsVectorStoreUrl.value)
    vectorStoreConfig.url = newKsVectorStoreUrl.value
  const documentProcessorConfig: Record<string, string> = { type: newKsDocProcessorType.value }
  if (
    (newKsDocProcessorType.value === 'tika' || newKsDocProcessorType.value === 'docling') &&
    newKsDocProcessorUrl.value
  )
    documentProcessorConfig.url = newKsDocProcessorUrl.value

  await knowledgeStore.createKnowledgeStore(newKsName.value, newKsDesc.value, {
    embeddingModelId:
      newKsEmbeddingModelId.value === '__default__' ? null : newKsEmbeddingModelId.value,
    vectorStoreConfig,
    documentProcessorConfig,
    chunkSize: newKsChunkSize.value || 1000,
    chunkOverlap: newKsChunkOverlap.value || 100,
    chunkUnit: newKsChunkUnit.value || 'characters',
  })
  showCreateKs.value = false
  newKsName.value = ''
  newKsDesc.value = ''
  // Reset to defaults
  newKsEmbeddingModelId.value = defaultEmbeddingModelId.value || '__default__'
  newKsVectorStoreType.value = defaultVectorStoreType.value || 'local'
  newKsVectorStoreUrl.value = vectorStoreUrls[defaultVectorStoreType.value || ''] || ''
  newKsDocProcessorType.value = defaultDocProcessorType.value || 'langchain'
  newKsDocProcessorUrl.value = docProcessorUrls[defaultDocProcessorType.value || ''] || ''
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  if (!selectedKs.value || !e.dataTransfer) return
  for (const file of Array.from(e.dataTransfer.files))
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}

async function handleFileSelect(e: Event) {
  if (!selectedKs.value) return
  const target = e.target as HTMLInputElement
  if (!target.files) return
  for (const file of Array.from(target.files))
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}

function statusVariant(status: string) {
  return (
    (
      {
        ready: 'success',
        indexed: 'success',
        processing: 'warning',
        failed: 'destructive',
        error: 'destructive',
      } as Record<string, string>
    )[status] || 'outline'
  )
}
</script>
