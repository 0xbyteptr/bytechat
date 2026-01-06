<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let group: any = null
  export let currentUserId: string
  export let isOpen = false

  const dispatch = createEventDispatcher()
  let activeTab: 'info' | 'members' = 'info'
  let editingName = false
  let groupName = group?.name || ''
  let groupPublic = group?.public ?? false
  let allowMemberInvite = group?.allowMemberInvite ?? false
  let requireApproval = group?.requireApproval ?? false

  $: if (group) {
    groupName = group.name || ''
    groupPublic = group.public ?? false
    allowMemberInvite = group.allowMemberInvite ?? false
    requireApproval = group.requireApproval ?? false
  }

  function saveName() {
    if (groupName.trim() && groupName !== group.name) {
      dispatch('updateGroup', { groupId: group.id, name: groupName.trim() })
    }
    editingName = false
  }

  function updateSetting(key: string, value: any) {
    dispatch('updateGroup', { groupId: group.id, [key]: value })
  }

  function handleCheckboxChange(key: string, e: Event) {
    const checked = (e.target as HTMLInputElement)?.checked ?? false
    updateSetting(key, checked)
  }

  function deleteGroup() {
    if (confirm('Are you sure you want to delete this group? This cannot be undone.')) {
      dispatch('deleteGroup', { groupId: group.id })
    }
  }

  function removeMember(memberId: string) {
    if (confirm(`Remove ${memberId} from group?`)) {
      dispatch('removeMember', { groupId: group.id, memberId })
    }
  }

  function addMember() {
    const userId = prompt('Enter user ID to add:')
    if (userId) {
      dispatch('addMember', { groupId: group.id, userId })
    }
  }

  let isOwner = false
  $: isOwner = group && (group.owner === currentUserId || group.admin === currentUserId)
</script>

<div class="group-settings-modal" class:open={isOpen && group}>
  {#if isOpen && group}
    <div 
      class="modal-overlay" 
      on:click={() => dispatch('close')} 
      on:keydown={(e) => e.key === 'Escape' && dispatch('close')}
      role="button" 
      tabindex="0"
    ></div>
    
    <div class="modal-content">
      <div class="modal-header">
        <h2>Group Settings - {group.name}</h2>
        <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
      </div>

      <div class="tabs">
        <button class="tab" class:active={activeTab === 'info'} on:click={() => activeTab = 'info'}>
          Info
        </button>
        <button class="tab" class:active={activeTab === 'members'} on:click={() => activeTab = 'members'}>
          Members ({group.members?.length || 0})
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'info'}
          <div class="info-tab">
            <div class="info-display">
              <div class="info-row">
                <strong>Name:</strong>
                {#if editingName && isOwner}
                  <div class="edit-name">
                    <input 
                      type="text" 
                      bind:value={groupName} 
                      placeholder="Group name"
                      on:keydown={(e) => e.key === 'Enter' && saveName()}
                    />
                    <button class="btn btn-primary" on:click={saveName}>Save</button>
                    <button class="btn" on:click={() => editingName = false}>Cancel</button>
                  </div>
                {:else}
                  <div class="name-display">
                    <span>{group.name}</span>
                    {#if isOwner}
                      <button class="btn-edit" on:click={() => editingName = true}>Edit</button>
                    {/if}
                  </div>
                {/if}
              </div>

              <div><strong>Members:</strong> {group.members?.length || 0}</div>
              <div><strong>Owner:</strong> {group.owner || group.admin || 'Unknown'}</div>

              {#if isOwner}
                <div class="settings-section">
                  <h3>Privacy & Permissions</h3>
                  
                  <label class="checkbox-item">
                    <input 
                      type="checkbox" 
                      checked={groupPublic}
                      on:change={(e) => handleCheckboxChange('public', e)}
                    />
                    <span>Public Group</span>
                    <small>Allow anyone to discover this group</small>
                  </label>

                  <label class="checkbox-item">
                    <input 
                      type="checkbox" 
                      checked={allowMemberInvite}
                      on:change={(e) => handleCheckboxChange('allowMemberInvite', e)}
                    />
                    <span>Members Can Invite</span>
                    <small>Allow members to invite other users</small>
                  </label>

                  <label class="checkbox-item">
                    <input 
                      type="checkbox" 
                      checked={requireApproval}
                      on:change={(e) => handleCheckboxChange('requireApproval', e)}
                    />
                    <span>Require Approval</span>
                    <small>New members must be approved by owner</small>
                  </label>
                </div>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'members'}
          <div class="members-tab">
            {#if isOwner}
              <div class="add-member-section">
                <button class="btn btn-primary" on:click={addMember}>Add Member</button>
              </div>
            {/if}
            
            <div class="members-list">
              {#each group.members || [] as member (member)}
                <div class="member-item">
                  <div class="member-info" on:click={() => dispatch('openProfile', { userId: member })} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') dispatch('openProfile', { userId: member }) }} role="button" tabindex="0">
                    <div class="member-id">{member}</div>
                    {#if member === group.owner || member === group.admin}
                      <div class="member-badge owner">Owner</div>
                    {/if}
                  </div>

                  {#if isOwner && member !== currentUserId && member !== group.owner && member !== group.admin}
                    <button 
                      class="btn-remove"
                      on:click={() => removeMember(member)}
                      title="Remove member"
                    >
                      Remove
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if isOwner}
        <div class="danger-zone">
          <h3>Danger Zone</h3>
          <button class="btn btn-danger" on:click={deleteGroup}>Delete Group</button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .group-settings-modal {
    display: none;
  }

  .group-settings-modal.open {
    display: flex;
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
    max-width: 600px;
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

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
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

  .info-display {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .info-display > div {
    padding: 0.75rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .info-row {
    padding: 0.75rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .name-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-edit {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    background: var(--surface-lighter);
    color: var(--fg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-edit:hover {
    background: var(--accent);
  }

  .edit-name {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .edit-name input {
    flex: 1;
    padding: 0.5rem;
    background: var(--surface);
    color: var(--fg);
    border: 1px solid var(--surface-lighter);
    border-radius: 4px;
    font-family: inherit;
  }

  .settings-section {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .settings-section h3 {
    margin: 0 0 1rem 0;
    font-size: 0.95rem;
    color: var(--accent);
  }

  .checkbox-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .checkbox-item:hover {
    background: var(--surface);
  }

  .checkbox-item input[type="checkbox"] {
    margin-top: 0.25rem;
    cursor: pointer;
  }

  .checkbox-item span {
    display: block;
    font-weight: 500;
  }

  .checkbox-item small {
    display: block;
    font-size: 0.75rem;
    color: var(--fg-muted);
    margin-top: 0.25rem;
  }

  .add-member-section {
    margin-bottom: 1rem;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .member-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--surface-darker);
    border-radius: 6px;
  }

  .member-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .member-info:hover {
    background: var(--surface-lighter);
  }

  .member-id {
    font-weight: 600;
  }

  .member-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface-lighter);
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--fg-muted);
    width: fit-content;
  }

  .member-badge.owner {
    background: #fbbf24;
    color: #000;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-remove {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-remove:hover {
    background: #dc2626;
  }

  .danger-zone {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #ef4444;
  }

  .danger-zone h3 {
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .danger-zone .btn-danger {
    margin-top: 0.5rem;
  }
</style>
