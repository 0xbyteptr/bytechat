import { Capacitor } from '@capacitor/core'

export function connectWS(id: string, token: string, onMessage: (m: any)=>void, onStatus: (s: 'connected' | 'disconnected' | 'connecting') => void) {
  let baseUrl = import.meta.env.VITE_WS_URL
  if (!baseUrl) {
    if (Capacitor.isNativePlatform()) {
      // Default to emulator IP if native, otherwise user must provide VITE_WS_URL
      baseUrl = 'wss://api.byteptr.xyz'
    } else {
      baseUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host
    }
  }
  const url = `${baseUrl}/ws?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`
  
  let ws: WebSocket | null = null
  let forcedClose = false

  function connect() {
    if (forcedClose) return
    onStatus('connecting')
    
    ws = new WebSocket(url)
    
    ws.onopen = () => {
      console.log('ws open')
      onStatus('connected')
    }
    
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        onMessage(data)
      } catch(e) {
        console.warn('invalid ws message', e)
      }
    }
    
    ws.onclose = () => {
      console.log('ws closed')
      onStatus('disconnected')
      if (!forcedClose) {
        setTimeout(connect, 3000)
      }
    }
    
    ws.onerror = () => {
      ws?.close()
    }
  }

  connect()

  return {
    send: (data: string) => ws?.send(data),
    close: () => { 
      forcedClose = true
      ws?.close() 
    },
    get readyState() { return ws?.readyState ?? 3 }
  }
}
