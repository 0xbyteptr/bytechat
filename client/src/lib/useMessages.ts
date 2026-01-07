import { writable, derived } from 'svelte/store'

export interface Message {
  from: string
  text: string
  ts?: number
  messageId?: string
  file?: { fileName: string; fileType: string; fileData?: string; fileUrl?: string }
  editedAt?: number
  deleted?: boolean
  replyTo?: { messageId: string; text: string; from: string }
  read?: boolean
  readAt?: number
  type?: 'text' | 'call' | 'group-update' // message type
  callData?: {
    duration?: number // duration in seconds
    status: 'missed' | 'completed' | 'cancelled' | 'declined' // call status
    initiator: string // who started the call
  }
  groupData?: {
    action: 'created' | 'updated' | 'member-added' | 'member-removed' | 'member-promoted'
    actionBy?: string // who performed the action
    targetUser?: string // affected member
  }
  reactions?: Record<string, string[]> // emoji -> list of user ids (local only)
  failedDecrypt?: boolean
}

export const messagesMap = writable<Record<string, Message[]>>({})
export const unreadMap = writable<Record<string, number>>({})
export const typingMap = writable<Record<string, boolean>>({})
export const pinnedMap = writable<Record<string, string[]>>({})

export const totalUnread = derived(unreadMap, $unread => 
  Object.values($unread).reduce((a, b) => a + b, 0)
)

export function getCurrentMessages(contactId: string | null): Message[] {
  let messages: Message[] = []
  const unsubscribe = messagesMap.subscribe(map => {
    messages = contactId ? (map[contactId] || []) : []
  })
  unsubscribe()
  return messages
}

export function addMessage(contactId: string, message: Message) {
  messagesMap.update(map => {
    const existing = map[contactId] || []
    return { ...map, [contactId]: [...existing, message] }
  })
}

export function updateMessage(contactId: string, messageId: string, updates: Partial<Message>) {
  messagesMap.update(map => {
    const messages = map[contactId] || []
    return {
      ...map,
      [contactId]: messages.map(m =>
        m.messageId === messageId ? { ...m, ...updates } : m
      )
    }
  })
}

export function deleteMessage(contactId: string, messageId: string) {
  messagesMap.update(map => {
    const messages = map[contactId] || []
    return {
      ...map,
      [contactId]: messages.map(m =>
        m.messageId === messageId ? { ...m, deleted: true, text: 'Message deleted' } : m
      )
    }
  })
}

export function toggleReaction(contactId: string, messageId: string, emoji: string, userId: string) {
  messagesMap.update(map => {
    const messages = map[contactId] || []
    return {
      ...map,
      [contactId]: messages.map(m => {
        if (m.messageId !== messageId) return m
        const reactions = { ...(m.reactions || {}) }
        const current = new Set(reactions[emoji] || [])
        if (current.has(userId)) {
          current.delete(userId)
        } else {
          current.add(userId)
        }
        reactions[emoji] = Array.from(current)
        return { ...m, reactions }
      })
    }
  })
}

export function togglePin(contactId: string, messageId: string) {
  pinnedMap.update(map => {
    const pins = new Set(map[contactId] || [])
    if (pins.has(messageId)) {
      pins.delete(messageId)
    } else {
      pins.add(messageId)
    }
    return { ...map, [contactId]: Array.from(pins) }
  })
}

export function isPinned(contactId: string, messageId: string): boolean {
  let pinned: Record<string, string[]> = {}
  const unsub = pinnedMap.subscribe(p => pinned = p)
  unsub()
  return new Set(pinned[contactId] || []).has(messageId)
}

export function incrementUnread(contactId: string) {
  unreadMap.update(map => ({
    ...map,
    [contactId]: (map[contactId] || 0) + 1
  }))
}

export function clearUnread(contactId: string) {
  unreadMap.update(map => ({
    ...map,
    [contactId]: 0
  }))
}

export function setTyping(contactId: string, isTyping: boolean) {
  typingMap.update(map => ({
    ...map,
    [contactId]: isTyping
  }))
}

export function loadFromLocalStorage() {
  const saved = localStorage.getItem('bytechat_session')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      if (s.messagesMap) messagesMap.set(s.messagesMap)
      if (s.unreadMap) unreadMap.set(s.unreadMap)
    } catch (e) {
      console.error('Failed to load messages from localStorage', e)
    }
  }
}

export function saveToLocalStorage() {
  let currentMessages: Record<string, Message[]> = {}
  let currentUnread: Record<string, number> = {}
  
  const unsub1 = messagesMap.subscribe(m => currentMessages = m)
  const unsub2 = unreadMap.subscribe(u => currentUnread = u)
  unsub1()
  unsub2()
  
  // Strip large file data to avoid QuotaExceededError
  const strippedMessages = { ...currentMessages }
  Object.keys(strippedMessages).forEach(contactId => {
    strippedMessages[contactId] = strippedMessages[contactId].map(m => {
      if (m.file && m.file.fileData && m.file.fileData.length > 100000) {
        return { ...m, file: { ...m.file, fileData: '' }, text: m.text + ' (File too large to persist)' }
      }
      return m
    })
  })
  
  return {
    messagesMap: strippedMessages,
    unreadMap: currentUnread
  }
}
