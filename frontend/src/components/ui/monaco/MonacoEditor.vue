<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import loader from '@monaco-editor/loader'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: string
    height?: string
    options?: Record<string, unknown>
  }>(),
  {
    language: 'plaintext',
    height: '240px',
    options: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)
let monacoEditor: any = null
let monacoModel: any = null
let monacoInstance: any = null

onMounted(async () => {
  monacoInstance = await loader.init()

  if (!containerRef.value) return

  monacoModel = monacoInstance.editor.createModel(props.modelValue || '', props.language)
  monacoEditor = monacoInstance.editor.create(containerRef.value, {
    model: monacoModel,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    tabSize: 2,
    ...props.options,
  })

  monacoEditor.onDidChangeModelContent(() => {
    const value = monacoModel.getValue()
    emit('update:modelValue', value)
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!monacoModel) return
    const currentValue = monacoModel.getValue()
    if (value !== currentValue) {
      monacoModel.setValue(value || '')
    }
  },
)

watch(
  () => props.language,
  (language) => {
    if (!monacoModel || !monacoInstance) return
    monacoInstance.editor.setModelLanguage(monacoModel, language || 'plaintext')
  },
)

onBeforeUnmount(() => {
  if (monacoEditor) monacoEditor.dispose()
  if (monacoModel) monacoModel.dispose()
})
</script>

<template>
  <div
    ref="containerRef"
    class="w-full rounded-md border border-input overflow-hidden"
    :style="{ height: props.height }"
  />
</template>
