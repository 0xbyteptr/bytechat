<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useUserStatus, getStatusColor, getStatusIcon, type UserStatus } from '../lib/useUserStatus'
  
  export let show: boolean = false
  
  const dispatch = createEventDispatcher()
  const statusManager = useUserStatus()
  const { state } = statusManager
  
  let customMessage = $state.customMessage
  
  const statuses: { value: UserStatus; label: string; description: string }[] = [
    { value: 'online', label: 'Online', description: 'Available to chat' },
    { value: 'away', label: 'Away', description: 'Not at keyboard' },
    { value: 'busy', label: 'Busy', description: 'Do not disturb' },
    { value: 'offline', label: 'Offline', description: 'Invisible to others' }
  ]
  
  function selectStatus(status: UserStatus) {
    statusManager.setStatus(status, customMessage)
    dispatch('change', { status, customMessage })
  }
  
  function updateCustomMessage() {
    statusManager.setStatus($state.status, customMessage)
    dispatch('change', { status: $state.status, customMessage })
  }
  
  function clearMessage() {
    customMessage = ''
    statusManager.clearCustomMessage()
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="status-selector"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown|stopPropagation
  >
    <div class="status-header">
      <h3>Set Status</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    
    <div class="status-options">
      {#each statuses as status}
        <button 
          class="status-option"
          class:active={$state.status === status.value}
          on:click={() => selectStatus(status.value)}
        >
          <span class="status-icon" style="color: {getStatusColor(status.value)}">
            {getStatusIcon(status.value)}
          </span>
          <div class="status-info">
            <span class="status-label">{status.label}</span>
            <span class="status-description">{status.description}</span>
          </div>
          {#if $state.status === status.value}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2.5" fill="none"/>
            </svg>
          {/if}
        </button>
      {/each}
    </div>
    
    <div class="custom-message">
      <label for="status-message">Custom Message</label>
      <div class="message-input-group">
        <input 
          id="status-message"
          type="text"
          placeholder="What's on your mind?"
          bind:value={customMessage}
          on:blur={updateCustomMessage}
          maxlength="100"
        />
        {#if customMessage}
          <button class="clear-btn" on:click={clearMessage} title="Clear message">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .status-selector {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 16px;
    min-width: 300px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    animation: slideDown 0.2s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .status-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--fg);
  }
  
  .close-btn {
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }
  
  .status-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
  }
  
  .status-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    color: var(--fg);
  }
  
  .status-option:hover {
    background: var(--surface-lighter);
  }
  
  .status-option.active {
    background: var(--accent);
    color: var(--accent-fg);
  }
  
  .status-icon {
    font-size: 24px;
    line-height: 1;
  }
  
  .status-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }
  
  .status-label {
    font-weight: 600;
    font-size: 14px;
  }
  
  .status-description {
    font-size: 12px;
    opacity: 0.7;
  }
  
  .custom-message {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--surface-lighter);
  }
  
  .custom-message label {
    font-size: 12px;
    font-weight: 600;
    color: var(--subtext);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .message-input-group {
    position: relative;
  }
  
  .message-input-group input {
    width: 100%;
    background: var(--bg);
    border: 2px solid var(--surface-lighter);
    color: var(--fg);
    padding: 8px 32px 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    transition: all 0.2s;
  }
  
  .message-input-group input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .clear-btn:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }
</style>
