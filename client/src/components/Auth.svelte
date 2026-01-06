<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { generateKeyPair, decrypt } from '../lib/crypto'
  import { Capacitor } from '@capacitor/core'
  import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
  import { FileOpener } from '@capacitor-community/file-opener'

  const dispatch = createEventDispatcher()
  const API_URL = import.meta.env.VITE_API_URL || (Capacitor.isNativePlatform() ? 'https://api.byteptr.xyz' : '')

  export let id = ''
  export let keypair: {publicKey:string, secretKey:string} | null = null
  let naclSecretKey = ''

  let mode: 'login-nacl' | 'register' = 'login-nacl'
  let loading = false

  async function loginWithNacl() {
    const trimmedId = id.trim()
    if (!trimmedId || !naclSecretKey) {
      alert('ID and Nacl Secret Key are required')
      return
    }
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

    <div class="auth-footer">
      <p>Your keys never leave your browser.</p>
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
    color: var(--accent);
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
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.85rem 1rem;
    color: var(--fg);
    font-size: 0.95rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(203, 166, 247, 0.1);
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
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-purple { background: #cba6f7; color: var(--bg); }
  .btn-secondary { background: var(--surface-lighter); color: var(--fg); }

  .btn-purple:hover { 
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(203, 166, 247, 0.2);
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
</style>
