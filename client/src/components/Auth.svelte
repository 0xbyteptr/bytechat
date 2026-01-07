<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte'
  import { generateKeyPair, decrypt } from '../lib/crypto'
  import { Capacitor } from '@capacitor/core'
  import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
  import { FileOpener } from '@capacitor-community/file-opener'
  import packageJson from '../../package.json'

  const dispatch = createEventDispatcher()
  const API_URL = import.meta.env.VITE_API_URL || 'https://api.byteptr.xyz'
  const APP_VERSION = packageJson.version

  export let id = ''
  export let keypair: {publicKey:string, secretKey:string} | null = null
  let naclSecretKey = ''
  let rememberMe = false

  let mode: 'login-nacl' | 'register' = 'login-nacl'
  let loading = false
  let updateAvailable = false
  let latestVersion = ''
  let isNewerThanRelease = false

  function loadSavedCredentials() {
    try {
      const saved = localStorage.getItem('bytechat_remember')
      if (saved) {
        const { id: savedId, naclSecretKey: savedKey } = JSON.parse(saved)
        id = savedId || ''
        naclSecretKey = savedKey || ''
        rememberMe = true
      }
    } catch (e) {
      console.error('Failed to load saved credentials:', e)
    }
  }

  function saveCredentials() {
    if (rememberMe) {
      try {
        localStorage.setItem('bytechat_remember', JSON.stringify({
          id: id.trim(),
          naclSecretKey: naclSecretKey.trim()
        }))
      } catch (e) {
        console.error('Failed to save credentials:', e)
      }
    } else {
      try {
        localStorage.removeItem('bytechat_remember')
      } catch (e) {
        console.error('Failed to clear saved credentials:', e)
      }
    }
  }

  onMount(() => {
    checkForUpdates()
    loadSavedCredentials()
  })

  function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0
      const p2 = parts2[i] || 0
      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }
    return 0
  }

  async function checkForUpdates() {
    try {
      const response = await fetch('https://raw.githubusercontent.com/0xbyteptr/bytechat/main/client/package.json')
      if (response.ok) {
        const data = await response.json()
        latestVersion = data.version
        const comparison = compareVersions(APP_VERSION, latestVersion)
        
        if (comparison > 0) {
          // Current version is newer than GitHub (dev/unreleased version)
          isNewerThanRelease = true
        } else if (comparison < 0) {
          // GitHub version is newer (update available)
          updateAvailable = true
        }
      }
    } catch (e) {
      console.log('Could not check for updates:', e)
    }
  }

  async function loginWithNacl() {
    const trimmedId = id.trim()
    if (!trimmedId || !naclSecretKey) {
      alert('ID and Nacl Secret Key are required')
      return
    }
    saveCredentials()
    loading = true
    
    // Defer operations to prevent UI freeze
    await new Promise(resolve => setTimeout(resolve, 50))
    
    try {
      // In tweetnacl, we can't easily get public key from secret key without the full keypair object
      // but we can just try to fetch the public key from the server first if it exists
      const resKey = await fetch(`${API_URL}/keys?id=${encodeURIComponent(trimmedId)}`)
      if (!resKey.ok) throw new Error("User not found. Please register first.")
      const { publicKey: pubKey } = await resKey.json()

      await new Promise(resolve => setTimeout(resolve, 10))
      
      const resChallenge = await fetch(`${API_URL}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trimmedId, publicKey: pubKey })
      })
      if (!resChallenge.ok) throw new Error(await resChallenge.text())
      const { encryptedChallenge, serverPublicKey } = await resChallenge.json()
      
      const [cipher, nonce] = encryptedChallenge.split('|')
      if (!nonce) throw new Error("Invalid challenge format from server.")

      await new Promise(resolve => setTimeout(resolve, 10))
      const code = decrypt(naclSecretKey, serverPublicKey, cipher, nonce)
      
      if (!code) throw new Error("Failed to decrypt challenge. Check your secret key.")

      await new Promise(resolve => setTimeout(resolve, 10))
      const res = await fetch(`${API_URL}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trimmedId, code })
      })
      if (res.ok) {
        const { token } = await res.json()
        dispatch('authSuccess', { id: trimmedId, publicKey: pubKey, type: 'nacl', keypair: { publicKey: pubKey, secretKey: naclSecretKey }, token })
      } else {
        alert('Login failed: ' + await res.text())
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      loading = false
    }
  }

  async function registerNacl() {
    if(!id || !keypair) {
      alert('ID and Keypair are required')
      return
    }
    loading = true
    try {
      const res = await fetch(`${API_URL}/keys`, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({id, publicKey: keypair.publicKey}) 
      })
      if (res.ok) {
        const { token } = await res.json()
        dispatch('authSuccess', { id, publicKey: keypair.publicKey, type: 'nacl', keypair, token })
      } else if (res.status === 409) {
        alert('Error: This ID is already taken. Please choose another one.')
      } else {
        alert('Failed to register key: ' + await res.text())
      }
    } catch (e) {
      alert('Error connecting to server')
    } finally {
      loading = false
    }
  }

  function newKeypair() { keypair = generateKeyPair() }

  async function exportNaclKeys() {
    if (!id || !keypair) return
    const content = `ByteChat Nacl Keys for ${id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
    
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `bytechat_${id}_nacl_keys.txt`
        
        const result = await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })

        await FileOpener.open({
          filePath: result.uri,
          contentType: 'text/plain'
        })
      } catch (e: any) {
        alert('Failed to save keys: ' + e.message)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bytechat_${id}_nacl_keys.txt`
      a.click()
      URL.revokeObjectURL(url)
    }
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    <div class="auth-header">
      <h1 class="brand">ByteChat</h1>
      <p class="subtitle">Secure, End-to-End Encrypted Messaging</p>
    </div>

    <div class="tabs">
      <button class:active={mode === 'login-nacl'} on:click={() => mode = 'login-nacl'}>Login</button>
      <button class:active={mode === 'register'} on:click={() => mode = 'register'}>Register</button>
    </div>

    <div class="form">
      <div class="input-group">
        <label for="id">User ID</label>
        <input id="id" placeholder="e.g. alice" bind:value={id} />
      </div>

      {#if mode === 'login-nacl'}
        <div class="input-group">
          <label for="nacl-sk">Nacl Secret Key (Base64)</label>
          <input id="nacl-sk" placeholder="Your Nacl secret key" bind:value={naclSecretKey} />
        </div>
        <label class="remember-me-label">
          <input type="checkbox" bind:checked={rememberMe} on:change={saveCredentials} />
          <span>Remember me</span>
        </label>
        <button class="btn-purple" on:click={loginWithNacl} disabled={loading || !id || !naclSecretKey}>
          {loading ? 'Verifying...' : 'Login'}
        </button>
      {:else}
        <div class="nacl-box">
          {#if keypair}
            <div class="key-info">
              <span class="label">Public Key:</span>
              <code class="truncate">{keypair.publicKey}</code>
            </div>
          {:else}
            <p class="opacity-50 text-sm">Generate a new Nacl keypair to register.</p>
          {/if}
          <button class="btn-secondary w-full mb-2" on:click={newKeypair}>Generate New Keypair</button>
          {#if keypair}
            <button class="btn-secondary w-full mb-2" on:click={exportNaclKeys}>Download Keys</button>
          {/if}
        </div>
        <button class="btn-purple w-full" on:click={registerNacl} disabled={loading || !id || !keypair}>
          {loading ? 'Registering...' : 'Register & Enter Chat'}
        </button>
      {/if}
    </div>

    {#if isNewerThanRelease}
      <div class="dev-banner">
        <div class="dev-icon">⚠️</div>
        <div class="dev-text">
          <strong>Development Version</strong>
          <span>You're using v{APP_VERSION} (newer than release v{latestVersion}). May be unstable.</span>
        </div>
      </div>
    {/if}

    {#if updateAvailable}
      <div class="update-banner">
        <div class="update-icon">🎉</div>
        <div class="update-text">
          <strong>Update Available!</strong>
          <span>Version {latestVersion} is available. Refresh to update.</span>
        </div>
        <button class="update-btn" on:click={() => window.location.reload()}>Refresh</button>
      </div>
    {/if}

    <div class="auth-footer">
      <p>Your keys never leave your browser.</p>
      <p class="version">v{APP_VERSION}</p>
    </div>
  </div>
</div>

<style>
  .auth-container {
    height: 100vh;
    height: 100dvh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 1rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    padding-left: calc(1rem + env(safe-area-inset-left));
    padding-right: calc(1rem + env(safe-area-inset-right));
  }

  .auth-card {
    width: 100%;
    max-width: 450px;
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 24px;
    padding: 2.5rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    animation: fadeIn 0.5s ease-out, scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0.95); }
    to { transform: scale(1); }
  }

  @media (max-width: 480px) {
    .auth-card {
      padding: 1.5rem;
      border-radius: 16px;
    }
    
    .brand {
      font-size: 2rem;
    }
  }

  .auth-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .brand {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent), var(--lavender));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 0.5rem;
    letter-spacing: -0.03em;
  }

  .subtitle {
    color: var(--fg);
    opacity: 0.5;
    font-size: 0.9375rem;
  }

  .tabs {
    display: flex;
    background: var(--bg);
    padding: 0.35rem;
    border-radius: 14px;
    margin-bottom: 2rem;
    gap: 0.25rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.75rem;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--fg);
    opacity: 0.5;
    transition: all 0.2s;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--surface-lighter);
    color: var(--fg);
    opacity: 1;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .input-group label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--fg);
    margin-left: 0.25rem;
  }

  input {
    width: 100%;
    background: var(--bg);
    border: 2px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    color: var(--fg);
    font-size: 0.95rem;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 4px rgba(203, 166, 247, 0.15);
    transform: translateY(-1px);
  }
  
  input:hover:not(:focus) {
    border-color: var(--overlay);
  }

  .remember-me-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: var(--fg);
    cursor: pointer;
    user-select: none;
    margin: -0.5rem 0 0.5rem 0;
  }

  .remember-me-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--accent);
  }

  .remember-me-label span {
    font-weight: 500;
  }

  .remember-me-label:hover span {
    opacity: 0.8;
  }

  .nacl-box {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 14px;
    padding: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .key-info {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
  }

  .key-info .label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--fg);
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .key-info code {
    font-size: 0.75rem;
    background: rgba(0,0,0,0.2);
    padding: 0.75rem;
    border-radius: 8px;
    color: var(--accent);
    word-break: break-all;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .btn-purple, .btn-secondary {
    width: 100%;
    padding: 1rem;
    border-radius: 12px;
    font-weight: 800;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-purple { 
    background: linear-gradient(135deg, var(--accent) 0%, var(--lavender) 100%); 
    color: var(--bg); 
  }
  
  .btn-secondary { 
    background: var(--surface-lighter); 
    color: var(--fg); 
    border: 2px solid transparent;
  }

  .btn-purple:hover:not(:disabled) { 
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(203, 166, 247, 0.4);
  }
  
  .btn-secondary:hover {
    background: var(--overlay);
    border-color: var(--accent);
  }
  
  .btn-purple:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-purple:active { transform: translateY(0); }

  .auth-footer {
    margin-top: 2.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--fg);
    opacity: 0.5;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .auth-footer .version {
    margin-top: 0.5rem;
    font-size: 0.7rem;
    opacity: 0.3;
  }

  .update-banner {
    background: linear-gradient(135deg, #cba6f7 0%, #b4befe 100%);
    border-radius: 12px;
    padding: 1rem;
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--bg);
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .update-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .update-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .update-text strong {
    font-weight: 800;
    font-size: 0.9rem;
  }

  .update-text span {
    font-size: 0.8rem;
    opacity: 0.9;
  }

  .update-btn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: var(--bg);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .update-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  .update-btn:active {
    transform: translateY(0);
  }

  .dev-banner {
    background: linear-gradient(135deg, #f9e2af 0%, #fab387 100%);
    border-radius: 12px;
    padding: 1rem;
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--bg);
    animation: slideIn 0.3s ease-out;
    border: 2px solid rgba(250, 179, 135, 0.3);
  }

  .dev-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .dev-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .dev-text strong {
    font-weight: 800;
    font-size: 0.9rem;
  }

  .dev-text span {
    font-size: 0.8rem;
    opacity: 0.9;
  }
</style>
