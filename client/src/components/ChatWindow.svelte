<script lang="ts">
  import MessageBubble from './MessageBubble.svelte'
  import { createEventDispatcher, onMount, afterUpdate, tick } from 'svelte'
  export let currentUserId: string
  export let contactId: string | null = null
  interface Message {
    from: string;
    text: string;
    ts?: number;
    file?: { fileName: string; fileType: string; fileData?: string; fileUrl?: string };
  }
  export let messages: Array<Message> = []
  export let isTyping = false
  const dispatch = createEventDispatcher()
  const MAX_FILE_SIZE = parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '52428800')
  let draft = ''
  let fileInput: HTMLInputElement
  let uploadProgress = 0
  let isUploading = false
  let uploadName = ''

  function send() { if(!contactId || !draft) return; dispatch('send', { to: contactId, text: draft }); draft = '' }
  
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

  let listEl: HTMLDivElement | null = null
  let autoscroll = true

  function handleScroll() {
    if (!listEl) return
    const threshold = 150
    autoscroll = (listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight) < threshold
  }

  afterUpdate(() => {
    if (autoscroll && listEl) {
      listEl.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' })
    }
  })

  $: if (contactId && listEl) {
    autoscroll = true
    tick().then(() => {
      if(listEl) listEl.scrollTop = listEl.scrollHeight
    })
  }

  function autoResize(e: Event) {
    const el = e.target as HTMLTextAreaElement
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
    if (autoscroll) {
      tick().then(() => { if(listEl) listEl.scrollTop = listEl.scrollHeight })
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
      const el = e.target as HTMLTextAreaElement
      el.style.height = 'auto'
    }
  }

  function handleSendClick() {
    send()
    // We can use a selector or just rely on the fact that the textarea is bound to draft
    // and we want to reset its height. Since we don't have a direct ref here easily
    // without adding one, let's just add a ref for the textarea.
  }

  let textareaEl: HTMLTextAreaElement
</script>

<div class="chat-window">
  {#if contactId}
    <header class="chat-header">
      <button class="back-button" on:click={() => dispatch('back')}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="avatar">{contactId.slice(0,1).toUpperCase()}</div>
      <div class="header-info">
        <div class="contact-name">{contactId}</div>
        <div class="status">
          {#if isTyping}
            <span class="typing-indicator">typing...</span>
          {:else}
            <span class="status-dot"></span>
            online
          {/if}
        </div>
      </div>
    </header>

    <div class="message-list" bind:this={listEl}>
      <div class="message-list-inner">
        {#each messages as m}
          <MessageBubble isOwn={m.from === currentUserId} msg={m} />
        {/each}
      </div>
    </div>

    {#if isUploading}
      <div class="upload-progress-container">
        <div class="upload-info">
          <span class="upload-name">Sending {uploadName}...</span>
          <span class="upload-percent">{uploadProgress}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: {uploadProgress}%"></div>
        </div>
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
        <button class="send-button" on:click={() => { send(); if(textareaEl) textareaEl.style.height = 'auto' }} disabled={!draft.trim()}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
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
    background: var(--green);
    border-radius: 50%;
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

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    scroll-behavior: smooth;
    display: flex;
    flex-direction: column;
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
</style>