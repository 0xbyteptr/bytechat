import { writable } from 'svelte/store'

export interface ForwardingState {
  isForwarding: boolean
  messages: Array<{
    messageId: string
    text: string
    from: string
    ts: number
  }>
}

export function useMessageForwarding() {
  const state = writable<ForwardingState>({
    isForwarding: false,
    messages: []
  })

  function startForwarding(message: any) {
    state.set({
      isForwarding: true,
      messages: [{
        messageId: message.messageId || '',
        text: message.text || '',
        from: message.from || '',
        ts: message.ts || Date.now()
      }]
    })
  }

  function addMessage(message: any) {
    state.update(s => ({
      ...s,
      messages: [...s.messages, {
        messageId: message.messageId || '',
        text: message.text || '',
        from: message.from || '',
        ts: message.ts || Date.now()
      }]
    }))
  }

  function removeMessage(messageId: string) {
    state.update(s => ({
      ...s,
      messages: s.messages.filter(m => m.messageId !== messageId)
    }))
  }

  function cancel() {
    state.set({
      isForwarding: false,
      messages: []
    })
  }

  function forwardTo(targetId: string, sendFn: (to: string, text: string) => void) {
    const messages = []
    state.subscribe(s => {
      messages.push(...s.messages)
    })()

    messages.forEach(msg => {
      const forwardedText = `📨 Forwarded from ${msg.from}:\n${msg.text}`
      sendFn(targetId, forwardedText)
    })

    cancel()
  }

  return {
    state,
    startForwarding,
    addMessage,
    removeMessage,
    cancel,
    forwardTo
  }
}
