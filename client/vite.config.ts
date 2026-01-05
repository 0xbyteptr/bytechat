import { defineConfig } from 'vite'

export default defineConfig(async () => {
  const { svelte } = await import('@sveltejs/vite-plugin-svelte')
  return {
    plugins: [svelte()],
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
