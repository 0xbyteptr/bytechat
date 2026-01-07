import { writable } from 'svelte/store'

export interface BlockedUsersState {
  blockedUsers: Set<string>
}

export function useBlockedUsers() {
  const STORAGE_KEY = 'bytechat_blocked_users'
  
  const loadBlocked = (): Set<string> => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        return new Set(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load blocked users:', e)
    }
    return new Set()
  }

  const state = writable<BlockedUsersState>({
    blockedUsers: loadBlocked()
  })

  function blockUser(userId: string) {
    state.update(s => {
      const newBlocked = new Set(s.blockedUsers)
      newBlocked.add(userId)
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...newBlocked]))
      } catch (e) {
        console.error('Failed to save blocked users:', e)
      }
      
      return { blockedUsers: newBlocked }
    })
  }

  function unblockUser(userId: string) {
    state.update(s => {
      const newBlocked = new Set(s.blockedUsers)
      newBlocked.delete(userId)
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...newBlocked]))
      } catch (e) {
        console.error('Failed to save blocked users:', e)
      }
      
      return { blockedUsers: newBlocked }
    })
  }

  function isBlocked(userId: string): boolean {
    let blocked = false
    state.subscribe(s => {
      blocked = s.blockedUsers.has(userId)
    })()
    return blocked
  }

  function getBlockedList(): string[] {
    let list: string[] = []
    state.subscribe(s => {
      list = [...s.blockedUsers]
    })()
    return list
  }

  return {
    state,
    blockUser,
    unblockUser,
    isBlocked,
    getBlockedList
  }
}
