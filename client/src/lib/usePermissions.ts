import { writable } from 'svelte/store'

export interface Permissions {
  microphone: boolean
  notifications: boolean
}

export const permissions = writable<Permissions>({
  microphone: false,
  notifications: false
})

export async function checkPermissions(): Promise<Permissions> {
  const perms: Permissions = {
    microphone: false,
    notifications: false
  }

  // Check microphone permission
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    perms.microphone = result.state === 'granted'
  } catch (err) {
    // Permission API might not be available
    perms.microphone = false
  }

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

  // Request microphone permission
  const micGranted = await requestMicrophonePermission()
  if (!micGranted) allGranted = false

  // Request notification permission
  await requestNotificationPermission()

  return allGranted
}
