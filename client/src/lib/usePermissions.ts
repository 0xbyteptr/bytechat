import { writable } from 'svelte/store'

export interface Permissions {
  microphone: boolean
  notifications: boolean
  camera: boolean
  storage: boolean
}

export const permissions = writable<Permissions>({
  microphone: false,
  notifications: false,
  camera: false,
  storage: false
})

export async function checkPermissions(): Promise<Permissions> {
  const perms: Permissions = {
    microphone: false,
    notifications: false,
    camera: false,
    storage: false
  }

  // For Android, permissions are declared in manifest and handled by Capacitor
  // These return true as they should be available after manifest declaration
  perms.microphone = true
  perms.camera = true
  perms.storage = true

  // Check notification permission
  if ('Notification' in window) {
    perms.notifications = Notification.permission === 'granted'
  }

  permissions.set(perms)
  return perms
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach(track => track.stop())
    permissions.update(p => ({ ...p, microphone: true }))
    return true
  } catch (err) {
    console.warn('Microphone permission denied:', err)
    return false
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach(track => track.stop())
    permissions.update(p => ({ ...p, camera: true }))
    return true
  } catch (err) {
    console.warn('Camera permission denied:', err)
    return false
  }
}

export async function requestStoragePermission(): Promise<boolean> {
  // Storage permissions are automatically granted on Android 11+
  permissions.update(p => ({ ...p, storage: true }))
  return true
}

export async function requestNotificationPermission(): Promise<boolean> {
  if ('Notification' in window && Notification.permission !== 'granted') {
    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      permissions.update(p => ({ ...p, notifications: granted }))
      return granted
    } catch (err) {
      console.warn('Notification permission denied:', err)
      return false
    }
  }
  return Notification.permission === 'granted'
}

export async function requestAllPermissions(): Promise<boolean> {
  let allGranted = true

  // Request all VoIP-related permissions
  const micGranted = await requestMicrophonePermission()
  if (!micGranted) allGranted = false

  const cameraGranted = await requestCameraPermission()
  if (!cameraGranted) allGranted = false

  const storageGranted = await requestStoragePermission()
  if (!storageGranted) allGranted = false

  // Request notification permission
  await requestNotificationPermission()

  return allGranted
}
