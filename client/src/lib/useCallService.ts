/**
 * Call service - handles VoIP signaling and call management
 */

import * as VoipLib from './useVoip'

export interface CallServiceContext {
  ws: { send: (d: string) => void; close: () => void; readyState: number } | null
}

export function createCallService(context: CallServiceContext) {
  function sendVoipSignal(type: string, data: any, to: string) {
    if (context.ws) {
      context.ws.send(
        JSON.stringify({
          type,
          to,
          ...data
        })
      )
    }
  }

  async function startCall(to: string) {
    if (!to) return

    try {
      await VoipLib.startCall(to, true) // audio only
    } catch (error) {
      console.error('Failed to start call:', error)
      throw error
    }
  }

  async function handleCallOffer(from: string, offer: any) {
    try {
      await VoipLib.handleCallOffer(from, offer, true)
    } catch (error) {
      console.error('Failed to answer call:', error)
      throw error
    }
  }

  async function handleCallAnswer(answer: any) {
    if (answer) {
      await VoipLib.handleCallAnswer(answer)
    }
  }

  async function handleIceCandidate(candidate: any) {
    if (candidate) {
      await VoipLib.handleIceCandidate(candidate)
    }
  }

  function endCall() {
    // Centralize signaling in VoipLib
    VoipLib.endCall()
  }

  function cancelCall() {
    // Centralize signaling in VoipLib
    VoipLib.cancelCall()
  }

  function toggleMute() {
    VoipLib.toggleMute()
  }

  return {
    sendVoipSignal,
    startCall,
    handleCallOffer,
    handleCallAnswer,
    handleIceCandidate,
    endCall,
    cancelCall,
    toggleMute
  }
}

export type CallService = ReturnType<typeof createCallService>
