<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let contacts: Array<{id:string, last:string, unread?:number}> = []
  export let selected: string | null = null
  export let version = ''
  const dispatch = createEventDispatcher()
  function pick(id:string) { dispatch('select', { id }) }

  let newContactId = ''
  function addContact() {
    if (!newContactId.trim()) return
    dispatch('addContact', { id: newContactId.trim() })
    newContactId = ''
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <div class="flex items-center justify-between mb-4">
      <h2 class="brand">Messages</h2>
      <div class="text-xs font-bold uppercase tracking-wider opacity-50">E2EE</div>
    </div>
    <div class="add-contact">
      <div class="search-wrapper">
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input 
          placeholder="Add user by ID..." 
          class="search-input" 
          bind:value={newContactId}
          on:keydown={(e) => e.key === 'Enter' && addContact()}
        />
      </div>
      <button class="add-btn" on:click={addContact} title="Add contact">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  </div>

  <div class="contact-list">
    {#if contacts.length === 0}
      <div class="empty-contacts">
        <p>No contacts yet.</p>
        <p class="text-xs opacity-50">Add someone by their ID to start chatting.</p>
      </div>
    {/if}
    {#each contacts as c}
      <button 
        class="contact-item" 
        class:active={c.id === selected}
        on:click={() => pick(c.id)}
      >
        <div class="avatar">{c.id.slice(0,1).toUpperCase()}</div>
        <div class="contact-info">
          <div class="contact-top">
            <span class="contact-name">{c.id}</span>
            {#if c.unread}
              <span class="unread-badge">{c.unread}</span>
            {/if}
          </div>
          <div class="contact-last">{c.last || 'No messages yet'}</div>
        </div>
      </button>
    {/each}
  </div>

  <div class="sidebar-footer">
    <div class="flex items-center justify-between w-full opacity-50">
      <div class="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.47 4.34-3.1 8.24-7 9.43V12H5V6.3l7-3.11v8.8z" />
        </svg>
        <span>Secure PGP</span>
      </div>
      <span class="text-[10px] font-mono">v{version}</span>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    width: 100%;
    height: 100%;
    background: var(--surface);
    border-right: 1px solid var(--surface-lighter);
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 1.5rem 1rem 1rem;
  }

  .brand {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--fg);
    letter-spacing: -0.02em;
  }

  .add-contact {
    display: flex;
    gap: 0.5rem;
  }

  .search-wrapper {
    position: relative;
    flex: 1;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--subtext);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    color: var(--fg);
    padding: 0.6rem 0.75rem 0.6rem 2.25rem;
    border-radius: 12px;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(203, 166, 247, 0.1);
  }

  .add-btn {
    background: var(--accent);
    color: var(--accent-fg);
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    transition: transform 0.2s, opacity 0.2s;
  }

  .add-btn:hover {
    transform: scale(1.05);
    opacity: 0.9;
  }

  .contact-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .empty-contacts {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--subtext);
  }

  .contact-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    border: none;
    background: transparent;
    color: var(--fg);
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
    margin-bottom: 0.25rem;
  }

  .contact-item:hover {
    background: var(--surface-lighter);
  }

  .contact-item.active {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .avatar {
    width: 44px;
    height: 44px;
    background: var(--bg);
    border: 2px solid var(--surface-lighter);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    color: var(--accent);
    flex-shrink: 0;
  }

  .contact-item.active .avatar {
    background: rgba(255,255,255,0.2);
    color: white;
    border-color: transparent;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .contact-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.15rem;
  }

  .contact-name {
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-item.active .contact-name {
    color: white;
  }

  .unread-badge {
    background: var(--red);
    color: white;
    font-size: 0.7rem;
    font-weight: 800;
    padding: 0.1rem 0.4rem;
    border-radius: 6px;
    min-width: 18px;
    text-align: center;
  }

  .contact-last {
    font-size: 0.8rem;
    color: var(--subtext);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-item.active .contact-last {
    color: rgba(255,255,255,0.7);
  }

  .sidebar-footer {
    padding: 1rem;
    border-top: 1px solid var(--surface-lighter);
    font-size: 0.75rem;
    font-weight: 600;
    display: flex;
    justify-content: center;
  }
</style>