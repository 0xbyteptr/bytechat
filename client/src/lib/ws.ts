export function connectWS(id: string, onMessage: (m: any)=>void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/ws?id=${encodeURIComponent(id)}`
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
