<template>
  <div>
    <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
      <h2 class="text-xl font-bold">Tools</h2>
      <Button size="sm" @click="openToolDialog()"> <Plus class="h-4 w-4 mr-2" />New Tool </Button>
    </div>
    <p class="text-sm text-muted-foreground mb-4">
      Connect tools via MCP, or configure Python and TypeScript function tools.
    </p>

    <div v-if="!toolsStore.tools.length" class="flex flex-col items-center py-14 text-center">
      <Wrench class="h-16 w-16 text-muted-foreground/25 mb-4" />
      <h3 class="text-lg font-semibold mb-2">No tools yet</h3>
      <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
        Add MCP, Python, or TypeScript tools.
      </p>
      <Button @click="openToolDialog()"><Plus class="h-4 w-4 mr-2" />New Tool</Button>
    </div>

    <Card v-else>
      <div class="divide-y divide-border">
        <div
          v-for="tool in toolsStore.tools"
          :key="tool.id"
          class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
        >
          <component
            :is="toolIconMap[tool.type] || Wrench"
            class="h-4 w-4 text-muted-foreground shrink-0"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">{{ tool.name }}</div>
            <div class="text-xs text-muted-foreground flex items-center gap-1">
              <Badge variant="outline" class="text-[10px] px-1.5 py-0">{{ tool.type }}</Badge>
              {{ tool.description || '' }}
            </div>
          </div>
          <Badge :variant="tool.enabled !== false ? 'success' : 'outline'">
            {{ tool.enabled !== false ? 'Active' : 'Disabled' }}
          </Badge>
          <Badge v-if="tool._sharedWithMe" variant="outline" class="text-[10px]">Shared</Badge>
          <Button
            v-if="canManage(tool)"
            variant="ghost"
            size="icon-xs"
            @click.stop="emit('openShareDialog', 'tool', tool.id, tool.name)"
          >
            <Share2 class="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" @click.stop="openToolDialog(tool)">
            <Pencil class="h-3 w-3" />
          </Button>
          <Button
            v-if="canManage(tool)"
            variant="ghost"
            size="icon-xs"
            class="text-destructive"
            @click.stop="toolsStore.deleteTool(tool.id)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>

    <!-- Tool dialog -->
    <Dialog :open="showToolDialog" @update:open="showToolDialog = $event">
      <DialogContent class="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{{ editingTool?.id ? 'Edit Tool' : 'Add Tool' }}</DialogTitle>
          <DialogDescription>Configure tool settings.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs">Name</Label>
            <Input v-model="toolForm.name" placeholder="Tool name" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Description</Label>
            <Textarea v-model="toolForm.description" placeholder="Description" rows="2" />
          </div>
          <div>
            <Label class="mb-1.5 block text-xs">Type</Label>
            <Select v-model="toolForm.type">
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcp">MCP</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="typescript">TypeScript</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-if="toolForm.type === 'mcp'">
            <div>
              <Label class="mb-1.5 block text-xs">MCP Server</Label>
              <Select v-model="toolForm.config.connectionId">
                <SelectTrigger><SelectValue placeholder="Select MCP server…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="conn in mcpStore.connections" :key="conn.id" :value="conn.id">
                    {{ conn.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Tool Name</Label>
              <Input v-model="toolForm.config.toolName" placeholder="Tool name" />
            </div>
          </template>
          <template v-else>
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <Label class="text-xs">
                  {{
                    toolForm.type === 'python'
                      ? 'Function Code (Python)'
                      : 'Function Code (JavaScript — Node.js runtime)'
                  }}
                </Label>
                <button
                  type="button"
                  class="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  @click="insertExampleCode"
                >
                  Insert example
                </button>
              </div>
              <p v-if="toolForm.type === 'typescript'" class="text-xs text-muted-foreground mb-1.5">
                Runs as plain JavaScript via Node.js. TypeScript syntax (type annotations,
                interfaces) is not supported.
              </p>
              <MonacoEditor
                v-model="toolForm.config.code"
                :language="toolForm.type === 'python' ? 'python' : 'javascript'"
                height="220px"
              />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Arguments JSON Schema (draft-07)</Label>
              <MonacoEditor
                v-model="toolForm.config.argsSchemaText"
                language="json"
                height="220px"
              />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Test Args JSON</Label>
              <MonacoEditor
                v-model="toolForm.config.sampleArgsJson"
                language="json"
                height="180px"
              />
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" :disabled="toolTestRunning" @click="runToolTest">
                {{ toolTestRunning ? 'Running…' : 'Run Test' }}
              </Button>
              <span v-if="toolTestError" class="text-xs text-destructive">{{ toolTestError }}</span>
            </div>
            <div v-if="toolTestResult" class="rounded-md border bg-muted/30 p-2">
              <Label class="mb-1.5 block text-xs">Test Result</Label>
              <pre class="text-xs whitespace-pre-wrap break-words">{{ toolTestResult }}</pre>
            </div>
          </template>
          <div class="flex items-center justify-between">
            <Label>Enabled</Label>
            <Switch
              :model-value="toolForm.enabled"
              @update:model-value="toolForm.enabled = $event"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showToolDialog = false">Cancel</Button>
          <Button :disabled="!toolForm.name.trim()" @click="saveTool">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useSettingsInject } from '../../composables/useSettingsState'
import type { Tool } from '../../types'
import { getErrorMessage } from '../../types'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import MonacoEditor from '../ui/monaco/MonacoEditor.vue'
import { Wrench, Plus, Pencil, Trash2, Share2, Link, Code } from 'lucide-vue-next'

const emit = defineEmits<{
  openShareDialog: [resourceType: string, resourceId: string, label: string]
}>()

const { toolsStore, mcpStore, canManage, notify } = useSettingsInject()

const toolIconMap: Record<string, typeof Link> = {
  mcp: Link,
  python: Code,
  typescript: Code,
}

// ── Default code templates ──────────────────────────────────────────────────
const PYTHON_EXAMPLE_CODE = `numbers = args.get('numbers', [])
return sum(numbers)`

const TS_EXAMPLE_CODE = `const numbers = args.numbers ?? [];
return numbers.reduce((a, b) => a + b, 0);`

const DEFAULT_NUMBERS_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "numbers": {
      "type": "array",
      "items": { "type": "number" },
      "description": "Array of numbers to sum"
    }
  },
  "required": ["numbers"]
}`

const DEFAULT_SAMPLE_ARGS = `{
  "numbers": [1, 2, 3, 4, 5]
}`

// ── State ───────────────────────────────────────────────────────────────────
const showToolDialog = ref(false)
const editingTool = ref<Tool | null>(null)
const toolTestRunning = ref(false)
const toolTestResult = ref('')
const toolTestError = ref('')

const toolForm = reactive({
  name: '',
  description: '',
  type: 'python',
  config: {
    connectionId: '',
    toolName: '',
    code: PYTHON_EXAMPLE_CODE,
    argsSchemaText: DEFAULT_NUMBERS_SCHEMA,
    sampleArgsJson: DEFAULT_SAMPLE_ARGS,
  },
  enabled: true,
})

// Auto-fill code template when type changes (new tools only)
watch(
  () => toolForm.type,
  (newType) => {
    if (editingTool.value !== null) return
    if (newType === 'python') {
      toolForm.config.code = PYTHON_EXAMPLE_CODE
      toolForm.config.argsSchemaText = DEFAULT_NUMBERS_SCHEMA
      toolForm.config.sampleArgsJson = DEFAULT_SAMPLE_ARGS
    } else if (newType === 'typescript') {
      toolForm.config.code = TS_EXAMPLE_CODE
      toolForm.config.argsSchemaText = DEFAULT_NUMBERS_SCHEMA
      toolForm.config.sampleArgsJson = DEFAULT_SAMPLE_ARGS
    } else {
      toolForm.config.code = ''
      toolForm.config.argsSchemaText = DEFAULT_NUMBERS_SCHEMA
      toolForm.config.sampleArgsJson = DEFAULT_SAMPLE_ARGS
    }
  },
)

function openToolDialog(tool: Tool | null = null) {
  editingTool.value = tool
  toolTestResult.value = ''
  toolTestError.value = ''
  if (tool)
    Object.assign(toolForm, {
      name: tool.name,
      description: tool.description || '',
      type: tool.type,
      config: {
        connectionId: (tool.config as any)?.connectionId || '',
        toolName: (tool.config as any)?.toolName || '',
        code: (tool.config as any)?.code || '',
        argsSchemaText: JSON.stringify((tool.config as any)?.args_schema || {}, null, 2),
        sampleArgsJson: JSON.stringify((tool.config as any)?.sampleArgs || {}, null, 2),
      },
      enabled: tool.enabled !== false,
    })
  else
    Object.assign(toolForm, {
      name: '',
      description: '',
      type: 'python',
      config: {
        connectionId: '',
        toolName: '',
        code: PYTHON_EXAMPLE_CODE,
        argsSchemaText: DEFAULT_NUMBERS_SCHEMA,
        sampleArgsJson: DEFAULT_SAMPLE_ARGS,
      },
      enabled: true,
    })
  showToolDialog.value = true
}

function parseJsonObject(text: string, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!text.trim()) return fallback
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : fallback
  } catch {
    return fallback
  }
}

async function saveTool() {
  const parsedArgsSchema = parseJsonObject(toolForm.config.argsSchemaText || '{}', {})
  const parsedSampleArgs = parseJsonObject(toolForm.config.sampleArgsJson || '{}', {})
  const configPayload: Record<string, unknown> = {}
  if (toolForm.type === 'mcp') {
    configPayload['connectionId'] = toolForm.config.connectionId || undefined
    configPayload['toolName'] = toolForm.config.toolName || undefined
  } else {
    configPayload['code'] = toolForm.config.code || ''
    configPayload['args_schema'] = parsedArgsSchema
    configPayload['sampleArgs'] = parsedSampleArgs
  }
  const payload = { ...toolForm, config: configPayload }
  try {
    if (editingTool.value?.id) {
      await toolsStore.updateTool(editingTool.value.id, payload)
      notify.success('Tool updated!')
    } else {
      await toolsStore.createTool(payload)
      notify.success('Tool created!')
    }
    showToolDialog.value = false
  } catch {
    notify.error('Failed to save tool.')
  }
}

function insertExampleCode() {
  if (toolForm.type === 'python') {
    toolForm.config.code = PYTHON_EXAMPLE_CODE
  } else if (toolForm.type === 'typescript') {
    toolForm.config.code = TS_EXAMPLE_CODE
  }
  toolForm.config.argsSchemaText = DEFAULT_NUMBERS_SCHEMA
  toolForm.config.sampleArgsJson = DEFAULT_SAMPLE_ARGS
}

async function runToolTest() {
  toolTestResult.value = ''
  toolTestError.value = ''
  if (!editingTool.value?.id) {
    toolTestError.value = 'Save the tool first before testing.'
    return
  }
  toolTestRunning.value = true
  try {
    const args = parseJsonObject(toolForm.config.sampleArgsJson || '{}', {})
    const result = await toolsStore.executeTool(editingTool.value.id, args)
    toolTestResult.value = JSON.stringify(result, null, 2)
    notify.success('Tool test succeeded.')
  } catch (e: unknown) {
    toolTestError.value = getErrorMessage(e, 'Tool test failed.')
  } finally {
    toolTestRunning.value = false
  }
}
</script>
