import { writable } from 'svelte/store'
import { connectWS } from './ws'
import { encrypt, decrypt } from './crypto'
import type { Message } from './useMessages'
import * as MessagesLib from './useMessages'
import * as ContactsLib from './useContacts'

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticating'

export const wsStatus = writable<WSStatus>('disconnected')

let wsInstance: { send: (d: string) => void, close: () => void, readyState: number } | null = null

export interface WebSocketHandlers {
  onMessage: (from: string, message: Message, chatWith: string) => void
  onTyping: (from: string, isTyping: boolean) => void
  onCallOffer: (msg: any) => Promise<void>
  onCallAnswer: (msg: any) => Promise<void>
  onIceCandidate: (msg: any) => Promise<void>
  onCallEnd: () => void
}

export function connectWebSocket(
  id: string,
  sessionToken: string,
  handlers: WebSocketHandlers,
  keypair: {publicKey: string, secretKey: string} | null,
  keysMap: Record<string, string>,
  pendingKeys: Set<string>,
  failedKeys: Set<string>,
  apiUrl: string,
  cryptoPool: any
) {
  if (wsInstance) {
    wsInstance.close()
  }

  wsInstance = connectWS(id, sessionToken, async (msg) => {
    // Handle typing indicator
    if (msg.type === 'typing') {
      MessagesLib.setTyping(msg.from, msg.isTyping)
      handlers.onTyping(msg.from, msg.isTyping)
      return
    }
    
    // Handle VoIP signaling
    if (msg.type === 'call-offer') {
      await handlers.onCallOffer(msg)
      return
    }
    if (msg.type === 'call-answer') {
      await handlers.onCallAnswer(msg)
      return
    }
    if (msg.type === 'call-ice-candidate') {
      await handlers.onIceCandidate(msg)
      return
    }
    if (msg.type === 'call-end') {
      handlers.onCallEnd()
      return
    }
    
    // Handle regular messages
    if (msg.type !== 'message') return
    
    const isGroup = msg.to.startsWith('#')
    const chatWith = isGroup ? msg.to : msg.from
    
    // Fetch public key if needed
    if (!keysMap[msg.from] && !pendingKeys.has(msg.from) && !failedKeys.has(msg.from)) {
      pendingKeys.add(msg.from)
      const publicKey = await ContactsLib.fetchPublicKey(apiUrl, msg.from)
      pendingKeys.delete(msg.from)
      
      if (!publicKey) {
        failedKeys.add(msg.from)
        console.error(`Failed to fetch public key for ${msg.from}`)
        return
      }
      
      keysMap[msg.from] = publicKey
    }
    
    try {
      // Decrypt message
      let text = ''
      if (keypair && keysMap[msg.from] && msg.cipher && msg.nonce) {
        const decrypted = await (cryptoPool
          ? cryptoPool.decrypt(keypair.secretKey, keysMap[msg.from], msg.cipher, msg.nonce)
          : decrypt(keypair.secretKey, keysMap[msg.from], msg.cipher, msg.nonce))
        text = decrypted || text
      }
      
      const msgObj: Message = {
        from: msg.from,
        text,
        ts: msg.ts || Date.now(),
        messageId: msg.messageId,
        file: msg.file,
        editedAt: msg.editedAt,
        deleted: msg.deleted,
        replyTo: msg.replyTo
      }
      
      // Handle message actions
      if (msg.action === 'edit' && msg.messageId) {
        MessagesLib.updateMessage(chatWith, msg.messageId, {
          text,
          editedAt: Date.now()
        })
      } else if (msg.action === 'delete' && msg.messageId) {
        MessagesLib.deleteMessage(chatWith, msg.messageId)
      } else {
        MessagesLib.addMessage(chatWith, msgObj)
      }
      
      handlers.onMessage(msg.from, msgObj, chatWith)
    } catch (e) {
      console.error('Failed to process message', e)
    }
  }, (status) => {
    wsStatus.set(status as WSStatus)
  })
  
  return wsInstance
}

export async function sendMessage(
  to: string,
  text: string,
  keypair: {publicKey: string, secretKey: string} | null,
  keysMap: Record<string, string>,
  groups: Array<{id: string, members: string[]}>,
  cryptoPool: any,
  replyTo?: { messageId: string; text: string; from: string }
): Promise<boolean> {
  if (!wsInstance || !keypair) return false
  
  const isGroup = to.startsWith('#')
  const recipients = isGroup
    ? (groups.find(g => g.id === to)?.members || [])
    : [to]
  
  for (const recipient of recipients) {
    if (!keysMap[recipient]) {
      console.error(`No public key for ${recipient}`)
      continue
    }
    
    const { cipher, nonce } = await (cryptoPool
      ? cryptoPool.encrypt(keypair.secretKey, keysMap[recipient], text)
      : encrypt(keypair.secretKey, keysMap[recipient], text))
    
    wsInstance.send(JSON.stringify({
      type: 'message',
      to: isGroup ? to : recipient,
      cipher,
      nonce,
      ts: Date.now(),
      messageId: Math.random().toString(36).substr(2, 9),
      replyTo
    }))
  }
  
  return true
}

export async function sendFileMessage(
  to: string,
  fileData: string,
  fileName: string,
  fileType: string,
  keypair: {publicKey: string, secretKey: string} | null,
  keysMap: Record<string, string>,
  groups: Array<{id: string, members: string[]}>,
  cryptoPool: any
): Promise<boolean> {
  if (!wsInstance || !keypair) return false
  
  const isGroup = to.startsWith('#')
  const recipients = isGroup
    ? (groups.find(g => g.id === to)?.members || [])
    : [to]
  
  const text = `Sent a file: ${fileName}`
  
  for (const recipient of recipients) {
    if (!keysMap[recipient]) {
      console.error(`No public key for ${recipient}`)
      continue
    }
    
    const { cipher, nonce } = await (cryptoPool
      ? cryptoPool.encrypt(keypair.secretKey, keysMap[recipient], text)
      : encrypt(keypair.secretKey, keysMap[recipient], text))
    
    wsInstance.send(JSON.stringify({
      type: 'message',
      to: isGroup ? to : recipient,
      cipher,
      nonce,
      file: { fileName, fileType, fileData },
      ts: Date.now(),
      messageId: Math.random().toString(36).substr(2, 9)
    }))
  }
  
  return true
}

export function sendTypingIndicator(to: string, isTyping: boolean) {
  if (wsInstance) {
    wsInstance.send(JSON.stringify({
      type: 'typing',
      to,
      isTyping
    }))
  }
}

export function sendEditMessage(
  to: string,
  messageId: string,
  newText: string,
  keypair: {publicKey: string, secretKey: string} | null,
  recipientKey: string,
  cryptoPool: any
) {
  if (!wsInstance || !keypair || !recipientKey) return
  
  const { cipher, nonce } = encrypt(keypair.secretKey, recipientKey, newText)
  wsInstance.send(JSON.stringify({
    type: 'message',
    action: 'edit',
    to,
    messageId,
    cipher,
    nonce
  }))
}

export function sendDeleteMessage(to: string, messageId: string) {
  if (wsInstance) {
    wsInstance.send(JSON.stringify({
      type: 'message',
      action: 'delete',
      to,
      messageId
    }))
  }
}

export function closeWebSocket() {
  if (wsInstance) {
    wsInstance.close()
    wsInstance = null
  }
  wsStatus.set('disconnected')
}

export function getWebSocketInstance() {
  return wsInstance
}
