<template>
  <div>
    <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
      <h2 class="text-xl font-bold">MCP Servers</h2>
      <Button size="sm" @click="openMcpDialog()"> <Plus class="h-4 w-4 mr-2" />Add Server </Button>
    </div>
    <p class="text-sm text-muted-foreground mb-4">
      Connect MCP (Model Context Protocol) servers. <b>Client</b> connections point to a server on
      <i>your</i> machine — the browser calls it directly. <b>Server</b> connections are reached by
      the backend and must be publicly accessible (admins may also use localhost).
    </p>

    <div v-if="!mcpStore.connections.length" class="flex flex-col items-center py-14 text-center">
      <Link class="h-16 w-16 text-muted-foreground/25 mb-4" />
      <h3 class="text-lg font-semibold mb-2">No MCP servers</h3>
      <p class="text-sm text-muted-foreground mb-4">Add an MCP server connection to get started.</p>
      <Button size="sm" @click="openMcpDialog()"><Plus class="h-4 w-4 mr-2" />Add Server</Button>
    </div>

    <Card v-else>
      <div class="divide-y divide-border">
        <div
          v-for="conn in mcpStore.connections"
          :key="conn.id"
          class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
        >
          <Link class="h-5 w-5 text-muted-foreground shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-medium truncate">{{ conn.name }}</span>
              <!-- Scope badge -->
              <Badge
                v-if="conn.connectionScope === 'client'"
                variant="outline"
                class="text-xs px-1.5 py-0 border-blue-500/60 text-blue-600 dark:text-blue-400"
              >
                Client
              </Badge>
              <Badge v-else variant="secondary" class="text-xs px-1.5 py-0">Server</Badge>
              <!-- Transport badge (only show SSE as it's the non-default) -->
              <Badge
                v-if="conn.connectionScope !== 'client' && conn.transportType === 'sse'"
                variant="outline"
                class="text-xs px-1.5 py-0 border-orange-500/60 text-orange-600 dark:text-orange-400"
              >
                SSE
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground truncate mt-0.5">{{ conn.serverUrl }}</div>
          </div>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="openMcpDialog(conn)">
                <Pencil class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-primary"
                @click="openImportToolsDialog(conn)"
              >
                <Download class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import Tools</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-destructive"
                @click="deleteMcpConnection(conn.id)"
              >
                <Trash2 class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>

    <!-- MCP Connection dialog -->
    <Dialog :open="showMcpDialog" @update:open="showMcpDialog = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingMcpConn?.id ? 'Edit MCP Server' : 'Add MCP Server' }}</DialogTitle>
          <DialogDescription>Configure a connection to an MCP server.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <!-- Name -->
          <div>
            <Label class="mb-1.5 block text-xs">Name</Label>
            <Input v-model="mcpForm.name" placeholder="My MCP Server" />
          </div>

          <!-- Connection Scope -->
          <div>
            <Label class="mb-1.5 block text-xs">Connection Type</Label>
            <Select v-model="mcpForm.connectionScope">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">
                  Client — browser calls your localhost directly
                </SelectItem>
                <SelectItem value="server"> Server — backend proxies calls to the URL </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground mt-1">
              <template v-if="mcpForm.connectionScope === 'client'">
                The MCP server runs on your machine. Only you can use this connection.
              </template>
              <template v-else>
                The MCP server must be reachable from the backend. Admins may use localhost.
              </template>
            </p>
          </div>

          <!-- Server URL -->
          <div>
            <Label class="mb-1.5 block text-xs">Server URL</Label>
            <Input
              v-model="mcpForm.serverUrl"
              :placeholder="
                mcpForm.connectionScope === 'client'
                  ? 'http://localhost:3001'
                  : 'https://my-mcp-server.example.com'
              "
            />
          </div>

          <!-- Transport Type server-scope only -->
          <div v-if="mcpForm.connectionScope === 'server'">
            <Label class="mb-1.5 block text-xs">Transport</Label>
            <Select v-model="mcpForm.transportType">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP POST (Streamable)</SelectItem>
                <SelectItem value="sse">SSE (two-channel)</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground mt-1">
              Use SSE only when the MCP server requires the SSE transport (GET /sse + POST session).
            </p>
          </div>

          <!-- Timeout -->
          <div>
            <Label class="mb-1.5 block text-xs">Timeout (ms)</Label>
            <Input v-model.number="mcpForm.timeout" type="number" placeholder="30000" />
          </div>

          <!-- API Key (optional) -->
          <div>
            <Label class="mb-1.5 block text-xs"
              >API Key <span class="text-muted-foreground font-normal">(optional)</span></Label
            >
            <Input
              v-model="mcpForm.apiKey"
              type="password"
              placeholder="Bearer token sent to the MCP server"
              autocomplete="new-password"
            />
          </div>

          <!-- Test result -->
          <div
            v-if="mcpTestResult"
            class="rounded-md p-3 text-sm"
            :class="
              mcpTestResult.ok
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-destructive/10 text-destructive'
            "
          >
            <template v-if="mcpTestResult.ok">
              Connection successful — {{ mcpTestResult.tools?.length || 0 }} tool(s) available
            </template>
            <template v-else>Connection failed: {{ mcpTestResult.error }}</template>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showMcpDialog = false">Cancel</Button>
          <Button
            variant="secondary"
            :disabled="!mcpForm.serverUrl.trim() || mcpTesting"
            @click="testMcpConnection"
          >
            {{ mcpTesting ? 'Testing¦' : 'Test' }}
          </Button>
          <Button
            :disabled="!mcpForm.name.trim() || !mcpForm.serverUrl.trim()"
            @click="saveMcpConnection"
            >Save</Button
          >
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Import Tools from MCP dialog -->
    <Dialog :open="showImportToolsDialog" @update:open="showImportToolsDialog = $event">
      <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tools from {{ importConn?.name }}</DialogTitle>
          <DialogDescription
            >Select the tools you want to import as individual tool entries.</DialogDescription
          >
        </DialogHeader>
        <div v-if="importLoading" class="flex items-center justify-center py-10 gap-3">
          <Loader2 class="h-5 w-5 animate-spin text-primary" />
          <span class="text-sm text-muted-foreground">Fetching tools from server…</span>
        </div>
        <div
          v-else-if="importFetchError"
          class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {{ importFetchError }}
        </div>
        <div v-else-if="importableTools.length" class="space-y-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-muted-foreground"
              >{{ importableTools.length }} tool(s) available</span
            >
            <div class="flex gap-2">
              <Button variant="ghost" size="sm" class="h-6 text-xs" @click="importSelectAll"
                >Select All</Button
              >
              <Button variant="ghost" size="sm" class="h-6 text-xs" @click="importDeselectAll"
                >Deselect All</Button
              >
            </div>
          </div>
          <div class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            <div
              v-for="tool in importableTools"
              :key="tool.name"
              class="flex items-start gap-3 rounded-md border px-3 py-2.5"
              :class="tool.alreadyExists ? 'opacity-50 bg-muted/30' : 'hover:bg-accent/40'"
            >
              <Checkbox
                :id="`import-tool-${tool.name}`"
                :model-value="importSelected[tool.name] ?? false"
                :disabled="tool.alreadyExists"
                class="mt-0.5 shrink-0"
                @update:model-value="importSelected[tool.name] = $event"
              />
              <div class="flex-1 min-w-0">
                <label
                  :for="`import-tool-${tool.name}`"
                  class="text-sm font-medium cursor-pointer"
                  >{{ tool.name }}</label
                >
                <p
                  v-if="tool.description"
                  class="text-xs text-muted-foreground mt-0.5 leading-snug"
                >
                  {{ tool.description }}
                </p>
                <Badge v-if="tool.alreadyExists" variant="secondary" class="mt-1 text-xs"
                  >Already imported</Badge
                >
              </div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="flex flex-col items-center py-10 text-center text-sm text-muted-foreground gap-2"
        >
          <Wrench class="h-10 w-10 text-muted-foreground/25" />
          <p>No tools found on this MCP server.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showImportToolsDialog = false">Cancel</Button>
          <Button
            :disabled="
              !importableTools.length ||
              importLoading ||
              importSaving ||
              !Object.values(importSelected).some(Boolean)
            "
            @click="importTools"
          >
            <Loader2 v-if="importSaving" class="h-4 w-4 animate-spin mr-2" />
            {{ importSaving ? 'Importing…' : 'Import Selected' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useSettingsInject } from '../../composables/useSettingsState'
import {
  testConnection as mcpTestDirect,
  listTools as mcpListToolsDirect,
} from '../../lib/mcpClient'
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { Checkbox } from '../ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Link, Plus, Pencil, Trash2, Download, Loader2, Wrench } from 'lucide-vue-next'
import type { McpConnection } from '../../types'

const { mcpStore, toolsStore, notify } = useSettingsInject()

const showMcpDialog = ref(false)
const editingMcpConn = ref<Partial<McpConnection> | null>(null)
const mcpForm = reactive({
  name: '',
  serverUrl: '',
  timeout: 30000,
  connectionScope: 'client' as 'client' | 'server',
  transportType: 'http' as 'http' | 'sse',
  apiKey: '',
})
const mcpTesting = ref(false)
const mcpTestResult = ref<{ ok?: boolean; tools?: { name: string }[]; error?: string } | null>(null)

function openMcpDialog(conn: Partial<McpConnection> | null = null) {
  editingMcpConn.value = conn
  mcpTestResult.value = null
  if (conn) {
    Object.assign(mcpForm, {
      name: conn.name ?? '',
      serverUrl: conn.serverUrl ?? '',
      timeout: conn.timeout ?? 30000,
      connectionScope: conn.connectionScope ?? 'client',
      transportType: conn.transportType ?? 'http',
      apiKey: conn.apiKey ?? '',
    })
  } else {
    Object.assign(mcpForm, {
      name: '',
      serverUrl: '',
      timeout: 30000,
      connectionScope: 'client',
      transportType: 'http',
      apiKey: '',
    })
  }
  showMcpDialog.value = true
}

async function saveMcpConnection() {
  try {
    const payload: Partial<McpConnection> = {
      name: mcpForm.name,
      serverUrl: mcpForm.serverUrl,
      timeout: mcpForm.timeout,
      connectionScope: mcpForm.connectionScope,
      transportType: mcpForm.connectionScope === 'server' ? mcpForm.transportType : 'http',
      apiKey: mcpForm.apiKey.trim() || undefined,
    }
    if (editingMcpConn.value?.id) {
      await mcpStore.updateConnection(editingMcpConn.value.id, payload)
      notify.success('MCP connection updated!')
    } else {
      await mcpStore.createConnection(payload)
      notify.success('MCP connection created!')
    }
    showMcpDialog.value = false
  } catch {
    /* store shows notification */
  }
}

async function deleteMcpConnection(id: string) {
  try {
    await mcpStore.deleteConnection(id)
    notify.success('MCP connection deleted')
  } catch {
    /* store shows notification */
  }
}

async function testMcpConnection() {
  mcpTesting.value = true
  mcpTestResult.value = null
  try {
    const apiKey = mcpForm.apiKey.trim() || undefined
    if (mcpForm.connectionScope === 'client') {
      // Client-scope: test browser-direct (no backend proxy)
      mcpTestResult.value = await mcpTestDirect(mcpForm.serverUrl, undefined, apiKey)
    } else {
      // Server-scope: test via backend (also tests backend reachability)
      mcpTestResult.value = await mcpStore.testConnection(
        mcpForm.serverUrl,
        editingMcpConn.value?.id,
        apiKey,
      )
    }
  } finally {
    mcpTesting.value = false
  }
}

interface ImportableTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  alreadyExists: boolean
}

const showImportToolsDialog = ref(false)
const importConn = ref<Partial<McpConnection> | null>(null)
const importableTools = ref<ImportableTool[]>([])
const importSelected = ref<Record<string, boolean>>({})
const importLoading = ref(false)
const importSaving = ref(false)
const importFetchError = ref<string | null>(null)

async function openImportToolsDialog(conn: McpConnection) {
  importConn.value = conn
  importableTools.value = []
  importSelected.value = {}
  importFetchError.value = null
  importLoading.value = true
  showImportToolsDialog.value = true
  try {
    let rawTools: { name: string; description?: string; inputSchema?: Record<string, unknown> }[]

    if (conn.connectionScope === 'client') {
      // Client-scope: the browser calls the MCP server directly
      rawTools = await mcpListToolsDirect(conn.serverUrl, undefined, conn.apiKey)
    } else {
      // Server-scope: backend proxies the call
      rawTools = await mcpStore.loadConnectionTools(conn.id)
    }

    const existingMcpTools = toolsStore.tools.filter(
      (t) =>
        t.type === 'mcp' && (t.config as Record<string, unknown>)?.['connectionId'] === conn.id,
    )
    importableTools.value = rawTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      alreadyExists: existingMcpTools.some(
        (t) => (t.config as Record<string, unknown>)?.['toolName'] === tool.name,
      ),
    }))
    const selected: Record<string, boolean> = {}
    for (const tool of importableTools.value) selected[tool.name] = !tool.alreadyExists
    importSelected.value = selected
  } catch (e) {
    importFetchError.value = (e as Error).message || 'Failed to fetch tools from MCP server.'
  } finally {
    importLoading.value = false
  }
}

function importSelectAll() {
  const selected: Record<string, boolean> = {}
  for (const tool of importableTools.value) selected[tool.name] = !tool.alreadyExists
  importSelected.value = selected
}

function importDeselectAll() {
  const selected: Record<string, boolean> = {}
  for (const tool of importableTools.value) selected[tool.name] = false
  importSelected.value = selected
}

async function importTools() {
  if (!importConn.value) return
  importSaving.value = true
  const toImport = importableTools.value.filter(
    (t) => !t.alreadyExists && importSelected.value[t.name],
  )
  let successCount = 0
  try {
    for (const tool of toImport) {
      await toolsStore.createTool({
        name: tool.name,
        description: tool.description || '',
        type: 'mcp',
        config: {
          connectionId: importConn.value.id,
          toolName: tool.name,
          args_schema: tool.inputSchema ?? { type: 'object', properties: {} },
        },
        enabled: true,
      })
      successCount++
    }
    if (successCount > 0) {
      notify.success(`Imported ${successCount} tool${successCount > 1 ? 's' : ''} successfully!`)
    }
    showImportToolsDialog.value = false
  } catch {
    notify.error('Failed to import one or more tools.')
  } finally {
    importSaving.value = false
  }
}
</script>
