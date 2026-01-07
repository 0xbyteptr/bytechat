<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  export let contacts: Array<{id:string, name?:string, last:string, unread?:number}> = []
  export let groups: Array<{id:string, name:string, members:string[], admin:string}> = []
  export let selected: string | null = null
  export let version = ''
  export let updateAvailable = false
  export let isUpdating = false
  export let isNewerThanRelease = false
  export let latestVersion = ''
  export let onlineUsers: Set<string> = new Set()
  export let userProfile: { displayName?: string; avatarUrl?: string; bannerUrl?: string; bio?: string; z?: string } | null = null
  export let userId = ''
  export let profiles: Record<string, { displayName?: string; avatarUrl?: string; bannerUrl?: string; bio?: string }> = {}

  $: if (onlineUsers && onlineUsers.size >= 0) {
    console.log('Sidebar received onlineUsers:', Array.from(onlineUsers))
  }
  
  const dispatch = createEventDispatcher()
  function pick(id:string) { dispatch('select', { id }) }
  
  function openProfile(userId: string) {
    dispatch('openProfile', { userId })
  }

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
  <div class="sidebar-header" style={userProfile?.bannerUrl ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.6), var(--surface)), url(${userProfile.bannerUrl}); background-size: cover; background-position: center;` : ''}>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="user-avatar" on:click={() => dispatch('openSettings')} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') dispatch('openSettings') }} role="button" tabindex="0" title="Open Settings">
          {#if userProfile?.avatarUrl}
            <img src={userProfile.avatarUrl} alt="Your avatar" />
          {:else}
            {(userId || '?').slice(0, 1).toUpperCase()}
          {/if}
        </div>
        <div class="user-info">
          <h2 class="brand">{userProfile?.displayName || 'Messages'}</h2>
          {#if userProfile?.z}
            <p class="user-bio">{userProfile.bio}</p>
          {/if}
        </div>
      </div>
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
    {#if isNewerThanRelease}
      <div class="dev-banner">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div class="dev-text">
          <strong>Dev Version</strong>
          <span>v{version} (release: v{latestVersion})</span>
        </div>
      </div>
    {/if}
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
          class:has-banner={Boolean(profiles[c.id]?.bannerUrl)}
          class:has-banner-active={Boolean(profiles[c.id]?.bannerUrl) && c.id === selected}
          style={profiles[c.id]?.bannerUrl 
            ? `background-image: linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15)), url(${profiles[c.id].bannerUrl}); background-size: cover; background-position: center;` 
            : ''}
          on:click={() => pick(c.id)}
        >
          <div class="avatar-wrapper" on:click|stopPropagation={() => openProfile(c.id)} on:keydown|stopPropagation={(e) => { if (e.key === 'Enter' || e.key === ' ') openProfile(c.id) }} role="button" tabindex="0">
              <div class="avatar">
                {#if profiles[c.id]?.avatarUrl}
                  <img src={profiles[c.id].avatarUrl} alt={profiles[c.id]?.displayName || c.id} />
                {:else}
                  {(profiles[c.id]?.displayName || c.name || c.id).slice(0,1).toUpperCase()}
                {/if}
              </div>
            {#if onlineUsers.has(c.id)}
              <div class="online-indicator" title="Online"></div>
            {/if}
          </div>
          <div class="contact-info">
            <div class="contact-top">
              <span class="contact-name">{profiles[c.id]?.displayName || c.name || c.id}</span>
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
    position: relative;
    transition: background 0.3s ease;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-fg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.1rem;
    cursor: pointer;
    transition: all 0.2s;
    overflow: hidden;
    flex-shrink: 0;
  }

  .user-avatar:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }

  .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }

  .user-bio {
    font-size: 0.75rem;
    color: var(--subtext);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .dev-banner {
    background: linear-gradient(135deg, #f9e2af 0%, #fab387 100%);
    color: var(--bg);
    padding: 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 2px solid rgba(250, 179, 135, 0.3);
    margin-bottom: 0.5rem;
  }

  .dev-banner svg {
    flex-shrink: 0;
  }

  .dev-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .dev-text strong {
    font-weight: 800;
    font-size: 0.85rem;
  }

  .dev-text span {
    font-size: 0.7rem;
    opacity: 0.9;
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

  .contact-item.active:not(.has-banner) {
    background: var(--accent);
    color: var(--accent-fg);
  }

  /* Preserve banner image on hover and improve legibility */
  .contact-item.has-banner:hover {
    background: none;
  }
  .contact-item.has-banner {
    color: white;
    text-shadow: 0 1px 1px rgba(0,0,0,0.25);
  }
  .contact-item.has-banner-active {
    box-shadow: 0 0 0 2px var(--accent) inset;
  }
  .contact-item.has-banner .contact-last {
    color: rgba(255,255,255,0.85);
  }
  .contact-item.has-banner .avatar {
    background: rgba(0,0,0,0.25);
    border-color: rgba(255,255,255,0.35);
    color: white;
  }
  .contact-item.has-banner-active .avatar {
    background: rgba(0,0,0,0.35);
    border-color: rgba(255,255,255,0.5);
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
      overflow: hidden;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
  }

  .avatar-wrapper {
    position: relative;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 12px;
    transition: background 0.2s;
  }

  .avatar-wrapper:hover {
    background: var(--surface-lighter);
  }

  .online-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    background: #22c55e;
    border: 2px solid var(--surface);
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.4);
  }

  .contact-item.active .online-indicator {
    border-color: var(--accent);
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