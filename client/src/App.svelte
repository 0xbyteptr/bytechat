<script lang="ts">
  import { generateKeyPair, encrypt, decrypt } from './lib/crypto'
  import { connectWS } from './lib/ws'
  import { generatePGPKey, signMessage, getPublicKeyInfo, encryptPGP, decryptPGP, getPublicKeyFromPrivate } from './lib/pgp'
  import { onMount } from 'svelte'
  import Sidebar from './components/Sidebar.svelte'
  import ChatWindow from './components/ChatWindow.svelte'
  import Auth from './components/Auth.svelte'
  import pkg from '../package.json'
  import { LocalNotifications } from '@capacitor/local-notifications'
  import { PushNotifications } from '@capacitor/push-notifications'
  import { Capacitor } from '@capacitor/core'
  import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
  import { FileOpener } from '@capacitor-community/file-opener'

  const API_URL = import.meta.env.VITE_API_URL || (Capacitor.isNativePlatform() ? 'https://api.byteptr.xyz' : '')
  const version = pkg.version

  let id = ''
  let pgpPrivateKey = ''
  let pgpPassphrase = ''
  let contact: string | null = null
  let keypair: {publicKey:string, secretKey:string} | null = null
  let keys: Record<string,string> = {}
  let pendingKeys = new Set<string>()
  let ws: { send: (d: string) => void, close: () => void, readyState: number } | null = null
  let wsStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  interface Message {
    from: string;
    text: string;
    ts?: number;
    file?: { fileName: string; fileType: string; fileData?: string; fileUrl?: string };
  }
  let messagesMap: Record<string, Array<Message>> = {}
  let unreadMap: Record<string, number> = {}
  let typingMap: Record<string, boolean> = {}
  let isLoggedIn = false
  let sessionToken = ''

  let typingTimeout: any = null
  let showSidebar = true
  let isAppVisible = true
  let notificationPermission = 'default'
  let showSettings = false
  let updateAvailable = false
  let updateUrl = ''
  let isUpdating = false

  function playPing() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const audioCtx = new AudioContextClass()
      if (audioCtx.state === 'suspended') audioCtx.resume()
      
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime)
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2)

      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.2)
    } catch (e) {
      console.warn('Failed to play ping sound', e)
    }
  }

  async function requestNotificationPermission() {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions()
      notificationPermission = status.display
      if (status.display !== 'granted') {
        const res = await LocalNotifications.requestPermissions()
        notificationPermission = res.display
      }
    } else if ('Notification' in window) {
      notificationPermission = Notification.permission
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        const res = await Notification.requestPermission()
        notificationPermission = res
      }
    }
  }

  async function notify(title: string, body: string) {
    if (isAppVisible && contact === title) return // Don't notify if looking at the chat

    playPing()

    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 10000),
            schedule: { at: new Date(Date.now() + 100) },
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      })
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // Use Service Worker notification if available (better for PWA/Mobile)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'bytechat-msg',
            renotify: true
          } as any)
        })
      } else {
        new Notification(title, { body })
      }
    }
  }

  $: currentMessages = contact ? (messagesMap[contact] || []) : []

  $: if (contact) {
    showSidebar = false
  }

  $: if (contact && unreadMap[contact]) {
    unreadMap = { ...unreadMap, [contact]: 0 }
  }

  function isPGP(key: string) {
    return key && key.includes('-----BEGIN PGP')
  }

  async function registerPush() {
    if (!Capacitor.isNativePlatform()) return

    let perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions()
    }

    if (perm.receive !== 'granted') return

    await PushNotifications.register()

    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value)
      await fetch(`${API_URL}/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token: token.value, sessionToken })
      })
    })

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error))
    })

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification))
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification))
      const from = notification.notification.data.from
      if (from) {
        contact = from
        showSidebar = false
      }
    })
  }

  function handleAuthSuccess(e: any) {
    const data = e.detail
    id = data.id
    sessionToken = data.token
    if (data.type === 'pgp') {
      pgpPrivateKey = data.pgpPrivateKey
      pgpPassphrase = data.pgpPassphrase
      keys = { ...keys, [id]: data.publicKey }
    } else {
      keypair = data.keypair
      keys = { ...keys, [id]: data.publicKey }
    }
    isLoggedIn = true
    showSidebar = true
    connect()
    registerPush()
    localStorage.setItem('bytechat_session', JSON.stringify({
      id,
      sessionToken,
      pgpPrivateKey,
      pgpPassphrase,
      keypair,
      keys
    }))
  }

  function connect() {
    if(!id || !sessionToken) return
    ws = connectWS(id, sessionToken, async (msg)=>{
      if (msg.type === 'typing') {
        typingMap = { ...typingMap, [msg.from]: msg.isTyping }
        return
      }
      const from = msg.from
      const chatWith = msg.chatWith || from
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

        let senderPk = keys[from]
        if (!senderPk) {
          senderPk = await fetchKey(from)
        }

        if (!senderPk) {
          console.warn(`No key found for ${from}, skipping message`)
          return
        }
        
        let text = ''
        const attemptDecrypt = async (pk: string) => {
          if (isPGP(pgpPrivateKey) && msg.cipher && msg.cipher.includes('-----BEGIN PGP MESSAGE-----')) {
            try {
              return await decryptPGP(pgpPrivateKey, msg.cipher, pgpPassphrase) as string
            } catch (e) {
              console.error('PGP decryption failed:', e)
              return null
            }
          } else if (keypair && pk && !pk.includes('-----BEGIN PGP')) {
            return decrypt(keypair.secretKey, pk, msg.cipher, msg.nonce)
          }
          return null
        }

        text = await attemptDecrypt(senderPk) || ''

        // If decryption failed, try fetching the key again (it might have changed)
        if (!text && msg.cipher && !msg.cipher.includes('typing')) {
          // Force a re-fetch if decryption failed
          keys = { ...keys }
          delete keys[from] 
          const newPk = await fetchKey(from)
          if (newPk && newPk !== senderPk) {
            text = await attemptDecrypt(newPk) || ''
          }
        }

        if (!text) {
          if (msg.cipher && msg.cipher.includes('-----BEGIN PGP MESSAGE-----') && !isPGP(pgpPrivateKey)) {
            text = '<received PGP message but you are using Nacl>'
          } else if (msg.cipher && !msg.cipher.includes('-----BEGIN PGP MESSAGE-----') && isPGP(pgpPrivateKey) && !keypair) {
            text = '<received Nacl message but you are using PGP>'
          } else {
            text = '<failed to decrypt message>'
          }
        }
        
        let msgObj: any = { from, text, ts: msg.ts || Date.now() }
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

        messagesMap = {
          ...messagesMap,
          [chatWith]: [...(messagesMap[chatWith]||[]), msgObj].sort((a, b) => (a.ts || 0) - (b.ts || 0))
        }
        
        // Don't notify for history messages
        if (msg.isHistory) return

        if (chatWith !== contact) {
          unreadMap = { ...unreadMap, [chatWith]: (unreadMap[chatWith] || 0) + 1 }
          const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
          notify(chatWith, displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg)
        } else if (!isAppVisible) {
          const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
          notify(chatWith, displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg)
        }
      } catch (e) {
        console.error('Failed to process message', e)
      }
    }, (status) => {
      wsStatus = status
    })
  }

  async function fetchContactKey(name:string) {
    if(!name || keys[name] || pendingKeys.has(name)) return
    pendingKeys.add(name)
    try {
      const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(name)}`)
      if(res.ok) {
        keys = { ...keys, [name]: (await res.json()).publicKey }
      }
    } finally {
      pendingKeys.delete(name)
    }
  }

  async function sendTo(to:string, text:string) {
    if(!ws || ws.readyState !== WebSocket.OPEN) return
    await fetchContactKey(to)
    const pk = keys[to]
    if(!pk) return
    
    let payload: any = { to }
    if (isPGP(pk)) {
      const cipher = await encryptPGP(pk, text)
      payload.cipher = cipher
      payload.nonce = ''
    } else if (keypair) {
      const { cipher, nonce } = encrypt(keypair.secretKey, pk, text)
      payload.cipher = cipher
      payload.nonce = nonce
    } else {
      alert('No encryption key available for this contact')
      return
    }
    
    ws.send(JSON.stringify(payload))
    messagesMap = {
      ...messagesMap,
      [to]: [...(messagesMap[to]||[]), { from: id, text, ts: Date.now() }].sort((a, b) => (a.ts || 0) - (b.ts || 0))
    }
    sendTyping(false)
  }

  async function sendFile(to: string, fileData: string, fileName: string, fileType: string) {
    if(!ws || ws.readyState !== WebSocket.OPEN) return

    // Upload to CDN
    let fileUrl = ''
    try {
      let blob: Blob;
      if (fileData.startsWith('data:')) {
        const parts = fileData.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || '';
        const b64 = parts[1];
        const binary = atob(b64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        blob = new Blob([array], { type: mime });
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
    if (isPGP(pk)) {
      payload.cipher = await encryptPGP(pk, payloadToEncrypt)
      payload.nonce = ''
    } else if (keypair) {
      const { cipher, nonce } = encrypt(keypair.secretKey, pk, payloadToEncrypt)
      payload.cipher = cipher
      payload.nonce = nonce
    }

    ws.send(JSON.stringify(payload))
    messagesMap = {
      ...messagesMap,
      [to]: [...(messagesMap[to]||[]), { from: id, text: `Sent file: ${fileName}`, file: { fileName, fileType, fileData, fileUrl }, ts: Date.now() }].sort((a, b) => (a.ts || 0) - (b.ts || 0))
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

  async function addContact(targetId: string) {
    if (targetId === id) {
      alert("You can't add yourself.")
      return
    }
    if (messagesMap[targetId]) {
      contact = targetId
      return
    }
    
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
    
    if (pgpPrivateKey) {
      content = `ByteChat PGP Private Key for ${id}\n\n${pgpPrivateKey}`
    } else if (keypair) {
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

  function logout() {
    isLoggedIn = false
    if(ws) ws.close()
    localStorage.removeItem('bytechat_session')
    id = ''
    pgpPrivateKey = ''
    pgpPassphrase = ''
    keypair = null
    keys = {}
    messagesMap = {}
    unreadMap = {}
    contact = null
  }

  async function checkForUpdates() {
    try {
      const res = await fetch('https://api.github.com/repos/0xbyteptr/bytechat/releases/latest')
      if (res.ok) {
        const data = await res.json()
        const latestVersion = data.tag_name.replace('v', '')
        if (latestVersion !== version) {
          updateAvailable = true
          const apkAsset = data.assets.find((a: any) => a.name.endsWith('.apk'))
          updateUrl = apkAsset ? apkAsset.browser_download_url : data.html_url
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
      const filename = `bytechat-${Date.now()}.apk`
      
      const download = await Filesystem.downloadFile({
        url: updateUrl,
        path: filename,
        directory: Directory.Data
      })

      if (download.path) {
        await FileOpener.open({
          filePath: download.path,
          contentType: 'application/vnd.android.package-archive'
        })
      }
    } catch (e: any) {
      console.error('Update failed', e)
      alert('Update failed: ' + e.message)
    } finally {
      isUpdating = false
    }
  }

  onMount(()=>{
    checkForUpdates()
    if ('Notification' in window) {
      notificationPermission = Notification.permission;
    }
    
    const handleVisibilityChange = () => {
      isAppVisible = document.visibilityState === 'visible'
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const saved = localStorage.getItem('bytechat_session')
    if(saved) {
      try {
        const s = JSON.parse(saved)
        id = s.id
        sessionToken = s.sessionToken || ''
        pgpPrivateKey = s.pgpPrivateKey || ''
        pgpPassphrase = s.pgpPassphrase || ''
        keypair = s.keypair || null
        keys = s.keys || {}
        messagesMap = s.messagesMap || {}
        unreadMap = s.unreadMap || {}
        if (id && sessionToken && (pgpPrivateKey || keypair)) {
          isLoggedIn = true
          connect()
          registerPush()
        }
      } catch (e) {
        console.error('Failed to restore session', e)
      }
    }
  })

  $: if(isLoggedIn) {
    try {
      // To avoid QuotaExceededError, we strip large file data when saving to localStorage
      // Users can still see them in the current session, but they won't persist if too large
      const strippedMessages = { ...messagesMap }
      Object.keys(strippedMessages).forEach(contactId => {
        strippedMessages[contactId] = strippedMessages[contactId].map(m => {
          if (m.file && m.file.fileData && m.file.fileData.length > 100000) {
            return { ...m, file: { ...m.file, fileData: '' }, text: m.text + ' (File too large to persist)' }
          }
          return m
        })
      })

      localStorage.setItem('bytechat_session', JSON.stringify({
        id, sessionToken, pgpPrivateKey, pgpPassphrase, keypair, keys, messagesMap: strippedMessages, unreadMap
      }))
    } catch (e) {
      console.warn('LocalStorage quota exceeded, session not fully saved', e)
    }
  }

  // small mock contacts list for UI
  $: contacts = Object.keys(messagesMap).map(k=>({ 
    id:k, 
    last: messagesMap[k]?.[messagesMap[k].length-1]?.text ?? '', 
    unread: unreadMap[k] || 0 
  }))

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
  {#if !isLoggedIn}
    <Auth {id} {pgpPrivateKey} {pgpPassphrase} {keypair} on:authSuccess={handleAuthSuccess} />
  {:else}
    <main class="flex flex-1 overflow-hidden relative bg-bg">
      <div class="sidebar-wrapper" class:hidden-mobile={!showSidebar}>
        <Sidebar 
          {contacts} 
          {version} 
          {updateAvailable} 
          {updateUrl} 
          {isUpdating}
          selected={contact} 
          on:select={(e)=>{ contact = e.detail.id; showSidebar = false; }} 
          on:addContact={(e) => addContact(e.detail.id)} 
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
            on:send={(e)=>sendTo(e.detail.to, e.detail.text)} 
            on:sendFile={(e)=>sendFile(e.detail.to, e.detail.fileData, e.detail.fileName, e.detail.fileType)}
            on:typing={handleTyping}
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
</div>