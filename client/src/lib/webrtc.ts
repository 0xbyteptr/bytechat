// WebRTC Voice/Video Call Module

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'

export interface CallEvents {
  onStateChange: (state: CallState) => void
  onRemoteStream: (stream: MediaStream) => void
  onError: (error: string) => void
}

export class VoIPCall {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private state: CallState = 'idle'
  private events: CallEvents
  private iceCandidateQueue: RTCIceCandidate[] = []
  private isInitiator: boolean = false

  constructor(events: CallEvents) {
    this.events = events
  }

  private setState(newState: CallState) {
    this.state = newState
    this.events.onStateChange(newState)
  }

  getState(): CallState {
    return this.state
  }

  private createPeerConnection() {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }

    this.peerConnection = new RTCPeerConnection(config)

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate through WebSocket
        this.onIceCandidate?.(event.candidate)
      }
    }

    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0]
        this.events.onRemoteStream(event.streams[0])
        this.setState('connected')
      }
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return
      
      console.log('ICE connection state:', this.peerConnection.iceConnectionState)
      
      if (this.peerConnection.iceConnectionState === 'connected') {
        this.setState('connected')
      } else if (this.peerConnection.iceConnectionState === 'disconnected' || 
                 this.peerConnection.iceConnectionState === 'failed') {
        this.hangup()
      }
    }
  }

  async startCall(audioOnly: boolean = true): Promise<{ offer: RTCSessionDescriptionInit }> {
    try {
      this.isInitiator = true
      this.setState('calling')

      // Get user media
      const constraints = audioOnly 
        ? { audio: true, video: false }
        : { audio: true, video: true }
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      this.createPeerConnection()
      
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Create and set local description
      const offer = await this.peerConnection!.createOffer()
      await this.peerConnection!.setLocalDescription(offer)

      return { offer }
    } catch (error) {
      this.events.onError(`Failed to start call: ${error}`)
      this.hangup()
      throw error
    }
  }

  async answerCall(offer: RTCSessionDescriptionInit, audioOnly: boolean = true): Promise<{ answer: RTCSessionDescriptionInit }> {
    try {
      this.isInitiator = false
      this.setState('connecting')

      // Get user media
      const constraints = audioOnly 
        ? { audio: true, video: false }
        : { audio: true, video: true }
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints)
      
      this.createPeerConnection()
      
      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Set remote description
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer))

      // Create and set local description
      const answer = await this.peerConnection!.createAnswer()
      await this.peerConnection!.setLocalDescription(answer)

      // Process queued ICE candidates
      for (const candidate of this.iceCandidateQueue) {
        await this.peerConnection!.addIceCandidate(candidate)
      }
      this.iceCandidateQueue = []

      return { answer }
    } catch (error) {
      this.events.onError(`Failed to answer call: ${error}`)
      this.hangup()
      throw error
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (!this.peerConnection) {
        throw new Error('No peer connection')
      }
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      
      // Process queued ICE candidates
      for (const candidate of this.iceCandidateQueue) {
        await this.peerConnection.addIceCandidate(candidate)
      }
      this.iceCandidateQueue = []
    } catch (error) {
      this.events.onError(`Failed to handle answer: ${error}`)
      this.hangup()
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (!this.peerConnection) {
        // Queue candidates until peer connection is ready
        this.iceCandidateQueue.push(new RTCIceCandidate(candidate))
        return
      }

      if (this.peerConnection.remoteDescription) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        this.iceCandidateQueue.push(new RTCIceCandidate(candidate))
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }

  hangup() {
    // Stop all tracks immediately to release resources
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop()
        } catch (e) {
          console.warn('Failed to stop track:', e)
        }
      })
      this.localStream = null
    }

    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close()
      } catch (e) {
        console.warn('Failed to close peer connection:', e)
      }
      this.peerConnection = null
    }

    this.remoteStream = null
    this.iceCandidateQueue = []
    
    // Don't set state here - let caller handle it to avoid race conditions
  }

  toggleMute(): boolean {
    if (!this.localStream) return false
    
    const audioTrack = this.localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      return !audioTrack.enabled // return true if muted
    }
    return false
  }

  isMuted(): boolean {
    if (!this.localStream) return false
    const audioTrack = this.localStream.getAudioTracks()[0]
    return audioTrack ? !audioTrack.enabled : false
  }

  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream
  }

  // Callback to send ICE candidates through WebSocket
  onIceCandidate?: (candidate: RTCIceCandidate) => void
}
