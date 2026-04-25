<template>
  <div>
    <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Vector Stores</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Configure available vector store backends and set the default for new knowledge stores.
    </p>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      <Card
        v-for="vs in vectorStoreProviders"
        :key="vs.key"
        :class="{ 'opacity-50': !vectorStoreEnabled[vs.key] }"
      >
        <CardHeader class="!flex !flex-row !items-center gap-3 pb-3">
          <Tooltip :delay-duration="200">
            <TooltipTrigger as-child>
              <Checkbox
                :checked="defaultVectorStoreType === vs.key"
                :disabled="!vectorStoreEnabled[vs.key]"
                @update:checked="toggleDefaultVectorStore(vs.key)"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ defaultVectorStoreType === vs.key ? 'Default vector store' : 'Set as default' }}
            </TooltipContent>
          </Tooltip>
          <div
            :class="['flex h-9 w-9 items-center justify-center rounded-lg shrink-0', vs.bgClass]"
          >
            <component :is="vs.icon" :class="['h-5 w-5', vs.iconClass]" />
          </div>
          <div class="flex-1 min-w-0">
            <CardTitle class="text-sm">{{ vs.name }}</CardTitle>
            <p class="text-xs text-muted-foreground truncate">{{ vs.description }}</p>
          </div>
          <Badge
            v-if="defaultVectorStoreType === vs.key"
            variant="default"
            class="text-[10px] shrink-0"
          >
            Default
          </Badge>
          <Switch
            class="shrink-0"
            :model-value="vectorStoreEnabled[vs.key]"
            @update:model-value="vectorStoreEnabled[vs.key] = $event"
          />
        </CardHeader>
        <CardContent
          v-if="vectorStoreEnabled[vs.key] && (vs.hasUrl || vs.hasApiKey)"
          class="space-y-3"
        >
          <Separator />
          <div v-if="vs.hasUrl">
            <Label class="mb-1.5 block text-xs">{{ vs.urlLabel }}</Label>
            <Input v-model="vectorStoreUrls[vs.key]" :placeholder="vs.urlPlaceholder" />
          </div>
          <div v-if="vs.hasApiKey">
            <Label class="mb-1.5 block text-xs">{{ vs.keyLabel || 'API Key' }}</Label>
            <Input
              v-model="vectorStoreApiKeys[vs.key]"
              type="password"
              placeholder="Enter API key…"
            />
          </div>
        </CardContent>
      </Card>
    </div>
    <Button
      class="mt-6 shadow-lg shadow-primary/20"
      :disabled="saving"
      @click="saveVectorStoreSettings"
    >
      <Save class="h-4 w-4 mr-2" />
      {{ saving ? 'Saving…' : 'Save Settings' }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useSettingsInject } from '../../composables/useSettingsState'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Checkbox } from '../ui/checkbox'
import { Save } from 'lucide-vue-next'

const {
  vectorStoreProviders,
  vectorStoreEnabled,
  vectorStoreUrls,
  vectorStoreApiKeys,
  defaultVectorStoreType,
  saving,
  toggleDefaultVectorStore,
  saveVectorStoreSettings,
} = useSettingsInject()
</script>
