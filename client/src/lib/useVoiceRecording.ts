import { writable } from 'svelte/store'

export interface VoiceRecordingState {
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
  audioUrl: string | null
}

export function useVoiceRecording() {
  const state = writable<VoiceRecordingState>({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null
  })

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let startTime: number = 0
  let timerInterval: NodeJS.Timeout | null = null

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      audioChunks = []
      startTime = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        state.update(s => ({
          ...s,
          isRecording: false,
          audioBlob,
          audioUrl
        }))

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        
        if (timerInterval) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      }

      mediaRecorder.start()
      
      state.update(s => ({
        ...s,
        isRecording: true,
        duration: 0,
        audioBlob: null,
        audioUrl: null
      }))

      // Update duration every 100ms
      timerInterval = setInterval(() => {
        const duration = Math.floor((Date.now() - startTime) / 1000)
        state.update(s => ({ ...s, duration }))
      }, 100)

    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
  }

  function cancelRecording() {
    if (mediaRecorder) {
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
      audioChunks = []
    }
    
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    state.update(s => ({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null
    }))
  }

  function reset() {
    state.update(s => ({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null
    }))
  }

  return {
    state,
    startRecording,
    stopRecording,
    cancelRecording,
    reset
  }
}
