<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Share {{ resourceLabel }}</DialogTitle>
        <DialogDescription>Manage who has access to this resource</DialogDescription>
      </DialogHeader>

      <!-- Current shares -->
      <div class="space-y-3">
        <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Shared with
        </div>
        <div v-if="sharingStore.loading" class="flex justify-center py-4">
          <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
        <div
          v-else-if="sharingStore.shares.length === 0"
          class="text-sm text-muted-foreground text-center py-4"
        >
          Not shared with anyone yet
        </div>
        <div v-else class="space-y-1 max-h-40 overflow-auto">
          <div
            v-for="share in sharingStore.shares"
            :key="share.id"
            class="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/50"
          >
            <div class="flex items-center gap-2">
              <Users v-if="share.targetType === 'group'" class="h-4 w-4 text-muted-foreground" />
              <User v-else class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm">{{ getTargetName(share) }}</span>
              <Badge variant="outline" class="text-xs">
                {{ share.targetType }}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-destructive hover:text-destructive"
              @click="handleUnshare(share.id)"
            >
              <X class="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <!-- Add share -->
      <div class="space-y-3">
        <div class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Add access
        </div>
        <Tabs v-model="shareTab" class="space-y-3">
          <TabsList class="w-full">
            <TabsTrigger value="user" class="flex-1"> User </TabsTrigger>
            <TabsTrigger value="group" class="flex-1"> Group </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <div class="space-y-2 max-h-40 overflow-auto">
              <div
                v-for="user in unsharableUsers"
                :key="user.id"
                class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                @click="handleShare('user', user.id)"
              >
                <div>
                  <div class="text-sm font-medium">
                    {{ user.name || user.email }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ user.email }}
                  </div>
                </div>
                <Plus class="h-4 w-4 text-muted-foreground" />
              </div>
              <div
                v-if="unsharableUsers.length === 0"
                class="text-sm text-muted-foreground text-center py-3"
              >
                Shared with all users
              </div>
            </div>
          </TabsContent>

          <TabsContent value="group">
            <div class="space-y-2 max-h-40 overflow-auto">
              <div
                v-for="group in unsharableGroups"
                :key="group.id"
                class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
                @click="handleShare('group', group.id)"
              >
                <div>
                  <div class="text-sm font-medium">
                    {{ group.name }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ (group.memberIds || []).length }} members
                  </div>
                </div>
                <Plus class="h-4 w-4 text-muted-foreground" />
              </div>
              <div
                v-if="unsharableGroups.length === 0"
                class="text-sm text-muted-foreground text-center py-3"
              >
                {{
                  groupsStore.groups.length === 0
                    ? 'No groups created yet'
                    : 'Shared with all groups'
                }}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)"> Done </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Loader2, User, Users, X, Plus } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useSharingStore } from '../stores/sharing'
import { useUsersStore } from '../stores/users'
import { useUserGroupsStore } from '../stores/userGroups'

import type { Share } from '../types'

const props = defineProps({
  open: Boolean,
  resourceType: String,
  resourceId: String,
  resourceLabel: { type: String, default: 'Resource' },
})

const emit = defineEmits(['update:open'])

const sharingStore = useSharingStore()
const usersStore = useUsersStore()
const groupsStore = useUserGroupsStore()

const shareTab = ref('user')

const unsharableUsers = computed(() => {
  const sharedUserIds = sharingStore.shares
    .filter((s) => s.targetType === 'user')
    .map((s) => s.targetId)
  return usersStore.users.filter((u) => !sharedUserIds.includes(u.id) && !u.disabled)
})

const unsharableGroups = computed(() => {
  const sharedGroupIds = sharingStore.shares
    .filter((s) => s.targetType === 'group')
    .map((s) => s.targetId)
  return groupsStore.groups.filter((g) => !sharedGroupIds.includes(g.id))
})

function getTargetName(share: Share) {
  if (share.targetType === 'user') {
    const user = usersStore.users.find((u) => u.id === share.targetId)
    return user ? user.name || user.email : share.targetId.slice(0, 8)
  }
  const group = groupsStore.groups.find((g) => g.id === share.targetId)
  return group ? group.name : share.targetId.slice(0, 8)
}

async function handleShare(targetType: string, targetId: string) {
  await sharingStore.shareResource(props.resourceType!, props.resourceId!, targetType, targetId)
}

async function handleUnshare(shareId: string) {
  await sharingStore.unshare(shareId)
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.resourceType && props.resourceId) {
      sharingStore.loadShares(props.resourceType, props.resourceId)
      if (usersStore.users.length === 0) usersStore.loadUsers()
      if (groupsStore.groups.length === 0) groupsStore.loadGroups()
    }
  },
)
</script>
