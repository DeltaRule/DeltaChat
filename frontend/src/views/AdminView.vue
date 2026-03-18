<template>
  <div class="h-full overflow-auto">
    <div class="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 class="text-2xl font-bold">Administration</h1>
        <p class="text-sm text-muted-foreground mt-1">Manage users, groups, and resource sharing</p>
      </div>

      <Tabs v-model="activeTab" class="space-y-4">
        <TabsList>
          <TabsTrigger value="users"> Users </TabsTrigger>
          <TabsTrigger value="groups"> Groups </TabsTrigger>
        </TabsList>

        <!-- Users Tab -->
        <TabsContent value="users" class="space-y-4">
          <div v-if="usersStore.loading" class="flex justify-center py-12">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <div v-else class="rounded-lg border border-border">
            <div
              class="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span class="text-right">Actions</span>
            </div>
            <div
              v-if="usersStore.users.length === 0"
              class="px-4 py-8 text-center text-sm text-muted-foreground"
            >
              No users registered yet
            </div>
            <div
              v-for="user in usersStore.users"
              :key="user.id"
              class="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-b-0"
            >
              <span class="text-sm font-medium truncate">{{ user.name || '—' }}</span>
              <span class="text-sm text-muted-foreground truncate">{{ user.email }}</span>
              <Badge :variant="user.role === 'admin' ? 'default' : 'secondary'" class="capitalize">
                {{ user.role }}
              </Badge>
              <Badge :variant="user.disabled ? 'destructive' : 'success'">
                {{ user.disabled ? 'Disabled' : 'Active' }}
              </Badge>
              <div class="flex items-center gap-1 justify-end">
                <Button
                  v-if="user.id !== authStore.user?.id"
                  variant="ghost"
                  size="icon-sm"
                  :title="user.role === 'admin' ? 'Demote to user' : 'Promote to admin'"
                  @click="toggleRole(user)"
                >
                  <ShieldCheck v-if="user.role === 'user'" class="h-4 w-4" />
                  <ShieldMinus v-else class="h-4 w-4" />
                </Button>
                <Button
                  v-if="user.id !== authStore.user?.id"
                  variant="ghost"
                  size="icon-sm"
                  :title="user.disabled ? 'Enable user' : 'Disable user'"
                  @click="toggleDisabled(user)"
                >
                  <UserCheck v-if="user.disabled" class="h-4 w-4" />
                  <UserX v-else class="h-4 w-4" />
                </Button>
                <Button
                  v-if="user.id !== authStore.user?.id"
                  variant="ghost"
                  size="icon-sm"
                  class="text-destructive hover:text-destructive"
                  @click="confirmDeleteUser(user)"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- Groups Tab -->
        <TabsContent value="groups" class="space-y-4">
          <div class="flex justify-end">
            <Button size="sm" @click="showCreateGroup = true">
              <Plus class="h-4 w-4 mr-1" /> New Group
            </Button>
          </div>

          <div v-if="groupsStore.loading" class="flex justify-center py-12">
            <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <div
            v-else-if="groupsStore.groups.length === 0"
            class="text-center py-12 text-sm text-muted-foreground"
          >
            No groups created yet
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="group in groupsStore.groups"
              :key="group.id"
              class="rounded-lg border border-border p-4 space-y-3"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-sm">
                    {{ group.name }}
                  </h3>
                  <p v-if="group.description" class="text-xs text-muted-foreground mt-0.5">
                    {{ group.description }}
                  </p>
                </div>
                <div class="flex items-center gap-1">
                  <Badge variant="secondary"> {{ (group.memberIds || []).length }} members </Badge>
                  <Button variant="ghost" size="icon-sm" @click="editGroup(group)">
                    <Pencil class="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="text-destructive hover:text-destructive"
                    @click="confirmDeleteGroup(group)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <!-- Members -->
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-muted-foreground">Members</span>
                  <Button variant="ghost" size="icon-sm" @click="openAddMember(group)">
                    <Plus class="h-3 w-3" />
                  </Button>
                </div>
                <div
                  v-if="(group.memberIds || []).length === 0"
                  class="text-xs text-muted-foreground pl-2"
                >
                  No members
                </div>
                <div v-else class="flex flex-wrap gap-1">
                  <Badge
                    v-for="memberId in group.memberIds"
                    :key="memberId"
                    variant="outline"
                    class="gap-1"
                  >
                    {{ getUserName(memberId) }}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      class="ml-1 h-4 w-4 p-0 hover:text-destructive"
                      aria-label="Remove member"
                      @click="removeMember(group.id, memberId)"
                    >
                      <X class="h-3 w-3" />
                    </Button>
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>

    <!-- Create Group Dialog -->
    <Dialog :open="showCreateGroup" @update:open="showCreateGroup = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editingGroup ? 'Edit Group' : 'Create Group' }}</DialogTitle>
          <DialogDescription>
            {{ editingGroup ? 'Update group details' : 'Create a new user group' }}
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="handleSaveGroup">
          <div class="space-y-2">
            <Label for="group-name">Name</Label>
            <Input id="group-name" v-model="groupForm.name" placeholder="Group name" required />
          </div>
          <div class="space-y-2">
            <Label for="group-desc">Description</Label>
            <Input
              id="group-desc"
              v-model="groupForm.description"
              placeholder="Optional description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="showCreateGroup = false">
              Cancel
            </Button>
            <Button type="submit" :disabled="!groupForm.name.trim()">
              {{ editingGroup ? 'Save' : 'Create' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Add Member Dialog -->
    <Dialog :open="showAddMember" @update:open="showAddMember = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
          <DialogDescription>Select users to add to "{{ addMemberGroup?.name }}"</DialogDescription>
        </DialogHeader>
        <div class="space-y-2 max-h-64 overflow-auto">
          <div
            v-for="user in availableMembers"
            :key="user.id"
            class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
            @click="toggleMemberSelection(user.id)"
          >
            <Checkbox :checked="selectedMembers.includes(user.id)" />
            <div>
              <div class="text-sm font-medium">
                {{ user.name || user.email }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ user.email }}
              </div>
            </div>
          </div>
          <div
            v-if="availableMembers.length === 0"
            class="text-sm text-muted-foreground text-center py-4"
          >
            All users are already members
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showAddMember = false"> Cancel </Button>
          <Button :disabled="selectedMembers.length === 0" @click="handleAddMembers">
            Add {{ selectedMembers.length }} member{{ selectedMembers.length !== 1 ? 's' : '' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog :open="!!confirmDelete" @update:open="!$event && (confirmDelete = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete
            {{ confirmDelete?.type === 'user' ? 'user' : 'group' }} "{{ confirmDelete?.name }}"?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirmDelete = null"> Cancel </Button>
          <Button variant="destructive" @click="handleDelete"> Delete </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Loader2,
  ShieldCheck,
  ShieldMinus,
  UserCheck,
  UserX,
  Trash2,
  Plus,
  Pencil,
  X,
} from 'lucide-vue-next'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { useAuthStore } from '../stores/auth'
import { useUsersStore } from '../stores/users'
import { useUserGroupsStore } from '../stores/userGroups'
import type { User, UserGroup } from '../types'

const authStore = useAuthStore()
const usersStore = useUsersStore()
const groupsStore = useUserGroupsStore()

const activeTab = ref('users')
const showCreateGroup = ref(false)
const editingGroup = ref<UserGroup | null>(null)
const groupForm = ref({ name: '', description: '' })

const showAddMember = ref(false)
const addMemberGroup = ref<UserGroup | null>(null)
const selectedMembers = ref<string[]>([])

const confirmDelete = ref<{ type: string; id: string; name: string } | null>(null)

const availableMembers = computed(() => {
  if (!addMemberGroup.value) return []
  const existing = addMemberGroup.value.memberIds || []
  return usersStore.users.filter((u) => !existing.includes(u.id) && !u.disabled)
})

function getUserName(userId: string) {
  const user = usersStore.users.find((u) => u.id === userId)
  return user ? user.name || user.email : userId.slice(0, 8)
}

async function toggleRole(user: User) {
  await usersStore.updateRole(user.id, user.role === 'admin' ? 'user' : 'admin')
}

async function toggleDisabled(user: User) {
  await usersStore.toggleDisabled(user.id, !user.disabled)
}

function confirmDeleteUser(user: User) {
  confirmDelete.value = { type: 'user', id: user.id, name: user.name || user.email }
}

function confirmDeleteGroup(group: UserGroup) {
  confirmDelete.value = { type: 'group', id: group.id, name: group.name }
}

async function handleDelete() {
  if (!confirmDelete.value) return
  if (confirmDelete.value.type === 'user') {
    await usersStore.deleteUser(confirmDelete.value.id)
  } else {
    await groupsStore.deleteGroup(confirmDelete.value.id)
  }
  confirmDelete.value = null
}

function editGroup(group: UserGroup) {
  editingGroup.value = group
  groupForm.value = { name: group.name, description: group.description || '' }
  showCreateGroup.value = true
}

async function handleSaveGroup() {
  if (editingGroup.value) {
    await groupsStore.updateGroup(editingGroup.value.id, groupForm.value)
  } else {
    await groupsStore.createGroup(groupForm.value.name, groupForm.value.description)
  }
  showCreateGroup.value = false
  editingGroup.value = null
  groupForm.value = { name: '', description: '' }
}

function openAddMember(group: UserGroup) {
  addMemberGroup.value = group
  selectedMembers.value = []
  showAddMember.value = true
}

function toggleMemberSelection(userId: string) {
  const idx = selectedMembers.value.indexOf(userId)
  if (idx === -1) selectedMembers.value.push(userId)
  else selectedMembers.value.splice(idx, 1)
}

async function handleAddMembers() {
  if (!addMemberGroup.value) return
  await groupsStore.addMembers(addMemberGroup.value.id, selectedMembers.value)
  showAddMember.value = false
}

async function removeMember(groupId: string, memberId: string) {
  await groupsStore.removeMembers(groupId, [memberId])
}

onMounted(() => {
  usersStore.loadUsers()
  groupsStore.loadGroups()
})
</script>
