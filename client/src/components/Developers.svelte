<script lang="ts">
  export let apiUrl: string;
  export let version: string | undefined;

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
</script>

<div class="dev-shell">
  <header class="hero">
    <div>
      <p class="eyebrow">Developers</p>
      <h1>Build bots for ByteChat</h1>
      <p class="lede">
        Connect securely, receive events, send messages and reactions.
        You own the keys — the server cannot read your traffic.
      </p>

      <div class="cta-row">
        <a class="btn" href="https://github.com/0xbyteptr/bytechat/tree/main/bot_api" target="_blank" rel="noreferrer">Bot SDK</a>
        <a class="btn ghost" href="mailto:hello@byteptr.xyz">Support</a>
      </div>

      {#if version}
        <p class="tiny">Running ByteChat v{version}</p>
      {/if}
    </div>
  </header>

  <section class="grid">
    <article class="card">
      <p class="label">1) Generate keys</p>
      <p class="body">Use a Curve25519/NaCl keypair. With Node:</p>
      <pre><code>npm install tweetnacl
node -e "const nacl=require('tweetnacl');const k=nacl.box.keyPair();console.log('PUB='+Buffer.from(k.publicKey).toString('base64'));console.log('SEC='+Buffer.from(k.secretKey).toString('base64'));"</code></pre>
      <p class="hint">Store the secret key securely; you need it to decrypt messages.</p>
    </article>

    <article class="card">
      <p class="label">2) Register bot ID</p>
      <p class="body">Call <span class="mono">POST /keys</span> with your bot ID and public key to receive a session token.</p>
      <pre><code>{curlRegister}</code></pre>

      <p class="body">If you prefer challenge/response, request an encrypted challenge first:</p>
      <pre><code>{curlChallenge}</code></pre>
    </article>

    <article class="card">
      <p class="label">3) Connect over WebSocket</p>
      <p class="body">Use the TypeScript SDK in <span class="mono">bot_api/</span> (or roll your own) and send the auth envelope first.</p>
      <pre><code>{wsExample}</code></pre>
      <p class="hint">
        The first frame must be <span class="mono">{"{\"type\":\"auth\",\"id\":\"your-bot\",\"token\":\"...\"}"}</span>.
      </p>
    </article>
  </section>

  <section class="faq">
    <h2>Behavior</h2>
    <ul>
      <li>History: the server replays the last messages and reactions for your bot after auth.</li>
      <li>Presence: you receive <span class="mono">presence</span> snapshots with <span class="mono">online: string[]</span>.</li>
      <li>Groups: set <span class="mono">to</span> to a group id (<span class="mono">#group</span>) to broadcast to members.</li>
      <li>Reactions & read receipts: use <span class="mono">type: "react"</span> or <span class="mono">type: "read"</span> envelopes.</li>
      <li>Rate: keep to &lt;20 msgs/sec per bot</li>
    </ul>
  </section>
</div>

<style>
  /* (zachowano cały CSS bez zmian) */
  .dev-shell { padding: 48px 32px; max-width: 1080px; margin: 0 auto; color: var(--fg); }
  .hero { display: grid; grid-template-columns: minmax(0, 2fr) 320px; gap: 24px; align-items: start; margin-bottom: 32px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px; opacity: 0.7; margin: 0; }
  h1 { margin: 4px 0 8px; font-size: 34px; }
  .lede { opacity: 0.8; line-height: 1.5; max-width: 640px; }
  .cta-row { display: flex; gap: 12px; margin: 16px 0; }
  .btn { background: var(--accent); color: var(--accent-fg); padding: 10px 16px; border-radius: 10px; text-decoration: none; font-weight: 700; }
  .btn.ghost { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
  .tiny { opacity: 0.5; font-size: 12px; margin-top: 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
  .card { background: var(--surface); border: 1px solid var(--surface-lighter); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .label { font-weight: 700; margin: 0; }
  .body { margin: 0; opacity: 0.9; }
  .hint { margin: 0; font-size: 13px; opacity: 0.7; }
  pre { margin: 0; padding: 12px; background: var(--surface-darker); border-radius: 10px; overflow-x: auto; font-size: 12px; }
  code { white-space: pre; display: block; font-family: var(--font-mono); }
  .mono { font-family: var(--font-mono); }
  .faq { margin-top: 32px; border-top: 1px solid var(--surface-lighter); padding-top: 16px; }
  .faq h2 { margin: 0 0 8px; }
  .faq ul { margin: 0; padding-left: 18px; opacity: 0.85; line-height: 1.5; }
</style>
