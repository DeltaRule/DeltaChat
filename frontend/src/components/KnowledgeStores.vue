<template>
  <v-container fluid class="pa-3 pa-md-4">
    <v-row>
      <!-- Store list column -->
      <v-col cols="12" sm="4" md="3">
        <v-card elevation="1">
          <v-card-title class="d-flex align-center py-3">
            <span class="text-body-1 font-weight-bold">Knowledge Stores</span>
            <v-spacer />
            <v-btn icon="mdi-plus" size="small" color="primary" variant="tonal" @click="showCreate = true" />
          </v-card-title>
          <v-divider />
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
                <v-icon icon="mdi-database" size="small" class="mr-1" />
              </template>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click.stop="knowledgeStore.deleteKnowledgeStore(ks.id)"
                />
              </template>
            </v-list-item>
            <v-list-item v-if="!knowledgeStore.knowledgeStores.length">
              <v-list-item-subtitle class="text-center py-4">No knowledge stores yet</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Documents column -->
      <v-col cols="12" sm="8" md="9">
        <v-card v-if="selectedKs" elevation="1">
          <v-card-title class="d-flex align-center py-3">
            <v-icon icon="mdi-database" class="mr-2" />
            <span class="text-body-1 font-weight-bold">{{ selectedKs.name }}</span>
          </v-card-title>
          <v-card-subtitle v-if="selectedKs.description" class="pb-2 px-4">
            {{ selectedKs.description }}
          </v-card-subtitle>
          <v-divider />
          <v-card-text>
            <!-- Drop zone -->
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

            <!-- Documents list -->
            <v-list v-if="docs.length" density="compact">
              <v-list-item
                v-for="doc in docs"
                :key="doc.id"
                :title="doc.name || doc.filename"
                rounded="lg"
                class="mb-1"
              >
                <template #subtitle>
                  <v-chip :color="statusColor(doc.status)" size="x-small" class="mt-1">
                    {{ doc.status || 'ready' }}
                  </v-chip>
                </template>
                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="knowledgeStore.deleteDocument(selectedKs.id, doc.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center text-disabled py-6">
              <v-icon icon="mdi-file-outline" size="40" class="mb-2" />
              <div class="text-body-2">No documents uploaded yet</div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Empty state when no store selected -->
        <div
          v-else
          class="d-flex align-center justify-center text-disabled"
          style="min-height: 300px;"
        >
          <div class="text-center">
            <v-icon icon="mdi-database-outline" size="64" class="mb-3 text-medium-emphasis" />
            <div class="text-body-1 text-medium-emphasis">Select a knowledge store</div>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-dialog v-model="showCreate" max-width="400">
      <v-card>
        <v-card-title class="pt-4">Create Knowledge Store</v-card-title>
        <v-card-text>
          <v-text-field v-model="newName" label="Name" variant="outlined" class="mb-3" autofocus />
          <v-textarea v-model="newDesc" label="Description (optional)" variant="outlined" rows="2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreate = false">Cancel</v-btn>
          <v-tooltip :text="!newName.trim() ? 'Name is required' : 'Create knowledge store'" location="top">
            <template #activator="{ props: tipProps }">
              <span v-bind="tipProps">
                <v-btn color="primary" :disabled="!newName.trim()" @click="createKs">Create</v-btn>
              </span>
            </template>
          </v-tooltip>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeStore } from '../stores/knowledge'

const knowledgeStore = useKnowledgeStore()
const selectedKs = ref(null)
const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const isDragging = ref(false)
const docInput = ref(null)

const docs = computed(() => selectedKs.value ? (knowledgeStore.documents[selectedKs.value.id] || []) : [])

async function selectKs(ks) {
  selectedKs.value = ks
  await knowledgeStore.loadDocuments(ks.id)
}

async function createKs() {
  await knowledgeStore.createKnowledgeStore(newName.value, newDesc.value)
  showCreate.value = false
  newName.value = ''
  newDesc.value = ''
}

async function handleDrop(e) {
  isDragging.value = false
  if (!selectedKs.value) return
  for (const file of e.dataTransfer.files) {
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
  }
}

async function handleFileSelect(e) {
  if (!selectedKs.value) return
  for (const file of e.target.files) {
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
  }
}

function statusColor(status) {
  return { ready: 'success', processing: 'warning', failed: 'error' }[status] || 'info'
}

onMounted(() => knowledgeStore.loadKnowledgeStores())
</script>

<style scoped>
.drop-zone {
  border: 2px dashed rgba(var(--v-theme-primary), 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(var(--v-theme-primary), 0.02);
}
.drop-zone:hover,
.drop-zone.dragging {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  transform: scale(1.01);
}
</style>
