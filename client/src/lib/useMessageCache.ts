import type { Message } from './useMessages'

const DB_NAME = 'bytechat'
const STORE_NAME = 'messages'
const CACHE_VERSION = 1

let db: IDBDatabase | null = null

// Initialize IndexedDB
export async function initializeCache(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CACHE_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve()
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: ['contactId', 'messageId'] })
        store.createIndex('contactId', 'contactId', { unique: false })
        store.createIndex('timestamp', 'ts', { unique: false })
      }
    }
  })
}

// Cache a message
export async function cacheMessage(contactId: string, message: Message | undefined): Promise<void> {
  if (!message) return // Silently skip if message is undefined
  if (!db) {
    try {
      await initializeCache()
    } catch (e) {
      console.warn('Failed to initialize cache:', e)
      return // Gracefully fail if cache init fails
    }
  }
  return new Promise((resolve, reject) => {
    try {
      const transaction = db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const data = { contactId, ...message }
      const request = store.put(data)
      request.onerror = () => {
        const error = request.error as any
        if (error?.name === 'QuotaExceededError') {
          console.warn('IndexedDB quota exceeded, clearing old cache')
          clearAllCache().then(() => resolve()).catch(() => resolve())
        } else {
          reject(error)
        }
      }
      request.onsuccess = () => resolve()
    } catch (e) {
      console.warn('Failed to cache message:', e)
      reject(e)
    }
  })
}

// Cache multiple messages
export async function cacheMessages(contactId: string, messages: Message[]): Promise<void> {
  if (!messages || messages.length === 0) return
  if (!db) {
    try {
      await initializeCache()
    } catch (e) {
      console.warn('Failed to initialize cache:', e)
      return
    }
  }
  return new Promise((resolve, reject) => {
    try {
      const transaction = db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      for (const message of messages) {
        if (message) {
          const data = { contactId, ...message }
          store.put(data)
        }
      }
      
      transaction.onerror = () => {
        const error = transaction.error as any
        if (error?.name === 'QuotaExceededError') {
          console.warn('IndexedDB quota exceeded, clearing old cache')
          clearAllCache().then(() => resolve()).catch(() => resolve())
        } else {
          reject(error)
        }
      }
      transaction.oncomplete = () => resolve()
    } catch (e) {
      console.warn('Failed to cache messages:', e)
      reject(e)
    }
  })
}

// Load cached messages for a contact
export async function loadCachedMessages(contactId: string): Promise<Message[]> {
  if (!db) await initializeCache()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('contactId')
    const request = index.getAll(contactId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const results = request.result
      // Remove contactId from each message before returning
      const messages = results.map(({ contactId, ...msg }) => msg as Message)
      // Sort by timestamp
      resolve(messages.sort((a, b) => (a.ts || 0) - (b.ts || 0)))
    }
  })
}

// Clear cache for a contact
export async function clearContactCache(contactId: string): Promise<void> {
  if (!db) await initializeCache()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('contactId')
    const request = index.openCursor(IDBKeyRange.only(contactId))

    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
  })
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  if (!db) await initializeCache()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

// Get cache stats
export async function getCacheStats(): Promise<{ contactId: string; count: number }[]> {
  if (!db) await initializeCache()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const results = request.result
      const stats = new Map<string, number>()
      for (const item of results) {
        const count = (stats.get(item.contactId) || 0) + 1
        stats.set(item.contactId, count)
      }
      resolve(Array.from(stats.entries()).map(([contactId, count]) => ({ contactId, count })))
    }
  })
}
