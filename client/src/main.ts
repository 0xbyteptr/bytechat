import './styles.css'
import App from './App.svelte'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'

inject()
injectSpeedInsights()

const app = new App({
  target: document.getElementById('app')!,
})

export default app
