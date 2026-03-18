<script setup lang="ts">
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const props = defineProps({
  class: { type: [String, Object, Array], required: false },
})
</script>

<template>
  <Separator data-slot="sidebar-separator" :class="cn('bg-sidebar-border w-auto', props.class)" />
</template>
