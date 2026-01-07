<script lang="ts">
  import MessageBubble from './MessageBubble.svelte'
  import VoiceRecorder from './VoiceRecorder.svelte'
  import { createEventDispatcher, afterUpdate, tick } from 'svelte'
  export let currentUserId: string
  export let contactId: string | null = null
  export let contactName: string | null = null
  export let contactProfile: { displayName?: string; avatarUrl?: string; bannerUrl?: string } | null = null
  export let isSending = false
  export let callState: 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended' = 'idle'
  export let isMuted = false
  export let isOnline = false
  export let isGroup = false
  // @ts-ignore - external reference
  export const group: any = null
  interface Message {
    from: string;
    text: string;
    ts?: number;
    messageId?: string;
    file?: { fileName: string; fileType: string; fileData?: string; fileUrl?: string };
    editedAt?: number;
    deleted?: boolean;
    replyTo?: { messageId: string; text: string; from: string };
    reactions?: Record<string, string[]>;
    failedDecrypt?: boolean;
    read?: boolean;
    readAt?: number;
    type?: 'text' | 'call';
    callData?: {
      duration?: number;
      status: 'missed' | 'completed' | 'cancelled' | 'declined';
      initiator: string;
    };
  }
  export let messages: Array<Message> = []
  export let isTyping = false
  export let pinned: string[] = []
  const dispatch = createEventDispatcher()
  const MAX_FILE_SIZE = parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '52428800')
  let draft = ''
  let fileInput: HTMLInputElement
  let uploadProgress = 0
  let isUploading = false
  let uploadName = ''
  let listEl: HTMLDivElement | null = null
  let textareaEl: HTMLTextAreaElement
  let editingMessage: Message | null = null
  let replyingTo: Message | null = null
  let shouldAutoScroll = true
  let prevMessageCount = 0
  let searchTerm = ''

  $: filteredMessages = searchTerm
    ? messages.filter(m => (m.text || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : messages

  $: pinnedMessages = pinned
    .map(id => messages.find(m => m.messageId === id))
    .filter((m): m is Message => Boolean(m && m.messageId))
  
  // Virtual scrolling for performance
  const ITEM_HEIGHT = 60 // Approximate height of message bubble
  const BUFFER_SIZE = 5 // Extra items to render above/below viewport
  let scrollTop = 0
  let viewportHeight = 0
  let visibleStart = 0
  let visibleEnd = 0
  let totalHeight = 0

  $: {
    const list = filteredMessages
    if (list.length > 100) {
      totalHeight = list.length * ITEM_HEIGHT
      viewportHeight = listEl?.clientHeight || 600
      visibleStart = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE)
      visibleEnd = Math.min(list.length, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE)
    } else {
      visibleStart = 0
      visibleEnd = list.length
      totalHeight = 0
    }
  }

  $: visibleMessages = filteredMessages.length > 100
    ? filteredMessages.slice(visibleStart, visibleEnd)
    : filteredMessages
  $: offsetY = visibleStart * ITEM_HEIGHT

  afterUpdate(async () => {
    // Auto-scroll to bottom when new messages arrive
    if (listEl && messages.length > prevMessageCount && shouldAutoScroll) {
      await tick()
      listEl.scrollTop = listEl.scrollHeight
    }
    prevMessageCount = messages.length
  })

  function send() { 
    if(!contactId || !draft.trim() || isSending) return
    
    if (editingMessage) {
      dispatch('edit', { 
        to: contactId, 
        messageId: editingMessage.messageId,
        text: draft 
      })
      editingMessage = null
    } else {
      dispatch('send', { 
        to: contactId, 
        text: draft,
        replyTo: replyingTo ? {
          messageId: replyingTo.messageId,
          text: replyingTo.text,
          from: replyingTo.from
        } : undefined
      })
      replyingTo = null
    }
    
    draft = ''
  }
  
  function handleEdit(e: CustomEvent) {
    editingMessage = e.detail
    draft = e.detail.text
    replyingTo = null
    textareaEl?.focus()
  }
  
  function handleDelete(e: CustomEvent) {
    if (confirm('Delete this message?')) {
      dispatch('delete', { 
        to: contactId, 
        messageId: e.detail.messageId 
      })
    }
  }
  
  function handleReply(e: CustomEvent) {
    replyingTo = e.detail
    editingMessage = null
    textareaEl?.focus()
  }
  
  function handleForward(e: CustomEvent) {
    dispatch('forward', e.detail)
  }
  
  function handleVoiceMessage(e: CustomEvent) {
    const { audioBlob, duration } = e.detail
    if (!contactId || !audioBlob) return
    
    const reader = new FileReader()
    reader.onload = () => {
      dispatch('sendVoice', {
        to: contactId,
        audioBlob: reader.result,
        duration: duration
      })
    }
    reader.readAsDataURL(audioBlob)
  }
  
  function cancelEdit() {
    editingMessage = null
    draft = ''
  }
  
  function cancelReply() {
    replyingTo = null
  }

  async function scrollToMessage(id?: string) {
    if (!id || !listEl) return
    let targetList = filteredMessages
    let index = targetList.findIndex(m => m.messageId === id)

    if (index === -1) {
      const allIndex = messages.findIndex(m => m.messageId === id)
      if (allIndex === -1) return
      if (searchTerm) {
        searchTerm = ''
        await tick()
      }
      targetList = filteredMessages
      index = targetList.findIndex(m => m.messageId === id)
    }

    if (index >= 0 && targetList.length > 100) {
      listEl.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
      requestAnimationFrame(() => {
        const target = listEl?.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    const node = listEl.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
  
  function handleFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !contactId) return
    
    if (file.size > MAX_FILE_SIZE) {
      alert(`File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`)
      return
    }

    isUploading = true
    uploadProgress = 0
    uploadName = file.name

    const reader = new FileReader()
    reader.onprogress = (ev) => {
      if (ev.lengthComputable) {
        uploadProgress = Math.round((ev.loaded / ev.total) * 100)
      }
    }
    reader.onload = () => {
      uploadProgress = 100
      setTimeout(() => {
        dispatch('sendFile', { 
          to: contactId, 
          fileData: reader.result, 
          fileName: file.name,
          fileType: file.type 
        })
        isUploading = false
        uploadProgress = 0
      }, 300)
    }
    reader.onerror = () => {
      alert('Failed to read file')
      isUploading = false
    }
    reader.readAsDataURL(file)
    fileInput.value = ''

  }

  $: if (draft) {
    dispatch('typing')
  }
  
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    if (filteredMessages.length > 100) {
      scrollTop = target.scrollTop
    }
    // Check if user is near bottom (within 100px)
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100
    shouldAutoScroll = isNearBottom
  }
  
  function autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
      const el = e.target as HTMLTextAreaElement
      el.style.height = 'auto'
    }
  }
  
  function startCall() {
    dispatch('startCall', { to: contactId })
  }
  
  function endCall() {
    dispatch('endCall')
  }
  
  function cancelCall() {
    dispatch('cancelCall')
  }
  
  function toggleMute() {
    dispatch('toggleMute')
  }

  function handleReact(event: CustomEvent<{ messageId: string; emoji: string }>) {
    if (!contactId) return
    dispatch('react', { to: contactId, ...event.detail })
  }

  function handleTogglePin(messageId?: string) {
    if (!contactId || !messageId) return
    dispatch('togglePin', { to: contactId, messageId })
  }
</script>

<div class="chat-window">
  {#if contactId}
    <header class="chat-header" style={contactProfile?.bannerUrl ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.6), var(--surface)), url(${contactProfile.bannerUrl}); background-size: cover; background-position: center;` : ''}>
      <button class="back-button" on:click={() => dispatch('back')}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="avatar">
        {#if contactProfile?.avatarUrl}
          <img src={contactProfile.avatarUrl} alt="{contactName} avatar" />
        {:else}
          {(contactName || contactId || '?').slice(0,1).toUpperCase()}
        {/if}
      </div>
      <div class="header-info">
        <div class="contact-name">{contactName || contactId}</div>
        <div class="status">
          {#if isTyping}
            <span class="typing-indicator">typing...</span>
          {:else}
            <span class="status-dot" class:online={isOnline}></span>
            <span class="online-text" class:online={isOnline}>{isOnline ? 'online' : 'offline'}</span>
          {/if}
        </div>
      </div>
    
        <div class="actions">
          <div class="search-bar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input placeholder="Search messages" bind:value={searchTerm} />
          </div>

          <div class="call-controls">
        {#if isGroup}
          <button 
            class="icon-button" 
            on:click={() => dispatch('openGroupSettings')} 
            title="Group settings"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        {/if}
        {#if callState === 'idle'}
          <button class="icon-button" on:click={startCall} title="Voice call">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
        {:else if callState === 'calling' || callState === 'connecting'}
          <button class="icon-button calling" disabled title="{callState === 'calling' ? 'Calling...' : 'Connecting...'}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" class="pulse">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
          <button class="icon-button end-call" on:click={cancelCall} title="Cancel call">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
          </button>
        {:else if callState === 'connected'}
          <button class="icon-button" on:click={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {#if isMuted}
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 003 3v8a3 3 0 01-6 0V4a3 3 0 013-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            {/if}
          </button>
          <button class="icon-button end-call" on:click={endCall} title="End call">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
        {/if}
        </div>
      </div>
    </header>

    {#if pinnedMessages.length}
      <div class="pinned-bar">
        {#each pinnedMessages as pm (pm.messageId)}
          <div
            class="pinned-pill"
            role="button"
            tabindex="0"
            on:click={() => scrollToMessage(pm.messageId)}
            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToMessage(pm.messageId)}
          >
            <span class="pin-icon">📌</span>
            <span class="pill-text">{pm.text || 'Pinned message'}</span>
            {#if pm.messageId}
              <button class="pill-unpin" on:click|stopPropagation={() => handleTogglePin(pm.messageId)}>✕</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="message-list" bind:this={listEl} on:scroll={handleScroll}>
      <div class="message-list-inner" style="height: {totalHeight ? totalHeight + 'px' : 'auto'}">
        <div style="transform: translateY({offsetY}px); will-change: transform;">
          {#each visibleMessages as m, i (m.messageId || `${visibleStart}-${m.from}-${m.ts || i}`)}
            <div data-message-id={m.messageId}>
              <MessageBubble 
                isOwn={m.from === currentUserId} 
                msg={m} 
                currentUserId={currentUserId}
                isPinned={pinned?.includes(m.messageId || '')}
                on:edit={handleEdit}
                on:delete={handleDelete}
                on:reply={handleReply}
                on:forward={handleForward}
                on:react={handleReact}
                on:togglePin={() => handleTogglePin(m.messageId)}
              />
            </div>
          {/each}
        </div>
      </div>
    </div>

    {#if isUploading}
      <div class="upload-progress-container">
        <div class="upload-info">
          <span class="upload-name">Sending {uploadName}...</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {uploadProgress}%"></div>
        </div>
      </div>
    {/if}
    
    {#if editingMessage}
      <div class="context-banner edit">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
        <div class="banner-content">
          <span class="banner-label">Edit message</span>
          <span class="banner-text">{editingMessage.text}</span>
        </div>
        <button class="banner-close" on:click={cancelEdit}>✕</button>
      </div>
    {/if}
    
    {#if replyingTo}
      <div class="context-banner reply">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
        </svg>
        <div class="banner-content">
          <span class="banner-label">Reply to {replyingTo.from}</span>
          <span class="banner-text">{replyingTo.text.length > 50 ? replyingTo.text.slice(0, 50) + '...' : replyingTo.text}</span>
        </div>
        <button class="banner-close" on:click={cancelReply}>✕</button>
      </div>
    {/if}

    <footer class="chat-footer">
      <div class="input-container">
        <input 
          type="file" 
          bind:this={fileInput} 
          on:change={handleFile} 
          style="display: none" 
        />
        <button class="icon-button" on:click={() => fileInput.click()} title="Send file">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea 
          class="message-input" 
          rows={1} 
          bind:value={draft} 
          bind:this={textareaEl}
          placeholder="Type a message..." 
          on:input={autoResize}
          on:keydown={handleKeydown}
        />
        <VoiceRecorder on:send={handleVoiceMessage} />
        <button class="send-button" on:click={() => { send(); if(textareaEl) textareaEl.style.height = 'auto' }} disabled={!draft.trim() || isSending}>
          {#if isSending}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" class="spinner">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          {/if}
        </button>
      </div>
    </footer>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">💬</div>
      <h3>Select a conversation</h3>
      <p>Choose a contact from the sidebar to start chatting securely.</p>
    </div>
  {/if}
</div>

<style>
  .chat-window {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
    position: relative;
  }

  .chat-header {
    padding: 0.75rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--surface-lighter);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: calc(64px + env(safe-area-inset-top));
    padding-top: calc(0.75rem + env(safe-area-inset-top));
    padding-left: calc(1rem + env(safe-area-inset-left));
    padding-right: calc(1rem + env(safe-area-inset-right));
    flex-shrink: 0;
    z-index: 10;
    position: relative;
    transition: background 0.3s ease;
  }

  .back-button {
    display: none;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    padding: 0.5rem;
    margin-left: -0.5rem;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: var(--surface-lighter);
  }

  @media (max-width: 768px) {
    .back-button {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .avatar {
    width: 40px;
    height: 40px;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.1rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    overflow: hidden;
    flex-shrink: 0;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .header-info {
    flex: 1;
    min-width: 0;
  }

  .contact-name {
    font-weight: 700;
    font-size: 1rem;
    color: var(--fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    font-size: 0.75rem;
    color: var(--subtext);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 600;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background: var(--red);
    border-radius: 50%;
  }

  .status-dot.online {
    background: var(--green);
  }

  .online-text {
    color: var(--fg-muted);
  }

  .online-text.online {
    color: var(--green);
    font-weight: 600;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--surface-lighter);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.35rem 0.5rem;
    color: var(--subtext);
    min-width: 180px;
  }

  .search-bar input {
    background: none;
    border: none;
    outline: none;
    color: var(--fg);
    font-size: 0.9rem;
    width: 100%;
  }

  .search-bar svg {
    color: var(--subtext);
  }

  .typing-indicator {
    color: var(--accent);
    font-weight: 700;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .call-controls {
    display: flex;
    gap: 0.5rem;
  }
  
  .icon-button.calling {
    color: var(--green);
    cursor: not-allowed;
  }
  
  .icon-button.end-call {
    background: var(--red);
    color: white;
  }
  
  .icon-button.end-call:hover {
    background: #c42a3a;
  }
  
  .pulse {
    animation: pulse 1.5s infinite;
  }

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    scroll-behavior: smooth;
    display: flex;
    flex-direction: column;
  }

  .pinned-bar {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem 1rem 0;
    overflow-x: auto;
    background: var(--bg);
  }

  .pinned-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.6rem;
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 10px;
    color: var(--fg);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
  }

  .pinned-pill:hover {
    border-color: var(--accent);
    box-shadow: 0 6px 16px rgba(0,0,0,0.08);
  }

  .pin-icon {
    opacity: 0.7;
  }

  .pill-text {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill-unpin {
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 0.1rem 0.3rem;
    border-radius: 6px;
    font-weight: 700;
  }

  .pill-unpin:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .message-list-inner {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    margin-top: auto;
  }

  .upload-progress-container {
    padding: 0.75rem 1rem;
    background: var(--surface);
    border-top: 1px solid var(--surface-lighter);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .upload-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--fg);
  }

  .upload-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80%;
  }

  .progress-bar-bg {
    height: 6px;
    background: var(--bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease-out;
  }
  
  .context-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--surface);
    border-top: 1px solid var(--surface-lighter);
  }
  
  .context-banner.edit {
    border-left: 3px solid var(--yellow);
  }
  
  .context-banner.reply {
    border-left: 3px solid var(--accent);
  }
  
  .banner-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  
  .banner-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .context-banner.edit .banner-label {
    color: var(--yellow);
  }
  
  .banner-text {
    font-size: 0.9rem;
    color: var(--subtext);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .banner-close {
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    font-size: 1.2rem;
    line-height: 1;
    transition: all 0.2s;
    flex-shrink: 0;
  }
  
  .banner-close:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .chat-footer {
    padding: 0.75rem;
    background: var(--bg);
    border-top: 1px solid var(--surface-lighter);
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    padding-left: calc(0.75rem + env(safe-area-inset-left));
    padding-right: calc(0.75rem + env(safe-area-inset-right));
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    padding: 0.4rem 0.6rem;
    border-radius: 24px;
    max-width: 900px;
    margin: 0 auto;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-container:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(203, 166, 247, 0.1);
  }

  .message-input {
    flex: 1;
    background: none;
    border: none;
    color: var(--fg);
    padding: 0.5rem;
    font-size: 0.95rem;
    resize: none;
    max-height: 150px;
    outline: none;
    line-height: 1.5;
  }

  .icon-button {
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

  .icon-button:hover {
    color: var(--accent);
    background: var(--surface-lighter);
  }

  .send-button {
    background: var(--accent);
    color: var(--accent-fg);
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
    margin-bottom: 2px;
  }

  .send-button:hover:not(:disabled) {
    transform: scale(1.05);
    opacity: 0.9;
  }

  .send-button:disabled {
    background: var(--surface-lighter);
    color: var(--subtext);
    cursor: not-allowed;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--subtext);
    text-align: center;
    padding: 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    filter: grayscale(0.5);
    opacity: 0.5;
  }

  .empty-state h3 {
    color: var(--fg);
    margin-bottom: 0.5rem;
    font-size: 1.5rem;
  }

  .empty-state p {
    max-width: 300px;
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .spinner {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>