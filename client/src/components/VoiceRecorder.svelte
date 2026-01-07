<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { useVoiceRecording } from '../lib/useVoiceRecording'
  
  const dispatch = createEventDispatcher()
  const recorder = useVoiceRecording()
  const { state } = recorder
  
  async function startRecording() {
    try {
      await recorder.startRecording()
    } catch (error) {
      alert('Failed to start recording. Please check microphone permissions.')
    }
  }
  
  function stopAndSend() {
    recorder.stopRecording()
    
    // Wait for the blob to be ready
    setTimeout(() => {
      const currentState = $state
      if (currentState.audioBlob) {
        dispatch('send', { 
          audioBlob: currentState.audioBlob,
          duration: currentState.duration
        })
        recorder.reset()
      }
    }, 100)
  }
  
  function cancel() {
    recorder.cancelRecording()
  }
  
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
</script>

<div class="voice-recorder" class:active={$state.isRecording}>
  {#if !$state.isRecording && !$state.audioBlob}
    <button class="record-btn" on:click={startRecording} title="Record voice message">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2"/>
        <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2"/>
      </svg>
    </button>
  {/if}
  
  {#if $state.isRecording}
    <div class="recording-controls">
      <div class="recording-indicator">
        <span class="pulse"></span>
        <span class="duration">{formatDuration($state.duration)}</span>
      </div>
      
      <button class="cancel-btn" on:click={cancel} title="Cancel recording">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      
      <button class="stop-btn" on:click={stopAndSend} title="Send voice message">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  {/if}
  
  {#if $state.audioBlob && $state.audioUrl}
    <div class="preview">
      <audio controls src={$state.audioUrl}></audio>
      <div class="preview-controls">
        <button class="send-btn" on:click={stopAndSend}>
          Send
        </button>
        <button class="cancel-btn-sm" on:click={cancel}>
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .voice-recorder {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .voice-recorder.active {
    background: var(--surface);
    padding: 12px;
    border-radius: 12px;
    border: 2px solid var(--red);
  }
  
  .record-btn {
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .record-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.4);
  }
  
  .recording-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }
  
  .recording-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  
  .pulse {
    width: 12px;
    height: 12px;
    background: var(--red);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
  
  .duration {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 700;
    color: var(--red);
  }
  
  .cancel-btn, .stop-btn {
    background: var(--surface-lighter);
    color: var(--fg);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .cancel-btn:hover {
    background: var(--red);
    color: white;
  }
  
  .stop-btn {
    background: var(--green);
    color: white;
  }
  
  .stop-btn:hover {
    opacity: 0.9;
    transform: scale(1.05);
  }
  
  .preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  
  .preview audio {
    width: 100%;
    height: 40px;
  }
  
  .preview-controls {
    display: flex;
    gap: 8px;
  }
  
  .send-btn, .cancel-btn-sm {
    flex: 1;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .send-btn {
    background: var(--accent);
    color: var(--accent-fg);
  }
  
  .send-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .cancel-btn-sm {
    background: var(--surface-lighter);
    color: var(--fg);
  }
  
  .cancel-btn-sm:hover {
    background: var(--overlay);
  }
</style>
