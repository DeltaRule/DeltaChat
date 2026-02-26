<template>
  <v-navigation-drawer
    v-model="drawerOpen"
    :rail="rail && !mobile"
    :temporary="mobile"
    :permanent="!mobile"
    :width="220"
    elevation="1"
  >
    <!-- Desktop header -->
    <template v-if="!mobile">
      <!-- Collapsed: logo only — click it to expand -->
      <div v-if="rail" class="d-flex justify-center align-center py-3">
        <v-avatar
          color="primary"
          size="28"
          rounded="sm"
          style="cursor:pointer"
          aria-label="Expand sidebar"
          @click="$emit('toggle-rail')"
        >
          <v-icon icon="mdi-delta" size="16" color="white" />
        </v-avatar>
      </div>
      <!-- Expanded: logo + text + collapse chevron -->
      <div v-else class="d-flex align-center px-3" style="min-height: 48px;">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="15" color="white" />
        </v-avatar>
        <span class="text-body-2 font-weight-bold flex-grow-1">DeltaChat</span>
        <v-btn
          icon="mdi-chevron-left"
          variant="text"
          size="small"
          aria-label="Collapse sidebar"
          @click="$emit('toggle-rail')"
        />
      </div>
      <v-divider />
    </template>

    <!-- Mobile header -->
    <template v-else>
      <div class="d-flex align-center px-3 py-3">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="15" color="white" />
        </v-avatar>
        <span class="text-body-2 font-weight-bold">DeltaChat</span>
      </div>
      <v-divider />
    </template>

    <!-- Navigation: + New Chat -->
    <v-list density="compact" nav class="mt-1">
      <v-tooltip text="New Chat" location="right" :disabled="!rail || mobile">
        <template #activator="{ props: tipProps }">
          <v-list-item
            v-bind="tipProps"
            prepend-icon="mdi-plus"
            title="New Chat"
            value="new-chat"
            rounded="lg"
            class="mb-1"
            @click="goToNewChat"
          />
        </template>
      </v-tooltip>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  rail: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'toggle-rail'])

const { mobile } = useDisplay()
const router = useRouter()
const chatStore = useChatStore()

const drawerOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

function goToNewChat() {
  chatStore.currentChatId = null
  router.push('/')
}
</script>
