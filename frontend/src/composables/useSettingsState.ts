import { ref, reactive, computed, watch, inject, type InjectionKey } from 'vue'

export type SettingsStateReturn = ReturnType<typeof useSettingsState>
export const SETTINGS_STATE_KEY: InjectionKey<SettingsStateReturn> = Symbol('settingsState')

export function useSettingsInject(): SettingsStateReturn {
  const state = inject(SETTINGS_STATE_KEY)
  if (!state) throw new Error('useSettingsInject must be used inside SettingsPanel')
  return state
}
import { useSettingsStore } from '../stores/settings'
import { useModelsStore } from '../stores/models'
import { useAgentsStore } from '../stores/agents'
import { useToolsStore } from '../stores/tools'
import { useMcpConnectionsStore } from '../stores/mcpConnections'
import { useKnowledgeStore } from '../stores/knowledge'
import { useThemeStore } from '../stores/theme'
import { useNotificationStore } from '../stores/notification'
import { useAuthStore } from '../stores/auth'
import {
  Brain,
  Bot,
  Zap,
  Database,
  HardDrive,
  FileSearch,
  FileText,
  Code,
  Link,
} from 'lucide-vue-next'

/**
 * useSettingsState - Shared composable for Settings panel state.
 *
 * Holds all reactive state for provider, vector store, document processor,
 * model defaults, and executor configuration. Each settings tab component
 * imports this composable instead of duplicating the state logic.
 */
export function useSettingsState() {
  const settingsStore = useSettingsStore()
  const modelsStore = useModelsStore()
  const agentsStore = useAgentsStore()
  const toolsStore = useToolsStore()
  const mcpStore = useMcpConnectionsStore()
  const knowledgeStore = useKnowledgeStore()
  const themeStore = useThemeStore()
  const notify = useNotificationStore()
  const authStore = useAuthStore()

  const saving = ref(false)

  // ── Auth helpers ──────────────────────────────────────────────────────────

  function isOwner(resource: { ownerId?: string }) {
    return resource.ownerId === authStore.user?.id
  }

  function canManage(resource: { ownerId?: string; _sharedWithMe?: boolean }) {
    return isOwner(resource) || authStore.isAdmin
  }

  // ── Provider settings ─────────────────────────────────────────────────────

  const providers = [
    {
      key: 'openai',
      name: 'OpenAI',
      keyLabel: 'API Key',
      icon: Brain,
      iconClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/10',
      description: 'GPT-4o, GPT-4, GPT-3.5 and more',
    },
    {
      key: 'anthropic',
      name: 'Anthropic',
      keyLabel: 'API Key',
      icon: Bot,
      iconClass: 'text-amber-500',
      bgClass: 'bg-amber-500/10',
      description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    },
    {
      key: 'ollama',
      name: 'Ollama',
      keyLabel: 'API Key (optional)',
      hasUrl: true,
      urlLabel: 'Base URL',
      icon: Zap,
      iconClass: 'text-sky-500',
      bgClass: 'bg-sky-500/10',
      description: 'Run models locally',
    },
    {
      key: 'groq',
      name: 'Groq',
      keyLabel: 'API Key',
      icon: Zap,
      iconClass: 'text-yellow-500',
      bgClass: 'bg-yellow-500/10',
      description: 'Ultra-fast inference',
    },
    {
      key: 'gemini',
      name: 'Google Gemini',
      keyLabel: 'API Key',
      icon: Brain,
      iconClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10',
      description: 'Gemini 1.5 Pro, Flash',
    },
    {
      key: 'azure',
      name: 'Azure OpenAI',
      keyLabel: 'API Key',
      hasUrl: true,
      urlLabel: 'Azure Endpoint',
      icon: Brain,
      iconClass: 'text-cyan-500',
      bgClass: 'bg-cyan-500/10',
      description: 'OpenAI on Azure',
    },
    {
      key: 'mistral',
      name: 'Mistral AI',
      keyLabel: 'API Key',
      icon: Brain,
      iconClass: 'text-orange-500',
      bgClass: 'bg-orange-500/10',
      description: 'Mistral Large, Medium, Small',
    },
    {
      key: 'deepseek',
      name: 'DeepSeek',
      keyLabel: 'API Key',
      icon: Brain,
      iconClass: 'text-indigo-500',
      bgClass: 'bg-indigo-500/10',
      description: 'DeepSeek Chat and Coder models',
    },
    {
      key: 'cohere',
      name: 'Cohere',
      keyLabel: 'API Key',
      icon: Brain,
      iconClass: 'text-rose-500',
      bgClass: 'bg-rose-500/10',
      description: 'Command R+, Command R',
    },
    {
      key: 'huggingface',
      name: 'HuggingFace',
      keyLabel: 'API Key',
      hasUrl: true,
      urlLabel: 'Base URL',
      icon: Bot,
      iconClass: 'text-yellow-600',
      bgClass: 'bg-yellow-600/10',
      description: 'HuggingFace Inference API',
    },
  ]

  const providerEnabled = reactive<Record<string, boolean>>({})
  const providerKeys = reactive<Record<string, string>>({})
  const providerUrls = reactive<Record<string, string>>({})
  const providerApiVersions = reactive<Record<string, string>>({ azure: '2024-04-01-preview' })
  const showKey = reactive<Record<string, boolean>>({})

  providers.forEach((p) => {
    providerEnabled[p.key] = false
    providerKeys[p.key] = ''
    providerUrls[p.key] = ''
    showKey[p.key] = false
  })

  const providerKeysList = computed(() =>
    providers.filter((p) => providerEnabled[p.key]).map((p) => p.key),
  )
  const embeddingProviderKeys = computed(() =>
    ['openai', 'ollama', 'gemini', 'cohere', 'azure', 'mistral', 'huggingface'].filter(
      (k) => providerEnabled[k],
    ),
  )

  // ── Model defaults ────────────────────────────────────────────────────────

  const defaultModelId = ref<string | null>(null)
  const defaultEmbeddingModelId = ref<string | null>(null)

  const embeddingModels = computed(() => modelsStore.aiModels.filter((m) => m.type === 'embedding'))
  const generalModels = computed(() => modelsStore.aiModels.filter((m) => m.type !== 'embedding'))

  // ── Vector Store providers ────────────────────────────────────────────────

  const vectorStoreProviders = [
    {
      key: 'local',
      name: 'Local (built-in)',
      icon: HardDrive,
      iconClass: 'text-green-500',
      bgClass: 'bg-green-500/10',
      description: 'In-memory vector storage, no external service needed',
    },
    {
      key: 'chroma',
      name: 'Chroma',
      icon: Database,
      iconClass: 'text-purple-500',
      bgClass: 'bg-purple-500/10',
      description: 'External Chroma vector database',
      hasUrl: true,
      urlLabel: 'Chroma URL',
      urlPlaceholder: 'http://localhost:8000',
    },
    {
      key: 'pinecone',
      name: 'Pinecone',
      icon: Database,
      iconClass: 'text-teal-500',
      bgClass: 'bg-teal-500/10',
      description: 'Managed vector database in the cloud',
      hasApiKey: true,
      keyLabel: 'API Key',
    },
    {
      key: 'qdrant',
      name: 'Qdrant',
      icon: Database,
      iconClass: 'text-red-500',
      bgClass: 'bg-red-500/10',
      description: 'High-performance vector search engine',
      hasUrl: true,
      urlLabel: 'Qdrant URL',
      urlPlaceholder: 'http://localhost:6333',
      hasApiKey: true,
      keyLabel: 'API Key (optional)',
    },
    {
      key: 'weaviate',
      name: 'Weaviate',
      icon: Database,
      iconClass: 'text-green-600',
      bgClass: 'bg-green-600/10',
      description: 'AI-native vector database',
      hasUrl: true,
      urlLabel: 'Weaviate URL',
      urlPlaceholder: 'http://localhost:8080',
      hasApiKey: true,
      keyLabel: 'API Key (optional)',
    },
    {
      key: 'milvus',
      name: 'Milvus',
      icon: Database,
      iconClass: 'text-blue-600',
      bgClass: 'bg-blue-600/10',
      description: 'Scalable vector database for AI',
      hasUrl: true,
      urlLabel: 'Milvus Address',
      urlPlaceholder: 'localhost:19530',
      hasApiKey: true,
      keyLabel: 'Token (optional)',
    },
    {
      key: 'pgvector',
      name: 'pgvector (PostgreSQL)',
      icon: Database,
      iconClass: 'text-slate-500',
      bgClass: 'bg-slate-500/10',
      description: 'PostgreSQL with vector extension',
      hasUrl: true,
      urlLabel: 'Connection String',
      urlPlaceholder: 'postgresql://user:pass@localhost:5432/db',
    },
  ]

  const vectorStoreEnabled = reactive<Record<string, boolean>>({
    local: true,
    chroma: false,
    pinecone: false,
    qdrant: false,
    weaviate: false,
    milvus: false,
    pgvector: false,
  })
  const vectorStoreUrls = reactive<Record<string, string>>({
    chroma: '',
    pinecone: '',
    qdrant: '',
    weaviate: '',
    milvus: '',
    pgvector: '',
  })
  const vectorStoreApiKeys = reactive<Record<string, string>>({
    pinecone: '',
    qdrant: '',
    weaviate: '',
    milvus: '',
  })
  const defaultVectorStoreType = ref<string | null>('local')

  // ── Document Processor providers ──────────────────────────────────────────

  const docProcessorProviders = [
    {
      key: 'langchain',
      name: 'LangChain (local)',
      icon: Code,
      iconClass: 'text-green-500',
      bgClass: 'bg-green-500/10',
      description: 'Local text extraction, no external service',
    },
    {
      key: 'tika',
      name: 'Apache Tika',
      icon: FileSearch,
      iconClass: 'text-orange-500',
      bgClass: 'bg-orange-500/10',
      description: 'External text extraction service',
      hasUrl: true,
      urlLabel: 'Tika URL',
      urlPlaceholder: 'http://localhost:9998',
    },
    {
      key: 'docling',
      name: 'Docling',
      icon: FileText,
      iconClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10',
      description: 'External document processing service',
      hasUrl: true,
      urlLabel: 'Docling URL',
      urlPlaceholder: 'http://localhost:5001',
    },
    {
      key: 'unstructured',
      name: 'Unstructured',
      icon: FileSearch,
      iconClass: 'text-violet-500',
      bgClass: 'bg-violet-500/10',
      description: 'All-in-one document extraction via Unstructured.io',
      hasUrl: true,
      urlLabel: 'Unstructured URL',
      urlPlaceholder: 'http://localhost:8000',
    },
  ]

  const docProcessorEnabled = reactive<Record<string, boolean>>({
    langchain: true,
    tika: false,
    docling: false,
    unstructured: false,
  })
  const docProcessorUrls = reactive<Record<string, string>>({
    tika: '',
    docling: '',
    unstructured: '',
  })
  const defaultDocProcessorType = ref<string | null>('langchain')

  // ── Executor settings ─────────────────────────────────────────────────────

  const executorNames = ['mcp', 'python', 'typescript']
  const executorEnabled = reactive<Record<string, boolean>>({
    mcp: true,
    python: true,
    typescript: true,
  })

  const pythonExecutorMode = ref<'spawn' | 'sandbox'>('sandbox')
  const pythonExecutorPath = ref('python')
  const pythonExecutorTimeout = ref(30000)
  const pythonExecutorMaxOutputBytes = ref(1024 * 1024)

  const typescriptExecutorMode = ref<'spawn' | 'sandbox'>('sandbox')
  const typescriptExecutorPath = ref('node')
  const typescriptExecutorTimeout = ref(30000)
  const typescriptExecutorMaxOutputBytes = ref(1024 * 1024)

  // ── Knowledge store creation form ─────────────────────────────────────────

  const newKsEmbeddingModelId = ref<string>('__default__')
  const newKsVectorStoreType = ref('local')
  const newKsVectorStoreUrl = ref('')
  const newKsDocProcessorType = ref('langchain')
  const newKsDocProcessorUrl = ref('')
  const newKsChunkSize = ref(1000)
  const newKsChunkOverlap = ref(200)
  const newKsChunkUnit = ref('characters')

  function syncChunkFromEmbeddingModel(modelId: string | null) {
    const model = embeddingModels.value.find((m) => m.id === modelId)
    if (model) {
      newKsChunkSize.value = (model as any).chunkSize ?? 1000
      newKsChunkOverlap.value = (model as any).chunkOverlap ?? 200
      newKsChunkUnit.value = 'characters'
    } else {
      newKsChunkSize.value = 1000
      newKsChunkOverlap.value = 200
      newKsChunkUnit.value = 'characters'
    }
  }

  watch(newKsEmbeddingModelId, (modelId) => {
    syncChunkFromEmbeddingModel(modelId)
  })

  // ── Settings watcher: sync all state from store ───────────────────────────

  watch(
    () => settingsStore.settings,
    (s: Record<string, any>) => {
      if (!s || !Object.keys(s).length) return

      providers.forEach((p) => {
        providerEnabled[p.key] = s[p.key]?.enabled || false
        providerKeys[p.key] = s[p.key]?.apiKey || ''
        providerUrls[p.key] = s[p.key]?.baseUrl || ''
        if (p.key === 'azure') {
          providerApiVersions.azure = s[p.key]?.apiVersion || providerApiVersions.azure
        }
      })

      if (s.defaultModelId !== undefined) defaultModelId.value = s.defaultModelId
      if (s.defaultEmbeddingModelId !== undefined)
        defaultEmbeddingModelId.value = s.defaultEmbeddingModelId

      if (s.vectorStores) {
        vectorStoreProviders.forEach((vs) => {
          if (s.vectorStores[vs.key] !== undefined) {
            vectorStoreEnabled[vs.key] = s.vectorStores[vs.key].enabled !== false
            if (s.vectorStores[vs.key].url) vectorStoreUrls[vs.key] = s.vectorStores[vs.key].url
            if (s.vectorStores[vs.key].apiKey)
              vectorStoreApiKeys[vs.key] = s.vectorStores[vs.key].apiKey
          }
        })
      } else if (s.defaultVectorStoreConfig) {
        const t = s.defaultVectorStoreConfig.type || 'local'
        vectorStoreEnabled[t] = true
        if (s.defaultVectorStoreConfig.url) vectorStoreUrls[t] = s.defaultVectorStoreConfig.url
      }

      if (s.defaultVectorStoreType) defaultVectorStoreType.value = s.defaultVectorStoreType
      else if (s.defaultVectorStoreConfig?.type)
        defaultVectorStoreType.value = s.defaultVectorStoreConfig.type

      if (s.documentProcessors) {
        docProcessorProviders.forEach((dp) => {
          if (s.documentProcessors[dp.key] !== undefined) {
            docProcessorEnabled[dp.key] = s.documentProcessors[dp.key].enabled !== false
            if (s.documentProcessors[dp.key].url)
              docProcessorUrls[dp.key] = s.documentProcessors[dp.key].url
          }
        })
      } else if (s.defaultDocumentProcessorConfig) {
        const t = s.defaultDocumentProcessorConfig.type || 'langchain'
        docProcessorEnabled[t] = true
        if (s.defaultDocumentProcessorConfig.url)
          docProcessorUrls[t] = s.defaultDocumentProcessorConfig.url
      }

      if (s.defaultDocumentProcessorType)
        defaultDocProcessorType.value = s.defaultDocumentProcessorType
      else if (s.defaultDocumentProcessorConfig?.type)
        defaultDocProcessorType.value = s.defaultDocumentProcessorConfig.type

      if (s.executors?.enabled) {
        executorNames.forEach((name) => {
          if (typeof s.executors.enabled[name] === 'boolean') {
            executorEnabled[name] = s.executors.enabled[name]
          }
        })
      }
      if (s.executors?.python?.mode === 'spawn' || s.executors?.python?.mode === 'sandbox') {
        pythonExecutorMode.value = s.executors.python.mode
      }
      if (s.executors?.python?.pythonPath) pythonExecutorPath.value = s.executors.python.pythonPath
      if (typeof s.executors?.python?.timeout === 'number')
        pythonExecutorTimeout.value = s.executors.python.timeout
      if (typeof s.executors?.python?.maxOutputBytes === 'number')
        pythonExecutorMaxOutputBytes.value = s.executors.python.maxOutputBytes

      if (s.executors?.typescript?.mode === 'spawn' || s.executors?.typescript?.mode === 'sandbox')
        typescriptExecutorMode.value = s.executors.typescript.mode
      if (s.executors?.typescript?.nodePath)
        typescriptExecutorPath.value = s.executors.typescript.nodePath
      if (typeof s.executors?.typescript?.timeout === 'number')
        typescriptExecutorTimeout.value = s.executors.typescript.timeout
      if (typeof s.executors?.typescript?.maxOutputBytes === 'number')
        typescriptExecutorMaxOutputBytes.value = s.executors.typescript.maxOutputBytes

      newKsEmbeddingModelId.value = defaultEmbeddingModelId.value || '__default__'
      newKsVectorStoreType.value = defaultVectorStoreType.value || 'local'
      newKsVectorStoreUrl.value = vectorStoreUrls[defaultVectorStoreType.value || ''] || ''
      newKsDocProcessorType.value = defaultDocProcessorType.value || 'langchain'
      newKsDocProcessorUrl.value = docProcessorUrls[defaultDocProcessorType.value || ''] || ''
      syncChunkFromEmbeddingModel(newKsEmbeddingModelId.value)
    },
    { immediate: true, deep: true },
  )

  // ── Save helpers ─────────────────────────────────────────────────────────

  async function saveProviderSettings() {
    saving.value = true
    const providerData: Record<
      string,
      { enabled: boolean; apiKey: string; baseUrl: string; apiVersion?: string }
    > = {}
    providers.forEach((p) => {
      providerData[p.key] = {
        enabled: providerEnabled[p.key],
        apiKey: providerKeys[p.key],
        baseUrl: providerUrls[p.key],
      }
      if (p.key === 'azure' && providerApiVersions.azure.trim()) {
        providerData[p.key].apiVersion = providerApiVersions.azure.trim()
      }
    })
    try {
      await settingsStore.saveSettings(providerData)
      notify.success('Settings saved successfully!')
    } catch {
      notify.error('Failed to save settings.')
    } finally {
      saving.value = false
    }
  }

  async function saveDefaults() {
    saving.value = true
    try {
      await settingsStore.saveSettings({
        defaultModelId: defaultModelId.value,
        defaultEmbeddingModelId: defaultEmbeddingModelId.value,
      })
      notify.success('Default saved!')
    } catch {
      notify.error('Failed to save default.')
    } finally {
      saving.value = false
    }
  }

  async function toggleDefaultModel(id: string) {
    defaultModelId.value = defaultModelId.value === id ? null : id
    await saveDefaults()
  }

  async function toggleDefaultEmbedding(id: string) {
    defaultEmbeddingModelId.value = defaultEmbeddingModelId.value === id ? null : id
    await saveDefaults()
  }

  function toggleDefaultVectorStore(key: string) {
    defaultVectorStoreType.value = defaultVectorStoreType.value === key ? null : key
  }

  function toggleDefaultDocProcessor(key: string) {
    defaultDocProcessorType.value = defaultDocProcessorType.value === key ? null : key
  }

  async function saveVectorStoreSettings() {
    saving.value = true
    const vsData: Record<string, { enabled: boolean; url?: string; apiKey?: string }> = {}
    vectorStoreProviders.forEach((vs) => {
      vsData[vs.key] = { enabled: vectorStoreEnabled[vs.key] }
      if (vectorStoreUrls[vs.key]) vsData[vs.key].url = vectorStoreUrls[vs.key]
      if (vectorStoreApiKeys[vs.key]) vsData[vs.key].apiKey = vectorStoreApiKeys[vs.key]
    })
    try {
      await settingsStore.saveSettings({
        vectorStores: vsData,
        defaultVectorStoreType: defaultVectorStoreType.value,
        defaultVectorStoreConfig: {
          type: defaultVectorStoreType.value,
          url: vectorStoreUrls[defaultVectorStoreType.value || ''] || '',
        },
      })
      notify.success('Vector store settings saved!')
    } catch {
      notify.error('Failed to save vector store settings.')
    } finally {
      saving.value = false
    }
  }

  async function saveDocProcessorSettings() {
    saving.value = true
    const dpData: Record<string, { enabled: boolean; url?: string }> = {}
    docProcessorProviders.forEach((dp) => {
      dpData[dp.key] = { enabled: docProcessorEnabled[dp.key] }
      if (docProcessorUrls[dp.key]) dpData[dp.key].url = docProcessorUrls[dp.key]
    })
    try {
      await settingsStore.saveSettings({
        documentProcessors: dpData,
        defaultDocumentProcessorType: defaultDocProcessorType.value,
        defaultDocumentProcessorConfig: {
          type: defaultDocProcessorType.value,
          url: docProcessorUrls[defaultDocProcessorType.value || ''] || '',
        },
      })
      notify.success('Document processor settings saved!')
    } catch {
      notify.error('Failed to save document processor settings.')
    } finally {
      saving.value = false
    }
  }

  async function saveExecutorSettings() {
    saving.value = true
    try {
      await settingsStore.saveSettings({
        executors: {
          enabled: { ...executorEnabled },
          python: {
            mode: pythonExecutorMode.value,
            pythonPath: pythonExecutorPath.value || 'python',
            timeout: pythonExecutorTimeout.value || 30000,
            maxOutputBytes: pythonExecutorMaxOutputBytes.value || 1024 * 1024,
          },
          typescript: {
            mode: typescriptExecutorMode.value,
            nodePath: typescriptExecutorPath.value || 'node',
            timeout: typescriptExecutorTimeout.value || 30000,
            maxOutputBytes: typescriptExecutorMaxOutputBytes.value || 1024 * 1024,
          },
        },
      })
      notify.success('Executor settings saved!')
    } catch {
      notify.error('Failed to save executor settings.')
    } finally {
      saving.value = false
    }
  }

  return {
    // Stores
    settingsStore,
    modelsStore,
    agentsStore,
    toolsStore,
    mcpStore,
    knowledgeStore,
    themeStore,
    notify,
    authStore,

    // Auth helpers
    isOwner,
    canManage,

    // Shared
    saving,

    // Provider state
    providers,
    providerEnabled,
    providerKeys,
    providerUrls,
    providerApiVersions,
    showKey,
    providerKeysList,
    embeddingProviderKeys,

    // Model defaults
    defaultModelId,
    defaultEmbeddingModelId,
    embeddingModels,
    generalModels,

    // Vector stores
    vectorStoreProviders,
    vectorStoreEnabled,
    vectorStoreUrls,
    vectorStoreApiKeys,
    defaultVectorStoreType,

    // Doc processors
    docProcessorProviders,
    docProcessorEnabled,
    docProcessorUrls,
    defaultDocProcessorType,

    // Executors
    executorNames,
    executorEnabled,
    pythonExecutorMode,
    pythonExecutorPath,
    pythonExecutorTimeout,
    pythonExecutorMaxOutputBytes,
    typescriptExecutorMode,
    typescriptExecutorPath,
    typescriptExecutorTimeout,
    typescriptExecutorMaxOutputBytes,

    // Knowledge store creation form
    newKsEmbeddingModelId,
    newKsVectorStoreType,
    newKsVectorStoreUrl,
    newKsDocProcessorType,
    newKsDocProcessorUrl,
    newKsChunkSize,
    newKsChunkOverlap,
    newKsChunkUnit,
    syncChunkFromEmbeddingModel,

    // Actions
    saveProviderSettings,
    saveDefaults,
    toggleDefaultModel,
    toggleDefaultEmbedding,
    toggleDefaultVectorStore,
    toggleDefaultDocProcessor,
    saveVectorStoreSettings,
    saveDocProcessorSettings,
    saveExecutorSettings,
  }
}
