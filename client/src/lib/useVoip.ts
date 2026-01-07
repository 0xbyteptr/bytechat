import { writable } from 'svelte/store'
import { VoIPCall, type CallState } from './webrtc'
import * as MessagesLib from './useMessages'

export const callState = writable<CallState>('idle')
export const callContact = writable<string | null>(null)
export const isMuted = writable(false)
export const callDuration = writable(0) // in seconds
export const isCallCancellable = writable(false) // true when ringing but not answered

let voipCallInstance: VoIPCall | null = null
let remoteAudioElement: HTMLAudioElement | null = null
let sendSignalCallback: ((type: string, data: any, to: string) => void) | null = null
let callStartTime: number | null = null
let callDurationInterval: ReturnType<typeof setInterval> | null = null

export function initVoIP(
  remoteAudioEl: HTMLAudioElement,
  sendSignal: (type: string, data: any, to: string) => void
) {
  remoteAudioElement = remoteAudioEl
  sendSignalCallback = sendSignal

  voipCallInstance = new VoIPCall({
    onStateChange: (state: CallState) => {
      callState.set(state)
    },
    onRemoteStream: (stream: MediaStream) => {
      if (remoteAudioElement) {
        remoteAudioElement.srcObject = stream
      }
    },
    onError: (error: string) => {
      console.error('VoIP error:', error)
      callState.set('idle')
      callContact.set(null)
    }
  })
  
  // Setup ICE candidate forwarding
  voipCallInstance.onIceCandidate = (candidate: RTCIceCandidate) => {
    const currentContact = callContact
    let contactValue: string | null = null
    const unsubscribe = currentContact.subscribe(value => contactValue = value)
    unsubscribe()
    
    if (sendSignalCallback && contactValue) {
      sendSignalCallback('call-ice-candidate', { candidate: candidate.toJSON() }, contactValue)
    }
  }
}

export async function startCall(contact: string, audioOnly: boolean = true): Promise<void> {
  if (!voipCallInstance || !sendSignalCallback) return

  try {
    callContact.set(contact)
    callState.set('calling')
    isCallCancellable.set(true)
    callStartTime = Date.now()

    const { offer } = await voipCallInstance.startCall(audioOnly)
    sendSignalCallback('call-offer', { offer, audioOnly }, contact)
  } catch (error) {
    console.error('Failed to start call:', error)
    endCall()
  }
}

export async function handleCallOffer(
  from: string,
  offer: RTCSessionDescriptionInit,
  audioOnly: boolean = true
): Promise<void> {
  if (!voipCallInstance || !sendSignalCallback) return

  const accept = confirm(`Incoming ${audioOnly ? 'voice' : 'video'} call from ${from}. Accept?`)
  if (!accept) {
    // Log missed/declined call
    logCallHistory(from, 'declined', 0)
    sendSignalCallback('call-end', {}, from)
    return
  }

  try {
    callContact.set(from)
    callState.set('connecting')
    isCallCancellable.set(false)
    callStartTime = Date.now()
    startCallDurationTimer()

    const { answer } = await voipCallInstance.answerCall(offer, audioOnly)
    sendSignalCallback('call-answer', { answer }, from)
  } catch (error) {
    console.error('Failed to answer call:', error)
    endCall()
  }
}

export async function handleCallAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
  if (!voipCallInstance) return

  try {
    await voipCallInstance.handleAnswer(answer)
  } catch (error) {
    console.error('Failed to handle answer:', error)
    endCall()
  }
}

export async function handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
  if (!voipCallInstance) return

  try {
    await voipCallInstance.addIceCandidate(candidate)
  } catch (error) {
    console.error('Failed to add ICE candidate:', error)
  }
}

export function endCall(): void {
  if (voipCallInstance) {
    voipCallInstance.hangup()
  }
  
  // Notify remote party that the call ended
  const remoteContact = getCurrentCallContact()
  if (remoteContact && sendSignalCallback) {
    sendSignalCallback('call-end', {}, remoteContact)
  }

  // Log call duration if call was connected
  const currentState = getCurrentCallState()
  const currentContact = getCurrentCallContact()
  
  if (currentState === 'connected' && callStartTime && currentContact) {
    const duration = Math.floor((Date.now() - callStartTime) / 1000)
    logCallHistory(currentContact, 'completed', duration)
  }
  
  stopCallDurationTimer()
  callState.set('idle')
  callContact.set(null)
  isMuted.set(false)
  isCallCancellable.set(false)
  callDuration.set(0)
  callStartTime = null
}

export function cancelCall(): void {
  const currentContact = getCurrentCallContact()
  const currentState = getCurrentCallState()
  
  // Only allow cancellation when calling (not yet answered)
  if (currentState === 'calling' && currentContact && sendSignalCallback) {
    sendSignalCallback('call-cancel', {}, currentContact)
    
    // Log as cancelled call
    logCallHistory(currentContact, 'cancelled', 0)
  }
  
  endCall()
}

export function toggleMute(): void {
  if (!voipCallInstance) return
  
  const newMutedState = voipCallInstance.toggleMute()
  isMuted.set(newMutedState)
}

export function getVoipInstance(): VoIPCall | null {
  return voipCallInstance
}

// Helper functions for call history and duration tracking

function getCurrentCallState(): CallState {
  let state: CallState = 'idle'
  const unsubscribe = callState.subscribe(value => state = value)
  unsubscribe()
  return state
}

function getCurrentCallContact(): string | null {
  let contact: string | null = null
  const unsubscribe = callContact.subscribe(value => contact = value)
  unsubscribe()
  return contact
}

function startCallDurationTimer(): void {
  stopCallDurationTimer()
  callDurationInterval = setInterval(() => {
    if (callStartTime) {
      const duration = Math.floor((Date.now() - callStartTime) / 1000)
      callDuration.set(duration)
    }
  }, 1000)
}

function stopCallDurationTimer(): void {
  if (callDurationInterval) {
    clearInterval(callDurationInterval)
    callDurationInterval = null
  }
}

function logCallHistory(contact: string, status: 'missed' | 'completed' | 'cancelled' | 'declined', duration: number): void {
  // Get current user ID from session
  let currentUserId = 'unknown'
  
  const callHistoryMessage: MessagesLib.Message = {
    from: currentUserId,
    text: formatCallStatus(status, duration),
    ts: Date.now(),
    messageId: `call-${Date.now()}-${Math.random()}`,
    type: 'call',
    callData: {
      status,
      duration,
      initiator: currentUserId
    }
  }
  
  MessagesLib.addMessage(contact, callHistoryMessage)
}

function formatCallStatus(status: 'missed' | 'completed' | 'cancelled' | 'declined', duration: number): string {
  switch (status) {
    case 'completed':
      return `Call completed (${formatDuration(duration)})`
    case 'missed':
      return 'Missed call'
    case 'cancelled':
      return 'Call cancelled'
    case 'declined':
      return 'Call declined'
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}
