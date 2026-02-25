<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="d-flex align-center">
            Knowledge Stores
            <v-spacer />
            <v-btn icon="mdi-plus" size="small" color="primary" @click="showCreate = true" />
          </v-card-title>
          <v-list>
            <v-list-item
              v-for="ks in knowledgeStore.knowledgeStores"
              :key="ks.id"
              :title="ks.name"
              :subtitle="`${ks.documentCount || 0} documents`"
              :active="selectedKs?.id === ks.id"
              rounded="lg"
              @click="selectKs(ks)"
            >
              <template #append>
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="knowledgeStore.deleteKnowledgeStore(ks.id)" />
              </template>
            </v-list-item>
            <v-list-item v-if="!knowledgeStore.knowledgeStores.length" subtitle="No knowledge stores yet" />
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="8" v-if="selectedKs">
        <v-card class="mb-4">
          <v-card-title>{{ selectedKs.name }}</v-card-title>
          <v-card-subtitle v-if="selectedKs.description">{{ selectedKs.description }}</v-card-subtitle>
          <v-card-text>
            <!-- Drop zone -->
            <div
              class="drop-zone pa-8 text-center mb-4"
              :class="{ dragging: isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleDrop"
              @click="$refs.docInput.click()"
            >
              <v-icon icon="mdi-cloud-upload" size="48" class="mb-2" />
              <div>Drop files here or click to upload</div>
              <div class="text-caption text-disabled">PDF, TXT, MD, DOCX supported</div>
            </div>
            <input ref="docInput" type="file" multiple style="display:none" @change="handleFileSelect" />

            <!-- Documents list -->
            <v-list v-if="docs.length">
              <v-list-item v-for="doc in docs" :key="doc.id" :title="doc.name || doc.filename">
                <template #subtitle>
                  <v-chip :color="statusColor(doc.status)" size="x-small">{{ doc.status || 'ready' }}</v-chip>
                </template>
                <template #append>
                  <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click="knowledgeStore.deleteDocument(selectedKs.id, doc.id)" />
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center text-disabled py-4">No documents uploaded</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="showCreate" max-width="400">
      <v-card>
        <v-card-title>Create Knowledge Store</v-card-title>
        <v-card-text>
          <v-text-field v-model="newName" label="Name" variant="outlined" class="mb-2" />
          <v-textarea v-model="newDesc" label="Description" variant="outlined" rows="2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showCreate = false">Cancel</v-btn>
          <v-btn color="primary" @click="createKs">Create</v-btn>
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
  border: 2px dashed rgba(var(--v-theme-primary), 0.5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover, .drop-zone.dragging {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.05);
}
</style>
