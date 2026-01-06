<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import type { Group } from '../lib/useGroups'
  import { isGroupAdmin } from '../lib/useGroups'

  export let group: Group
  export let currentUserId: string
  export let isOpen = false

  const dispatch = createEventDispatcher()
  let newMemberInput = ''
  let searchQuery = ''

  $: filteredMembers = group.members.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function addMember() {
    if (newMemberInput.trim()) {
      dispatch('addMember', { userId: newMemberInput.trim() })
      newMemberInput = ''
    }
  }

  function removeMember(memberId: string) {
    if (confirm(`Remove ${memberId}?`)) {
      dispatch('removeMember', { memberId })
    }
  }

  const canManage = isGroupAdmin(group, currentUserId)
</script>

<div class="member-management" class:open={isOpen}>
  {#if isOpen}
    <div class="management-header">
      <h3>Manage Members</h3>
      <button class="close-btn" on:click={() => dispatch('close')}>✕</button>
    </div>

    {#if canManage}
      <div class="add-member">
        <input 
          type="text" 
          placeholder="Enter user ID to add..." 
          bind:value={newMemberInput}
          on:keydown={e => e.key === 'Enter' && addMember()}
        />
        <button class="btn-add" on:click={addMember}>Add</button>
      </div>
    {/if}

    <div class="search-box">
      <input 
        type="text" 
        placeholder="Search members..." 
        bind:value={searchQuery}
      />
    </div>

    <div class="members-scroll">
      {#each filteredMembers as member (member.id)}
        <div class="member-card">
          <div class="member-details">
            <div class="member-id">{member.id}</div>
            <div class="member-badge" class:owner={member.role === 'owner'} class:admin={member.role === 'admin'}>
              {member.role}
            </div>
          </div>

          {#if canManage && member.id !== currentUserId && member.role !== 'owner'}
            <button 
              class="btn-remove"
              on:click={() => removeMember(member.id)}
              title="Remove member"
            >
              Remove
            </button>
          {/if}
        </div>
      {/each}

      {#if filteredMembers.length === 0}
        <div class="empty-state">
          {searchQuery ? 'No members match your search' : 'No members yet'}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .member-management {
    display: none;
    flex-direction: column;
    background: var(--surface-darker);
    border-radius: 8px;
    max-height: 400px;
    overflow: hidden;
  }

  .member-management.open {
    display: flex;
  }

  .management-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--surface-lighter);
  }

  .management-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0;
    width: 24px;
    height: 24px;
  }

  .add-member {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid var(--surface-lighter);
  }

  .add-member input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--surface-lighter);
    border-radius: 4px;
    background: var(--surface);
    color: var(--fg);
  }

  .btn-add {
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: opacity 0.2s;
  }

  .btn-add:hover {
    opacity: 0.9;
  }

  .search-box {
    padding: 0.75rem;
    border-bottom: 1px solid var(--surface-lighter);
  }

  .search-box input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--surface-lighter);
    border-radius: 4px;
    background: var(--surface);
    color: var(--fg);
  }

  .members-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .member-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--surface);
    border-radius: 4px;
  }

  .member-details {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .member-id {
    font-weight: 600;
    font-size: 0.9rem;
  }

  .member-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--surface-lighter);
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--fg-muted);
  }

  .member-badge.owner {
    background: #fbbf24;
    color: #000;
  }

  .member-badge.admin {
    background: #60a5fa;
    color: #fff;
  }

  .btn-remove {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-remove:hover {
    background: #dc2626;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--fg-muted);
  }
</style>
