<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let contacts: Array<{id:string, last:string, unread?:number}> = []
  export let groups: Array<{id:string, name:string, members:string[], admin:string}> = []
  export let selected: string | null = null
  export let version = ''
  export let updateAvailable = false
  export let isUpdating = false
  const dispatch = createEventDispatcher()
  function pick(id:string) { dispatch('select', { id }) }

  let newContactId = ''
  function addContact() {
    if (!newContactId.trim()) return
    dispatch('addContact', { id: newContactId.trim() })
    newContactId = ''
  }

  let showCreateGroup = false
  let groupName = ''
  let groupMembers = ''
  function createGroup() {
    if (!groupName.trim()) return
    const members = groupMembers.split(',').map(m => m.trim()).filter(m => m)
    dispatch('createGroup', { name: groupName.trim(), members })
    groupName = ''
    groupMembers = ''
    showCreateGroup = false
  }
</script>

<aside class="sidebar">
  <div class="sidebar-header">
    <div class="flex items-center justify-between mb-4">
      <h2 class="brand">Messages</h2>
      <div class="flex items-center gap-1">
        <button class="settings-btn" on:click={() => dispatch('logout')} title="Logout">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
        <button class="settings-btn" on:click={() => dispatch('openSettings')} title="Settings">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2 2 2 0 0 0 2 2 2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2 2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2 2 2 0 0 0 2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2 2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </div>
    {#if updateAvailable}
      <button class="update-banner" on:click={() => dispatch('update')} disabled={isUpdating}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {isUpdating ? 'Downloading update...' : 'Update Available! Tap to install'}
      </button>
    {/if}
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

  <div class="px-4 flex gap-4 text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">
    <button class:text-accent={!showCreateGroup} on:click={() => showCreateGroup = false}>Chats</button>
    <button class:text-accent={showCreateGroup} on:click={() => showCreateGroup = true}>New Group</button>
  </div>

  <div class="contact-list">
    {#if showCreateGroup}
      <div class="p-2 flex flex-col gap-2">
        <input placeholder="Group Name" class="search-input" bind:value={groupName} />
        <textarea placeholder="Members (ID1, ID2...)" class="search-input min-h-[80px] py-2" bind:value={groupMembers}></textarea>
        <button class="add-btn w-full h-10" on:click={createGroup}>Create Group</button>
      </div>
    {:else}
      {#if contacts.length === 0 && groups.length === 0}
        <div class="empty-contacts">
          <p>No chats yet.</p>
          <p class="text-xs opacity-50">Add someone by their ID to start chatting.</p>
        </div>
      {/if}
      
      {#each groups as g}
        <button 
          class="contact-item" 
          class:active={g.id === selected}
          on:click={() => pick(g.id)}
        >
          <div class="avatar !bg-accent !text-white">#</div>
          <div class="contact-info">
            <div class="contact-top">
              <span class="contact-name">{g.name}</span>
            </div>
            <div class="contact-last">{g.members.length} members: {g.members.join(', ')}</div>
          </div>
        </button>
      {/each}

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
    {/if}
  </div>

  <div class="sidebar-footer">
    <div class="flex items-center justify-between w-full opacity-50">
      <div class="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.47 4.34-3.1 8.24-7 9.43V12H5V6.3l7-3.11v8.8z" />
        </svg>
        <span>Secure E2EE</span>
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
    padding-top: calc(1.5rem + env(safe-area-inset-top));
    padding-left: calc(1rem + env(safe-area-inset-left));
    padding-right: calc(1rem + env(safe-area-inset-right));
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .update-banner {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    text-decoration: none;
    border: none;
    width: 100%;
    cursor: pointer;
    animation: pulse 2s infinite;
  }

  .update-banner:disabled {
    opacity: 0.7;
    cursor: wait;
    animation: none;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }

  .brand {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--fg);
    letter-spacing: -0.02em;
  }

  .settings-btn {
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

  .settings-btn:hover {
    color: var(--accent);
    background: var(--surface-lighter);
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
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    padding-left: calc(1rem + env(safe-area-inset-left));
    padding-right: calc(1rem + env(safe-area-inset-right));
  }
</style>