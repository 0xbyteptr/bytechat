/**
 * Contact and key management service
 */
import * as ContactsLib from './useContacts'

export interface ContactContext {
  API_URL: string
  id: string
}

export function createContactService(context: ContactContext) {
  let keyCache: Record<string, string> = {}
  let keyFetching = new Set<string>()
  let failedKeys = new Set<string>()

  async function fetchContactKey(name: string): Promise<string | null> {
    // Return cached key
    if (keyCache[name]) return keyCache[name]

    // Skip if already fetching or failed
    if (keyFetching.has(name) || failedKeys.has(name)) return null

    keyFetching.add(name)
    try {
      const res = await fetch(`${context.API_URL}/keys?id=${encodeURIComponent(name)}`)
      if (res.ok) {
        const data = await res.json()
        keyCache[name] = data.publicKey
        // Sync to ContactsLib.keys store
        ContactsLib.keys.update(k => ({ ...k, [name]: data.publicKey }))
        return data.publicKey
      } else {
        failedKeys.add(name)
        return null
      }
    } catch (e) {
      console.error(`Failed to fetch key for ${name}:`, e)
      failedKeys.add(name)
      return null
    } finally {
      keyFetching.delete(name)
    }
  }

  async function addContact(targetId: string, name?: string): Promise<boolean> {
    if (targetId === context.id) {
      throw new Error("You can't add yourself.")
    }

    try {
      const res = await fetch(`${context.API_URL}/keys?id=${encodeURIComponent(targetId)}`)
      if (res.ok) {
        const data = await res.json()
        keyCache[targetId] = data.publicKey
        // Sync to ContactsLib.keys store
        ContactsLib.keys.update(k => ({ ...k, [targetId]: data.publicKey }))
        return true
      } else {
        throw new Error(`User "${targetId}" not found on server.`)
      }
    } catch (e) {
      console.error('Error adding contact:', e)
      throw e
    }
  }

  function getCachedKey(userId: string): string | null {
    return keyCache[userId] || null
  }

  function clearKeyCache(userId: string) {
    delete keyCache[userId]
    failedKeys.delete(userId)
  }

  function getAllKeys(): Record<string, string> {
    return { ...keyCache }
  }

  return {
    fetchContactKey,
    addContact,
    getCachedKey,
    clearKeyCache,
    getAllKeys
  }
}

export type ContactService = ReturnType<typeof createContactService>
