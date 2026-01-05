<script lang="ts">
  import { generateKeyPair, encrypt, decrypt } from './lib/crypto'
  import { connectWS } from './lib/ws'
  import { generatePGPKey, signMessage, getPublicKeyInfo, encryptPGP, decryptPGP, getPublicKeyFromPrivate } from './lib/pgp'
  import { onMount } from 'svelte'
  import Sidebar from './components/Sidebar.svelte'
  import ChatWindow from './components/ChatWindow.svelte'
  import Auth from './components/Auth.svelte'
  import pkg from '../package.json'

  const API_URL = import.meta.env.VITE_API_URL || ''
  const version = pkg.version

  let id = ''
  let pgpPrivateKey = ''
  let pgpPassphrase = ''
  let contact: string | null = null
  let keypair: {publicKey:string, secretKey:string} | null = null
  let keys: Record<string,string> = {}
  let ws: { send: (d: string) => void, close: () => void, readyState: number } | null = null
  let wsStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
  interface Message {
    from: string;
    text: string;
    ts?: number;
    file?: { fileName: string; fileType: string; fileData: string };
  }
  let messagesMap: Record<string, Array<Message>> = {}
  let unreadMap: Record<string, number> = {}
  let typingMap: Record<string, boolean> = {}
  let isLoggedIn = false

  let typingTimeout: any = null
  let showSidebar = true

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

  function handleAuthSuccess(e: any) {
    const data = e.detail
    id = data.id
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
  }

  function connect() {
    if(!id) return
    ws = connectWS(id, async (msg)=>{
      if (msg.type === 'typing') {
        typingMap = { ...typingMap, [msg.from]: msg.isTyping }
        return
      }
      const from = msg.from
      try {
        const senderPk = keys[from] ?? (await fetch(`${API_URL}/keys?id=${encodeURIComponent(from)}`).then(r=>r.json()).then(j=>j.publicKey))
        if (!keys[from]) {
          keys = { ...keys, [from]: senderPk }
        }
        
        let text = ''
        if (isPGP(pgpPrivateKey) && msg.cipher.includes('-----BEGIN PGP MESSAGE-----')) {
          text = await decryptPGP(pgpPrivateKey, msg.cipher, pgpPassphrase) as string
        } else if (keypair) {
          text = decrypt(keypair.secretKey, senderPk, msg.cipher, msg.nonce) || '<failed to decrypt>'
        } else {
          text = '<no key to decrypt>'
        }
        
        let msgObj: any = { from, text, ts: Date.now() }
        try {
          if (text.startsWith('{') && text.includes('bytechat_file')) {
            const parsed = JSON.parse(text)
            if (parsed && parsed.bytechat_file) {
              msgObj.text = `Sent a file: ${parsed.fileName}`
              msgObj.file = {
                fileName: parsed.fileName,
                fileType: parsed.fileType,
                fileData: parsed.fileData
              }
            }
          }
        } catch (e) {
          // Not a JSON/file message, treat as plain text
        }

        messagesMap = {
          ...messagesMap,
          [from]: [...(messagesMap[from]||[]), msgObj]
        }
        if (from !== contact) {
          unreadMap = { ...unreadMap, [from]: (unreadMap[from] || 0) + 1 }
        }
      } catch (e) {
        console.error('Failed to process message', e)
      }
    }, (status) => {
      wsStatus = status
    })
  }

  async function fetchContactKey(name:string) {
    if(!name) return
    const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(name)}`)
    if(res.ok) {
      keys = { ...keys, [name]: (await res.json()).publicKey }
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
      [to]: [...(messagesMap[to]||[]), { from: id, text, ts: Date.now() }]
    }
    sendTyping(false)
  }

  async function sendFile(to: string, fileData: string, fileName: string, fileType: string) {
    if(!ws || ws.readyState !== WebSocket.OPEN) return
    await fetchContactKey(to)
    const pk = keys[to]
    if(!pk) return

    const payloadToEncrypt = JSON.stringify({
      bytechat_file: true,
      fileName,
      fileType,
      fileData
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
      [to]: [...(messagesMap[to]||[]), { from: id, text: `Sent file: ${fileName}`, file: { fileName, fileType, fileData }, ts: Date.now() }]
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

  function exportKeys() {
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

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
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

  onMount(()=>{
    const saved = localStorage.getItem('bytechat_session')
    if(saved) {
      try {
        const s = JSON.parse(saved)
        id = s.id
        pgpPrivateKey = s.pgpPrivateKey || ''
        pgpPassphrase = s.pgpPassphrase || ''
        keypair = s.keypair || null
        keys = s.keys || {}
        messagesMap = s.messagesMap || {}
        unreadMap = s.unreadMap || {}
        if (id && (pgpPrivateKey || keypair)) {
          isLoggedIn = true
          connect()
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
        id, pgpPrivateKey, pgpPassphrase, keypair, keys, messagesMap: strippedMessages, unreadMap
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
  }

  .chat-wrapper {
    flex: 1;
    height: 100%;
    min-width: 0;
    background: var(--bg);
  }

  @media (max-width: 768px) {
    .top-bar {
      padding: 0.5rem 1rem;
      height: auto;
      min-height: 64px;
    }
    
    .top-bar .text-sm {
      display: none;
    }

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
    <header class="top-bar">
      <div class="flex justify-between items-center w-full">
        <div class="flex items-center gap-3 sm:gap-4">
          <span class="text-xl font-bold tracking-tight text-accent">ByteChat</span>
          <div class="status-indicator hidden sm:flex">
            <div class="dot {wsStatus}"></div>
            <span class="opacity-50">{wsStatus}</span>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:gap-4">
          <div class="text-sm hidden md:block">
            <span class="opacity-50">Logged in as:</span>
            <span class="font-bold text-accent">{id}</span>
          </div>
          <div class="flex gap-2">
            <button class="btn-secondary text-xs py-1.5 px-3 rounded-lg" on:click={exportKeys}>Export</button>
            <button class="btn-secondary text-xs py-1.5 px-3 rounded-lg" on:click={logout}>Logout</button>
          </div>
        </div>
      </div>
    </header>

    <main class="flex flex-1 overflow-hidden relative">
      <div class="sidebar-wrapper" class:hidden-mobile={!showSidebar}>
        <Sidebar {contacts} {version} selected={contact} on:select={(e)=>{ contact = e.detail.id; showSidebar = false; }} on:addContact={(e) => addContact(e.detail.id)} />
      </div>
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
    </main>
  {/if}
</div>