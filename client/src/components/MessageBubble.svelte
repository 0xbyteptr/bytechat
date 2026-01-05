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
    width: 100%;
  }

  .message-row.is-own {
    justify-content: flex-end;
  }

  .bubble {
    max-width: 80%;
    padding: 0.6rem 0.8rem;
    border-radius: 16px;
    position: relative;
    font-size: 0.95rem;
    line-height: 1.5;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    word-break: break-word;
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