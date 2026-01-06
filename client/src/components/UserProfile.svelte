<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let userId: string | null = null
  export let isOpen = false
  export let isOnline = false
  export let commonGroups: any[] = []
  export let isBlocked = false
  export let userNickname: string = ''

  const dispatch = createEventDispatcher()
  let activeTab: 'info' | 'groups' | 'actions' = 'info'
  let copied = false
  let showBlockConfirm = false
  let nickname = userNickname
  let editingNickname = false
  let nicknameUpdated = false

  function startChat() {
    dispatch('startChat', { userId })
  }

  function copyUserId() {
    if (userId) {
      navigator.clipboard.writeText(userId)
      copied = true
      setTimeout(() => (copied = false), 2000)
    }
  }

  function blockUser() {
    dispatch('blockUser', { userId })
    showBlockConfirm = false
  }

  function unblockUser() {
    dispatch('unblockUser', { userId })
  }

  function reportUser() {
    if (confirm(`Report ${userId} for inappropriate behavior?`)) {
      dispatch('reportUser', { userId })
    }
  }

  function addToContacts() {
    dispatch('addToContacts', { userId, name: nickname || userId })
  }

  function removeFromContacts() {
    dispatch('removeFromContacts', { userId })
  }

  function saveNickname() {
    if (nickname !== userNickname) {
      editingNickname = false
      nicknameUpdated = true
      setTimeout(() => (nicknameUpdated = false), 2000)
    } else {
      editingNickname = false
    }
  }

  function cancelNickname() {
    nickname = userNickname
    editingNickname = false
  }

  function shareProfile() {
    const shareText = `Check out this user on ByteChat: ${userId}`
    if (navigator.share) {
      navigator.share({
        title: `ByteChat User: ${userId}`,
        text: shareText,
      })
    } else {
      navigator.clipboard.writeText(shareText)
      alert('Profile link copied to clipboard')
    }
  }

  function viewEncryptionKey() {
    dispatch('viewEncryptionKey', { userId })
  }

  function closeModal() {
    dispatch('close')
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeModal()
    }
  }

  const avatar = userId?.slice(0, 1).toUpperCase() || '?'
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="user-profile-modal" class:open={isOpen && userId} role="dialog" aria-modal="true">
  {#if isOpen && userId}
    <button class="modal-overlay" on:click={closeModal} type="button"></button>

    <div class="modal-content">
      <div class="modal-header">
        <div class="header-title">
          <div class="avatar">{avatar}</div>
          <div class="title-text">
            {#if editingNickname}
              <div class="nickname-edit">
                <input type="text" bind:value={nickname} placeholder="Enter nickname" class="nickname-input" />
                <button class="edit-btn save" on:click={saveNickname}>✓</button>
                <button class="edit-btn cancel" on:click={cancelNickname}>✕</button>
              </div>
            {:else}
              <div class="nickname-display">
                <h2>{nickname || userId}</h2>
                <button class="edit-nickname-btn" on:click={() => (editingNickname = true)} title="Edit nickname">✏️</button>
                {#if nicknameUpdated}
                  <span class="update-indicator">✓ Saved</span>
                {/if}
              </div>
              <div class="public-key" title="Public key">{userId}</div>
            {/if}
            <div class="status-indicator">
              <span class="status-dot" class:online={isOnline}></span>
              <span class="status-text">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
        <button class="close-btn" on:click={closeModal}>✕</button>
      </div>

      <div class="tabs">
        <button class="tab" class:active={activeTab === 'info'} on:click={() => (activeTab = 'info')}>
          Info
        </button>
        <button class="tab" class:active={activeTab === 'groups'} on:click={() => (activeTab = 'groups')}>
          Groups ({commonGroups?.length || 0})
        </button>
        <button class="tab" class:active={activeTab === 'actions'} on:click={() => (activeTab = 'actions')}>
          Actions
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'info'}
          <div class="info-tab">
            <div class="info-section">
              <h3>Profile Information</h3>
              <div class="info-item">
                <span class="label">User ID</span>
                <div class="id-display">
                  <span class="id-value">{userId}</span>
                  <button class="copy-btn" on:click={copyUserId} title="Copy user ID">
                    {copied ? '✓ Copied' : '📋'}
                  </button>
                </div>
              </div>

              <div class="info-item">
                <span class="label">Status</span>
                <div class="status-badge" class:online={isOnline}>
                  {isOnline ? '🟢 Online' : '⚫ Offline'}
                </div>
              </div>

              {#if isBlocked}
                <div class="info-item warning">
                  <span class="label">⚠️ Status</span>
                  <div class="blocked-badge">User is blocked</div>
                </div>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'groups'}
          <div class="groups-tab">
            {#if commonGroups && commonGroups.length > 0}
              <div class="groups-list">
                <h3>Common Groups ({commonGroups.length})</h3>
                {#each commonGroups as group (group.id)}
                  <div class="group-item">
                    <div class="group-avatar">{group.name?.slice(0, 1).toUpperCase() || '#'}</div>
                    <div class="group-info">
                      <div class="group-name">{group.name}</div>
                      <div class="group-members">{group.members?.length || 0} members</div>
                    </div>
                    <button class="group-link-btn" on:click={() => dispatch('viewGroup', { groupId: group.id })}>
                      View
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">
                <p>No common groups yet</p>
              </div>
            {/if}
          </div>

        {:else if activeTab === 'actions'}
          <div class="actions-tab">
            <div class="action-section">
              <h3>Communication</h3>
              <button class="action-btn primary" on:click={startChat} disabled={isBlocked}>
                💬 Start Chat
              </button>
              <button class="action-btn secondary" on:click={shareProfile}>
                🔗 Share Profile
              </button>
            </div>

            <div class="action-section">
              <h3>Contacts</h3>
              <button class="action-btn secondary" on:click={addToContacts}>
                ➕ Add to Contacts
              </button>
              <button class="action-btn secondary" on:click={removeFromContacts}>
                ➖ Remove from Contacts
              </button>
            </div>

            <div class="action-section">
              <h3>Security</h3>
              <button class="action-btn secondary" on:click={viewEncryptionKey}>
                🔐 View Encryption Key
              </button>
            </div>

            <div class="action-section">
              <h3>Privacy & Moderation</h3>
              {#if isBlocked}
                <button class="action-btn warning" on:click={unblockUser}>
                  ✓ Unblock User
                </button>
              {:else}
                <button class="action-btn danger" on:click={() => (showBlockConfirm = true)}>
                  🚫 Block User
                </button>
              {/if}
              <button class="action-btn danger" on:click={reportUser}>
                🚩 Report User
              </button>
            </div>

            {#if showBlockConfirm}
              <div class="confirm-dialog">
                <p>Block {userId}?</p>
                <p class="confirm-desc">You won't receive messages from this user</p>
                <div class="confirm-buttons">
                  <button class="btn cancel" on:click={() => (showBlockConfirm = false)}>Cancel</button>
                  <button class="btn confirm" on:click={blockUser}>Block</button>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .user-profile-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1001;
  }

  .user-profile-modal.open {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--surface);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    z-index: 1000;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--surface-lighter);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .avatar {
    width: 48px;
    height: 48px;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .title-text {
    flex: 1;
    min-width: 0;
  }

  .title-text h2 {
    margin: 0;
    font-size: 1.1rem;
    word-break: break-all;
  }

  .nickname-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nickname-display h2 {
    margin: 0;
    font-size: 1.1rem;
    word-break: break-all;
  }

  .edit-nickname-btn {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .edit-nickname-btn:hover {
    background: var(--surface-lighter);
  }

  .update-indicator {
    font-size: 0.75rem;
    color: var(--green);
    font-weight: 600;
  }

  .nickname-edit {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nickname-input {
    flex: 1;
    padding: 0.5rem;
    background: var(--surface-darker);
    color: var(--fg);
    border: 1px solid var(--accent);
    border-radius: 4px;
    font-size: 0.95rem;
  }

  .nickname-input::placeholder {
    color: var(--fg-muted);
  }

  .edit-btn {
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s;
  }

  .edit-btn.save {
    background: var(--green);
    color: white;
  }

  .edit-btn.save:hover {
    opacity: 0.9;
  }

  .edit-btn.cancel {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .edit-btn.cancel:hover {
    opacity: 0.8;
  }

  .public-key {
    font-size: 0.7rem;
    color: var(--fg-muted);
    font-family: monospace;
    word-break: break-all;
    margin-top: 0.25rem;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin-top: 0.25rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background: var(--red);
    border-radius: 50%;
  }

  .status-dot.online {
    background: var(--green);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--fg);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: var(--surface-lighter);
  }

  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--surface-lighter);
  }

  .tab {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    color: var(--fg-muted);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    color: var(--fg);
  }

  .tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .info-tab,
  .groups-tab,
  .actions-tab {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.95rem;
    color: var(--accent);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .info-item.warning {
    border-left: 3px solid #fbbf24;
  }

  .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .id-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .id-value {
    flex: 1;
    word-break: break-all;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .copy-btn {
    padding: 0.4rem 0.8rem;
    background: var(--surface-lighter);
    color: var(--fg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .copy-btn:hover {
    background: var(--accent);
  }

  .status-badge {
    padding: 0.5rem 0.75rem;
    background: var(--surface-lighter);
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .status-badge.online {
    background: rgba(34, 197, 94, 0.1);
    color: var(--green);
  }

  .blocked-badge {
    padding: 0.5rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-radius: 4px;
    font-weight: 500;
  }

  .groups-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .groups-list h3 {
    margin: 0;
    font-size: 0.95rem;
    color: var(--accent);
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .group-avatar {
    width: 40px;
    height: 40px;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .group-info {
    flex: 1;
    min-width: 0;
  }

  .group-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .group-members {
    font-size: 0.75rem;
    color: var(--fg-muted);
  }

  .group-link-btn {
    padding: 0.4rem 0.8rem;
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .group-link-btn:hover {
    opacity: 0.9;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--fg-muted);
  }

  .action-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .action-section h3 {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--accent);
    font-weight: 600;
  }

  .action-btn {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.9rem;
  }

  .action-btn.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .action-btn.primary:hover {
    opacity: 0.9;
  }

  .action-btn.secondary {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .action-btn.secondary:hover {
    background: var(--surface-lighter);
    opacity: 0.8;
  }

  .action-btn.warning {
    background: #fbbf24;
    color: #000;
  }

  .action-btn.warning:hover {
    opacity: 0.9;
  }

  .action-btn.danger {
    background: #ef4444;
    color: white;
  }

  .action-btn.danger:hover {
    background: #dc2626;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .confirm-dialog {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
  }

  .confirm-dialog p {
    margin: 0 0 0.25rem 0;
    font-weight: 600;
    color: var(--fg);
  }

  .confirm-desc {
    font-size: 0.85rem;
    color: var(--fg-muted) !important;
    margin-bottom: 0.75rem !important;
  }

  .confirm-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    flex: 1;
    padding: 0.6rem;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn.cancel {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .btn.cancel:hover {
    opacity: 0.8;
  }

  .btn.confirm {
    background: #ef4444;
    color: white;
  }

  .btn.confirm:hover {
    background: #dc2626;
  }
</style>
