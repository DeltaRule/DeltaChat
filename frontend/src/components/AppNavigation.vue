<template>
  <v-navigation-drawer
    v-model="drawerOpen"
    :rail="rail && !mobile"
    :temporary="mobile"
    :permanent="!mobile"
    :width="220"
    elevation="1"
  >
    <!-- Expand/collapse toggle (desktop only) -->
    <template v-if="!mobile">
      <!-- Collapsed rail: logo avatar + expand button stacked -->
      <div v-if="rail" class="d-flex flex-column align-center py-2" style="min-height: 56px; gap: 2px;">
        <v-btn variant="plain" density="compact" :to="'/'" aria-label="DeltaChat Home" class="pa-0">
          <v-avatar color="primary" size="28" rounded="sm">
            <v-icon icon="mdi-delta" size="16" color="white" />
          </v-avatar>
        </v-btn>
        <v-btn
          icon="mdi-chevron-right"
          variant="text"
          size="x-small"
          aria-label="Expand sidebar"
          @click="$emit('toggle-rail')"
        />
      </div>
      <!-- Expanded: brand row + collapse button -->
      <div v-else class="d-flex align-center justify-space-between px-2" style="min-height: 48px;">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2">
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
      <v-list-item
        prepend-icon="mdi-delta"
        title="DeltaChat"
        nav
        class="py-3"
      />
      <v-divider />
    </template>

    <!-- Workspace Navigation -->
    <v-list density="compact" nav class="mt-1">
      <v-tooltip :text="'Chat'" location="right" :disabled="!rail || mobile">
        <template #activator="{ props: tipProps }">
          <v-list-item
            v-bind="tipProps"
            prepend-icon="mdi-chat"
            title="Chat"
            value="chat"
            to="/"
            rounded="lg"
            class="mb-1"
            exact
          />
        </template>
      </v-tooltip>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { useDisplay } from 'vuetify'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  rail: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'toggle-rail'])

const { mobile } = useDisplay()

const drawerOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>
