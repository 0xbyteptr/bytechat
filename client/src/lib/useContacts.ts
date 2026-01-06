import { writable } from 'svelte/store'

export interface Group {
  id: string
  name: string
  members: string[]
  admin: string
}

export const keys = writable<Record<string, string>>({})
export const groups = writable<Group[]>([])
export const contacts = writable<Array<{id: string, last: string, unread: number}>>([])
export const onlineUsers = writable<Set<string>>(new Set())

export async function fetchPublicKey(apiUrl: string, targetId: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/keys?id=${encodeURIComponent(targetId)}`)
    if (res.ok) {
      const data = await res.json()
      keys.update(k => ({ ...k, [targetId]: data.publicKey }))
      return data.publicKey
    } else {
      return null
    }
  } catch (e) {
    console.error('Error fetching public key', e)
    return null
  }
}

export async function addContact(
  apiUrl: string,
  targetId: string,
  currentId: string,
  messagesMap: Record<string, any[]>
): Promise<{ success: boolean, error?: string }> {
  if (targetId === currentId) {
    return { success: false, error: "You can't add yourself." }
  }
  
  if (messagesMap[targetId]) {
    return { success: true }
  }
  
  const publicKey = await fetchPublicKey(apiUrl, targetId)
  if (publicKey) {
    return { success: true }
  } else {
    return { success: false, error: `User "${targetId}" not found on server.` }
  }
}

export async function fetchGroups(apiUrl: string, id: string, sessionToken: string) {
  if (!id || !sessionToken) return
  
  try {
    const res = await fetch(`${apiUrl}/groups?id=${encodeURIComponent(id)}&token=${encodeURIComponent(sessionToken)}`)
    if (res.ok) {
      const data = await res.json()
      groups.set(data)
    }
  } catch (e) {
    console.error('Failed to fetch groups', e)
  }
}

export async function createGroup(
  apiUrl: string,
  id: string,
  sessionToken: string,
  name: string,
  members: string[]
): Promise<boolean> {
  if (!id || !sessionToken) return false
  
  const gid = '#' + Math.random().toString(36).slice(2, 10)
  
  try {
    const res = await fetch(`${apiUrl}/groups?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: gid, name, members: [...members, id] })
    })
    
    if (res.ok) {
      await fetchGroups(apiUrl, id, sessionToken)
      return true
    }
    return false
  } catch (e) {
    console.error('Failed to create group', e)
    return false
  }
}

export function updateContactsList(
  messagesMap: Record<string, any[]>,
  unreadMap: Record<string, number>,
  groupsList: Group[]
) {
  const contactsList = [
    ...groupsList.map(g => ({
      id: g.id,
      last: `Group: ${g.members.length} members`,
      unread: unreadMap[g.id] || 0
    })),
    ...Object.keys(messagesMap)
      .filter(k => !k.startsWith('#'))
      .map(k => ({
        id: k,
        last: messagesMap[k]?.[messagesMap[k].length - 1]?.text ?? '',
        unread: unreadMap[k] || 0
      }))
  ]
  
  contacts.set(contactsList)
}

export function loadKeysFromLocalStorage() {
  const saved = localStorage.getItem('bytechat_session')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      if (s.keys) keys.set(s.keys)
    } catch (e) {
      console.error('Failed to load keys from localStorage', e)
    }
  }
}

export function saveKeysToLocalStorage(): Record<string, string> {
  let currentKeys: Record<string, string> = {}
  const unsub = keys.subscribe(k => currentKeys = k)
  unsub()
  return currentKeys
}
