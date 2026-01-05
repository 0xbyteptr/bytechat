export function connectWS(id: string, onMessage: (m: any)=>void) {
  const baseUrl = import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host
  const url = `${baseUrl}/ws?id=${encodeURIComponent(id)}`
  const ws = new WebSocket(url)
  
  ws.addEventListener('open', () => console.log('ws open'))
  ws.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data)
      onMessage(data)
    } catch(e) {
      console.warn('invalid ws message', e)
    }
  })
  ws.addEventListener('close', () => console.log('ws closed'))
  
  return ws
}
