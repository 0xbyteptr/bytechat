<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let contacts: Array<{id:string, last:string, unread?:number}> = []
  export let selected: string | null = null
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
    <h2 class="brand">ByteChat</h2>
    <div class="add-contact">
      <input 
        placeholder="Add user by ID..." 
        class="search-input" 
        bind:value={newContactId}
        on:keydown={(e) => e.key === 'Enter' && addContact()}
      />
      <button class="add-btn" on:click={addContact}>+</button>
    </div>
  </div>

  <div class="contact-list">
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
    E2EE · PGP Identity
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
    margin-bottom: 1rem;
    color: var(--accent);
    letter-spacing: -0.02em;
  }

  .add-contact {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .add-btn {
    background: var(--accent);
    color: var(--accent-fg);
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-weight: 800;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
  }

  .search-input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    font-size: 0.875rem;
  }

  .contact-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .contact-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border: none;
    background: transparent;
    text-align: left;
    color: inherit;
    margin-bottom: 0.25rem;
  }

  .contact-item:hover {
    background: var(--surface-lighter);
  }

  .contact-item.active {
    background: var(--surface-lighter);
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    background: linear-gradient(135deg, #89b4fa, #cba6f7);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    color: #11111b;
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .contact-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.125rem;
  }

  .contact-name {
    font-weight: 600;
    font-size: 0.9375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unread-badge {
    background: var(--accent);
    color: var(--accent-fg);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
  }

  .contact-last {
    font-size: 0.8125rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    padding: 1rem;
    font-size: 0.75rem;
    color: var(--muted);
    text-align: center;
    border-top: 1px solid var(--surface-lighter);
  }
</style>