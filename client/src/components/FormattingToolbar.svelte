<script lang="ts">
  import { getFormattingToolbar } from '../lib/chatEnhancements'
  
  export let textareaEl: HTMLTextAreaElement | undefined
  export let compact = false
  
  const toolbar = getFormattingToolbar()
  
  function applyFormat(prefix: string, suffix: string) {
    if (!textareaEl) return
    
    const {selectionStart, selectionEnd, value} = textareaEl
    const selectedText = value.slice(selectionStart, selectionEnd)
    const before = value.slice(0, selectionStart)
    const after = value.slice(selectionEnd)
    
    const formatted = `${before}${prefix}${selectedText || 'text'}${suffix}${after}`
    textareaEl.value = formatted
    
    // Move cursor to end of formatted text
    textareaEl.selectionStart = selectionStart + prefix.length + (selectedText || 'text').length
    textareaEl.selectionEnd = textareaEl.selectionStart
    textareaEl.focus()
    
    // Trigger input event for reactivity
    textareaEl.dispatchEvent(new Event('input', {bubbles: true}))
  }
</script>

<div class="formatting-toolbar" class:compact>
  {#each toolbar as item}
    <button
      class="format-btn"
      title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
      on:click={() => applyFormat(item.prefix, item.suffix)}
    >
      {#if item.label === 'Bold'}
        <strong>B</strong>
      {:else if item.label === 'Italic'}
        <em>I</em>
      {:else if item.label === 'Code'}
        <code>&lt;&gt;</code>
      {:else if item.label === 'Strikethrough'}
        <del>S</del>
      {:else if item.label === 'Spoiler'}
        <span class="spoiler-demo">||</span>
      {:else if item.label === 'Quote'}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-4.716-2-7-2s-7 .75-7 2c0 1.972 0 4 0 6 0 4-1 6 2 6s2-1 2-3v-4c0-2.667 1.5-4 3-4 2 0 4 1.5 4 3 0 5-2 5-5 5z"/>
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-4.716-2-7-2s-7 .75-7 2c0 1.972 0 4 0 6 0 4-1 6 2 6s2-1 2-3v-4c0-2.667 1.5-4 3-4 2 0 4 1.5 4 3 0 5-2 5-5 5z"/>
        </svg>
      {/if}
    </button>
  {/each}
</div>

<style>
  .formatting-toolbar {
    display: flex;
    gap: 0.35rem;
    padding: 0.5rem;
    background: var(--surface-lighter);
    border-radius: 8px;
    border: 1px solid var(--surface-lighter);
    flex-wrap: wrap;
  }

  .formatting-toolbar.compact {
    gap: 0.25rem;
    padding: 0.25rem;
  }

  .format-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    border: 1px solid var(--overlay);
    border-radius: 6px;
    background: var(--surface);
    color: var(--fg);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 700;
    transition: all 0.2s;
  }

  .format-btn:hover {
    background: var(--overlay);
    border-color: var(--accent);
    color: var(--accent);
  }

  .format-btn:active {
    transform: scale(0.95);
  }

  .format-btn strong {
    font-weight: 800;
  }

  .format-btn em {
    font-style: italic;
    font-weight: 700;
  }

  .format-btn code {
    font-size: 0.75rem;
    font-weight: 800;
  }

  .format-btn del {
    text-decoration: line-through;
    font-weight: 700;
  }

  .format-btn .spoiler-demo {
    font-weight: 800;
    opacity: 0.7;
  }

  .format-btn svg {
    width: 16px;
    height: 16px;
  }
</style>
