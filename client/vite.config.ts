import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(async () => {
  const { svelte } = await import('@sveltejs/vite-plugin-svelte')
  return {
    plugins: [
      svelte(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'ByteChat',
          short_name: 'ByteChat',
          description: 'Secure, End-to-End Encrypted Messaging',
          theme_color: '#1e1e2e',
          background_color: '#1e1e2e',
          display: 'standalone',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    server: {
      proxy: {
        '/keys': 'http://localhost:8080',
        '/challenge': 'http://localhost:8080',
        '/ws': {
          target: 'ws://localhost:8080',
          ws: true
        }
      }
    }
  }
})
