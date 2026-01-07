<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { renderMarkdown } from '../lib/markdown'
  
  export let msg: { 
    from: string; 
    text: string; 
    ts?: number;
    messageId?: string;
    file?: { fileName: string; fileType: string; fileData?: string; fileUrl?: string };
    editedAt?: number;
    deleted?: boolean;
    replyTo?: { messageId: string; text: string; from: string };
    read?: boolean;
    readAt?: number;
    type?: 'text' | 'call' | 'voice';
    callData?: {
      duration?: number;
      status: 'missed' | 'completed' | 'cancelled' | 'declined';
      initiator: string;
    };
    voiceData?: {
      duration?: number;
      audioUrl?: string;
    };
    reactions?: Record<string, string[]>;
    failedDecrypt?: boolean;
  }
  export let isOwn = false
  export let isPinned = false
  export let currentUserId = ''
  
  const dispatch = createEventDispatcher()
  let showActions = false

  function fmt(ts?: number) {
    if(!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
  }

  function isImage(type: string) {
    return type.startsWith('image/')
  }
  
  function getCallIcon(status: string): string {
    switch(status) {
      case 'completed': return '☎️'
      case 'missed': return '📵'
      case 'cancelled': return '❌'
      case 'declined': return '📞'
      default: return '☎️'
    }
  }
  
  function handleEdit() {
    dispatch('edit', msg)
    showActions = false
  }
  
  function handleDelete() {
    dispatch('delete', msg)
    showActions = false
  }
  
  function handleReply() {
    dispatch('reply', msg)
    showActions = false
  }
  
  function handleForward() {
    dispatch('forward', msg)
    showActions = false
  }

  function handleTogglePin() {
    if (!msg.messageId) return
    dispatch('togglePin', { messageId: msg.messageId })
    showActions = false
  }

  function handleReaction(emoji: string) {
    if (!msg.messageId) return
    dispatch('react', { messageId: msg.messageId, emoji })
    showActions = false
  }
  
  function formatVoiceDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const defaultReactions = ['👍','❤️','😂','😮','😢','🔥']
</script>

<div class="message-row" class:is-own={isOwn}>
  <div class="bubble" role="button" tabindex="0" on:contextmenu|preventDefault={() => showActions = !showActions}>
    {#if isPinned}
      <div class="pin-tag">📌 Pinned</div>
    {/if}

    {#if msg.replyTo}
      <div class="reply-preview">
        <div class="reply-line"></div>
        <div class="reply-content">
          <span class="reply-author">{msg.replyTo.from}</span>
          <span class="reply-text">{msg.replyTo.text.length > 50 ? msg.replyTo.text.slice(0, 50) + '...' : msg.replyTo.text}</span>
        </div>
      </div>
    {/if}
    
    {#if msg.failedDecrypt}
      <div class="failed-decrypt">Could not decrypt this message</div>
    {:else if msg.deleted}
      <div class="deleted-message">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        This message was deleted
      </div>
    {:else if msg.file}
      <div class="file-attachment">
        {#if isImage(msg.file.fileType)}
          <img src={msg.file.fileUrl || msg.file.fileData} alt={msg.file.fileName} class="attached-image" />
        {:else}
          <div class="file-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
        {/if}
        <div class="file-info">
          <span class="file-name">{msg.file.fileName}</span>
          <a href={msg.file.fileUrl || msg.file.fileData} target="_blank" rel="noopener noreferrer" download={msg.file.fileName} class="download-link">
            {msg.file.fileUrl ? 'Open Link' : 'Download'}
          </a>
        </div>
      </div>
    {:else if msg.type === 'call'}
      <div class="call-message">
        <span class="call-icon">{getCallIcon(msg.callData?.status || 'completed')}</span>
        <span class="call-text">{msg.text}</span>
      </div>
    {:else if msg.type === 'voice' && msg.voiceData}
      <div class="voice-message">
        <audio controls src={msg.voiceData.audioUrl}></audio>
        {#if msg.voiceData.duration}
          <span class="voice-duration">{formatVoiceDuration(msg.voiceData.duration)}</span>
        {/if}
      </div>
    {:else}
      <div class="text">{@html renderMarkdown(msg.text)}</div>
    {/if}
    
    <div class="meta">
      <span class="time">{fmt(msg.ts)}</span>
      {#if msg.editedAt}
        <span class="edited">edited</span>
      {/if}
      {#if isOwn}
        {#if msg.read}
          <span class="status" title="Read at {fmt(msg.readAt)}">✓✓</span>
        {:else}
          <span class="status">✓</span>
        {/if}
      {/if}
    </div>
    
    {#if showActions && !msg.deleted}
      <div class="action-menu">
        {#if isOwn}
          <button class="action-btn" on:click={handleEdit}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Edit
          </button>
          <button class="action-btn" on:click={handleDelete}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
            Delete
          </button>
        {/if}
        <button class="action-btn" on:click={handleTogglePin}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M14 2l1 1-2.5 4.5 4 3L17 12l-2.5 1.5v6l-1 .5-1-.5v-6L10 12l.5-1.5 4-3L12 3l1-1z"/>
          </svg>
          {isPinned ? 'Unpin' : 'Pin'}
        </button>
        <button class="action-btn" on:click={handleReply}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
          </svg>
          Reply
        </button>
        <button class="action-btn" on:click={handleForward}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
          </svg>
          Forward
        </button>
        <div class="reaction-row">
          {#each defaultReactions as emoji}
            <button class="reaction-btn" on:click={() => handleReaction(emoji)}>{emoji}</button>
          {/each}
        </div>
      </div>
    {/if}

    {#if msg.reactions}
      <div class="reactions">
        {#each Object.entries(msg.reactions) as [emoji, users]}
          <span class:own-reacted={users && users.includes(currentUserId)}>{emoji} {users?.length || 0}</span>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .message-row {
    display: flex;
    margin-bottom: 0.75rem;
    padding: 0 1rem;
  }

  .message-row.is-own {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 70%;
    padding: 0.5rem 0.75rem;
    border-radius: 12px;
    word-wrap: break-word;
    position: relative;
    cursor: pointer;
  }

  @media (max-width: 480px) {
    .bubble {
      max-width: 90%;
    }
  }

  .message-row:not(.is-own) .bubble {
    background: var(--surface);
    color: var(--fg);
    border-bottom-left-radius: 4px;
  }

  .message-row.is-own .bubble {
    background: var(--accent);
    color: var(--accent-fg);
    border-bottom-right-radius: 4px;
  }

  .pin-tag {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-bottom: 0.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .reply-preview {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: rgba(0,0,0,0.1);
    border-radius: 8px;
    font-size: 0.85rem;
  }
  
  .reply-line {
    width: 3px;
    background: currentColor;
    opacity: 0.5;
    border-radius: 2px;
  }
  
  .reply-content {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;
  }
  
  .reply-author {
    font-weight: 700;
    opacity: 0.9;
  }
  
  .reply-text {
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .deleted-message {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-style: italic;
    opacity: 0.6;
  }

  .failed-decrypt {
    color: var(--fg);
    background: rgba(255, 184, 108, 0.15);
    border: 1px solid rgba(255, 184, 108, 0.3);
    padding: 0.4rem 0.6rem;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }
  
  .call-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }
  
  .call-icon {
    font-size: 1.2em;
  }
  
  .call-text {
    font-size: 0.9rem;
    opacity: 0.9;
  }
  
  .edited {
    font-size: 0.7rem;
    opacity: 0.6;
    font-style: italic;
  }
  
  .action-menu {
    position: absolute;
    top: -40px;
    right: 0;
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    z-index: 10;
  }
  
  .message-row.is-own .action-menu {
    right: auto;
    left: 0;
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.6rem;
    background: none;
    border: none;
    color: var(--fg);
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;
    white-space: nowrap;
  }
  
  .action-btn:hover {
    background: var(--surface-lighter);
  }

  .reaction-row {
    display: flex;
    gap: 0.25rem;
    margin-left: 0.35rem;
  }

  .reaction-btn {
    background: none;
    border: 1px solid var(--surface-lighter);
    border-radius: 6px;
    padding: 0.2rem 0.4rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .reactions {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
    font-size: 0.85rem;
  }

  .reactions span {
    background: rgba(0,0,0,0.08);
    padding: 0.2rem 0.4rem;
    border-radius: 12px;
  }

  .message-row.is-own .reactions span {
    background: rgba(255,255,255,0.2);
  }

  .own-reacted {
    outline: 1px solid var(--accent);
  }
  
  .deleted-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--fg-muted);
    font-style: italic;
    padding: 0.25rem 0;
  }
  
  .message-row:not(.is-own) .bubble {
    background: var(--surface);
    color: var(--fg);
    border-bottom-left-radius: 4px;
  }

  .message-row.is-own .bubble {
    background: var(--accent);
    color: var(--accent-fg);
    border-bottom-right-radius: 4px;
  }

  .file-attachment {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 200px;
  }

  @media (max-width: 480px) {
    .file-attachment {
      min-width: 150px;
    }
  }

  .attached-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 12px;
    display: block;
    object-fit: cover;
  }

  .file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    font-size: 0.8rem;
    background: rgba(0,0,0,0.1);
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
  }

  .message-row.is-own .file-info {
    background: rgba(255,255,255,0.15);
  }

  .file-name {
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .download-link {
    color: var(--accent);
    font-weight: 800;
    text-decoration: none;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .message-row.is-own .download-link {
    color: white;
    text-decoration: underline;
  }

  .text {
    white-space: pre-wrap;
  }
  
  .voice-message {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 250px;
  }
  
  .voice-message audio {
    width: 100%;
    height: 36px;
    border-radius: 8px;
  }
  
  .voice-duration {
    font-size: 11px;
    font-family: var(--font-mono);
    opacity: 0.7;
    text-align: right;
  }
  
  /* Markdown styles */
  .text :global(strong) {
    font-weight: 700;
  }
  
  .text :global(em) {
    font-style: italic;
  }
  
  .text :global(del) {
    text-decoration: line-through;
    opacity: 0.7;
  }
  
  .text :global(.inline-code) {
    background: rgba(0, 0, 0, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.9em;
  }
  
  .message-row.is-own .text :global(.inline-code) {
    background: rgba(255, 255, 255, 0.2);
  }
  
  .text :global(.code-block) {
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 8px 0;
  }
  
  .message-row.is-own .text :global(.code-block) {
    background: rgba(255, 255, 255, 0.15);
  }
  
  .text :global(.code-block code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    line-height: 1.5;
  }
  
  .text :global(.spoiler) {
    background: rgba(0, 0, 0, 0.8);
    color: transparent;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .text :global(.spoiler:hover) {
    background: rgba(0, 0, 0, 0.4);
    color: inherit;
  }
  
  .text :global(.mention) {
    background: rgba(var(--accent-rgb), 0.2);
    color: var(--accent);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
  }
  
  .message-row.is-own .text :global(.mention) {
    background: rgba(255, 255, 255, 0.3);
    color: var(--accent-fg);
  }
  
  .text :global(a) {
    color: var(--blue);
    text-decoration: underline;
    font-weight: 500;
  }
  
  .message-row.is-own .text :global(a) {
    color: var(--accent-fg);
    opacity: 0.9;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
    margin-top: 0.25rem;
    font-size: 0.7rem;
    opacity: 0.7;
    font-weight: 600;
  }

  .time {
    font-variant-numeric: tabular-nums;
  }

  .status {
    font-weight: 800;
  }
</style>