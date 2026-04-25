<template>
  <div>
    <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Model Providers</h2>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      <Card
        v-for="provider in providers"
        :key="provider.key"
        :class="{ 'opacity-50': !providerEnabled[provider.key] }"
      >
        <CardHeader class="!flex !flex-row !items-center gap-3 pb-3">
          <div
            :class="[
              'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
              provider.bgClass,
            ]"
          >
            <component :is="provider.icon" :class="['h-5 w-5', provider.iconClass]" />
          </div>
          <div class="flex-1 min-w-0">
            <CardTitle class="text-sm">{{ provider.name }}</CardTitle>
            <p class="text-xs text-muted-foreground truncate">{{ provider.description }}</p>
          </div>
          <Switch
            class="shrink-0"
            :model-value="providerEnabled[provider.key]"
            @update:model-value="providerEnabled[provider.key] = $event"
          />
        </CardHeader>
        <CardContent v-if="providerEnabled[provider.key]" class="space-y-3">
          <Separator />
          <div>
            <Label class="mb-1.5 block text-xs">{{ provider.keyLabel || 'API Key' }}</Label>
            <Input
              v-model="providerKeys[provider.key]"
              :type="showKey[provider.key] ? 'text' : 'password'"
              :placeholder="provider.keyLabel || 'API Key'"
              autocomplete="new-password"
            />
          </div>
          <div v-if="provider.hasUrl">
            <Label class="mb-1.5 block text-xs">{{ provider.urlLabel || 'Base URL' }}</Label>
            <Input
              v-model="providerUrls[provider.key]"
              :placeholder="provider.urlLabel || 'Base URL'"
            />
          </div>
          <div v-if="provider.key === 'azure'">
            <Label class="mb-1.5 block text-xs">API Version</Label>
            <Input v-model="providerApiVersions.azure" placeholder="e.g. 2024-04-01-preview" />
            <p class="mt-1 text-[11px] text-muted-foreground">
              Azure model execution uses deployment name from the model/agent form.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
    <Button
      class="mt-6 shadow-lg shadow-primary/20"
      :disabled="saving"
      @click="saveProviderSettings"
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
import { Separator } from '../ui/separator'
import { Save } from 'lucide-vue-next'

const {
  providers,
  providerEnabled,
  providerKeys,
  providerUrls,
  providerApiVersions,
  showKey,
  saving,
  saveProviderSettings,
} = useSettingsInject()
</script>
