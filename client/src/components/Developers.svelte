<script lang="ts">
  export let apiUrl: string;
  export let version: string | undefined;
  export let onNavigate: ((path: string) => void) | undefined = undefined;

  const wsUrl =
    apiUrl.startsWith("https://")
      ? apiUrl.replace("https://", "wss://") + "/ws"
      : apiUrl.startsWith("http://")
      ? apiUrl.replace("http://", "ws://") + "/ws"
      : apiUrl;

  const curlRegister = `curl -X POST ${apiUrl}/keys \\
  -H 'Content-Type: application/json' \\
  -d '{"id":"bot.example","publicKey":"<base64-public-key>"}'`;

  const curlChallenge = `curl -X POST ${apiUrl}/challenge \\
  -H 'Content-Type: application/json' \\
  -d '{"id":"bot.example","publicKey":"<base64-public-key>"}'`;

  const wsExample = `import { BotClient } from './bot_api/src';

const bot = new BotClient({
  id: 'bot.example',
  token: process.env.BYTECHAT_BOT_TOKEN!,
  wsUrl: '${wsUrl}',
  autoReconnect: true,
});

bot.on('message', (msg) => {
  const from = msg.from as string | undefined;
  const text = typeof msg.text === 'string' ? msg.text : '';
  if (!from || !text) return;
  bot.sendMessage({ to: from, payload: { type: 'text', text: \`echo: \${text}\` } });
});

bot.connect();`;

  let copiedIndex: number | null = null;
  
  async function copyToClipboard(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      copiedIndex = index;
      setTimeout(() => copiedIndex = null, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
</script>

<div class="dev-shell">
  <header class="hero">
    <div class="hero-content">
      <button class="back-btn" on:click={() => onNavigate?.('/home')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Chat
      </button>
      
      <p class="eyebrow">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
        </svg>
        Developers
      </p>
      
      <h1 class="title-gradient">Build bots for ByteChat</h1>
      
      <p class="lede">
        Connect securely, receive events, send messages and reactions.
        <strong>You own the keys</strong> — the server cannot read your traffic.
      </p>

      <div class="cta-row">
        <a class="btn primary" href="https://github.com/0xbyteptr/bytechat/tree/main/bot_api" target="_blank" rel="noreferrer">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          View SDK on GitHub
        </a>
        <a class="btn ghost" href="mailto:hello@byteptr.xyz">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Contact Support
        </a>
      </div>

      {#if version}
        <p class="tiny">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          ByteChat v{version}
        </p>
      {/if}
    </div>
  </header>

  <section class="grid">
    <article class="card">
      <div class="card-header">
        <span class="step-badge">1</span>
        <h3>Generate keys</h3>
      </div>
      <p class="body">Use a Curve25519/NaCl keypair. With Node:</p>
      <div class="code-block">
        <button class="copy-btn" on:click={() => copyToClipboard('npm install tweetnacl\nnode -e "const nacl=require(\'tweetnacl\');const k=nacl.box.keyPair();console.log(\'PUB=\'+Buffer.from(k.publicKey).toString(\'base64\'));console.log(\'SEC=\'+Buffer.from(k.secretKey).toString(\'base64\'));"', 0)} title="Copy to clipboard">
          {#if copiedIndex === 0}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
        <pre><code>npm install tweetnacl
node -e "const nacl=require('tweetnacl');const k=nacl.box.keyPair();console.log('PUB='+Buffer.from(k.publicKey).toString('base64'));console.log('SEC='+Buffer.from(k.secretKey).toString('base64'));"</code></pre>
      </div>
      <p class="hint">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        Store the secret key securely; you need it to decrypt messages.
      </p>
    </article>

    <article class="card">
      <div class="card-header">
        <span class="step-badge">2</span>
        <h3>Register bot ID</h3>
      </div>
      <p class="body">Call <span class="mono">POST /keys</span> with your bot ID and public key to receive a session token.</p>
      <div class="code-block">
        <button class="copy-btn" on:click={() => copyToClipboard(curlRegister, 1)} title="Copy to clipboard">
          {#if copiedIndex === 1}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
        <pre><code>{curlRegister}</code></pre>
      </div>

      <p class="body">If you prefer challenge/response, request an encrypted challenge first:</p>
      <div class="code-block">
        <button class="copy-btn" on:click={() => copyToClipboard(curlChallenge, 2)} title="Copy to clipboard">
          {#if copiedIndex === 2}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
        <pre><code>{curlChallenge}</code></pre>
      </div>
    </article>

    <article class="card">
      <div class="card-header">
        <span class="step-badge">3</span>
        <h3>Connect over WebSocket</h3>
      </div>
      <p class="body">Use the TypeScript SDK in <span class="mono">bot_api/</span> (or roll your own) and send the auth envelope first.</p>
      <div class="code-block">
        <button class="copy-btn" on:click={() => copyToClipboard(wsExample, 3)} title="Copy to clipboard">
          {#if copiedIndex === 3}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          {/if}
        </button>
        <pre><code>{wsExample}</code></pre>
      </div>
      <p class="hint">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
        The first frame must be <span class="mono">{"{\"type\":\"auth\",\"id\":\"your-bot\",\"token\":\"...\"}"}</span>.
      </p>
    </article>
  </section>

  <section class="faq">
    <h2>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      Behavior & Features
    </h2>
    <ul>
      <li><strong>History:</strong> the server replays the last messages and reactions for your bot after auth.</li>
      <li><strong>Presence:</strong> you receive <span class="mono">presence</span> snapshots with <span class="mono">online: string[]</span>.</li>
      <li><strong>Groups:</strong> set <span class="mono">to</span> to a group id (<span class="mono">#group</span>) to broadcast to members.</li>
      <li><strong>Reactions & read receipts:</strong> use <span class="mono">type: "react"</span> or <span class="mono">type: "read"</span> envelopes.</li>
      <li><strong>Rate limits:</strong> keep to &lt;20 msgs/sec per bot for optimal performance</li>
    </ul>
  </section>
</div>

<style>
  .dev-shell { 
    padding: 48px 32px; 
    max-width: 1200px; 
    margin: 0 auto; 
    color: var(--fg);
    animation: fadeIn 0.4s ease-out;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .back-btn { 
    background: var(--surface); 
    border: 1px solid var(--surface-lighter); 
    color: var(--fg); 
    padding: 10px 18px; 
    border-radius: 10px; 
    cursor: pointer; 
    font-size: 14px; 
    font-weight: 500;
    margin-bottom: 24px; 
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  
  .back-btn:hover { 
    background: var(--surface-lighter); 
    border-color: var(--accent); 
    transform: translateX(-4px);
  }
  
  .hero { 
    margin-bottom: 48px;
  }
  
  .hero-content {
    max-width: 800px;
  }
  
  .eyebrow { 
    text-transform: uppercase; 
    letter-spacing: 0.15em; 
    font-size: 12px; 
    font-weight: 600;
    opacity: 0.7; 
    margin: 0 0 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  
  h1 { 
    margin: 0 0 16px; 
    font-size: 48px; 
    font-weight: 800;
    line-height: 1.1;
  }
  
  .title-gradient {
    background: linear-gradient(135deg, var(--accent) 0%, var(--lavender) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .lede { 
    opacity: 0.85; 
    line-height: 1.6; 
    font-size: 18px;
    max-width: 640px;
    margin-bottom: 24px;
  }
  
  .lede strong {
    color: var(--accent);
    font-weight: 600;
  }
  
  .cta-row { 
    display: flex; 
    gap: 12px; 
    margin: 24px 0;
    flex-wrap: wrap;
  }
  
  .btn { 
    background: var(--accent); 
    color: var(--accent-fg); 
    padding: 12px 24px; 
    border-radius: 12px; 
    text-decoration: none; 
    font-weight: 600;
    font-size: 15px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  
  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(var(--accent-rgb), 0.3);
  }
  
  .btn.primary {
    background: var(--accent);
  }
  
  .btn.ghost { 
    background: transparent; 
    color: var(--accent); 
    border: 2px solid var(--accent);
  }
  
  .btn.ghost:hover {
    background: rgba(var(--accent-rgb), 0.1);
    border-color: var(--lavender);
    color: var(--lavender);
  }
  
  .tiny { 
    opacity: 0.5; 
    font-size: 13px; 
    margin-top: 16px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  
  .grid { 
    display: grid; 
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); 
    gap: 20px;
    margin-bottom: 48px;
  }
  
  .card { 
    background: var(--surface); 
    border: 1px solid var(--surface-lighter); 
    border-radius: 16px; 
    padding: 24px; 
    display: flex; 
    flex-direction: column; 
    gap: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--lavender));
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .card:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  }
  
  .card:hover::before {
    opacity: 1;
  }
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  
  .step-badge {
    background: var(--accent);
    color: var(--accent-fg);
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    flex-shrink: 0;
  }
  
  .card-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }
  
  .body { 
    margin: 0; 
    opacity: 0.9;
    line-height: 1.6;
  }
  
  .hint { 
    margin: 0; 
    font-size: 13px; 
    opacity: 0.7;
    padding: 12px;
    background: rgba(var(--accent-rgb), 0.1);
    border-radius: 8px;
    border-left: 3px solid var(--accent);
    display: flex;
    align-items: start;
    gap: 8px;
  }
  
  .hint svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
  
  .code-block {
    position: relative;
    margin: 8px 0;
  }
  
  .copy-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: var(--surface-lighter);
    border: 1px solid var(--overlay);
    color: var(--fg);
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }
  
  .copy-btn:hover {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  
  pre { 
    margin: 0; 
    padding: 16px 48px 16px 16px; 
    background: var(--bg); 
    border-radius: 12px; 
    overflow-x: auto; 
    font-size: 13px;
    border: 1px solid var(--surface-lighter);
    transition: border-color 0.2s;
  }
  
  pre:hover {
    border-color: var(--overlay);
  }
  
  code { 
    white-space: pre; 
    display: block; 
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    line-height: 1.6;
  }
  
  .mono { 
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    background: rgba(var(--accent-rgb), 0.15);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  
  .faq { 
    margin-top: 48px; 
    padding: 32px;
    background: var(--surface);
    border-radius: 16px;
    border: 1px solid var(--surface-lighter);
  }
  
  .faq h2 { 
    margin: 0 0 20px; 
    font-size: 28px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .faq ul { 
    margin: 0; 
    padding-left: 0; 
    opacity: 0.9; 
    line-height: 1.8;
    list-style: none;
  }
  
  .faq li {
    padding: 12px 0;
    padding-left: 32px;
    position: relative;
  }
  
  .faq li::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent);
    font-weight: 700;
    font-size: 18px;
  }
  
  .faq li strong {
    color: var(--accent);
  }
  
  @media (max-width: 768px) {
    .dev-shell { 
      padding: 24px 16px; 
    }
    
    h1 { 
      font-size: 36px; 
    }
    
    .lede {
      font-size: 16px;
    }
    
    .grid { 
      grid-template-columns: 1fr; 
    }
    
    .cta-row {
      flex-direction: column;
    }
    
    .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
