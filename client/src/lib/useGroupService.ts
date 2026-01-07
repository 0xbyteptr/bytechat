/**
 * Groups and message reactions service
 */

export interface Group {
  id: string
  name: string
  members: string[]
  admin: string
}

export interface GroupServiceContext {
  API_URL: string
  id: string
  sessionToken: string
}

export function createGroupService(context: GroupServiceContext) {
  let groups: Group[] = []
  let pinnedMap: Record<string, string[]> = {}

  async function fetchGroups(): Promise<Group[]> {
    try {
      const res = await fetch(`${context.API_URL}/groups?id=${encodeURIComponent(context.id)}`, {
        headers: {
          Authorization: `Bearer ${context.sessionToken}`
        }
      })

      if (res.ok) {
        const data = await res.json()
        groups = data
        return groups
      } else {
        console.warn('Failed to fetch groups')
        return []
      }
    } catch (e) {
      console.error('Error fetching groups:', e)
      return []
    }
  }

  async function createGroup(name: string, members: string[]): Promise<Group | null> {
    try {
      const res = await fetch(`${context.API_URL}/group/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.sessionToken}`,
          'X-ByteChat-ID': context.id
        },
        body: JSON.stringify({ name, members })
      })

      if (res.ok) {
        const group = await res.json()
        groups.push(group)
        return group
      } else {
        console.error('Failed to create group')
        return null
      }
    } catch (e) {
      console.error('Error creating group:', e)
      return null
    }
  }

  function togglePin(chatId: string, messageId: string) {
    if (!pinnedMap[chatId]) {
      pinnedMap[chatId] = []
    }

    const pins = new Set(pinnedMap[chatId])
    if (pins.has(messageId)) {
      pins.delete(messageId)
    } else {
      pins.add(messageId)
    }
    pinnedMap[chatId] = Array.from(pins)
  }

  function isPinned(chatId: string, messageId: string): boolean {
    return new Set(pinnedMap[chatId] || []).has(messageId)
  }

  function getPinnedMessages(chatId: string): string[] {
    return pinnedMap[chatId] || []
  }

  function getAllGroups(): Group[] {
    return [...groups]
  }

  function getGroup(groupId: string): Group | undefined {
    return groups.find((g) => g.id === groupId)
  }

  return {
    fetchGroups,
    createGroup,
    togglePin,
    isPinned,
    getPinnedMessages,
    getAllGroups,
    getGroup
  }
}

export type GroupService = ReturnType<typeof createGroupService>
