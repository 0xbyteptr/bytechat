import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'

let audioCtx: AudioContext | null = null

export function playPing() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    
    if (!audioCtx) {
      audioCtx = new AudioContextClass()
    }
    
    if (audioCtx.state === 'suspended') audioCtx.resume()
    
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    
    oscillator.frequency.value = 800
    gainNode.gain.value = 0.1
    
    oscillator.start()
    oscillator.stop(audioCtx.currentTime + 0.2)
  } catch (e) {
    console.warn('Failed to play ping sound', e)
  }
}

export async function notify(
  title: string,
  body: string,
  isAppVisible: boolean,
  currentContact: string | null
) {
  if (isAppVisible && currentContact === title) return // Don't notify if looking at the chat

  playPing()

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 10000),
          schedule: { at: new Date(Date.now() + 100) },
          attachments: undefined,
          actionTypeId: '',
          extra: null
        }
      ]
    })
  } else if ('Notification' in window && Notification.permission === 'granted') {
    // Use Service Worker notification if available (better for PWA/Mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'bytechat-msg',
          renotify: true
        } as any)
      })
    } else {
      new Notification(title, { body })
    }
  }
}

export async function setupNotifications(id: string, sessionToken: string, apiUrl: string) {
  if (!id || !sessionToken) return
  
  if (!Capacitor.isNativePlatform()) {
    // For web, just register service worker if available
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (e) {
        console.warn('Failed to register service worker', e)
      }
    }
    return
  }

  // For native platform, setup push notifications
  try {
    await registerPush(id, sessionToken, apiUrl)
  } catch (e) {
    console.warn('Failed to setup push notifications', e)
  }
}

async function registerPush(id: string, sessionToken: string, apiUrl: string) {
  if (!Capacitor.isNativePlatform()) return

  try {
    let perm = await PushNotifications.checkPermissions()

    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions()
    }

    if (perm.receive !== 'granted') {
      return
    }

    // Add listener BEFORE registering to avoid race conditions
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value)
      await fetch(`${apiUrl}/push-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token: token.value, sessionToken })
      })
    })

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error))
    })

    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push notification received: ', notification)
      await LocalNotifications.schedule({
        notifications: [
          {
            title: notification.title || 'ByteChat',
            body: notification.body || 'New message',
            id: Math.floor(Math.random() * 10000),
            schedule: { at: new Date(Date.now() + 100) },
            attachments: undefined,
            actionTypeId: '',
            extra: null
          }
        ]
      })
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification.actionId, notification.inputValue)
    })

    await PushNotifications.register()
  } catch (e) {
    console.error('Failed to register push notifications', e)
  }
}

export async function requestNotificationPermissionNative(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    return Notification.permission
  }

  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display !== 'granted') {
      const res = await LocalNotifications.requestPermissions()
      return res.display
    }
    return status.display
  } catch (e) {
    console.error('Failed to request notification permission', e)
    return 'denied'
  }
}
