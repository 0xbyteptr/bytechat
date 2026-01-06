import { Capacitor } from '@capacitor/core'

export function connectWS(id: string, token: string, onMessage: (m: any)=>void, onStatus: (s: 'connected' | 'disconnected' | 'connecting' | 'authenticating') => void) {
  let baseUrl = import.meta.env.VITE_WS_URL
  if (!baseUrl) {
    baseUrl = 'wss://api.byteptr.xyz'
  }
  const url = `${baseUrl}/ws`
  console.log('Connecting to WS:', url)
  
  let ws: WebSocket | null = null
  let forcedClose = false
  let authenticated = false

  function connect() {
    if (forcedClose) return
    onStatus('connecting')
    authenticated = false
    
    ws = new WebSocket(url)
    
    ws.onopen = () => {
      console.log('ws open, sending auth...')
      onStatus('authenticating')
      
      // Send authentication message
      ws?.send(JSON.stringify({
        type: 'auth',
        id: id,
        token: token
      }))
    }
    
    // Respond to ping messages automatically (browser handles this natively)
    // WebSocket API automatically responds to ping with pong
    
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        
        // Handle authentication response
        if (data.type === 'auth') {
          if (data.status === 'success') {
            console.log('ws authenticated')
            authenticated = true
            onStatus('connected')
          } else {
            console.error('ws auth failed')
            forcedClose = true
            ws?.close()
          }
          return
        }
        
        // Handle error messages
        if (data.type === 'error') {
          console.error('ws error:', data.error)
          if (data.error === 'authentication required' || data.error === 'invalid credentials') {
            forcedClose = true
            ws?.close()
          }
          return
        }
        
        // Only process regular messages after authentication
        if (authenticated) {
          onMessage(data)
        }
      } catch(e) {
        console.warn('invalid ws message', e)
      }
    }
    
    ws.onclose = () => {
      console.log('ws closed')
      authenticated = false
      onStatus('disconnected')
      if (!forcedClose) {
        setTimeout(connect, 3000)
      }
    }
    
    ws.onerror = (ev) => {
      console.error('WebSocket Error details:', ev)
      ws?.close()
    }
  }

  connect()

  return {
    send: (data: string) => {
      if (authenticated && ws?.readyState === WebSocket.OPEN) {
        ws.send(data)
      } else {
        console.warn('Cannot send: WebSocket not authenticated or not open')
      }
    },
    close: () => { 
      forcedClose = true
      ws?.close() 
    },
    get readyState() { return ws?.readyState ?? 3 },
    get isAuthenticated() { return authenticated }
  }
}
