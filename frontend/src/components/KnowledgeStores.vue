<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-border">
      <div>
        <h1 class="text-xl font-bold">Knowledge Stores</h1>
        <p class="text-sm text-muted-foreground">Manage your document knowledge bases</p>
      </div>
      <Button @click="showCreateDialog = true"> <Plus class="h-4 w-4 mr-2" />New Store </Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-6">
      <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 max-w-5xl">
        <!-- Store list -->
        <div>
          <div
            v-if="!knowledgeStore.knowledgeStores.length"
            class="flex flex-col items-center py-14 border border-dashed border-border rounded-lg text-center"
          >
            <Database class="h-14 w-14 text-muted-foreground/25 mb-4" />
            <h3 class="text-base font-semibold mb-2">No knowledge stores</h3>
            <p class="text-sm text-muted-foreground mb-4 max-w-[240px]">
              Create a store to start uploading documents.
            </p>
            <Button size="sm" @click="showCreateDialog = true">
              <Plus class="h-4 w-4 mr-2" />New Store
            </Button>
          </div>

          <Card v-else>
            <div class="divide-y divide-border">
              <div
                v-for="ks in knowledgeStore.knowledgeStores"
                :key="ks.id"
                :class="[
                  'flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors',
                  selected?.id === ks.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                ]"
                @click="selectStore(ks)"
              >
                <Database class="h-4 w-4 shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ ks.name }}
                  </div>
                  <div class="text-xs text-muted-foreground">{{ ks.documentCount || 0 }} docs</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="text-destructive opacity-0 group-hover:opacity-100"
                  @click.stop="deleteStore(ks)"
                >
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <!-- Document panel -->
        <div>
          <Card v-if="selected" class="h-full">
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">
                    {{ selected.name }}
                  </CardTitle>
                  <p v-if="selected.description" class="text-xs text-muted-foreground mt-1">
                    {{ selected.description }}
                  </p>
                </div>
                <Badge variant="secondary"> {{ docs.length }} documents </Badge>
              </div>
            </CardHeader>
            <CardContent class="space-y-4">
              <!-- Upload zone -->
              <div
                :class="[
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  dragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50',
                ]"
                @dragover.prevent="dragging = true"
                @dragleave="dragging = false"
                @drop.prevent="onDrop"
                @click="fileInput?.click()"
              >
                <Upload class="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p class="text-sm font-medium">Drop files here or click to upload</p>
                <p class="text-xs text-muted-foreground mt-1">PDF, TXT, MD, DOCX supported</p>
              </div>
              <input ref="fileInput" type="file" multiple class="hidden" @change="onFileSelect" />

              <!-- Document list -->
              <div v-if="docs.length" class="divide-y divide-border rounded-md border">
                <div v-for="doc in docs" :key="doc.id" class="flex items-center gap-3 px-3 py-2.5">
                  <FileText class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span class="text-sm flex-1 truncate">{{ doc.name || doc.filename }}</span>
                  <Badge :variant="statusBadge(doc.status || 'ready')">
                    {{ doc.status || 'ready' }}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-destructive"
                    @click="knowledgeStore.deleteDocument(selected!.id, doc.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div v-else class="flex flex-col items-center py-10 text-center">
                <FileText class="h-12 w-12 text-muted-foreground/20 mb-3" />
                <p class="text-sm text-muted-foreground">No documents yet. Upload files above.</p>
              </div>
            </CardContent>
          </Card>

          <div
            v-else
            class="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg min-h-[300px]"
          >
            <Database class="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p class="text-sm text-muted-foreground">
              {{
                knowledgeStore.knowledgeStores.length
                  ? 'Select a store to manage documents'
                  : 'Create a knowledge store to get started'
              }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Create dialog -->
    <Dialog :open="showCreateDialog" @update:open="showCreateDialog = $event">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Knowledge Store</DialogTitle>
          <DialogDescription>Add a new knowledge base for your documents.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Name</Label>
            <Input v-model="newName" placeholder="Store name" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Description (optional)</Label>
            <Textarea v-model="newDesc" placeholder="Description…" rows="2" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showCreateDialog = false"> Cancel </Button>
          <Button :disabled="!newName.trim()" @click="createStore"> Create </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeStore } from '../stores/knowledge'
import { useNotificationStore } from '../stores/notification'
import type { KnowledgeStore as KnowledgeStoreType } from '../types'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'
import { Database, Plus, Trash2, Upload, FileText } from 'lucide-vue-next'

const knowledgeStore = useKnowledgeStore()
const notify = useNotificationStore()

const selected = ref<KnowledgeStoreType | null>(null)
const dragging = ref(false)
const showCreateDialog = ref(false)
const newName = ref('')
const newDesc = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const docs = computed(() =>
  selected.value ? knowledgeStore.documents[selected.value.id] || [] : [],
)

function statusBadge(status: string) {
  return (
    ({ ready: 'success', processing: 'warning', failed: 'destructive' } as Record<string, string>)[
      status
    ] || 'outline'
  )
}

async function selectStore(ks: KnowledgeStoreType) {
  selected.value = ks
  await knowledgeStore.loadDocuments(ks.id)
}

async function deleteStore(ks: KnowledgeStoreType) {
  try {
    await knowledgeStore.deleteKnowledgeStore(ks.id)
    if (selected.value?.id === ks.id) selected.value = null
    notify.success('Store deleted')
  } catch {
    /* notification already shown by store */
  }
}

async function createStore() {
  try {
    await knowledgeStore.createKnowledgeStore(newName.value, newDesc.value)
    showCreateDialog.value = false
    newName.value = ''
    newDesc.value = ''
    notify.success('Knowledge store created')
  } catch {
    /* notification already shown by store */
  }
}

async function onDrop(e: DragEvent) {
  dragging.value = false
  if (!selected.value || !e.dataTransfer) return
  let uploaded = 0
  for (const file of Array.from(e.dataTransfer.files)) {
    try {
      await knowledgeStore.uploadDocument(selected.value.id, file)
      uploaded++
    } catch {
      /* notification already shown by store */
    }
  }
  if (uploaded > 0) notify.success(`${uploaded} file(s) uploaded`)
}

async function onFileSelect(e: Event) {
  if (!selected.value) return
  const target = e.target as HTMLInputElement
  if (!target.files) return
  let uploaded = 0
  for (const file of Array.from(target.files)) {
    try {
      await knowledgeStore.uploadDocument(selected.value.id, file)
      uploaded++
    } catch {
      /* notification already shown by store */
    }
  }
  if (uploaded > 0) notify.success(`${uploaded} file(s) uploaded`)
}

onMounted(() => {
  knowledgeStore.loadKnowledgeStores()
})
</script>
