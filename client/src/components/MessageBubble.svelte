<script lang="ts">
  export let msg: { 
    from: string; 
    text: string; 
    ts?: number;
    file?: { fileName: string; fileType: string; fileData: string }
  }
  export let isOwn = false

  function fmt(ts?: number) {
    if(!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
  }

  function isImage(type: string) {
    return type.startsWith('image/')
  }
</script>

<div class="message-row" class:is-own={isOwn}>
  <div class="bubble">
    {#if msg.file}
      <div class="file-attachment">
        {#if isImage(msg.file.fileType)}
          <img src={msg.file.fileData} alt={msg.file.fileName} class="attached-image" />
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
          <a href={msg.file.fileData} download={msg.file.fileName} class="download-link">Download</a>
        </div>
      </div>
    {:else}
      <div class="text">{msg.text}</div>
    {/if}
    <div class="meta">
      <span class="time">{fmt(msg.ts)}</span>
      {#if isOwn}
        <span class="status">✓✓</span>
      {/if}
    </div>
  </div>
</div>

<style>
  .message-row {
    display: flex;
    margin-bottom: 0.25rem;
  }

  .bubble {
    max-width: 75%;
    padding: 0.625rem 0.875rem;
    border-radius: 18px;
    position: relative;
    font-size: 0.9375rem;
    line-height: 1.4;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  .file-attachment {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 150px;
  }

  .attached-image {
    max-width: 100%;
    border-radius: 8px;
    display: block;
  }

  .file-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    font-size: 0.8125rem;
    background: rgba(0,0,0,0.05);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
  }

  .file-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .download-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 700;
  }

  .download-link:hover {
    text-decoration: underline;
  }

  .message-row:not(.is-own) .bubble {
    background: var(--surface-lighter);
    color: var(--fg);
    border-bottom-left-radius: 4px;
  }

  .is-own {
    justify-content: flex-end;
  }

  .is-own .bubble {
    background: var(--accent);
    color: var(--accent-fg);
    border-bottom-right-radius: 4px;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    margin-top: 0.25rem;
    font-size: 0.6875rem;
    opacity: 0.7;
  }

  .is-own .meta {
    color: var(--accent-fg);
  }

  .status {
    font-weight: 700;
  }
</style>