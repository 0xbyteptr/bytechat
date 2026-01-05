<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { generateKeyPair, decrypt } from '../lib/crypto'
  import { getPublicKeyFromPrivate, decryptPGP } from '../lib/pgp'

  const dispatch = createEventDispatcher()
  const API_URL = import.meta.env.VITE_API_URL || ''

  export let id = ''
  export let pgpPrivateKey = ''
  export let pgpPassphrase = ''
  export let keypair: {publicKey:string, secretKey:string} | null = null
  let naclSecretKey = ''

  let mode: 'login-pgp' | 'login-nacl' | 'register' = 'login-pgp'
  let loading = false

  async function loginWithPGP() {
    if (!id || !pgpPrivateKey) {
      alert('ID and PGP Private Key are required')
      return
    }
    loading = true
    try {
      const pubKey = await getPublicKeyFromPrivate(pgpPrivateKey)
      const resChallenge = await fetch(`${API_URL}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, publicKey: pubKey })
      })
      if (!resChallenge.ok) throw new Error(await resChallenge.text())
      const { encryptedChallenge } = await resChallenge.json()
      const code = await decryptPGP(pgpPrivateKey, encryptedChallenge, pgpPassphrase) as string
      const res = await fetch(`${API_URL}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, code })
      })
      if (res.ok) {
        dispatch('authSuccess', { id, publicKey: pubKey, type: 'pgp', pgpPrivateKey, pgpPassphrase })
      } else {
        alert('Login failed: ' + await res.text())
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      loading = false
    }
  }

  async function loginWithNacl() {
    if (!id || !naclSecretKey) {
      alert('ID and Nacl Secret Key are required')
      return
    }
    loading = true
    try {
      // In tweetnacl, we can't easily get public key from secret key without the full keypair object
      // but we can just try to fetch the public key from the server first if it exists
      const resKey = await fetch(`${API_URL}/keys?id=${encodeURIComponent(id)}`)
      if (!resKey.ok) throw new Error("User not found. Please register first.")
      const { publicKey: pubKey } = await resKey.json()

      const resChallenge = await fetch(`${API_URL}/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, publicKey: pubKey })
      })
      if (!resChallenge.ok) throw new Error(await resChallenge.text())
      const { encryptedChallenge, serverPublicKey } = await resChallenge.json()
      
      const [cipher, nonce] = encryptedChallenge.split('|')
      const code = decrypt(naclSecretKey, serverPublicKey, cipher, nonce)
      
      if (!code) throw new Error("Failed to decrypt challenge. Check your secret key.")

      const res = await fetch(`${API_URL}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, code })
      })
      if (res.ok) {
        dispatch('authSuccess', { id, publicKey: pubKey, type: 'nacl', keypair: { publicKey: pubKey, secretKey: naclSecretKey } })
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
        dispatch('authSuccess', { id, publicKey: keypair.publicKey, type: 'nacl', keypair })
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

  function exportNaclKeys() {
    if (!id || !keypair) return
    const content = `ByteChat Nacl Keys for ${id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bytechat_${id}_nacl_keys.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    <div class="auth-header">
      <h1 class="brand">ByteChat</h1>
      <p class="subtitle">Secure, End-to-End Encrypted Messaging</p>
    </div>

    <div class="tabs">
      <button class:active={mode === 'login-pgp'} on:click={() => mode = 'login-pgp'}>PGP Login</button>
      <button class:active={mode === 'login-nacl'} on:click={() => mode = 'login-nacl'}>Nacl Login</button>
      <button class:active={mode === 'register'} on:click={() => mode = 'register'}>Register</button>
    </div>

    <div class="form">
      <div class="input-group">
        <label for="id">User ID</label>
        <input id="id" placeholder="e.g. alice" bind:value={id} />
      </div>

      {#if mode === 'login-pgp'}
        <div class="input-group">
          <label for="pgp">PGP Private Key (Armored)</label>
          <textarea id="pgp" placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..." bind:value={pgpPrivateKey} rows={6}></textarea>
        </div>
        <div class="input-group">
          <label for="pass">Passphrase (if any)</label>
          <input id="pass" type="password" placeholder="Your PGP passphrase" bind:value={pgpPassphrase} />
        </div>
        <button class="btn-primary" on:click={loginWithPGP} disabled={loading || !id || !pgpPrivateKey}>
          {loading ? 'Verifying...' : 'Login with PGP'}
        </button>
      {:else if mode === 'login-nacl'}
        <div class="input-group">
          <label for="nacl-sk">Nacl Secret Key (Base64)</label>
          <input id="nacl-sk" placeholder="Your Nacl secret key" bind:value={naclSecretKey} />
        </div>
        <button class="btn-purple" on:click={loginWithNacl} disabled={loading || !id || !naclSecretKey}>
          {loading ? 'Verifying...' : 'Login with Nacl'}
        </button>
      {:else}
        <div class="nacl-box">
          {#if keypair}
            <div class="key-info">
              <span class="label">Public Key:</span>
              <code class="truncate">{keypair.publicKey}</code>
            </div>
          {:else}
            <p class="text-muted text-sm">Generate a new Nacl keypair to register.</p>
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
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    padding: 1rem;
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
    color: var(--muted);
    font-size: 0.9375rem;
  }

  .tabs {
    display: flex;
    background: var(--bg);
    padding: 0.25rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.625rem;
    border-radius: 10px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
    transition: all 0.2s;
  }

  .tabs button.active {
    background: var(--surface-lighter);
    color: var(--fg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .input-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--muted);
    margin-left: 0.25rem;
  }

  input, textarea {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.75rem 1rem;
    color: var(--fg);
    font-size: 0.9375rem;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .nacl-box {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }

  .key-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 1rem;
  }

  .key-info .label {
    font-size: 0.75rem;
    color: var(--muted);
  }

  .key-info code {
    font-size: 0.75rem;
    background: rgba(0,0,0,0.3);
    padding: 0.5rem;
    border-radius: 6px;
    color: var(--accent);
  }

  .btn-primary, .btn-purple, .btn-secondary {
    width: 100%;
    padding: 0.875rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.2s;
  }

  .btn-primary { background: var(--accent); color: var(--accent-fg); }
  .btn-purple { background: #cba6f7; color: var(--accent-fg); }
  .btn-secondary { background: var(--surface-lighter); color: var(--fg); }

  .btn-primary:hover, .btn-purple:hover { opacity: 0.9; }
  .btn-primary:active, .btn-purple:active { transform: scale(0.98); }

  .auth-footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
