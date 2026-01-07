/**
 * Messaging service - handles sending messages, files, and voice messages
 */

import { decrypt, encrypt } from './crypto'

export interface MessagingContext {
  ws: { send: (d: string) => void; close: () => void; readyState: number } | null
  id: string
  getKeypair: () => { publicKey: string; secretKey: string } | null
  getKeys: () => Record<string, string>
  getGroups: () => Array<{ id: string; name: string; members: string[]; admin: string }>
  cryptoPool: any
  API_URL: string
  sessionToken: string
  uploadFile: (file: File) => Promise<string | null>
  fetchContactKey: (name: string) => Promise<void>
  messagesMap: Record<string, any[]>
  updateMessagesMap: (updater: (map: Record<string, any[]>) => Record<string, any[]>) => void
}

export function createMessagingService(context: MessagingContext) {
  let isSending = false
  let typingTimeout: any = null

  function sendReadReceipt(from: string, messageId: string) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || !messageId) return

    context.ws.send(
      JSON.stringify({
        type: 'read',
        messageId: messageId,
        from: from,
        readAt: Date.now()
      })
    )
  }

  async function sendTo(to: string, text: string, replyTo?: { messageId: string; text: string; from: string }) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || isSending) return

    // Ensure text is a string
    if (typeof text !== 'string') {
      console.error('sendTo: text must be a string, got', typeof text, text)
      return
    }

    isSending = true
    // Defer to next tick to allow UI to update
    await new Promise((resolve) => setTimeout(resolve, 10))

    try {
      const messageId = Date.now() + '_' + Math.random().toString(36).slice(2, 11)
      let payload: any = { to, messageId, replyTo }

      if (to.startsWith('#')) {
        const groups = context.getGroups()
        const g = groups.find((x) => x.id === to)
        if (!g) return

        const groupCiphers: any = {}
        const recipients: Record<string, string> = {}

        for (const member of g.members) {
          await context.fetchContactKey(member)
          const keys = context.getKeys()
          const mpk = keys[member]
          if (mpk) recipients[member] = mpk
        }

        const keypair = context.getKeypair()
        if (keypair && Object.keys(recipients).length > 0) {
          try {
            const encrypted = await context.cryptoPool.batchEncrypt(keypair.secretKey, recipients, text)
            Object.assign(groupCiphers, encrypted)
          } catch (e) {
            console.warn('Batch encryption failed, using fallback', e)
            for (const member of g.members) {
              const keys = context.getKeys()
              const mpk = keys[member]
              if (!mpk) continue
              const { cipher, nonce } = encrypt(keypair.secretKey, mpk, text)
              groupCiphers[member] = { cipher, nonce }
            }
          }
        }

        payload.groupCiphers = groupCiphers
      } else {
        await context.fetchContactKey(to)
        const keys = context.getKeys()
        const pk = keys[to]
        if (!pk) return

        const keypair = context.getKeypair()
        if (keypair) {
          try {
            const { cipher, nonce } = await context.cryptoPool.encrypt(keypair.secretKey, pk, text)
            payload.cipher = cipher
            payload.nonce = nonce
          } catch (e) {
            console.warn('Worker encryption failed, using fallback', e)
            const { cipher, nonce } = encrypt(keypair.secretKey, pk, text)
            payload.cipher = cipher
            payload.nonce = nonce
          }
        } else {
          alert('No encryption key available for this contact')
          return
        }
      }

      context.ws.send(JSON.stringify({ type: 'message', ...payload }))
      
      // Trigger Svelte reactivity by using the update callback
      const newMessage = { from: context.id, text, ts: Date.now(), messageId, replyTo, sent: true }
      console.log('Adding local message:', { messageId, to, text: text.substring(0, 50) })
      context.updateMessagesMap((currentMap) => {
        const updatedMap = {
          ...currentMap,
          [to]: [...(currentMap[to] || []), newMessage].sort((a, b) => (a.ts || 0) - (b.ts || 0))
        }
        console.log('Updated messagesMap:', { to, count: updatedMap[to]?.length })
        return updatedMap
      })
    } finally {
      isSending = false
    }
  }

  async function sendFile(to: string, fileData: string, fileName: string, fileType: string) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || isSending) return

    isSending = true
    // Defer to next tick to allow UI to update
    await new Promise((resolve) => setTimeout(resolve, 10))

    try {
      // Upload to CDN
      let fileUrl = ''
      try {
        let blob: Blob
        if (fileData.startsWith('data:')) {
          const parts = fileData.split(',')
          const mime = parts[0].match(/:(.*?);/)?.[1] || ''
          const b64 = parts[1]

          // More memory-efficient base64 decoding for large files
          const chunkSize = 1024 * 1024 // 1MB chunks
          const chunks: Uint8Array[] = []

          for (let i = 0; i < b64.length; i += chunkSize) {
            const chunk = b64.slice(i, i + chunkSize)
            const binary = atob(chunk)
            const array = new Uint8Array(binary.length)
            for (let j = 0; j < binary.length; j++) array[j] = binary.charCodeAt(j)
            chunks.push(array)

            // Yield to main thread periodically
            if (i % (chunkSize * 5) === 0) {
              await new Promise((resolve) => setTimeout(resolve, 0))
            }
          }

          blob = new Blob(chunks as BlobPart[], { type: mime })
        } else {
          const res = await fetch(fileData)
          blob = await res.blob()
        }

        const formData = new FormData()
        formData.append('file', blob, fileName)

        const uploadRes = await fetch(`${context.API_URL}/cdn/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.sessionToken}`,
            'X-ByteChat-ID': context.id
          },
          body: formData
        })

        if (uploadRes.ok) {
          const data = await uploadRes.json()
          fileUrl = data.url
        } else {
          console.error('CDN upload failed')
        }
      } catch (e) {
        console.error('Error uploading to CDN:', e)
      }

      await context.fetchContactKey(to)
      const keys = context.getKeys()
      const pk = keys[to]
      if (!pk) return

      const payloadToEncrypt = JSON.stringify({
        bytechat_file: true,
        fileName,
        fileType,
        fileData: fileUrl ? undefined : fileData, // Fallback to base64 if CDN failed
        fileUrl
      })

      let payload: any = { to }
      const keypair = context.getKeypair()
      if (keypair) {
        try {
          const { cipher, nonce } = await context.cryptoPool.encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        } catch (e) {
          console.warn('Worker encryption failed, using fallback', e)
          const { cipher, nonce } = encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        }
      }

      context.ws.send(JSON.stringify({ type: 'message', ...payload }))
      
      // Trigger Svelte reactivity
      const newMessage = { from: context.id, text: `Sent file: ${fileName}`, file: { fileName, fileType, fileData, fileUrl }, ts: Date.now() }
      context.updateMessagesMap((currentMap) => ({
        ...currentMap,
        [to]: [...(currentMap[to] || []), newMessage].sort((a, b) => (a.ts || 0) - (b.ts || 0))
      }))
    } finally {
      isSending = false
    }
  }

  async function sendVoice(to: string, audioDataUrl: string, duration: number) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || !context.getKeypair() || !audioDataUrl) return

    try {
      isSending = true

      // Convert data URL to Blob and upload
      const blob = await fetch(audioDataUrl).then((r) => r.blob())
      const uploadUrl = await context.uploadFile(blob as File)

      if (!uploadUrl) {
        console.error('Failed to upload voice message')
        isSending = false
        return
      }

      await context.fetchContactKey(to)
      const keys = context.getKeys()
      const pk = keys[to]
      if (!pk) return

      const payloadToEncrypt = JSON.stringify({
        bytechat_voice: true,
        audioUrl: uploadUrl,
        duration
      })

      let payload: any = { type: 'voice', to }
      const keypair = context.getKeypair()
      if (keypair) {
        try {
          const { cipher, nonce } = await context.cryptoPool.encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        } catch (e) {
          console.warn('Worker encryption failed, using fallback', e)
          const { cipher, nonce } = encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        }
      }

      context.ws.send(JSON.stringify(payload))
      
      // Trigger Svelte reactivity
      const newMessage = { from: context.id, type: 'voice', voiceData: { duration, audioUrl: uploadUrl }, ts: Date.now() }
      context.updateMessagesMap((currentMap) => ({
        ...currentMap,
        [to]: [...(currentMap[to] || []), newMessage].sort((a, b) => (a.ts || 0) - (b.ts || 0))
      }))
    } finally {
      isSending = false
    }
  }

  function sendTyping(isTyping: boolean, contact: string | null) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || !contact) return
    context.ws.send(JSON.stringify({ type: 'typing', to: contact, isTyping }))
  }

  function handleTyping(contact: string | null) {
    sendTyping(true, contact)
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => {
      sendTyping(false, contact)
    }, 3000)
  }

  async function handleEdit(to: string, messageId: string, text: string) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || !context.getKeypair() || !messageId) return

    try {
      await context.fetchContactKey(to)
      const keys = context.getKeys()
      const pk = keys[to]
      if (!pk) return

      const keypair = context.getKeypair()
      if (!keypair) return
      const { cipher, nonce } = await context.cryptoPool.encrypt(keypair.secretKey, pk, text)

      context.ws.send(JSON.stringify({ type: 'edit', to, messageId, cipher, nonce }))

      // Update local message with Svelte reactivity
      context.updateMessagesMap((currentMap) => {
        if (!currentMap[to]) return currentMap
        return {
          ...currentMap,
          [to]: currentMap[to].map((m) =>
            messageId && m.messageId === messageId ? { ...m, text, editedAt: Date.now() } : m
          )
        }
      })
    } catch (e) {
      console.error('Failed to edit message', e)
    }
  }

  function handleDelete(to: string, messageId: string) {
    if (!context.ws || context.ws.readyState !== WebSocket.OPEN || !messageId) return

    context.ws.send(JSON.stringify({ type: 'delete', to, messageId }))

    // Update local message with Svelte reactivity
    context.updateMessagesMap((currentMap) => {
      if (!currentMap[to]) return currentMap
      return {
        ...currentMap,
        [to]: currentMap[to].map((m) =>
          m.messageId === messageId ? { ...m, deleted: true, text: 'Message deleted' } : m
        )
      }
    })
  }

  function reset() {}

  return {
    sendReadReceipt,
    sendTo,
    sendFile,
    sendVoice,
    sendTyping,
    handleTyping,
    handleEdit,
    handleDelete,
    reset
  }
}

export type MessagingService = ReturnType<typeof createMessagingService>
