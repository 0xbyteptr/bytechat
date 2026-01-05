import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(async () => {
  const { svelte } = await import('@sveltejs/vite-plugin-svelte')
  return {
    base: './',
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
          icons: []
        }
      })
    ],
    server: {
      proxy: {
        '/keys': 'http://localhost:8080',
        '/challenge': 'http://localhost:8080',
        '/push-token': 'http://localhost:8080',
        '/cdn': 'http://localhost:8080',
        '/ws': {
          target: 'ws://localhost:8080',
          ws: true
        }
      }
    }
  }
})
