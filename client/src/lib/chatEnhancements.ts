// Enhanced chat features for rich messaging experience

export interface UserPresence {
  userId: string
  status: 'online' | 'away' | 'offline'
  lastSeen?: number
  activity?: string
}

export interface EnhancedMessage {
  messageId?: string
  from: string
  text: string
  ts?: number
  read?: boolean
  readAt?: number
  edited?: boolean
  editedAt?: number
  reactions?: Record<string, string[]>
}

// Format timestamp with hover tooltip
export function formatTimestamp(ts?: number): {short: string, full: string} {
  if (!ts) return {short: '', full: ''}
  
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  let short = ''
  if (diffMins < 1) short = 'now'
  else if (diffMins < 60) short = `${diffMins}m ago`
  else if (diffHours < 24) short = `${diffHours}h ago`
  else if (diffDays < 7) short = `${diffDays}d ago`
  else short = d.toLocaleDateString()
  
  const full = d.toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  return {short, full}
}

// Format user presence
export function formatPresence(presence: UserPresence): string {
  switch (presence.status) {
    case 'online':
      return '🟢 Online'
    case 'away':
      return '🟡 Away'
    case 'offline':
      if (presence.lastSeen) {
        const {short} = formatTimestamp(presence.lastSeen)
        return `⚫ Offline (last seen ${short})`
      }
      return '⚫ Offline'
    default:
      return 'Unknown'
  }
}

// Get status indicator emoji
export function getStatusEmoji(status: 'online' | 'away' | 'offline'): string {
  switch (status) {
    case 'online': return '🟢'
    case 'away': return '🟡'
    case 'offline': return '⚫'
    default: return '⚪'
  }
}

// Format read receipt
export function formatReadReceipt(readAt?: number): string {
  if (!readAt) return 'Sending...'
  
  const {short} = formatTimestamp(readAt)
  return `Read ${short}`
}

// Generate user activity text
export function generateActivityText(userId: string, activity?: string): string {
  if (!activity) return `${userId} is here`
  return `${userId} is ${activity}`
}

// Check if message is recently edited
export function isRecentlyEdited(editedAt?: number): boolean {
  if (!editedAt) return false
  
  const now = Date.now()
  const diffMins = Math.floor((now - editedAt) / 60000)
  
  return diffMins < 60 // Show "edited" tag for 1 hour after edit
}

// Format message metadata
export function getMessageMetadata(msg: EnhancedMessage): {
  timestamp: string
  isEdited: boolean
  hasReactions: boolean
  reactionCount: number
} {
  const {short: timestamp} = formatTimestamp(msg.ts)
  const isEdited = isRecentlyEdited(msg.editedAt)
  const hasReactions = Boolean(msg.reactions && Object.keys(msg.reactions).length > 0)
  const reactionCount = hasReactions ? Object.keys(msg.reactions || {}).length : 0
  
  return {
    timestamp,
    isEdited,
    hasReactions,
    reactionCount
  }
}

// Message formatting hints
export const FORMATTING_HELP = {
  bold: '**text**',
  italic: '*text*',
  code: '`code`',
  codeblock: '```\ncode\n```',
  strikethrough: '~~text~~',
  spoiler: '||spoiler||',
  mention: '@username',
  link: '[text](url)'
}

// Get formatting toolbar items
export function getFormattingToolbar(): Array<{label: string, prefix: string, suffix: string, shortcut?: string}> {
  return [
    {label: 'Bold', prefix: '**', suffix: '**', shortcut: 'Ctrl+B'},
    {label: 'Italic', prefix: '*', suffix: '*', shortcut: 'Ctrl+I'},
    {label: 'Code', prefix: '`', suffix: '`', shortcut: 'Ctrl+K'},
    {label: 'Strikethrough', prefix: '~~', suffix: '~~'},
    {label: 'Spoiler', prefix: '||', suffix: '||'},
    {label: 'Quote', prefix: '> ', suffix: ''},
  ]
}

// Parse mentions from text
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+(?:\.\w+)*)/g
  const mentions: string[] = []
  let match
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1])
  }
  
  return [...new Set(mentions)] // Remove duplicates
}

// Check if user is mentioned in message
export function isMentioned(text: string, userId: string): boolean {
  return extractMentions(text).includes(userId)
}

// Get mention color
export function getMentionColor(): {bg: string, text: string} {
  return {
    bg: 'rgba(88, 101, 242, 0.15)',
    text: '#5865F2'
  }
}
