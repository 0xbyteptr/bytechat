<script lang="ts">
  import { onMount } from 'svelte'
  
  export let status: string = 'Loading...'
  export let progress: number = 0
  
  let dots = ''
  
  onMount(() => {
    const interval = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.'
    }, 500)
    
    return () => clearInterval(interval)
  })
</script>

<div class="loading-screen">
  <div class="loading-content">
    <div class="logo-container">
      <div class="logo">
        <svg viewBox="0 0 100 100" width="80" height="80">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="3" opacity="0.2"/>
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" stroke-width="3" 
                  stroke-dasharray="283" stroke-dashoffset={283 - (283 * progress / 100)}
                  class="progress-circle" />
          <path d="M30 50 L45 65 L70 35" fill="none" stroke="var(--accent)" stroke-width="4" 
                stroke-linecap="round" stroke-linejoin="round" class="check-mark"/>
        </svg>
      </div>
      <h1 class="app-name">ByteChat</h1>
    </div>
    
    <div class="status-container">
      <p class="status-text">{status}{dots}</p>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {progress}%"></div>
      </div>
    </div>
  </div>
</div>

<style>
  .loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--bg) 0%, var(--surface) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
  }

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .logo {
    position: relative;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .progress-circle {
    transform-origin: center;
    transform: rotate(-90deg);
    transition: stroke-dashoffset 0.3s ease;
  }

  .check-mark {
    opacity: 0;
    animation: fadeIn 0.3s ease forwards;
    animation-delay: 0.5s;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  .app-name {
    font-size: 2rem;
    font-weight: 700;
    color: var(--accent);
    margin: 0;
    letter-spacing: 1px;
    text-shadow: 0 2px 10px rgba(var(--accent-rgb, 137, 180, 250), 0.3);
  }

  .status-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .status-text {
    text-align: center;
    color: var(--fg);
    font-size: 0.95rem;
    font-weight: 500;
    margin: 0;
    min-height: 24px;
    opacity: 0.8;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--surface-lighter);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--blue));
    border-radius: 2px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(var(--accent-rgb, 137, 180, 250), 0.5);
  }

  @media (prefers-reduced-motion: reduce) {
    .logo {
      animation: none;
    }
    
    .progress-fill {
      transition: none;
    }
  }
</style>
