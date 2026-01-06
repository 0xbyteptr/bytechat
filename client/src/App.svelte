<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { cryptoPool } from './lib/cryptoPool'
  import Sidebar from './components/Sidebar.svelte'
  import ChatWindow from './components/ChatWindow.svelte'
  import Auth from './components/Auth.svelte'
  import LoadingScreen from './components/LoadingScreen.svelte'
  import PermissionsDialog from './components/PermissionsDialog.svelte'
  import pkg from '../package.json'
  import { inject } from '@vercel/analytics'
  // @ts-ignore - Vercel Speed Insights types
  import { injectSpeedInsights } from '@vercel/speed-insights'
  
  // Composables
  import * as PermissionsLib from './lib/usePermissions'
  import * as VoipLib from './lib/useVoip'
  import * as NotificationsLib from './lib/useNotifications'
  import * as SessionLib from './lib/useSession'
  import * as MessagesLib from './lib/useMessages'
  import * as ContactsLib from './lib/useContacts'
  import * as WebSocketLib from './lib/useWebSocket'
  import * as UpdatesLib from './lib/useUpdates'
  import * as FileHandlingLib from './lib/useFileHandling'
  import * as MessageCacheLib from './lib/useMessageCache'
  import type { CallState } from './lib/webrtc'
    import { connectWS } from './lib/ws';
    import { decrypt, encrypt } from './lib/crypto';
    import { Capacitor } from '@capacitor/core';
    import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
    import { FileOpener } from '@capacitor-community/file-opener';

  const API_URL = import.meta.env.VITE_API_URL || 'https://api.byteptr.xyz'
  const version = pkg.version

  // Session state
  let id = ''
  let sessionToken = ''
  let keypair: {publicKey:string, secretKey:string} | null = null
  let isLoggedIn = false
  
  // Contact and message state
  let contact: string | null = null
  let keys: Record<string,string> = {}
  let groups: Array<{id:string, name:string, members:string[], admin:string}> = []
  let contacts: Array<{ id: string; last: string; unread: number }> = []
  let messagesMap: Record<string, any[]> = {}
  let unreadMap: Record<string, number> = {}
  let typingMap: Record<string, boolean> = {}
  let pendingKeys = new Set<string>()
  let failedKeys = new Set<string>()
  
  // WebSocket state
  let ws: { send: (d: string) => void, close: () => void, readyState: number } | null = null
  let wsStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticating' = 'disconnected'
  let onlineUsers = new Set<string>()
  
  // UI state
  let showSidebar = true
  let showSettings = false
  let isAppVisible = true
  let isSending = false
  let typingTimeout: any = null
  
  // Updates state
  let updateAvailable = false
  let updateUrl = ''
  let isUpdating = false
  let isNewerThanRelease = false
  let latestVersion = ''
  let notificationPermission = 'default'
  
  // Session validation state
  let sessionValidationFailures = 0
  let lastValidationAttempt = 0
  
  // Loading and permissions state
  let isLoading = true
  let loadingStatus = 'Initializing...'
  let loadingProgress = 0
  let showPermissionsDialog = false
  let permissions = {
    microphone: false,
    notifications: false
  }
  
  // VoIP state (from composable)
  let callState: CallState = 'idle'
  let callContact: string | null = null
  let isMuted = false
  let remoteAudioEl: HTMLAudioElement | null = null
  
  // Subscribe to stores
  VoipLib.callState.subscribe(value => callState = value)
  VoipLib.callContact.subscribe(value => callContact = value)
  VoipLib.isMuted.subscribe(value => isMuted = value)
  
  MessagesLib.messagesMap.subscribe(value => messagesMap = value)
  MessagesLib.unreadMap.subscribe(value => unreadMap = value)
  MessagesLib.typingMap.subscribe(value => typingMap = value)
  
  ContactsLib.keys.subscribe(value => keys = value)
  ContactsLib.groups.subscribe(value => groups = value)
  ContactsLib.contacts.subscribe(value => contacts = value)
  
  WebSocketLib.wsStatus.subscribe(value => wsStatus = value)
  ContactsLib.onlineUsers.subscribe(value => onlineUsers = value)
  
  SessionLib.id.subscribe(value => id = value)
  SessionLib.sessionToken.subscribe(value => sessionToken = value)
  SessionLib.keypair.subscribe(value => keypair = value)
  SessionLib.isLoggedIn.subscribe(value => isLoggedIn = value)

  async function requestAllPermissions() {
    loadingStatus = 'Requesting microphone access...'
    loadingProgress = 30
    
    const micGranted = await PermissionsLib.requestMicrophonePermission()
    permissions.microphone = micGranted

    loadingStatus = 'Requesting notification permissions...'
    loadingProgress = 60
    
    const notifGranted = await PermissionsLib.requestNotificationPermission()
    permissions.notifications = notifGranted

    // Setup notifications if granted
    if (notifGranted && id && sessionToken) {
      await NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    }

    loadingProgress = 90
    showPermissionsDialog = false
    
    return micGranted
  }

  async function initializeApp() {
    loadingStatus = 'Loading application...'
    loadingProgress = 10

    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500))

    loadingStatus = 'Checking permissions...'
    loadingProgress = 20
    
    const perms = await PermissionsLib.checkPermissions()
    permissions = perms

    // Check if we need to show permissions dialog
    if (!perms.microphone || !perms.notifications) {
      loadingProgress = 30
      showPermissionsDialog = true
      return
    }

    // Continue initialization
    await continueInitialization()
  }

  async function continueInitialization() {
    loadingStatus = 'Preparing...'
    loadingProgress = 70

    if (permissions.notifications && id && sessionToken) {
      await NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    }

    await new Promise(resolve => setTimeout(resolve, 300))
    
    loadingStatus = 'Ready!'
    loadingProgress = 100

    // Small delay to show completion
    await new Promise(resolve => setTimeout(resolve, 400))
    
    isLoading = false
  }

  async function handlePermissionsRequest() {
    await requestAllPermissions()
    await continueInitialization()
  }

  async function handlePermissionsSkip() {
    showPermissionsDialog = false
    await continueInitialization()
  }

  async function requestNotificationPermission() {
    const perm = await NotificationsLib.requestNotificationPermissionNative()
    notificationPermission = perm
  }

  $: currentMessages = contact ? (messagesMap[contact] || []) : []

  $: if (contact) {
    showSidebar = false
    // Load cached messages for this contact
    if (!messagesMap[contact] || messagesMap[contact].length === 0) {
      MessageCacheLib.loadCachedMessages(contact)
        .then(cachedMessages => {
          if (cachedMessages.length > 0 && !messagesMap[contact]) {
            messagesMap = { ...messagesMap, [contact!]: cachedMessages }
          }
        })
        .catch(err => console.warn('Failed to load cached messages:', err))
    }
  }

  $: if (contact && unreadMap[contact]) {
    unreadMap = { ...unreadMap, [contact]: 0 }
  }

  function handleAuthSuccess(e: any) {
    const data = e.detail
    if (!data) return
    id = data.id
    sessionToken = data.token || ''
    keypair = data.keypair
    keys = { ...keys, [id]: data.publicKey }
    isLoggedIn = true
    showSidebar = true
    connect()
    NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    saveSession()
  }

  function connect() {
    if(!id || !sessionToken) return
    ws = connectWS(id, sessionToken, async (msg)=>{
      // Handle presence updates - create new Set to trigger Svelte reactivity
      if (msg.type === 'presence') {
        const newOnlineUsers: any = new Set(msg.online || [])
        console.log('Presence update:', Array.from(newOnlineUsers))
        ContactsLib.onlineUsers.set(newOnlineUsers)
        return
      }
      
      if (msg.type === 'typing') {
        typingMap = { ...typingMap, [msg.from]: msg.isTyping }
        return
      }
      
      // Handle VoIP signaling
      if (msg.type === 'call-offer') {
        await handleCallOffer(msg)
        return
      }
      if (msg.type === 'call-answer') {
        await handleCallAnswer(msg)
        return
      }
      if (msg.type === 'call-ice-candidate') {
        await handleIceCandidate(msg)
        return
      }
      if (msg.type === 'call-end') {
        VoipLib.endCall()
        return
      }
      
      // Handle edit message
      if (msg.type === 'edit') {
        const chatWith = msg.chatWith || msg.from
        if (messagesMap[chatWith] && msg.messageId) {
          // Decrypt the edited text
          const pk = keys[msg.from]
          if (pk && keypair && msg.cipher && msg.nonce) {
            try {
              const text = await cryptoPool.decrypt(keypair.secretKey, pk, msg.cipher, msg.nonce)
              messagesMap = {
                ...messagesMap,
                [chatWith]: messagesMap[chatWith].map(m => 
                  (msg.messageId && m.messageId === msg.messageId)
                    ? { ...m, text, editedAt: msg.editedAt || Date.now() } 
                    : m
                )
              }
            } catch (e) {
              console.error('Failed to decrypt edited message', e)
            }
          }
        }
        return
      }
      
      // Handle delete message
      if (msg.type === 'delete') {
        const chatWith = msg.chatWith || msg.from
        if (messagesMap[chatWith] && msg.messageId) {
          messagesMap = {
            ...messagesMap,
            [chatWith]: messagesMap[chatWith].map(m => 
              (msg.messageId && m.messageId === msg.messageId)
                ? { ...m, deleted: true, text: '' } 
                : m
            )
          }
        }
        return
      }
      
      const from = msg.from
      const chatWith = msg.chatWith || from
      
      // Skip if we can't determine chat context
      if (!chatWith || !from) {
        console.warn('Skipping message without proper context:', msg)
        return
      }
      
      try {
        const fetchKey = async (targetId: string) => {
          if (pendingKeys.has(targetId)) {
            // Wait for existing request
            for (let i = 0; i < 10; i++) {
              await new Promise(r => setTimeout(r, 200))
              if (keys[targetId]) return keys[targetId]
            }
          }
          
          if (keys[targetId]) return keys[targetId]
          
          pendingKeys.add(targetId)
          try {
            const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(targetId)}`)
            if (res.ok) {
              const data = await res.json()
              keys = { ...keys, [targetId]: data.publicKey }
              return data.publicKey
            }
          } finally {
            pendingKeys.delete(targetId)
          }
          return null
        }

        let decryptPkName = chatWith
        if (chatWith.startsWith('#')) {
          decryptPkName = from
        }

        let decryptPk = keys[decryptPkName]
        if (!decryptPk) {
          decryptPk = await fetchKey(decryptPkName)
        }

        if (!decryptPk) {
          console.warn(`No key found for ${decryptPkName}, skipping message`)
          return
        }
        
        let text = ''
        const attemptDecrypt = async (pk: string) => {
          let cipher = msg.cipher
          let nonce = msg.nonce

          if (msg.groupCiphers && msg.groupCiphers[id]) {
            cipher = msg.groupCiphers[id].cipher
            nonce = msg.groupCiphers[id].nonce
          }

          // Validate we have all required string parameters
          if (!cipher || !nonce || typeof cipher !== 'string' || typeof nonce !== 'string') {
            if (cipher || nonce) {
              console.warn('Invalid cipher/nonce types:', { 
                cipher: typeof cipher, 
                nonce: typeof nonce, 
                messageId: msg.messageId 
              })
            }
            return null
          }

          // Use worker pool to prevent UI blocking
          if (keypair && pk) {
            try {
              return await cryptoPool.decrypt(keypair.secretKey, pk, cipher, nonce)
            } catch (e) {
              console.warn('Worker decryption failed, trying fallback', e)
              return decrypt(keypair.secretKey, pk, cipher, nonce)
            }
          }
          return null
        }

        text = await attemptDecrypt(decryptPk) || ''

        // If decryption failed, try fetching the key again (it might have changed)
        if (!text && (msg.cipher || msg.groupCiphers) && !msg.cipher?.includes('typing')) {
          // Force a re-fetch if decryption failed
          keys = { ...keys }
          delete keys[decryptPkName] 
          const newPk = await fetchKey(decryptPkName)
          if (newPk && newPk !== decryptPk) {
            text = await attemptDecrypt(newPk) || ''
          }
        }

        if (!text) {
          text = '<failed to decrypt message>'
        }
        
        let msgObj: any = { 
          from, 
          text, 
          ts: msg.ts || Date.now(),
          messageId: msg.messageId || (msg.ts + '_' + from),
          editedAt: msg.editedAt,
          deleted: msg.deleted,
          replyTo: msg.replyTo
        }
        try {
          if (text.startsWith('{') && text.includes('bytechat_file')) {
            const parsed = JSON.parse(text)
            if (parsed && parsed.bytechat_file) {
              msgObj.text = `Sent a file: ${parsed.fileName}`
              msgObj.file = {
                fileName: parsed.fileName,
                fileType: parsed.fileType,
                fileData: parsed.fileData,
                fileUrl: parsed.fileUrl
              }
            }
          }
        } catch (e) {
          // Not a JSON/file message, treat as plain text
        }

        // Avoid duplicates (especially from history)
        const isDuplicate = (messagesMap[chatWith] || []).some(m => 
          m.ts === msgObj.ts && m.text === msgObj.text && m.from === msgObj.from
        )
        if (isDuplicate) return

        // Use requestIdleCallback for non-urgent UI updates
        const updateMessages = () => {
          messagesMap = {
            ...messagesMap,
            [chatWith]: [...(messagesMap[chatWith]||[]), msgObj].sort((a, b) => (a.ts || 0) - (b.ts || 0))
          }
          // Cache the message
          MessageCacheLib.cacheMessage(chatWith, msgObj).catch(err => console.warn('Failed to cache message:', err))
        }
        
        // For history messages, defer to idle time
        if (msg.isHistory) {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => updateMessages(), { timeout: 1000 })
          } else {
            setTimeout(updateMessages, 0)
          }
          return
        }
        
        // For live messages, update immediately
        updateMessages()

        if (chatWith !== contact) {
          unreadMap = { ...unreadMap, [chatWith]: (unreadMap[chatWith] || 0) + 1 }
          const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
          const shortMsg = displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg
          NotificationsLib.notify(chatWith, shortMsg, isAppVisible, contact)
        } else if (!isAppVisible) {
          const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
          const shortMsg = displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg
          NotificationsLib.notify(chatWith, shortMsg, isAppVisible, contact)
        }
      } catch (e) {
        console.error('Failed to process message', e)
      }
    }, (status) => {
      wsStatus = status
    })
  }

  async function fetchContactKey(name:string) {
    if(!name || keys[name] || pendingKeys.has(name) || failedKeys.has(name)) return
    pendingKeys.add(name)
    try {
      const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(name)}`)
      if(res.ok) {
        const data = await res.json()
        if (data && data.publicKey) {
          keys = { ...keys, [name]: data.publicKey }
        } else {
          failedKeys.add(name)
        }
      } else if (res.status === 404) {
        failedKeys.add(name)
      }
    } catch (e) {
      console.error('Failed to fetch key for', name, e)
    } finally {
      pendingKeys.delete(name)
    }
  }

  async function sendTo(to:string, text:string, replyTo?: { messageId: string; text: string; from: string }) {
    if(!ws || ws.readyState !== WebSocket.OPEN || isSending) return
    
    // Ensure text is a string
    if (typeof text !== 'string') {
      console.error('sendTo: text must be a string, got', typeof text, text)
      return
    }
    
    isSending = true
    // Defer to next tick to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    try {
      const messageId = Date.now() + '_' + Math.random().toString(36).slice(2, 11)
      let payload: any = { to, messageId, replyTo }
      
      if (to.startsWith('#')) {
        const g = groups.find(x => x.id === to)
        if (!g) return
        
        const groupCiphers: any = {}
        const recipients: Record<string, string> = {}
        
        for (const member of g.members) {
          await fetchContactKey(member)
          const mpk = keys[member]
          if (mpk) recipients[member] = mpk
        }
        
        if (keypair && Object.keys(recipients).length > 0) {
          try {
            const encrypted = await cryptoPool.batchEncrypt(keypair.secretKey, recipients, text)
            Object.assign(groupCiphers, encrypted)
          } catch (e) {
            console.warn('Batch encryption failed, using fallback', e)
            for (const member of g.members) {
              const mpk = keys[member]
              if (!mpk) continue
              const { cipher, nonce } = encrypt(keypair.secretKey, mpk, text)
              groupCiphers[member] = { cipher, nonce }
            }
          }
        }
        
        payload.groupCiphers = groupCiphers
      } else {
        await fetchContactKey(to)
        const pk = keys[to]
        if(!pk) return
        
        if (keypair) {
          try {
            const { cipher, nonce } = await cryptoPool.encrypt(keypair.secretKey, pk, text)
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
      
      ws.send(JSON.stringify(payload))
      messagesMap = {
        ...messagesMap,
        [to]: [...(messagesMap[to]||[]), { from: id, text, ts: Date.now(), messageId, replyTo }].sort((a, b) => (a.ts || 0) - (b.ts || 0))
      }
      sendTyping(false)
    } finally {
      isSending = false
    }
  }

  async function sendFile(to: string, fileData: string, fileName: string, fileType: string) {
    if(!ws || ws.readyState !== WebSocket.OPEN || isSending) return

    isSending = true
    // Defer to next tick to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10))

    try {
      // Upload to CDN
      let fileUrl = ''
      try {
        let blob: Blob;
        if (fileData.startsWith('data:')) {
          const parts = fileData.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || '';
          const b64 = parts[1];
          
          // More memory-efficient base64 decoding for large files
          const chunkSize = 1024 * 1024; // 1MB chunks
          const chunks: Uint8Array[] = []
          
          for (let i = 0; i < b64.length; i += chunkSize) {
            const chunk = b64.slice(i, i + chunkSize)
            const binary = atob(chunk)
            const array = new Uint8Array(binary.length)
            for (let j = 0; j < binary.length; j++) array[j] = binary.charCodeAt(j)
            chunks.push(array)
            
            // Yield to main thread periodically
            if (i % (chunkSize * 5) === 0) {
              await new Promise(resolve => setTimeout(resolve, 0))
            }
          }
          
          blob = new Blob(chunks as BlobPart[], { type: mime });
        } else {
          const res = await fetch(fileData);
          blob = await res.blob();
        }

        const formData = new FormData()
        formData.append('file', blob, fileName)
        
        const uploadRes = await fetch(`${API_URL}/cdn/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'X-ByteChat-ID': id
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

      await fetchContactKey(to)
      const pk = keys[to]
      if(!pk) return

      const payloadToEncrypt = JSON.stringify({
        bytechat_file: true,
        fileName,
        fileType,
        fileData: fileUrl ? undefined : fileData, // Fallback to base64 if CDN failed
        fileUrl
      })

      let payload: any = { to }
      if (keypair) {
        try {
          const { cipher, nonce } = await cryptoPool.encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        } catch (e) {
          console.warn('Worker encryption failed, using fallback', e)
          const { cipher, nonce } = encrypt(keypair.secretKey, pk, payloadToEncrypt)
          payload.cipher = cipher
          payload.nonce = nonce
        }
      }

      ws.send(JSON.stringify(payload))
      messagesMap = {
        ...messagesMap,
        [to]: [...(messagesMap[to]||[]), { from: id, text: `Sent file: ${fileName}`, file: { fileName, fileType, fileData, fileUrl }, ts: Date.now() }].sort((a, b) => (a.ts || 0) - (b.ts || 0))
      }
    } finally {
      isSending = false
    }
  }

  function sendTyping(isTyping: boolean) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !contact) return
    ws.send(JSON.stringify({ type: 'typing', to: contact, isTyping }))
  }

  function handleTyping() {
    sendTyping(true)
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => {
      sendTyping(false)
    }, 3000)
  }
  
  async function handleEdit(e: CustomEvent) {
    const { to, messageId, text } = e.detail
    if (!ws || ws.readyState !== WebSocket.OPEN || !keypair || !messageId) return
    
    try {
      await fetchContactKey(to)
      const pk = keys[to]
      if (!pk) return
      
      const { cipher, nonce } = await cryptoPool.encrypt(keypair.secretKey, pk, text)
      
      ws.send(JSON.stringify({ 
        type: 'edit', 
        to, 
        messageId,
        cipher,
        nonce
      }))
      
      // Update local message
      if (messagesMap[to]) {
        messagesMap = {
          ...messagesMap,
          [to]: messagesMap[to].map(m => 
            (messageId && m.messageId === messageId)
              ? { ...m, text, editedAt: Date.now() } 
              : m
          )
        }
      }
    } catch (e) {
      console.error('Failed to edit message', e)
    }
  }
  
  function handleDelete(e: CustomEvent) {
    const { to, messageId } = e.detail
    if (!ws || ws.readyState !== WebSocket.OPEN || !messageId) return
    
    ws.send(JSON.stringify({ 
      type: 'delete', 
      to, 
      messageId
    }))
    
    // Update local message
    if (messagesMap[to]) {
      messagesMap = {
        ...messagesMap,
        [to]: messagesMap[to].map(m => 
          (messageId && m.messageId === messageId)
            ? { ...m, deleted: true, text: '' } 
            : m
        )
      }
    }
  }

  // VoIP Call Functions - using composable
  function sendVoipSignal(type: string, data: any, to: string) {
    if (ws) {
      ws.send(JSON.stringify({
        type,
        to,
        ...data
      }))
    }
  }
  
  async function startCall(e: CustomEvent) {
    const { to } = e.detail
    if (!to) return
    
    try {
      await VoipLib.startCall(to, true) // audio only
    } catch (error) {
      console.error('Failed to start call:', error)
      alert('Failed to start call. Please check microphone permissions.')
    }
  }
  
  async function handleCallOffer(msg: any) {
    try {
      await VoipLib.handleCallOffer(msg.from, msg.offer, true)
    } catch (error) {
      console.error('Failed to answer call:', error)
      alert('Failed to answer call. Please check microphone permissions.')
    }
  }
  
  async function handleCallAnswer(msg: any) {
    if (msg.answer) {
      await VoipLib.handleCallAnswer(msg.answer)
    }
  }
  
  async function handleIceCandidate(msg: any) {
    if (msg.candidate) {
      await VoipLib.handleIceCandidate(msg.candidate)
    }
  }
  
  function endCall() {
    const currentCallContact = callContact
    VoipLib.endCall()
    if (ws && currentCallContact) {
      ws.send(JSON.stringify({
        type: 'call-end',
        to: currentCallContact
      }))
    }
  }
  
  function toggleMute() {
    VoipLib.toggleMute()
  }

  async function addContact(targetId: string) {
    if (targetId === id) {
      alert("You can't add yourself.")
      return
    }
    if (messagesMap[targetId]) {
      contact = targetId
      return
    }
    
    // Defer to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 10))
    
    try {
      const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(targetId)}`)
      if (res.ok) {
        const data = await res.json()
        keys = { ...keys, [targetId]: data.publicKey }
        messagesMap = { ...messagesMap, [targetId]: [] }
        contact = targetId
      } else {
        alert(`User "${targetId}" not found on server.`)
      }
    } catch (e) {
      alert("Error finding user.")
    }
  }

  async function exportKeys() {
    let content = ''
    let filename = `bytechat_${id}_keys.txt`
    
    if (keypair) {
      content = `ByteChat Nacl Keys for ${id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
    } else {
      alert('No keys found to export')
      return
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
        await FileOpener.open({
          filePath: result.uri,
          contentType: 'text/plain'
        })
      } catch (e: any) {
        alert('Failed to save keys: ' + e.message)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function validateSession() {
    if (!isLoggedIn || !id || !sessionToken) return
    
    const now = Date.now()
    // Rate limit validation attempts (max once per 30 seconds)
    if (now - lastValidationAttempt < 30000) return
    lastValidationAttempt = now
    
    try {
      const res = await fetch(`${API_URL}/validate-session?id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      if (res.status === 401) {
        sessionValidationFailures++
        console.warn(`Session validation failed (${sessionValidationFailures}/3)`)
        
        // Only logout after 3 consecutive failures
        if (sessionValidationFailures >= 3) {
          console.warn('Multiple session validation failures, logging out')
          logout()
        }
      } else if (res.ok) {
        // Reset failure count on success
        sessionValidationFailures = 0
      }
    } catch (e) {
      // Network error - don't logout, user might be offline
      console.warn('Failed to validate session (network error), staying logged in', e)
      sessionValidationFailures = 0 // Reset on network errors
    }
  }

  function logout() {
    isLoggedIn = false
    id = ''
    sessionToken = ''
    keypair = null
    if (ws) {
      ws.close()
      ws = null
    }
    localStorage.removeItem('bytechat_session')
    localStorage.removeItem('bytechat_session_backup')
    keys = {}
    groups = []
    messagesMap = {}
    unreadMap = {}
    contact = null
    showSidebar = true
  }

  async function checkForUpdates() {
    try {
      console.log('Checking for updates... current version:', version)
      
      // Check GitHub package.json for latest version
      const pkgRes = await fetch('https://raw.githubusercontent.com/0xbyteptr/bytechat/main/client/package.json')
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json()
        latestVersion = pkgData.version
        console.log('Latest version in repo:', latestVersion)
      }
      
      // Check GitHub releases
      const res = await fetch('https://api.github.com/repos/0xbyteptr/bytechat/releases/latest')
      if (res.ok) {
        const data = await res.json()
        const releaseVersion = data.tag_name.replace('v', '')
        console.log('Latest release version:', releaseVersion)
        
        const compareVersions = (v1: string, v2: string) => {
          const parts1 = v1.split('.').map(x => parseInt(x) || 0)
          const parts2 = v2.split('.').map(x => parseInt(x) || 0)
          const length = Math.max(parts1.length, parts2.length)
          for (let i = 0; i < length; i++) {
            const p1 = parts1[i] || 0
            const p2 = parts2[i] || 0
            if (p1 > p2) return 1
            if (p1 < p2) return -1
          }
          return 0
        }

        const comparison = compareVersions(version, releaseVersion)
        
        if (comparison > 0) {
          // Current version is newer than release (dev version)
          isNewerThanRelease = true
          console.log('Using dev version')
        } else if (comparison < 0) {
          // Release is newer (update available)
          updateAvailable = true
          const apkAsset = data.assets.find((a: any) => a.name.endsWith('.apk'))
          updateUrl = apkAsset ? apkAsset.browser_download_url : data.html_url
          console.log('Update found! URL:', updateUrl)
        }
      }
    } catch (e) {
      console.warn('Update check failed', e)
    }
  }

  async function installUpdate() {
    if (!updateUrl || isUpdating) return
    
    if (!Capacitor.isNativePlatform() || !updateUrl.endsWith('.apk')) {
      window.open(updateUrl, '_blank')
      return
    }

    try {
      isUpdating = true
      const filename = `bytechat_update.apk`
      
      console.log('Starting download from:', updateUrl)
      
      // Delete old file if exists
      try {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Data
        })
      } catch (e) {}

      const download = await Filesystem.downloadFile({
        url: updateUrl,
        path: filename,
        directory: Directory.Data
      })

      if (download.path) {
        console.log('Download complete:', download.path)
        
        // On Android, we might need to convert the path to a proper URI
        let finalPath = download.path
        if (Capacitor.getPlatform() === 'android' && !finalPath.startsWith('file://')) {
          finalPath = 'file://' + finalPath
        }

        await FileOpener.open({
          filePath: finalPath,
          contentType: 'application/vnd.android.package-archive',
          openWithDefault: true
        })
      }
    } catch (e: any) {
      console.error('Update failed', e)
      alert('Update failed: ' + e.message)
    } finally {
      isUpdating = false
    }
  }

  async function fetchGroups() {
    if (!id || !sessionToken) return
    try {
      const res = await fetch(`${API_URL}/groups?id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      if (res.status === 401) {
        console.warn('Session invalid, logging out')
        logout()
        return
      }
      if (res.ok) {
        groups = await res.json()
      }
    } catch (e) {}
  }

  async function createGroup(name: string, members: string[]) {
    if (!id || !sessionToken) return
    const gid = '#' + Math.random().toString(36).slice(2, 10)
    try {
      const res = await fetch(`${API_URL}/groups?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: gid, name, members: [...members, id] })
      })
      if (res.ok) {
        await fetchGroups()
        contact = gid
      }
    } catch (e: any) {
      alert('Failed to create group: ' + e.message)
    }
  }

  onMount(()=>{
    // Initialize message cache
    MessageCacheLib.initializeCache().catch(err => console.warn('Failed to initialize message cache:', err))
    
    // Initialize Vercel Analytics and Speed Insights
    inject()
    injectSpeedInsights()
    
    // Show loading screen and request permissions (async, non-blocking)
    initializeApp()
    
    // Initialize VoIP with remote audio element
    if (remoteAudioEl) {
      VoipLib.initVoIP(remoteAudioEl, sendVoipSignal)
    }
    
    try {
      checkForUpdates()
      fetchGroups()
      if ('Notification' in window) {
        notificationPermission = Notification.permission;
      }
      
      const handleVisibilityChange = () => {
        isAppVisible = document.visibilityState === 'visible'
        if (isAppVisible) {
          validateSession()
          fetchGroups()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      const saved = localStorage.getItem('bytechat_session')
      if(saved) {
        try {
          const s = JSON.parse(saved)
          if (s.version !== 2) {
            // Old session format, upgrade or clear
            console.log('Upgrading session format')
          }
          id = s.id
          sessionToken = s.sessionToken || ''
          keypair = s.keypair || null
          keys = s.keys || {}
          groups = s.groups || []
          messagesMap = s.messagesMap || {}
          unreadMap = s.unreadMap || {}
          contact = s.lastContact || null
          if (id && sessionToken && keypair) {
            isLoggedIn = true
            connect()
            NotificationsLib.setupNotifications(id, sessionToken, API_URL)
            // Validate session after a delay to allow WebSocket to connect first
            setTimeout(() => validateSession(), 2000)
          }
        } catch (e) {
          console.error('Failed to restore session:', e)
          // Try backup
          try {
            const backup = localStorage.getItem('bytechat_session_backup')
            if (backup) {
              const s = JSON.parse(backup)
              id = s.id
              sessionToken = s.sessionToken || ''
              keypair = s.keypair || null
              keys = s.keys || {}
              groups = s.groups || []
              messagesMap = s.messagesMap || {}
              unreadMap = s.unreadMap || {}
              contact = s.lastContact || null
              if (id && sessionToken && keypair) {
                isLoggedIn = true
                connect()
                NotificationsLib.setupNotifications(id, sessionToken, API_URL)
                setTimeout(() => validateSession(), 2000)
                console.log('Restored from backup')
              }
            }
          } catch (backupError) {
            console.error('Failed to restore from backup:', backupError)
          }
        }
      }

      const sessionInterval = setInterval(() => {
        if (isLoggedIn) {
          validateSession()
          fetchGroups()
        }
      }, 60000)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(sessionInterval)
      }
    } catch (err) {
      console.error('Fatal onMount error:', err)
    }
  })
  
  onDestroy(() => {
    // Clean up crypto worker pool to prevent memory leaks
    if (cryptoPool) {
      cryptoPool.terminate()
    }
    // Clean up any pending timeouts
    if (contactsDebounce) clearTimeout(contactsDebounce)
    if (typingTimeout) clearTimeout(typingTimeout)
  })

  // Session saving with backup and compression
  let saveTimeout: any = null
  let lastSaveTime = 0
  
  function saveSession() {
    const now = Date.now()
    // Rate limit saves to max once per 500ms
    if (now - lastSaveTime < 500) {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveSession, 500)
      return
    }
    
    lastSaveTime = now
    
    try {
      // Create backup of current session before saving new one
      const current = localStorage.getItem('bytechat_session')
      if (current) {
        try {
          localStorage.setItem('bytechat_session_backup', current)
        } catch (e) {
          console.warn('Failed to create session backup', e)
        }
      }
      
      // Strip large file data and limit message history to avoid quota errors
      const strippedMessages: Record<string, any[]> = {}
      Object.keys(messagesMap).forEach(contactId => {
        // Keep only last 100 messages per contact
        const messages = messagesMap[contactId].slice(-100)
        strippedMessages[contactId] = messages.map(m => {
          if (m.file && m.file.fileData) {
            // Keep small files (< 50KB), strip large ones
            if (m.file.fileData.length > 50000) {
              return { 
                ...m, 
                file: { 
                  fileName: m.file.fileName, 
                  fileType: m.file.fileType,
                  fileUrl: m.file.fileUrl,
                  fileData: '' 
                }, 
                text: m.text || `File: ${m.file.fileName}` 
              }
            }
          }
          return m
        })
      })

      const sessionData = {
        version: 2,
        id,
        sessionToken,
        keypair,
        keys,
        groups,
        messagesMap: strippedMessages,
        unreadMap,
        lastContact: contact,
        savedAt: now
      }
      
      const serialized = JSON.stringify(sessionData)
      
      // Check size and warn if approaching limits
      if (serialized.length > 4500000) { // 4.5MB (localStorage is typically 5-10MB)
        console.warn('Session data is large:', Math.round(serialized.length / 1024), 'KB')
        // Try more aggressive pruning
        Object.keys(strippedMessages).forEach(contactId => {
          strippedMessages[contactId] = strippedMessages[contactId].slice(-50)
        })
        sessionData.messagesMap = strippedMessages
      }
      
      localStorage.setItem('bytechat_session', JSON.stringify(sessionData))
    } catch (e) {
      console.error('Failed to save session:', e)
      
      // Try emergency save with minimal data
      try {
        localStorage.setItem('bytechat_session', JSON.stringify({
          version: 2,
          id,
          sessionToken,
          keypair,
          keys,
          groups,
          messagesMap: {}, // Drop all messages
          unreadMap: {},
          lastContact: contact,
          savedAt: Date.now()
        }))
        console.warn('Saved minimal session data (messages dropped)')
      } catch (emergencyError) {
        console.error('Emergency save failed:', emergencyError)
      }
    }
  }
  
  // Auto-save on data changes
  $: if(isLoggedIn && (id || sessionToken || keypair || keys || groups || messagesMap || unreadMap || contact)) {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveSession, 1000)
  }

  // small mock contacts list for UI
  let contactsDebounce: any = null
  
  $: if (messagesMap || unreadMap) {
    if (contactsDebounce) clearTimeout(contactsDebounce)
    contactsDebounce = setTimeout(() => {
      contacts = Object.keys(messagesMap)
        .filter(k => !k.startsWith('#')) // Exclude groups from contacts list
        .map(k=>({ 
          id:k, 
          last: messagesMap[k]?.[messagesMap[k].length-1]?.text ?? '', 
          unread: unreadMap[k] || 0 
        }))
    }, 50)
  }

  $: totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)
  $: {
    if (typeof document !== 'undefined') {
      document.title = totalUnread > 0 ? `(${totalUnread}) ByteChat` : 'ByteChat'
    }
  }
</script>

<style>
  .top-bar {
    padding: 0.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-bottom: 1px solid var(--surface-lighter);
    background: var(--surface);
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s, transform 0.1s;
  }

  button:active { transform: scale(0.98); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary { background: var(--accent); color: var(--accent-fg); }
  .btn-secondary { background: var(--surface-lighter); color: var(--fg); }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.connected { background: var(--green); box-shadow: 0 0 8px var(--green); }
  .dot.connecting { background: var(--yellow); }
  .dot.disconnected { background: var(--red); }

  .sidebar-wrapper {
    width: 320px;
    height: 100%;
    flex-shrink: 0;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--surface);
    padding-left: env(safe-area-inset-left);
  }

  .chat-wrapper {
    flex: 1;
    height: 100%;
    min-width: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    padding-right: env(safe-area-inset-right);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal-content {
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 24px;
    width: 100%;
    max-width: 450px;
    padding: 2rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--accent);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: var(--fg);
    background: var(--surface-lighter);
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .settings-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--subtext);
  }

  .settings-item {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (max-width: 768px) {

    .sidebar-wrapper {
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
    }

    .chat-wrapper {
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 25;
    }

    .hidden-mobile {
      display: none;
    }
  }
</style>

<div class="flex flex-col h-screen w-screen overflow-hidden bg-bg text-fg">
  {#if isLoading}
    <LoadingScreen status={loadingStatus} progress={loadingProgress} />
  {/if}
  
  {#if showPermissionsDialog}
    <PermissionsDialog 
      {permissions} 
      on:request={handlePermissionsRequest}
      on:skip={handlePermissionsSkip}
    />
  {/if}
  
  {#if !isLoggedIn && !isLoading}
    <Auth {id} {keypair} on:authSuccess={handleAuthSuccess} />
  {:else if !isLoading}
    <main class="flex flex-1 overflow-hidden relative bg-bg">
      <div class="sidebar-wrapper" class:hidden-mobile={!showSidebar}>
        <Sidebar 
          {contacts} 
          {groups}
          {version} 
          {updateAvailable}
          {isNewerThanRelease}
          {latestVersion}
          {isUpdating}
          {onlineUsers}
          selected={contact} 
          on:select={(e)=>{ contact = e.detail.id; showSidebar = false; }} 
          on:addContact={(e) => addContact(e.detail.id)} 
          on:createGroup={(e) => createGroup(e.detail.name, e.detail.members)}
          on:logout={logout}
          on:openSettings={() => showSettings = true} 
          on:update={installUpdate}
        />
      </div>
      {#if contact}
        <div class="chat-wrapper" class:hidden-mobile={showSidebar}>
          <ChatWindow 
            currentUserId={id} 
            contactId={contact} 
            messages={currentMessages} 
            isTyping={contact ? !!typingMap[contact] : false}
            isSending={isSending}
            callState={contact === callContact ? callState : 'idle'}
            isMuted={isMuted}
            on:send={(e)=>sendTo(e.detail.to, e.detail.text, e.detail.replyTo)} 
            on:sendFile={(e)=>sendFile(e.detail.to, e.detail.fileData, e.detail.fileName, e.detail.fileType)}
            on:edit={handleEdit}
            on:delete={handleDelete}
            on:typing={handleTyping}
            on:startCall={startCall}
            on:endCall={endCall}
            on:toggleMute={toggleMute}
            on:back={() => { contact = null; showSidebar = true; }}
          />
        </div>
      {/if}
    </main>

    {#if showSettings}
      <div 
        class="modal-overlay" 
        on:click|self={() => showSettings = false} 
        on:keydown={(e) => e.key === 'Escape' && (showSettings = false)}
        role="button"
        tabindex="-1"
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 class="modal-title">Settings</h2>
            <button class="close-btn" on:click={() => showSettings = false}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="settings-section">
            <span class="settings-label">Account</span>
            <div class="settings-item">
              <div class="flex justify-between items-center">
                <span class="opacity-50 text-sm">Logged in as</span>
                <span class="font-bold text-accent">{id}</span>
              </div>
              <div class="flex justify-between items-center mt-2">
                <span class="opacity-50 text-sm">Status</span>
                <div class="status-indicator">
                  <div class="dot {wsStatus}"></div>
                  <span class="opacity-50">{wsStatus}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <span class="settings-label">Notifications</span>
            <div class="settings-item">
              <div class="flex justify-between items-center">
                <span class="text-sm">Push Notifications</span>
                {#if notificationPermission === 'granted'}
                  <span class="text-green text-xs font-bold uppercase">Enabled</span>
                {:else}
                  <button class="btn-secondary text-xs py-1 px-3 rounded-lg" on:click={requestNotificationPermission}>Enable</button>
                {/if}
              </div>
            </div>
          </div>

          <div class="settings-section">
            <span class="settings-label">Data & Security</span>
            <div class="flex flex-col gap-2">
              <button class="btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2" on:click={exportKeys}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export Keys
              </button>
              <button class="btn-secondary w-full py-3 rounded-xl text-red flex items-center justify-center gap-2" on:click={logout}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Logout
              </button>
            </div>
          </div>

          <div class="mt-auto pt-4 text-center opacity-30 text-[10px] font-mono">
            ByteChat v{version}
          </div>
        </div>
      </div>
    {/if}
  {/if}
  
  <!-- Hidden audio element for remote audio stream -->
  <audio bind:this={remoteAudioEl} autoplay style="display: none;"></audio>
</div>