import { writable } from 'svelte/store'

export interface GroupPermission {
  sendMessages: boolean
  addMembers: boolean
  removeMembers: boolean
  editGroup: boolean
  deleteGroup: boolean
  changePermissions: boolean
}

export interface GroupMember {
  id: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: number
  permissions?: GroupPermission
}

export interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  members: GroupMember[]
  owner: string // user ID of owner
  admins: string[] // array of admin user IDs
  createdAt: number
  updatedAt: number
  settings: {
    public: boolean
    requireApproval: boolean
    allowMemberInvite: boolean
  }
}

export const groupsMap = writable<Record<string, Group>>({})
export const currentGroupMembers = writable<GroupMember[]>([])

export function getGroupPermissions(group: Group, userId: string): GroupPermission {
  const member = group.members.find(m => m.id === userId)
  
  if (!member) {
    return {
      sendMessages: false,
      addMembers: false,
      removeMembers: false,
      editGroup: false,
      deleteGroup: false,
      changePermissions: false
    }
  }

  // Owner has all permissions
  if (member.role === 'owner') {
    return {
      sendMessages: true,
      addMembers: true,
      removeMembers: true,
      editGroup: true,
      deleteGroup: true,
      changePermissions: true
    }
  }

  // Admin has most permissions
  if (member.role === 'admin') {
    return {
      sendMessages: true,
      addMembers: true,
      removeMembers: true,
      editGroup: true,
      deleteGroup: false,
      changePermissions: false
    }
  }

  // Members have basic permissions
  return {
    sendMessages: true,
    addMembers: group.settings.allowMemberInvite,
    removeMembers: false,
    editGroup: false,
    deleteGroup: false,
    changePermissions: false
  }
}

export function isGroupOwner(group: Group, userId: string): boolean {
  return group.owner === userId
}

export function isGroupAdmin(group: Group, userId: string): boolean {
  return group.owner === userId || group.admins.includes(userId)
}

export function updateGroup(groupId: string, updates: Partial<Group>) {
  groupsMap.update(map => ({
    ...map,
    [groupId]: { ...map[groupId], ...updates, updatedAt: Date.now() }
  }))
}

export function addGroupMember(groupId: string, member: GroupMember) {
  groupsMap.update(map => {
    const group = map[groupId]
    if (!group) return map
    
    return {
      ...map,
      [groupId]: {
        ...group,
        members: [...group.members, member],
        updatedAt: Date.now()
      }
    }
  })
}

export function removeGroupMember(groupId: string, memberId: string) {
  groupsMap.update(map => {
    const group = map[groupId]
    if (!group) return map
    
    return {
      ...map,
      [groupId]: {
        ...group,
        members: group.members.filter(m => m.id !== memberId),
        admins: group.admins.filter(id => id !== memberId),
        updatedAt: Date.now()
      }
    }
  })
}

export function promoteToAdmin(groupId: string, memberId: string) {
  groupsMap.update(map => {
    const group = map[groupId]
    if (!group) return map
    
    const updatedAdmins = [...group.admins]
    if (!updatedAdmins.includes(memberId)) {
      updatedAdmins.push(memberId)
    }
    
    const updatedMembers = group.members.map(m =>
      m.id === memberId ? { ...m, role: 'admin' as const } : m
    )
    
    return {
      ...map,
      [groupId]: {
        ...group,
        members: updatedMembers,
        admins: updatedAdmins,
        updatedAt: Date.now()
      }
    }
  })
}

export function demoteFromAdmin(groupId: string, memberId: string) {
  groupsMap.update(map => {
    const group = map[groupId]
    if (!group) return map
    
    return {
      ...map,
      [groupId]: {
        ...group,
        members: group.members.map(m =>
          m.id === memberId ? { ...m, role: 'member' as const } : m
        ),
        admins: group.admins.filter(id => id !== memberId),
        updatedAt: Date.now()
      }
    }
  })
}
