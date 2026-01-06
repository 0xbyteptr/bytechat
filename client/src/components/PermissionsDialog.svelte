<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  
  export let permissions: {
    microphone: boolean
    notifications: boolean
  }
  
  const dispatch = createEventDispatcher()
  
  function requestPermissions() {
    dispatch('request')
  }
  
  function skipPermissions() {
    dispatch('skip')
  }
</script>

<div class="permissions-overlay">
  <div class="permissions-dialog">
    <div class="dialog-header">
      <div class="icon-wrapper">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </div>
      <h2>App Permissions</h2>
      <p class="subtitle">ByteChat needs access to the following features</p>
    </div>
    
    <div class="permissions-list">
      <div class="permission-item" class:granted={permissions.microphone}>
        <div class="permission-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 003 3v8a3 3 0 01-6 0V4a3 3 0 013-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div class="permission-details">
          <h3>Microphone</h3>
          <p>Required for voice calls</p>
        </div>
        {#if permissions.microphone}
          <div class="status-badge granted">Granted</div>
        {:else}
          <div class="status-badge">Required</div>
        {/if}
      </div>
      
      <div class="permission-item" class:granted={permissions.notifications}>
        <div class="permission-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </div>
        <div class="permission-details">
          <h3>Notifications</h3>
          <p>Get alerts for new messages</p>
        </div>
        {#if permissions.notifications}
          <div class="status-badge granted">Granted</div>
        {:else}
          <div class="status-badge">Optional</div>
        {/if}
      </div>
    </div>
    
    <div class="dialog-actions">
      <button class="btn-primary" on:click={requestPermissions}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Grant Permissions
      </button>
      <button class="btn-secondary" on:click={skipPermissions}>
        Skip
      </button>
    </div>
    
    <p class="privacy-note">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
      </svg>
      Your privacy matters. All data is end-to-end encrypted.
    </p>
  </div>
</div>

<style>
  .permissions-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .permissions-dialog {
    background: var(--surface);
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .dialog-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .icon-wrapper {
    display: inline-flex;
    padding: 1rem;
    background: rgba(var(--accent-rgb, 137, 180, 250), 0.1);
    border-radius: 50%;
    margin-bottom: 1rem;
  }

  .icon-wrapper svg {
    color: var(--accent);
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--fg);
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    color: var(--subtext);
    font-size: 0.9rem;
    margin: 0;
  }

  .permissions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .permission-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--bg);
    border-radius: 12px;
    border: 2px solid var(--surface-lighter);
    transition: all 0.2s ease;
  }

  .permission-item.granted {
    border-color: var(--green);
    background: rgba(var(--green-rgb, 166, 227, 161), 0.05);
  }

  .permission-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--surface-lighter);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .permission-item.granted .permission-icon {
    background: rgba(var(--green-rgb, 166, 227, 161), 0.2);
  }

  .permission-item.granted .permission-icon svg {
    color: var(--green);
  }

  .permission-details {
    flex: 1;
  }

  .permission-details h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg);
    margin: 0 0 0.25rem 0;
  }

  .permission-details p {
    font-size: 0.85rem;
    color: var(--subtext);
    margin: 0;
  }

  .status-badge {
    padding: 0.35rem 0.75rem;
    background: var(--surface-lighter);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--subtext);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-badge.granted {
    background: rgba(var(--green-rgb, 166, 227, 161), 0.2);
    color: var(--green);
  }

  .dialog-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.875rem 1.5rem;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--crust);
  }

  .btn-primary:hover {
    background: var(--blue);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--accent-rgb, 137, 180, 250), 0.4);
  }

  .btn-secondary {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .btn-secondary:hover {
    background: var(--surface);
  }

  .privacy-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.75rem;
    background: rgba(var(--green-rgb, 166, 227, 161), 0.05);
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--subtext);
    line-height: 1.4;
  }

  .privacy-note svg {
    color: var(--green);
    flex-shrink: 0;
  }

  @media (max-width: 480px) {
    .permissions-dialog {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    .permission-icon {
      width: 40px;
      height: 40px;
    }

    .permission-icon svg {
      width: 20px;
      height: 20px;
    }
  }
</style>
