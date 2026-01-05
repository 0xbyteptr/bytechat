<script lang="ts">
  import MessageBubble from './MessageBubble.svelte'
  import { createEventDispatcher, onMount } from 'svelte'
  export let currentUserId: string
  export let contactId: string | null = null
  interface Message {
    from: string;
    text: string;
    ts?: number;
    file?: { fileName: string; fileType: string; fileData: string };
  }
  export let messages: Array<Message> = []
  export let isTyping = false
  const dispatch = createEventDispatcher()
  let draft = ''
  let fileInput: HTMLInputElement

  function send() { if(!contactId || !draft) return; dispatch('send', { to: contactId, text: draft }); draft = '' }
  
  function handleFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !contactId) return
    
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Maximum size is 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      dispatch('sendFile', { 
        to: contactId, 
        fileData: reader.result, 
        fileName: file.name,
        fileType: file.type 
      })
    }
    reader.readAsDataURL(file)
    fileInput.value = ''
  }

  $: if (draft) {
    dispatch('typing')
  }

  let listEl: HTMLDivElement | null = null
  onMount(()=>{ if(listEl) listEl.scrollTop = listEl.scrollHeight })
  $: if(listEl) listEl.scrollTop = listEl.scrollHeight
</script>

<div class="chat-window">
  {#if contactId}
    <header class="chat-header">      <button class="back-button" on:click={() => dispatch('back')}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>      <div class="avatar">{contactId.slice(0,1).toUpperCase()}</div>
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

    <footer class="chat-footer">
      <div class="input-container">
        <input 
          type="file" 
          bind:this={fileInput} 
          on:change={handleFile} 
          style="display: none" 
        />
        <button class="icon-button" on:click={() => fileInput.click()}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea 
          class="message-input" 
          rows={1} 
          bind:value={draft} 
          placeholder="Type a message..." 
          on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
        />
        <button class="send-button" on:click={send} disabled={!draft.trim()}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
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
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    height: 100%;
  }

  .chat-header {
    padding: 0.75rem 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--surface-lighter);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-button {
    display: none;
    background: transparent;
    border: none;
    color: var(--fg);
    padding: 0.5rem;
    margin-left: -0.5rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .back-button {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .chat-header {
      padding: 0.75rem 1rem;
    }
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--surface-lighter);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: var(--accent);
  }

  .contact-name {
    font-weight: 700;
    font-size: 1rem;
  }

  .status {
    font-size: 0.75rem;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .typing-indicator {
    color: var(--accent);
    font-weight: 600;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  .status-dot {
    width: 6px;
    height: 6px;
    background: var(--success);
    border-radius: 50%;
  }

  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    background-image: radial-gradient(var(--surface-lighter) 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: center;
  }

  .message-list-inner {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chat-footer {
    padding: 1rem 1.5rem;
    background: var(--surface);
    border-top: 1px solid var(--surface-lighter);
  }

  .input-container {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    background: var(--surface-lighter);
    padding: 0.5rem 0.75rem;
    border-radius: 16px;
  }

  .icon-button {
    background: transparent;
    border: none;
    color: var(--muted);
    padding: 0.5rem 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .icon-button:hover {
    color: var(--accent);
  }

  .message-input {
    flex: 1;
    background: transparent;
    border: none;
    padding: 0.5rem 0;
    resize: none;
    max-height: 150px;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .message-input:focus {
    outline: none;
  }

  .send-button {
    background: var(--accent);
    color: var(--accent-fg);
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-bottom: 2px;
  }

  .send-button:hover {
    opacity: 0.9;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    text-align: center;
    padding: 2rem;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    opacity: 0.2;
  }

  .empty-state h3 {
    color: var(--fg);
    margin-bottom: 0.5rem;
  }
</style>