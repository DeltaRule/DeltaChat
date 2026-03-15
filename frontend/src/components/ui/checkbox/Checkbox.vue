<script setup>
import { computed } from 'vue'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'
import { Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps({
  defaultChecked: { type: Boolean },
  checked: { type: [Boolean, String] },
  disabled: { type: Boolean },
  required: { type: Boolean },
  name: { type: String },
  value: { type: String },
  id: { type: String },
  class: { type: [String, Array, Object] },
})

const emits = defineEmits(['update:checked'])

const modelValue = computed({
  get: () => props.checked,
  set: (val) => emits('update:checked', val),
})
</script>

<template>
  <CheckboxRoot
    v-model="modelValue"
    :disabled="disabled"
    :required="required"
    :name="name"
    :value="value"
    :id="id"
    :class="cn(
      'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer',
      props.class,
    )"
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Check class="h-3.5 w-3.5" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
