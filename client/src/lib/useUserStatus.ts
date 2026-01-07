import { writable } from 'svelte/store'

export type UserStatus = 'online' | 'away' | 'busy' | 'offline'

export interface UserStatusState {
  status: UserStatus
  customMessage: string
}

export function useUserStatus() {
  const STORAGE_KEY = 'bytechat_user_status'
  
  const loadStatus = (): UserStatusState => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load user status:', e)
    }
    return { status: 'online', customMessage: '' }
  }

  const state = writable<UserStatusState>(loadStatus())

  function setStatus(status: UserStatus, customMessage: string = '') {
    const newState = { status, customMessage }
    state.set(newState)
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    } catch (e) {
      console.error('Failed to save user status:', e)
    }
  }

  function clearCustomMessage() {
    state.update(s => {
      const newState = { ...s, customMessage: '' }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
      } catch (e) {
        console.error('Failed to save user status:', e)
      }
      return newState
    })
  }

  return {
    state,
    setStatus,
    clearCustomMessage
  }
}

export function getStatusColor(status: UserStatus): string {
  switch (status) {
    case 'online': return '#22c55e'
    case 'away': return '#f59e0b'
    case 'busy': return '#ef4444'
    case 'offline': return '#6b7280'
    default: return '#6b7280'
  }
}

export function getStatusIcon(status: UserStatus): string {
  switch (status) {
    case 'online': return '●'
    case 'away': return '◐'
    case 'busy': return '⊘'
    case 'offline': return '○'
    default: return '○'
  }
}
