import './styles.css'
import App from './App.svelte'
import vercelAnalytics from '@vercel/analytics'
import { inject } from '@vercel/analytics'

const app = new App({
  target: document.getElementById('app')!,
})

inject()
vercelAnalytics.inject()

export default app
