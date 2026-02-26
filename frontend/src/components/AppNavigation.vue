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
      <div
        class="d-flex align-center justify-space-between px-2"
        style="min-height: 48px;"
      >
        <v-btn
          v-if="!rail"
          icon="mdi-delta"
          variant="text"
          size="small"
          color="primary"
          class="mr-1"
          :to="'/'"
          aria-label="Go to home page"
        />
        <span
          v-if="!rail"
          class="text-body-2 font-weight-bold text-primary flex-grow-1"
        >DeltaChat</span>
        <v-btn
          :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
          variant="text"
          size="small"
          :aria-label="rail ? 'Expand sidebar' : 'Collapse sidebar'"
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
