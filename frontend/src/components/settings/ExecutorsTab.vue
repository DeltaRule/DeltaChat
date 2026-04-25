<template>
  <div>
    <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Executors</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Configure global function executor defaults used by executable tools.
    </p>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle class="text-sm">Python Executor</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Mode</Label>
            <Select v-model="pythonExecutorMode">
              <SelectTrigger><SelectValue placeholder="Select mode…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">sandbox</SelectItem>
                <SelectItem value="spawn">spawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Python Path</Label>
            <Input v-model="pythonExecutorPath" placeholder="python" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Default Timeout (ms)</Label>
            <Input v-model.number="pythonExecutorTimeout" type="number" placeholder="30000" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Max Output Bytes</Label>
            <Input
              v-model.number="pythonExecutorMaxOutputBytes"
              type="number"
              placeholder="1048576"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm">TypeScript Executor</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Mode</Label>
            <Select v-model="typescriptExecutorMode">
              <SelectTrigger><SelectValue placeholder="Select mode…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">sandbox</SelectItem>
                <SelectItem value="spawn">spawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Node Path</Label>
            <Input v-model="typescriptExecutorPath" placeholder="node" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Default Timeout (ms)</Label>
            <Input v-model.number="typescriptExecutorTimeout" type="number" placeholder="30000" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Max Output Bytes</Label>
            <Input
              v-model.number="typescriptExecutorMaxOutputBytes"
              type="number"
              placeholder="1048576"
            />
          </div>
        </CardContent>
      </Card>
    </div>
    <div class="mt-4">
      <Button class="w-full md:w-auto" :disabled="saving" @click="saveExecutorSettings">
        <Save class="h-4 w-4 mr-2" />Save Executor Settings
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsInject } from '../../composables/useSettingsState'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Input } from '../ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Label } from '../ui/label'
import { Save } from 'lucide-vue-next'

const {
  pythonExecutorMode,
  pythonExecutorPath,
  pythonExecutorTimeout,
  pythonExecutorMaxOutputBytes,
  typescriptExecutorMode,
  typescriptExecutorPath,
  typescriptExecutorTimeout,
  typescriptExecutorMaxOutputBytes,
  saving,
  saveExecutorSettings,
} = useSettingsInject()
</script>
