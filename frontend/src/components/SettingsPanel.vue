<template>
  <div class="flex h-full overflow-hidden">
    <!-- Settings sidebar (ShadCN Sidebar) -->
    <Sidebar collapsible="icon">
      <SidebarHeader class="flex items-center px-3 h-12">
        <span class="text-sm font-bold flex-1 group-data-[collapsible=icon]:hidden">Settings</span>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem v-for="tab in tabs" :key="tab.value">
                <SidebarMenuButton
                  :is-active="activeTab === tab.value"
                  :tooltip="tab.label"
                  @click="activeTab = tab.value"
                >
                  <component :is="tab.icon" class="h-4 w-4" />
                  <span>{{ tab.label }}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>

    <!-- Content area -->
    <SidebarInset class="min-h-0">
      <ScrollArea class="flex-1 h-full">
        <div class="p-6 max-w-4xl">
          <!-- ── Model Providers ────────────────────────── -->
          <template v-if="activeTab === 'providers'">
            <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">
              Model Providers
            </h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card v-for="provider in providers" :key="provider.key">
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
                    <CardTitle class="text-sm">
                      {{ provider.name }}
                    </CardTitle>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ provider.description }}
                    </p>
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
                    />
                  </div>
                  <div v-if="provider.hasUrl">
                    <Label class="mb-1.5 block text-xs">{{
                      provider.urlLabel || 'Base URL'
                    }}</Label>
                    <Input
                      v-model="providerUrls[provider.key]"
                      :placeholder="provider.urlLabel || 'Base URL'"
                    />
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
          </template>

          <!-- ── Models ─────────────────────────────────── -->
          <template v-else-if="activeTab === 'models'">
            <!-- Sub-tabs -->
            <div class="flex items-center gap-1 mb-5 pb-3 border-b-2 border-primary/15">
              <Tabs v-model="modelSubTab">
                <TabsList>
                  <TabsTrigger value="general"> Models </TabsTrigger>
                  <TabsTrigger value="embedding"> Embedding </TabsTrigger>
                </TabsList>
              </Tabs>
              <div class="flex-1" />
              <Button
                size="sm"
                @click="openModelDialog(null, modelSubTab === 'embedding' ? 'embedding' : 'model')"
              >
                <Plus class="h-4 w-4 mr-2" />{{
                  modelSubTab === 'embedding' ? 'New Embedding' : 'New Model'
                }}
              </Button>
            </div>

            <!-- Default info hint -->
            <p class="text-xs text-muted-foreground mb-3">
              Click the checkbox next to a model to set it as default.
            </p>

            <!-- General models list -->
            <template v-if="modelSubTab === 'general'">
              <p class="text-sm text-muted-foreground mb-4">
                Models are named configurations that users chat with. Includes standard models,
                webhooks, and agents.
              </p>

              <div
                v-if="!generalModels.length"
                class="flex flex-col items-center py-14 text-center"
              >
                <Brain class="h-16 w-16 text-muted-foreground/25 mb-4" />
                <h3 class="text-lg font-semibold mb-2">No models yet</h3>
                <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
                  Create a named model configuration.
                </p>
                <Button @click="openModelDialog(null, 'model')">
                  <Plus class="h-4 w-4 mr-2" />New Model
                </Button>
              </div>

              <Card v-else>
                <div class="divide-y divide-border">
                  <div
                    v-for="m in generalModels"
                    :key="m.id"
                    class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <Tooltip :delay-duration="200">
                      <TooltipTrigger as-child>
                        <Checkbox
                          :checked="m.id === defaultModelId"
                          @update:checked="toggleDefaultModel(m.id)"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {{ m.id === defaultModelId ? 'Default model' : 'Set as default' }}
                      </TooltipContent>
                    </Tooltip>
                    <component
                      :is="m.type === 'agent' ? Bot : m.type === 'webhook' ? Webhook : Brain"
                      class="h-4 w-4 text-muted-foreground shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate">
                        {{ m.name }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{
                          m.type === 'agent'
                            ? 'Agent'
                            : m.type === 'webhook'
                              ? 'Webhook'
                              : m.provider || 'No provider'
                        }}
                        <span v-if="m.providerModel"> · {{ m.providerModel }}</span>
                      </div>
                    </div>
                    <Badge v-if="m.id === defaultModelId" variant="default" class="text-[10px]">
                      Default
                    </Badge>
                    <Badge v-if="m._sharedWithMe" variant="outline" class="text-[10px]">
                      Shared
                    </Badge>
                    <Badge :variant="m.enabled !== false ? 'success' : 'outline'">
                      {{ m.enabled !== false ? 'Active' : 'Disabled' }}
                    </Badge>
                    <Button
                      v-if="canManage(m)"
                      variant="ghost"
                      size="icon-xs"
                      @click.stop="openShareDialog('ai_model', m.id, m.name)"
                    >
                      <Share2 class="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" @click.stop="openModelDialog(m)">
                      <Pencil class="h-3 w-3" />
                    </Button>
                    <Button
                      v-if="canManage(m)"
                      variant="ghost"
                      size="icon-xs"
                      class="text-destructive"
                      @click.stop="confirmDeleteModel(m)"
                    >
                      <Trash2 class="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            </template>

            <!-- Embedding models list -->
            <template v-else>
              <p class="text-sm text-muted-foreground mb-4">
                Embedding models convert text into vectors for knowledge store search and RAG.
              </p>

              <div
                v-if="!embeddingModels.length"
                class="flex flex-col items-center py-14 text-center"
              >
                <Database class="h-16 w-16 text-muted-foreground/25 mb-4" />
                <h3 class="text-lg font-semibold mb-2">No embedding models yet</h3>
                <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
                  Create an embedding model configuration.
                </p>
                <Button @click="openModelDialog(null, 'embedding')">
                  <Plus class="h-4 w-4 mr-2" />New Embedding
                </Button>
              </div>

              <Card v-else>
                <div class="divide-y divide-border">
                  <div
                    v-for="m in embeddingModels"
                    :key="m.id"
                    class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                  >
                    <Tooltip :delay-duration="200">
                      <TooltipTrigger as-child>
                        <Checkbox
                          :checked="m.id === defaultEmbeddingModelId"
                          @update:checked="toggleDefaultEmbedding(m.id)"
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {{
                          m.id === defaultEmbeddingModelId ? 'Default embedding' : 'Set as default'
                        }}
                      </TooltipContent>
                    </Tooltip>
                    <Database class="h-4 w-4 text-muted-foreground shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium truncate">
                        {{ m.name }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ m.provider || 'No provider' }}
                        <span v-if="m.providerModel"> · {{ m.providerModel }}</span>
                        <span v-if="m.chunkSize"> · {{ m.chunkSize }}cs</span>
                        <span v-if="m.chunkOverlap"> / {{ m.chunkOverlap }}co</span>
                        <span v-if="m.topK"> · top{{ m.topK }}</span>
                      </div>
                    </div>
                    <Badge
                      v-if="m.id === defaultEmbeddingModelId"
                      variant="default"
                      class="text-[10px]"
                    >
                      Default
                    </Badge>
                    <Badge v-if="m._sharedWithMe" variant="outline" class="text-[10px]">
                      Shared
                    </Badge>
                    <Badge :variant="m.enabled !== false ? 'success' : 'outline'">
                      {{ m.enabled !== false ? 'Active' : 'Disabled' }}
                    </Badge>
                    <Button
                      v-if="canManage(m)"
                      variant="ghost"
                      size="icon-xs"
                      @click.stop="openShareDialog('ai_model', m.id, m.name)"
                    >
                      <Share2 class="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" @click.stop="openModelDialog(m)">
                      <Pencil class="h-3 w-3" />
                    </Button>
                    <Button
                      v-if="canManage(m)"
                      variant="ghost"
                      size="icon-xs"
                      class="text-destructive"
                      @click.stop="confirmDeleteModel(m)"
                    >
                      <Trash2 class="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            </template>
          </template>

          <!-- ── Vector Stores ────────────────────────────── -->
          <template v-else-if="activeTab === 'vectorstores'">
            <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Vector Stores</h2>
            <p class="text-sm text-muted-foreground mb-4">
              Configure available vector store backends and set the default for new knowledge
              stores.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card v-for="vs in vectorStoreProviders" :key="vs.key">
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
                      {{
                        defaultVectorStoreType === vs.key
                          ? 'Default vector store'
                          : 'Set as default'
                      }}
                    </TooltipContent>
                  </Tooltip>
                  <div
                    :class="[
                      'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                      vs.bgClass,
                    ]"
                  >
                    <component :is="vs.icon" :class="['h-5 w-5', vs.iconClass]" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <CardTitle class="text-sm">
                      {{ vs.name }}
                    </CardTitle>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ vs.description }}
                    </p>
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
                <CardContent v-if="vectorStoreEnabled[vs.key] && vs.hasUrl" class="space-y-3">
                  <Separator />
                  <div>
                    <Label class="mb-1.5 block text-xs">{{ vs.urlLabel }}</Label>
                    <Input v-model="vectorStoreUrls[vs.key]" :placeholder="vs.urlPlaceholder" />
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
          </template>

          <!-- ── Document Processor ─────────────────────── -->
          <template v-else-if="activeTab === 'docprocessor'">
            <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">
              Document Processors
            </h2>
            <p class="text-sm text-muted-foreground mb-4">
              Configure available document processors and set the default for new knowledge stores.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card v-for="dp in docProcessorProviders" :key="dp.key">
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
                      {{
                        defaultDocProcessorType === dp.key ? 'Default processor' : 'Set as default'
                      }}
                    </TooltipContent>
                  </Tooltip>
                  <div
                    :class="[
                      'flex h-9 w-9 items-center justify-center rounded-lg shrink-0',
                      dp.bgClass,
                    ]"
                  >
                    <component :is="dp.icon" :class="['h-5 w-5', dp.iconClass]" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <CardTitle class="text-sm">
                      {{ dp.name }}
                    </CardTitle>
                    <p class="text-xs text-muted-foreground truncate">
                      {{ dp.description }}
                    </p>
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
          </template>

          <!-- ── Knowledge Stores ───────────────────────── -->
          <template v-else-if="activeTab === 'knowledge'">
            <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
              <h2 class="text-xl font-bold">Knowledge Stores</h2>
              <Button size="sm" @click="showCreateKs = true">
                <Plus class="h-4 w-4 mr-2" />New Store
              </Button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
              <div>
                <div
                  v-if="!knowledgeStore.knowledgeStores.length"
                  class="flex flex-col items-center py-10 border border-dashed border-border rounded-lg text-center"
                >
                  <Database class="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p class="text-sm text-muted-foreground mb-3">No knowledge stores yet</p>
                  <Button size="sm" @click="showCreateKs = true">
                    <Plus class="h-4 w-4 mr-2" />New Store
                  </Button>
                </div>
                <Card v-else>
                  <div class="divide-y divide-border">
                    <div
                      v-for="ks in knowledgeStore.knowledgeStores"
                      :key="ks.id"
                      :class="[
                        'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors',
                        selectedKs?.id === ks.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                      ]"
                      @click="selectKs(ks)"
                    >
                      <Database class="h-4 w-4 shrink-0" />
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium truncate">
                          {{ ks.name }}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {{ ks.documentCount || 0 }} documents
                        </div>
                      </div>
                      <Badge v-if="ks._sharedWithMe" variant="outline" class="text-[10px]">
                        Shared
                      </Badge>
                      <Button
                        v-if="canManage(ks)"
                        variant="ghost"
                        size="icon-xs"
                        @click.stop="openShareDialog('knowledge_store', ks.id, ks.name)"
                      >
                        <Share2 class="h-3 w-3" />
                      </Button>
                      <Button
                        v-if="canManage(ks)"
                        variant="ghost"
                        size="icon-xs"
                        class="text-destructive"
                        @click.stop="knowledgeStore.deleteKnowledgeStore(ks.id)"
                      >
                        <Trash2 class="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
              <div>
                <Card v-if="selectedKs">
                  <CardHeader>
                    <CardTitle class="text-sm">
                      {{ selectedKs.name }}
                    </CardTitle>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div
                      v-if="canManage(selectedKs)"
                      class="border-2 border-dashed border-primary/25 rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5"
                      :class="{ 'border-primary bg-primary/5': isDragging }"
                      @dragover.prevent="isDragging = true"
                      @dragleave="isDragging = false"
                      @drop.prevent="handleDrop"
                      @click="docInput?.click()"
                    >
                      <Upload class="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <div class="text-sm">Drop files here or click to upload</div>
                      <div class="text-xs text-muted-foreground mt-1">
                        PDF, TXT, MD, DOCX supported
                      </div>
                    </div>
                    <input
                      ref="docInput"
                      type="file"
                      multiple
                      class="hidden"
                      @change="handleFileSelect"
                    />
                    <div v-if="ksDocs.length" class="divide-y divide-border rounded-md border">
                      <div
                        v-for="doc in ksDocs"
                        :key="doc.id"
                        class="flex items-center gap-2 px-3 py-2"
                      >
                        <FileText class="h-4 w-4 text-muted-foreground" />
                        <span class="text-sm flex-1 truncate">{{ doc.name || doc.filename }}</span>
                        <Badge :variant="statusVariant(doc.status || 'ready')">
                          {{ doc.status || 'ready' }}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          @click="
                            knowledgeStore.downloadDocument(
                              selectedKs!.id,
                              doc.id,
                              doc.name || doc.filename || '',
                            )
                          "
                        >
                          <Download class="h-3 w-3" />
                        </Button>
                        <Button
                          v-if="canManage(selectedKs)"
                          variant="ghost"
                          size="icon-xs"
                          class="text-destructive"
                          @click="knowledgeStore.deleteDocument(selectedKs!.id, doc.id)"
                        >
                          <Trash2 class="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div v-else class="text-center text-muted-foreground py-6">
                      <FileText class="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p class="text-sm">No documents uploaded yet</p>
                    </div>
                  </CardContent>
                </Card>
                <div
                  v-else
                  class="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-lg min-h-[240px]"
                >
                  <ArrowLeft class="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p class="text-sm text-muted-foreground">
                    {{ ksRightPanelHint }}
                  </p>
                </div>
              </div>
            </div>
          </template>

          <!-- ── Agents ─────────────────────────────────── -->
          <template v-else-if="activeTab === 'agents'">
            <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
              <h2 class="text-xl font-bold">Agents</h2>
              <Button size="sm" @click="openAgentDialog()">
                <Plus class="h-4 w-4 mr-2" />New Agent
              </Button>
            </div>
            <p class="text-sm text-muted-foreground mb-4">
              Agents combine a system prompt, knowledge stores, and tools.
            </p>

            <div
              v-if="!agentsStore.agents.length"
              class="flex flex-col items-center py-14 text-center"
            >
              <Bot class="h-16 w-16 text-muted-foreground/25 mb-4" />
              <h3 class="text-lg font-semibold mb-2">No agents yet</h3>
              <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
                Agents combine a system prompt, tools, and knowledge stores.
              </p>
              <Button @click="openAgentDialog()"> <Plus class="h-4 w-4 mr-2" />New Agent </Button>
            </div>

            <Card v-else>
              <div class="divide-y divide-border">
                <div
                  v-for="agent in agentsStore.agents"
                  :key="agent.id"
                  class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
                >
                  <Bot class="h-4 w-4 text-muted-foreground shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">
                      {{ agent.name }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ agent.provider || 'No provider' }}
                      <span v-if="agent.providerModel"> · {{ agent.providerModel }}</span>
                      <span v-if="agent.knowledgeStoreIds?.length">
                        · {{ agent.knowledgeStoreIds.length }} KB</span
                      >
                      <span v-if="agent.toolIds?.length"> · {{ agent.toolIds.length }} tools</span>
                    </div>
                  </div>
                  <Badge v-if="agent._sharedWithMe" variant="outline" class="text-[10px]">
                    Shared
                  </Badge>
                  <Button
                    v-if="canManage(agent)"
                    variant="ghost"
                    size="icon-xs"
                    @click.stop="openShareDialog('agent', agent.id, agent.name)"
                  >
                    <Share2 class="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" @click.stop="openAgentDialog(agent)">
                    <Pencil class="h-3 w-3" />
                  </Button>
                  <Button
                    v-if="canManage(agent)"
                    variant="ghost"
                    size="icon-xs"
                    class="text-destructive"
                    @click.stop="agentsStore.deleteAgent(agent.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </template>

          <!-- ── Tools ──────────────────────────────────── -->
          <template v-else-if="activeTab === 'tools'">
            <div class="flex items-center justify-between mb-5 pb-3 border-b-2 border-primary/15">
              <h2 class="text-xl font-bold">Tools</h2>
              <Button size="sm" @click="openToolDialog()">
                <Plus class="h-4 w-4 mr-2" />New Tool
              </Button>
            </div>
            <p class="text-sm text-muted-foreground mb-4">
              Connect tools via MCP, or define custom Python / TypeScript functions.
            </p>

            <div
              v-if="!toolsStore.tools.length"
              class="flex flex-col items-center py-14 text-center"
            >
              <Wrench class="h-16 w-16 text-muted-foreground/25 mb-4" />
              <h3 class="text-lg font-semibold mb-2">No tools yet</h3>
              <p class="text-sm text-muted-foreground mb-6 max-w-[340px]">
                Add MCP tool servers or define custom functions.
              </p>
              <Button @click="openToolDialog()"> <Plus class="h-4 w-4 mr-2" />New Tool </Button>
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
                    <div class="text-sm font-medium truncate">
                      {{ tool.name }}
                    </div>
                    <div class="text-xs text-muted-foreground flex items-center gap-1">
                      <Badge variant="outline" class="text-[10px] px-1.5 py-0">
                        {{ tool.type }}
                      </Badge>
                      {{ tool.description || '' }}
                    </div>
                  </div>
                  <Badge :variant="tool.enabled !== false ? 'success' : 'outline'">
                    {{ tool.enabled !== false ? 'Active' : 'Disabled' }}
                  </Badge>
                  <Badge v-if="tool._sharedWithMe" variant="outline" class="text-[10px]">
                    Shared
                  </Badge>
                  <Button
                    v-if="canManage(tool)"
                    variant="ghost"
                    size="icon-xs"
                    @click.stop="openShareDialog('tool', tool.id, tool.name)"
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
          </template>

          <!-- ── Appearance ─────────────────────────────── -->
          <template v-else-if="activeTab === 'appearance'">
            <h2 class="text-xl font-bold mb-5 pb-3 border-b-2 border-primary/15">Appearance</h2>
            <Card>
              <CardHeader>
                <CardTitle class="text-sm"> Theme Color </CardTitle>
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
          </template>
        </div>
      </ScrollArea>

      <!-- ── Dialogs ───────────────────────────────────── -->

      <!-- Model dialog -->
      <Dialog :open="showModelDialog" @update:open="showModelDialog = $event">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ editingModel?.id ? 'Edit Model' : 'Add Model' }}</DialogTitle>
            <DialogDescription>Configure the model settings below.</DialogDescription>
          </DialogHeader>
          <div class="space-y-3">
            <div>
              <Label class="mb-1.5 block text-xs">Display Name</Label
              ><Input v-model="modelForm.name" placeholder="Display Name" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Type</Label>
              <Select v-model="modelForm.type">
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="model"> Model </SelectItem>
                  <SelectItem value="embedding"> Embedding </SelectItem>
                  <SelectItem value="webhook"> Webhook </SelectItem>
                  <SelectItem value="agent"> Agent </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <template v-if="modelForm.type === 'model' || modelForm.type === 'embedding'">
              <div>
                <Label class="mb-1.5 block text-xs">Provider</Label>
                <Select v-model="modelForm.provider">
                  <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="p in modelForm.type === 'embedding'
                        ? embeddingProviderKeys
                        : providerKeys_list"
                      :key="p"
                      :value="p"
                    >
                      {{ p }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label class="mb-1.5 block text-xs">Model Name</Label
                ><Input
                  v-model="modelForm.providerModel"
                  :placeholder="
                    modelForm.type === 'embedding' ? 'e.g. nomic-embed-text' : 'e.g. gpt-4o'
                  "
                />
              </div>
              <template v-if="modelForm.type === 'embedding'">
                <Separator />
                <p class="text-xs text-muted-foreground">
                  Default chunking & retrieval settings for knowledge stores using this embedding
                  model.
                </p>
                <div class="grid grid-cols-3 gap-3">
                  <div>
                    <Label class="mb-1.5 block text-xs">Chunk Size</Label>
                    <Input v-model.number="modelForm.chunkSize" type="number" placeholder="1000" />
                  </div>
                  <div>
                    <Label class="mb-1.5 block text-xs">Chunk Overlap</Label>
                    <Input
                      v-model.number="modelForm.chunkOverlap"
                      type="number"
                      placeholder="200"
                    />
                  </div>
                  <div>
                    <Label class="mb-1.5 block text-xs">Top K</Label>
                    <Input v-model.number="modelForm.topK" type="number" placeholder="5" />
                  </div>
                </div>
              </template>
              <template v-if="modelForm.type === 'model'">
                <div>
                  <Label class="mb-1.5 block text-xs">System Prompt</Label
                  ><Textarea
                    v-model="modelForm.systemPrompt"
                    placeholder="System prompt…"
                    rows="3"
                  />
                </div>
                <div>
                  <Label class="mb-1.5 block text-xs">Temperature</Label
                  ><Input v-model="modelForm.temperature" type="number" placeholder="0.7" />
                </div>
                <div>
                  <Label class="mb-1.5 block text-xs">Knowledge Stores</Label>
                  <div class="max-h-32 overflow-y-auto space-y-1.5 rounded-md border p-2">
                    <div
                      v-if="!knowledgeStore.knowledgeStores.length"
                      class="text-xs text-muted-foreground py-1"
                    >
                      No knowledge stores available
                    </div>
                    <label
                      v-for="ks in knowledgeStore.knowledgeStores"
                      :key="ks.id"
                      class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
                    >
                      <Checkbox
                        :checked="modelForm.knowledgeStoreIds.includes(ks.id)"
                        @update:checked="toggleModelKs(ks.id)"
                      />
                      <span class="text-xs">{{ ks.name }}</span>
                    </label>
                  </div>
                </div>
              </template>
            </template>
            <template v-else-if="modelForm.type === 'webhook'">
              <div>
                <Label class="mb-1.5 block text-xs">Webhook</Label>
                <Select v-model="modelForm.webhookId">
                  <SelectTrigger><SelectValue placeholder="Select webhook…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="w in webhookItems" :key="w.value" :value="w.value">
                      {{ w.title }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </template>
            <template v-else-if="modelForm.type === 'agent'">
              <div>
                <Label class="mb-1.5 block text-xs">Agent</Label>
                <Select v-model="modelForm.agentId">
                  <SelectTrigger><SelectValue placeholder="Select agent…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="a in agentItems" :key="a.value" :value="a.value">
                      {{ a.title }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </template>
            <div class="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                :model-value="modelForm.enabled"
                @update:model-value="modelForm.enabled = $event"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showModelDialog = false"> Cancel </Button>
            <Button :disabled="!modelForm.name.trim()" @click="saveModel"> Save </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Agent dialog -->
      <Dialog :open="showAgentDialog" @update:open="showAgentDialog = $event">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ editingAgent?.id ? 'Edit Agent' : 'Add Agent' }}</DialogTitle>
            <DialogDescription>Configure agent settings.</DialogDescription>
          </DialogHeader>
          <div class="space-y-3">
            <div>
              <Label class="mb-1.5 block text-xs">Name</Label
              ><Input v-model="agentForm.name" placeholder="Agent name" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Description</Label
              ><Textarea
                v-model="agentForm.description"
                placeholder="Optional description"
                rows="2"
              />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Provider</Label>
              <Select v-model="agentForm.provider">
                <SelectTrigger><SelectValue placeholder="Select provider…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in providerKeys_list" :key="p" :value="p">
                    {{ p }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Model Name</Label
              ><Input v-model="agentForm.providerModel" placeholder="Model name" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">System Prompt</Label
              ><Textarea v-model="agentForm.systemPrompt" placeholder="System prompt…" rows="4" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showAgentDialog = false"> Cancel </Button>
            <Button :disabled="!agentForm.name.trim()" @click="saveAgent"> Save </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Tool dialog -->
      <Dialog :open="showToolDialog" @update:open="showToolDialog = $event">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ editingTool?.id ? 'Edit Tool' : 'Add Tool' }}</DialogTitle>
            <DialogDescription>Configure tool settings.</DialogDescription>
          </DialogHeader>
          <div class="space-y-3">
            <div>
              <Label class="mb-1.5 block text-xs">Name</Label
              ><Input v-model="toolForm.name" placeholder="Tool name" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Description</Label
              ><Textarea v-model="toolForm.description" placeholder="Description" rows="2" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Type</Label>
              <Select v-model="toolForm.type">
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcp"> MCP </SelectItem>
                  <SelectItem value="python"> Python </SelectItem>
                  <SelectItem value="typescript"> TypeScript </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <template v-if="toolForm.type === 'mcp'">
              <div>
                <Label class="mb-1.5 block text-xs">MCP Server URL</Label
                ><Input v-model="toolForm.config.serverUrl" placeholder="https://..." />
              </div>
              <div>
                <Label class="mb-1.5 block text-xs">Tool Name</Label
                ><Input v-model="toolForm.config.toolName" placeholder="Tool name" />
              </div>
            </template>
            <template v-else>
              <div>
                <Label class="mb-1.5 block text-xs">Function Code</Label
                ><Textarea
                  v-model="toolForm.config.code"
                  placeholder="Code…"
                  rows="6"
                  class="font-mono text-xs"
                />
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
            <Button variant="outline" @click="showToolDialog = false"> Cancel </Button>
            <Button :disabled="!toolForm.name.trim()" @click="saveTool"> Save </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Delete model confirmation -->
      <Dialog :open="showDeleteModelDialog" @update:open="showDeleteModelDialog = $event">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Model</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <p class="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{{ deletingModel?.name }}</strong
            >?
          </p>
          <DialogFooter>
            <Button variant="outline" @click="showDeleteModelDialog = false"> Cancel </Button>
            <Button variant="destructive" @click="executeDeleteModel"> Delete </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Create knowledge store dialog -->
      <Dialog :open="showCreateKs" @update:open="showCreateKs = $event">
        <DialogContent class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Knowledge Store</DialogTitle>
            <DialogDescription>Add a new knowledge store for your documents.</DialogDescription>
          </DialogHeader>
          <div class="space-y-3">
            <div>
              <Label class="mb-1.5 block text-xs">Name</Label
              ><Input v-model="newKsName" placeholder="Store name" />
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Description (optional)</Label
              ><Textarea v-model="newKsDesc" placeholder="Description…" rows="2" />
            </div>
            <Separator />
            <p class="text-xs text-muted-foreground">
              Pipeline configuration (pre-filled from defaults)
            </p>
            <div>
              <Label class="mb-1.5 block text-xs">Embedding Model</Label>
              <Select v-model="newKsEmbeddingModelId">
                <SelectTrigger><SelectValue placeholder="Select embedding model…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem :value="null"> Use default </SelectItem>
                  <SelectItem v-for="m in embeddingModels" :key="m.id" :value="m.id">
                    {{ m.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Vector Store</Label>
              <Select v-model="newKsVectorStoreType">
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local"> Local (built-in) </SelectItem>
                  <SelectItem value="chroma"> Chroma </SelectItem>
                </SelectContent>
              </Select>
              <div v-if="newKsVectorStoreType === 'chroma'" class="mt-2">
                <Label class="mb-1.5 block text-xs">Chroma URL</Label>
                <Input v-model="newKsVectorStoreUrl" placeholder="http://localhost:8000" />
              </div>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Document Processor</Label>
              <Select v-model="newKsDocProcessorType">
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="langchain"> LangChain (local) </SelectItem>
                  <SelectItem value="tika"> Apache Tika </SelectItem>
                  <SelectItem value="docling"> Docling </SelectItem>
                </SelectContent>
              </Select>
              <div v-if="newKsDocProcessorType === 'tika'" class="mt-2">
                <Label class="mb-1.5 block text-xs">Tika URL</Label>
                <Input v-model="newKsDocProcessorUrl" placeholder="http://localhost:9998" />
              </div>
              <div v-if="newKsDocProcessorType === 'docling'" class="mt-2">
                <Label class="mb-1.5 block text-xs">Docling URL</Label>
                <Input v-model="newKsDocProcessorUrl" placeholder="http://localhost:5001" />
              </div>
            </div>
            <Separator />
            <p class="text-xs text-muted-foreground">Chunking configuration</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <Label class="mb-1.5 block text-xs">Chunk Size</Label>
                <Input v-model.number="newKsChunkSize" type="number" placeholder="1000" />
              </div>
              <div>
                <Label class="mb-1.5 block text-xs">Chunk Overlap</Label>
                <Input v-model.number="newKsChunkOverlap" type="number" placeholder="100" />
              </div>
            </div>
            <div>
              <Label class="mb-1.5 block text-xs">Chunk Unit</Label>
              <Select v-model="newKsChunkUnit">
                <SelectTrigger><SelectValue placeholder="Select unit…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="characters"> Characters </SelectItem>
                  <SelectItem value="tokens"> Tokens (approximate) </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="showCreateKs = false"> Cancel </Button>
            <Button :disabled="!newKsName.trim()" @click="createKs"> Create </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- Share Dialog -->
      <ShareDialog
        v-model:open="shareDialogOpen"
        :resource-type="shareTarget.type"
        :resource-id="shareTarget.id"
        :resource-label="shareTarget.label"
      />
    </SidebarInset>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useModelsStore } from '../stores/models'
import { useAgentsStore } from '../stores/agents'
import { useToolsStore } from '../stores/tools'
import { useKnowledgeStore } from '../stores/knowledge'
import { useThemeStore } from '../stores/theme'
import { useNotificationStore } from '../stores/notification'
import { useAuthStore } from '../stores/auth'
import type { AiModel, Agent, Tool, KnowledgeStore as KnowledgeStoreType } from '../types'
import ShareDialog from './ShareDialog.vue'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { ScrollArea } from './ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
  SidebarInset,
} from './ui/sidebar'
import { Checkbox } from './ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import {
  ArrowLeft,
  Key,
  Brain,
  Database,
  Bot,
  Wrench,
  Palette,
  Plus,
  Pencil,
  Trash2,
  Save,
  Upload,
  FileText,
  Webhook,
  Zap,
  Code,
  Link,
  HardDrive,
  FileSearch,
  Share2,
  Download,
} from 'lucide-vue-next'

const settingsStore = useSettingsStore()
const authStore = useAuthStore()

function isOwner(resource: { ownerId?: string }) {
  return resource.ownerId === authStore.user?.id
}

function canManage(resource: { ownerId?: string; _sharedWithMe?: boolean }) {
  return isOwner(resource) || authStore.isAdmin
}

const shareDialogOpen = ref(false)
const shareTarget = ref({ type: '', id: '', label: '' })
function openShareDialog(resourceType: string, resourceId: string, label: string) {
  shareTarget.value = { type: resourceType, id: resourceId, label }
  shareDialogOpen.value = true
}
const modelsStore = useModelsStore()
const agentsStore = useAgentsStore()
const toolsStore = useToolsStore()
const knowledgeStore = useKnowledgeStore()
const themeStore = useThemeStore()
const notify = useNotificationStore()

const activeTab = ref('providers')
const saving = ref(false)

const tabs = [
  { value: 'providers', label: 'Providers', icon: Key },
  { value: 'models', label: 'Models', icon: Brain },
  { value: 'vectorstores', label: 'Vector Stores', icon: HardDrive },
  { value: 'docprocessor', label: 'Document Processor', icon: FileSearch },
  { value: 'knowledge', label: 'Knowledge', icon: Database },
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'tools', label: 'Tools', icon: Wrench },
  { value: 'appearance', label: 'Appearance', icon: Palette },
]

const toolIconMap: Record<string, typeof Link> = { mcp: Link, python: Code, typescript: Code }

// ── Provider settings ──────────────────────────────────
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
]

const providerEnabled = reactive<Record<string, boolean>>({})
const providerKeys = reactive<Record<string, string>>({})
const providerUrls = reactive<Record<string, string>>({})
const showKey = reactive<Record<string, boolean>>({})
providers.forEach((p) => {
  providerEnabled[p.key] = false
  providerKeys[p.key] = ''
  providerUrls[p.key] = ''
  showKey[p.key] = false
})

// ── Model sub-tab & defaults ─────────────────────────
const modelSubTab = ref('general')
const defaultModelId = ref<string | null>(null)
const defaultEmbeddingModelId = ref<string | null>(null)

const embeddingModels = computed(() => modelsStore.aiModels.filter((m) => m.type === 'embedding'))
const generalModels = computed(() => modelsStore.aiModels.filter((m) => m.type !== 'embedding'))
const embeddingProviderKeys = computed(() => ['openai', 'ollama'].filter((k) => providerEnabled[k]))

const providerKeys_list = computed(() =>
  providers.filter((p) => providerEnabled[p.key]).map((p) => p.key),
)

// ── Vector Store providers ───────────────────────────
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
]
const vectorStoreEnabled = reactive<Record<string, boolean>>({ local: true, chroma: false })
const vectorStoreUrls = reactive<Record<string, string>>({ chroma: '' })
const defaultVectorStoreType = ref<string | null>('local')
const enabledVectorStores = computed(() =>
  vectorStoreProviders.filter((vs) => vectorStoreEnabled[vs.key]),
)

// ── Document Processor providers ─────────────────────
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
]
const docProcessorEnabled = reactive<Record<string, boolean>>({
  langchain: true,
  tika: false,
  docling: false,
})
const docProcessorUrls = reactive<Record<string, string>>({ tika: '', docling: '' })
const defaultDocProcessorType = ref<string | null>('langchain')
const enabledDocProcessors = computed(() =>
  docProcessorProviders.filter((dp) => docProcessorEnabled[dp.key]),
)

// ── Knowledge store creation form defaults (must be declared before watcher) ──
const newKsEmbeddingModelId = ref<string | null>(null)
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
    newKsChunkSize.value = model.chunkSize ?? 1000
    newKsChunkOverlap.value = model.chunkOverlap ?? 200
    newKsChunkUnit.value = 'characters'
  } else {
    newKsChunkSize.value = 1000
    newKsChunkOverlap.value = 200
    newKsChunkUnit.value = 'characters'
  }
}

watch(
  () => settingsStore.settings,
  (s: Record<string, any>) => {
    if (!s || !Object.keys(s).length) return
    providers.forEach((p) => {
      providerEnabled[p.key] = s[p.key]?.enabled || false
      providerKeys[p.key] = s[p.key]?.apiKey || ''
      providerUrls[p.key] = s[p.key]?.baseUrl || ''
    })
    // Model defaults
    if (s.defaultModelId !== undefined) defaultModelId.value = s.defaultModelId
    if (s.defaultEmbeddingModelId !== undefined)
      defaultEmbeddingModelId.value = s.defaultEmbeddingModelId
    // Vector store settings
    if (s.vectorStores) {
      vectorStoreProviders.forEach((vs) => {
        if (s.vectorStores[vs.key] !== undefined) {
          vectorStoreEnabled[vs.key] = s.vectorStores[vs.key].enabled !== false
          if (s.vectorStores[vs.key].url) vectorStoreUrls[vs.key] = s.vectorStores[vs.key].url
        }
      })
    } else if (s.defaultVectorStoreConfig) {
      // Backward compat: migrate old format
      const t = s.defaultVectorStoreConfig.type || 'local'
      vectorStoreEnabled[t] = true
      if (s.defaultVectorStoreConfig.url) vectorStoreUrls[t] = s.defaultVectorStoreConfig.url
    }
    if (s.defaultVectorStoreType) defaultVectorStoreType.value = s.defaultVectorStoreType
    else if (s.defaultVectorStoreConfig?.type)
      defaultVectorStoreType.value = s.defaultVectorStoreConfig.type
    // Document processor settings
    if (s.documentProcessors) {
      docProcessorProviders.forEach((dp) => {
        if (s.documentProcessors[dp.key] !== undefined) {
          docProcessorEnabled[dp.key] = s.documentProcessors[dp.key].enabled !== false
          if (s.documentProcessors[dp.key].url)
            docProcessorUrls[dp.key] = s.documentProcessors[dp.key].url
        }
      })
    } else if (s.defaultDocumentProcessorConfig) {
      // Backward compat: migrate old format
      const t = s.defaultDocumentProcessorConfig.type || 'langchain'
      docProcessorEnabled[t] = true
      if (s.defaultDocumentProcessorConfig.url)
        docProcessorUrls[t] = s.defaultDocumentProcessorConfig.url
    }
    if (s.defaultDocumentProcessorType)
      defaultDocProcessorType.value = s.defaultDocumentProcessorType
    else if (s.defaultDocumentProcessorConfig?.type)
      defaultDocProcessorType.value = s.defaultDocumentProcessorConfig.type
    // Sync KS creation form defaults
    newKsEmbeddingModelId.value = defaultEmbeddingModelId.value
    newKsVectorStoreType.value = defaultVectorStoreType.value || 'local'
    newKsVectorStoreUrl.value = vectorStoreUrls[defaultVectorStoreType.value || ''] || ''
    newKsDocProcessorType.value = defaultDocProcessorType.value || 'langchain'
    newKsDocProcessorUrl.value = docProcessorUrls[defaultDocProcessorType.value || ''] || ''
    syncChunkFromEmbeddingModel(newKsEmbeddingModelId.value)
  },
  { immediate: true, deep: true },
)

async function saveProviderSettings() {
  saving.value = true
  const providerData: Record<string, { enabled: boolean; apiKey: string; baseUrl: string }> = {}
  providers.forEach((p) => {
    providerData[p.key] = {
      enabled: providerEnabled[p.key],
      apiKey: providerKeys[p.key],
      baseUrl: providerUrls[p.key],
    }
  })
  try {
    await settingsStore.saveSettings(providerData)
    notify.success('Settings saved successfully!')
  } catch (e) {
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

function toggleModelKs(ksId: string) {
  const idx = modelForm.knowledgeStoreIds.indexOf(ksId)
  if (idx >= 0) modelForm.knowledgeStoreIds.splice(idx, 1)
  else modelForm.knowledgeStoreIds.push(ksId)
}

async function saveVectorStoreSettings() {
  saving.value = true
  const vsData: Record<string, { enabled: boolean; url?: string }> = {}
  vectorStoreProviders.forEach((vs) => {
    vsData[vs.key] = { enabled: vectorStoreEnabled[vs.key] }
    if (vectorStoreUrls[vs.key]) vsData[vs.key].url = vectorStoreUrls[vs.key]
  })
  try {
    await settingsStore.saveSettings({
      vectorStores: vsData,
      defaultVectorStoreType: defaultVectorStoreType.value,
      // Keep backward compat fields
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
      // Keep backward compat fields
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

// ── Model dialog ───────────────────────────────────
const showModelDialog = ref(false)
const editingModel = ref<AiModel | null>(null)
const modelForm = reactive({
  name: '',
  type: 'chat' as AiModel['type'],
  provider: null as string | null,
  providerModel: '',
  systemPrompt: '',
  temperature: 0.7,
  knowledgeStoreIds: [] as string[],
  toolIds: [] as string[],
  webhookId: null as string | null,
  agentId: null as string | null,
  enabled: true,
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
})
const showDeleteModelDialog = ref(false)
const deletingModel = ref<AiModel | null>(null)

const knowledgeStoreItems = computed(() =>
  knowledgeStore.knowledgeStores.map((k: KnowledgeStoreType) => ({ title: k.name, value: k.id })),
)
const toolItems = computed(() =>
  toolsStore.tools.map((t: Tool) => ({ title: t.name, value: t.id })),
)
const webhookItems = computed(() =>
  settingsStore.webhooks.map((w: { id: string; name?: string }) => ({
    title: w.name,
    value: w.id,
  })),
)
const agentItems = computed(() =>
  agentsStore.agents.map((a: Agent) => ({ title: a.name, value: a.id })),
)

function openModelDialog(model: AiModel | null = null, defaultType: AiModel['type'] = 'model') {
  editingModel.value = model
  if (model) {
    Object.assign(modelForm, {
      name: model.name,
      type: model.type || ('model' as AiModel['type']),
      provider: model.provider || null,
      providerModel: model.providerModel || '',
      systemPrompt: model.systemPrompt || '',
      temperature: model.temperature ?? 0.7,
      knowledgeStoreIds: model.knowledgeStoreIds || [],
      toolIds: model.toolIds || [],
      webhookId: model.webhookId || null,
      agentId: model.agentId || null,
      enabled: model.enabled !== false,
      chunkSize: model.chunkSize ?? 1000,
      chunkOverlap: model.chunkOverlap ?? 200,
      topK: model.topK ?? 5,
    })
  } else {
    // Pre-fill provider with first enabled provider
    const firstProvider =
      defaultType === 'embedding'
        ? embeddingProviderKeys.value.length
          ? embeddingProviderKeys.value[0]
          : null
        : providerKeys_list.value.length
          ? providerKeys_list.value[0]
          : null
    Object.assign(modelForm, {
      name: '',
      type: defaultType,
      provider: firstProvider,
      providerModel: '',
      systemPrompt: '',
      temperature: 0.7,
      knowledgeStoreIds: [],
      toolIds: [],
      webhookId: null,
      agentId: null,
      enabled: true,
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 5,
    })
  }
  showModelDialog.value = true
}

async function saveModel() {
  const payload = { ...modelForm, provider: modelForm.provider || undefined }
  try {
    if (editingModel.value?.id) {
      await modelsStore.updateModel(editingModel.value.id, payload)
      notify.success('Model updated!')
    } else {
      await modelsStore.createModel(payload)
      notify.success('Model created!')
    }
    showModelDialog.value = false
  } catch {
    notify.error('Failed to save model.')
  }
}

function confirmDeleteModel(model: AiModel) {
  deletingModel.value = model
  showDeleteModelDialog.value = true
}
async function executeDeleteModel() {
  if (deletingModel.value) {
    await modelsStore.deleteModel(deletingModel.value.id)
    notify.success('Model deleted.')
  }
  showDeleteModelDialog.value = false
  deletingModel.value = null
}

// ── Agent dialog ───────────────────────────────────
const showAgentDialog = ref(false)
const editingAgent = ref<Agent | null>(null)
const agentForm = reactive({
  name: '',
  description: '',
  provider: null as string | null,
  providerModel: '',
  systemPrompt: '',
  knowledgeStoreIds: [] as string[],
  toolIds: [] as string[],
})

function openAgentDialog(agent: Agent | null = null) {
  editingAgent.value = agent
  if (agent)
    Object.assign(agentForm, {
      name: agent.name,
      description: agent.description || '',
      provider: agent.provider || null,
      providerModel: agent.providerModel || '',
      systemPrompt: agent.systemPrompt || '',
      knowledgeStoreIds: agent.knowledgeStoreIds || [],
      toolIds: agent.toolIds || [],
    })
  else
    Object.assign(agentForm, {
      name: '',
      description: '',
      provider: null,
      providerModel: '',
      systemPrompt: '',
      knowledgeStoreIds: [],
      toolIds: [],
    })
  showAgentDialog.value = true
}

async function saveAgent() {
  const payload = { ...agentForm, provider: agentForm.provider || undefined }
  try {
    if (editingAgent.value?.id) {
      await agentsStore.updateAgent(editingAgent.value.id, payload)
      notify.success('Agent updated!')
    } else {
      await agentsStore.createAgent(payload)
      notify.success('Agent created!')
    }
    showAgentDialog.value = false
  } catch {
    notify.error('Failed to save agent.')
  }
}

// ── Tool dialog ────────────────────────────────────
const showToolDialog = ref(false)
const editingTool = ref<Tool | null>(null)
const toolForm = reactive({
  name: '',
  description: '',
  type: 'mcp',
  config: { serverUrl: '', toolName: '', code: '' },
  enabled: true,
})

function openToolDialog(tool: Tool | null = null) {
  editingTool.value = tool
  if (tool)
    Object.assign(toolForm, {
      name: tool.name,
      description: tool.description || '',
      type: tool.type,
      config: {
        serverUrl: tool.config?.serverUrl || '',
        toolName: tool.config?.toolName || '',
        code: tool.config?.code || '',
      },
      enabled: tool.enabled !== false,
    })
  else
    Object.assign(toolForm, {
      name: '',
      description: '',
      type: 'mcp',
      config: { serverUrl: '', toolName: '', code: '' },
      enabled: true,
    })
  showToolDialog.value = true
}

async function saveTool() {
  const payload = { ...toolForm, config: { ...toolForm.config } }
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

// ── Knowledge stores ───────────────────────────────
const selectedKs = ref<KnowledgeStoreType | null>(null)
const showCreateKs = ref(false)
const newKsName = ref('')
const newKsDesc = ref('')
watch(newKsEmbeddingModelId, (modelId) => {
  syncChunkFromEmbeddingModel(modelId)
})
const isDragging = ref(false)
const docInput = ref<HTMLInputElement | null>(null)
const ksDocs = computed(() =>
  selectedKs.value ? knowledgeStore.documents[selectedKs.value.id] || [] : [],
)
const ksRightPanelHint = computed(() =>
  knowledgeStore.knowledgeStores.length
    ? 'Select a store to manage its documents'
    : 'Create a knowledge store first',
)

async function selectKs(ks: KnowledgeStoreType) {
  selectedKs.value = ks
  await knowledgeStore.loadDocuments(ks.id)
}
async function createKs() {
  const vectorStoreConfig: Record<string, string> = { type: newKsVectorStoreType.value }
  if (newKsVectorStoreType.value === 'chroma' && newKsVectorStoreUrl.value)
    vectorStoreConfig.url = newKsVectorStoreUrl.value
  const documentProcessorConfig: Record<string, string> = { type: newKsDocProcessorType.value }
  if (
    (newKsDocProcessorType.value === 'tika' || newKsDocProcessorType.value === 'docling') &&
    newKsDocProcessorUrl.value
  )
    documentProcessorConfig.url = newKsDocProcessorUrl.value
  await knowledgeStore.createKnowledgeStore(newKsName.value, newKsDesc.value, {
    embeddingModelId: newKsEmbeddingModelId.value,
    vectorStoreConfig,
    documentProcessorConfig,
    chunkSize: newKsChunkSize.value || 1000,
    chunkOverlap: newKsChunkOverlap.value || 100,
    chunkUnit: newKsChunkUnit.value || 'characters',
  })
  showCreateKs.value = false
  newKsName.value = ''
  newKsDesc.value = ''
  // Reset to defaults
  newKsEmbeddingModelId.value = defaultEmbeddingModelId.value
  newKsVectorStoreType.value = defaultVectorStoreType.value || 'local'
  newKsVectorStoreUrl.value = vectorStoreUrls[defaultVectorStoreType.value || ''] || ''
  newKsDocProcessorType.value = defaultDocProcessorType.value || 'langchain'
  newKsDocProcessorUrl.value = docProcessorUrls[defaultDocProcessorType.value || ''] || ''
}
async function handleDrop(e: DragEvent) {
  isDragging.value = false
  if (!selectedKs.value || !e.dataTransfer) return
  for (const file of Array.from(e.dataTransfer.files))
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}
async function handleFileSelect(e: Event) {
  if (!selectedKs.value) return
  const target = e.target as HTMLInputElement
  if (!target.files) return
  for (const file of Array.from(target.files))
    await knowledgeStore.uploadDocument(selectedKs.value.id, file)
}
function statusVariant(status: string) {
  return (
    (
      {
        ready: 'success',
        indexed: 'success',
        processing: 'warning',
        failed: 'destructive',
        error: 'destructive',
      } as Record<string, string>
    )[status] || 'outline'
  )
}

onMounted(async () => {
  await Promise.all([
    settingsStore.loadSettings(),
    settingsStore.loadWebhooks(),
    modelsStore.loadModels(),
    agentsStore.loadAgents(),
    toolsStore.loadTools(),
    knowledgeStore.loadKnowledgeStores(),
  ])
})
</script>
