import { writable } from 'svelte/store'
import { VoIPCall, type CallState } from './webrtc'

export const callState = writable<CallState>('idle')
export const callContact = writable<string | null>(null)
export const isMuted = writable(false)

let voipCallInstance: VoIPCall | null = null
let remoteAudioElement: HTMLAudioElement | null = null
let sendSignalCallback: ((type: string, data: any, to: string) => void) | null = null

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

    const { offer } = await voipCallInstance.startCall(audioOnly)
    sendSignalCallback('call-offer', { offer, audioOnly }, contact)
  } catch (error) {
    console.error('Failed to start call:', error)
    callState.set('idle')
    callContact.set(null)
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
    sendSignalCallback('call-end', {}, from)
    return
  }

  try {
    callContact.set(from)
    callState.set('connecting')

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
  callState.set('idle')
  callContact.set(null)
  isMuted.set(false)
}

export function toggleMute(): void {
  if (!voipCallInstance) return
  
  const newMutedState = voipCallInstance.toggleMute()
  isMuted.set(newMutedState)
}

export function getVoipInstance(): VoIPCall | null {
  return voipCallInstance
}
