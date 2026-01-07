<script lang="ts">
  import { formatPresence, getStatusEmoji } from '../lib/chatEnhancements'
  
  export let userId: string
  export let status: 'online' | 'away' | 'offline' = 'offline'
  export let lastSeen: number | undefined = undefined
  export let showActivity = false
  export let activity: string | undefined = undefined
</script>

<div class="user-status" class:online={status === 'online'} class:away={status === 'away'} title={formatPresence({userId, status, lastSeen, activity})}>
  <span class="status-badge">{getStatusEmoji(status)}</span>
  {#if showActivity}
    <span class="status-text">
      {status === 'online' ? 'Online' : status === 'away' ? 'Away' : 'Offline'}
      {#if activity}
        <span class="activity"> — {activity}</span>
      {/if}
    </span>
  {/if}
</div>

<style>
  .user-status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.6rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    font-size: 0.8rem;
    cursor: help;
  }

  .status-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 10px;
    height: 10px;
    font-size: 0.7rem;
    line-height: 1;
  }

  .status-text {
    font-weight: 500;
    color: var(--fg);
  }

  .activity {
    opacity: 0.7;
    font-weight: 400;
  }

  .user-status.online {
    background: rgba(166, 227, 161, 0.15);
  }

  .user-status.away {
    background: rgba(249, 226, 175, 0.15);
  }
</style>
