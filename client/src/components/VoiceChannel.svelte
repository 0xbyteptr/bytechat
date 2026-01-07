<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte'
  
  export let channelId: string
  export let channelName: string
  export let participants: string[] = []
  export let isConnected: boolean = false
  export let isMuted: boolean = false
  export let isDeafened: boolean = false
  
  const dispatch = createEventDispatcher()
  
  function joinChannel() {
    dispatch('join', { channelId })
  }
  
  function leaveChannel() {
    dispatch('leave', { channelId })
  }
  
  function toggleMute() {
    dispatch('toggleMute')
  }
  
  function toggleDeafen() {
    dispatch('toggleDeafen')
  }
</script>

<div class="voice-channel">
  <div class="channel-header">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
    <span class="channel-name">{channelName}</span>
    <span class="participant-count">{participants.length}</span>
  </div>
  
  {#if isConnected}
    <div class="channel-controls">
      <button 
        class="control-btn" 
        class:active={isMuted}
        on:click={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {#if isMuted}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
        {/if}
      </button>
      
      <button 
        class="control-btn" 
        class:active={isDeafened}
        on:click={toggleDeafen}
        title={isDeafened ? 'Undeafen' : 'Deafen'}
      >
        {#if isDeafened}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"/>
            <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="2"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"/>
          </svg>
        {/if}
      </button>
      
      <button class="leave-btn" on:click={leaveChannel}>
        Disconnect
      </button>
    </div>
    
    <div class="participants-list">
      {#each participants as participant}
        <div class="participant">
          <div class="participant-avatar">
            {participant.slice(0, 1).toUpperCase()}
          </div>
          <span class="participant-name">{participant}</span>
        </div>
      {/each}
    </div>
  {:else}
    <button class="join-btn" on:click={joinChannel}>
      Join Voice Channel
    </button>
  {/if}
</div>

<style>
  .voice-channel {
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
  }
  
  .channel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--fg);
  }
  
  .channel-name {
    flex: 1;
    font-weight: 600;
  }
  
  .participant-count {
    background: var(--accent);
    color: var(--accent-fg);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  }
  
  .join-btn {
    width: 100%;
    background: var(--green);
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .join-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--green-rgb), 0.3);
  }
  
  .channel-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .control-btn {
    background: var(--surface-lighter);
    color: var(--fg);
    border: none;
    padding: 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .control-btn:hover {
    background: var(--overlay);
  }
  
  .control-btn.active {
    background: var(--red);
    color: white;
  }
  
  .leave-btn {
    flex: 1;
    background: var(--red);
    color: white;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .leave-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .participants-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .participant {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background: var(--bg);
    border-radius: 8px;
  }
  
  .participant-avatar {
    width: 32px;
    height: 32px;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }
  
  .participant-name {
    flex: 1;
    font-size: 14px;
    color: var(--fg);
  }
</style>
