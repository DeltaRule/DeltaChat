<template>
  <div>
    <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Appearance</h2>
    <Card>
      <CardHeader>
        <CardTitle class="text-sm">Theme Color</CardTitle>
        <p class="text-xs text-muted-foreground">
          Choose your accent color. This is saved in cookies.
        </p>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-wrap gap-3">
          <button
            v-for="(preset, name) in themeStore.presets"
            :key="name"
            :class="[
              'h-10 w-10 rounded-full border-2 transition-all hover:scale-110',
              themeStore.currentPreset === name
                ? 'border-foreground ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                : 'border-transparent',
            ]"
            :style="{ background: preset.primaryHex }"
            :title="name"
            :aria-label="`Set theme color: ${name}`"
            @click="themeStore.setPreset(name)"
          />
        </div>
        <div>
          <Label class="mb-1.5 block text-xs">Custom Color</Label>
          <div class="flex items-center gap-3">
            <input
              type="color"
              :value="themeStore.colors.primaryHex"
              class="h-10 w-14 rounded-md border border-input cursor-pointer"
              @input="themeStore.setCustomColor(($event.target as HTMLInputElement)?.value)"
            />
            <Input
              :model-value="themeStore.colors.primaryHex"
              class="w-28 font-mono text-sm"
              @update:model-value="
                (v) => {
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) themeStore.setCustomColor(v)
                }
              "
            />
          </div>
        </div>
        <Separator />
        <div class="flex items-center justify-between">
          <div>
            <Label class="block text-sm">Dark Mode</Label>
            <p class="text-xs text-muted-foreground">Toggle between light and dark theme</p>
          </div>
          <Switch
            :model-value="themeStore.isDark"
            @update:model-value="themeStore.isDark = $event"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useSettingsInject } from '../../composables/useSettingsState'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'

const { themeStore } = useSettingsInject()
</script>
