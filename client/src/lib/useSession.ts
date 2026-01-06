import { writable } from 'svelte/store'

export const id = writable<string>('')
export const sessionToken = writable<string>('')
export const keypair = writable<{publicKey: string, secretKey: string} | null>(null)
export const isLoggedIn = writable<boolean>(false)

export interface SessionData {
  id: string
  token: string
  keypair: {publicKey: string, secretKey: string}
  publicKey: string
}

export function handleAuthSuccess(data: SessionData) {
  id.set(data.id)
  sessionToken.set(data.token)
  keypair.set(data.keypair)
  isLoggedIn.set(true)
  
  saveToLocalStorage(data)
}

export function logout() {
  id.set('')
  sessionToken.set('')
  keypair.set(null)
  isLoggedIn.set(false)
  
  localStorage.removeItem('bytechat_session')
  
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
}

export async function validateSession(apiUrl: string, currentId: string, currentToken: string): Promise<boolean> {
  if (!currentId || !currentToken) return false
  
  try {
    const res = await fetch(`${apiUrl}/validate-session?id=${encodeURIComponent(currentId)}&token=${encodeURIComponent(currentToken)}`)
    if (!res.ok) {
      console.warn('Session invalid, logging out')
      logout()
      return false
    }
    return true
  } catch (e) {
    console.error('Failed to validate session', e)
    return false
  }
}

export function loadFromLocalStorage(): SessionData | null {
  const saved = localStorage.getItem('bytechat_session')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      if (s.id && s.sessionToken && s.keypair) {
        id.set(s.id)
        sessionToken.set(s.sessionToken)
        keypair.set(s.keypair)
        isLoggedIn.set(true)
        return {
          id: s.id,
          token: s.sessionToken,
          keypair: s.keypair,
          publicKey: s.keypair.publicKey
        }
      }
    } catch (e) {
      console.error('Failed to restore session', e)
    }
  }
  return null
}

function saveToLocalStorage(data: SessionData) {
  const toSave = {
    id: data.id,
    sessionToken: data.token,
    keypair: data.keypair
  }
  
  localStorage.setItem('bytechat_session', JSON.stringify(toSave))
}

export function updateLocalStorage(additionalData: any) {
  const saved = localStorage.getItem('bytechat_session')
  if (saved) {
    try {
      const s = JSON.parse(saved)
      localStorage.setItem('bytechat_session', JSON.stringify({ ...s, ...additionalData }))
    } catch (e) {
      console.error('Failed to update localStorage', e)
    }
  }
}
