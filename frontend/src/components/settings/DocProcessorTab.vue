<template>
  <div>
    <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Document Processors</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Configure available document processors and set the default for new knowledge stores.
    </p>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      <Card
        v-for="dp in docProcessorProviders"
        :key="dp.key"
        :class="{ 'opacity-50': !docProcessorEnabled[dp.key] }"
      >
        <CardHeader class="!flex !flex-row !items-center gap-3 pb-3">
          <Tooltip :delay-duration="200">
            <TooltipTrigger as-child>
              <Checkbox
                :checked="defaultDocProcessorType === dp.key"
                :disabled="!docProcessorEnabled[dp.key]"
                @update:checked="toggleDefaultDocProcessor(dp.key)"
              />
            </TooltipTrigger>
            <TooltipContent>
              {{ defaultDocProcessorType === dp.key ? 'Default processor' : 'Set as default' }}
            </TooltipContent>
          </Tooltip>
          <div
            :class="['flex h-9 w-9 items-center justify-center rounded-lg shrink-0', dp.bgClass]"
          >
            <component :is="dp.icon" :class="['h-5 w-5', dp.iconClass]" />
          </div>
          <div class="flex-1 min-w-0">
            <CardTitle class="text-sm">{{ dp.name }}</CardTitle>
            <p class="text-xs text-muted-foreground truncate">{{ dp.description }}</p>
          </div>
          <Badge
            v-if="defaultDocProcessorType === dp.key"
            variant="default"
            class="text-[10px] shrink-0"
          >
            Default
          </Badge>
          <Switch
            class="shrink-0"
            :model-value="docProcessorEnabled[dp.key]"
            @update:model-value="docProcessorEnabled[dp.key] = $event"
          />
        </CardHeader>
        <CardContent v-if="docProcessorEnabled[dp.key] && dp.hasUrl" class="space-y-3">
          <Separator />
          <div>
            <Label class="mb-1.5 block text-xs">{{ dp.urlLabel }}</Label>
            <Input v-model="docProcessorUrls[dp.key]" :placeholder="dp.urlPlaceholder" />
          </div>
        </CardContent>
      </Card>
    </div>
    <Button
      class="mt-6 shadow-lg shadow-primary/20"
      :disabled="saving"
      @click="saveDocProcessorSettings"
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
  docProcessorProviders,
  docProcessorEnabled,
  docProcessorUrls,
  defaultDocProcessorType,
  saving,
  toggleDefaultDocProcessor,
  saveDocProcessorSettings,
} = useSettingsInject()
</script>
