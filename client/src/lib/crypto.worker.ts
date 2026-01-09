import nacl from 'tweetnacl'
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util'

// Robust base64 decoder mirroring crypto.ts to avoid strict decode failures
const cleanBase64 = (s: string) => {
  if (typeof s !== 'string') return ''
  return s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
}

function robustDecodeBase64(s: string): Uint8Array {
  if (!s || typeof s !== 'string') return new Uint8Array(0)
  let cleaned = cleanBase64(s)
  if (!cleaned) return new Uint8Array(0)

  while (cleaned.length % 4 !== 0) cleaned += '='

  try {
    if (typeof atob !== 'undefined') {
      const binary = atob(cleaned)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    }
  } catch (e) {
    // fall back below
  }

  try {
    return decodeBase64(cleaned)
  } catch (e) {
    return new Uint8Array(0)
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data

  try {
    switch (type) {
      case 'decrypt': {
        const { secretKey, publicKey, cipher, nonce } = data
        
        // Validate all parameters are strings
        if (typeof secretKey !== 'string' || typeof publicKey !== 'string' || 
            typeof cipher !== 'string' || typeof nonce !== 'string') {
          const error = `Invalid decrypt params: sk=${typeof secretKey}, pk=${typeof publicKey}, cipher=${typeof cipher}, nonce=${typeof nonce}`
          console.error('[Worker] ' + error)
          self.postMessage({ 
            type: 'error', 
            id, 
            error
          })
          return
        }
        
        try {
          const sk = robustDecodeBase64(secretKey)
          const pk = robustDecodeBase64(publicKey)
          const cipherBytes = robustDecodeBase64(cipher)
          const nonceBytes = robustDecodeBase64(nonce)
          
          if (!sk.length || !pk.length || !cipherBytes.length || !nonceBytes.length) {
            throw new Error('Decoded values are empty')
          }
          
          const decrypted: any = nacl.box.open(cipherBytes, nonceBytes, pk, sk)
          if (!decrypted) {
            self.postMessage({ type: 'error', id, error: 'Decryption failed: nacl.box.open returned null' })
            return
          }
          
          const text = decodeUTF8(decrypted as any)
          self.postMessage({ type: 'success', id, result: text })
        } catch (decryptError: any) {
          self.postMessage({ type: 'error', id, error: `Decryption error: ${decryptError.message}` })
        }
        break
      }
      
      case 'encrypt': {
        const { secretKey, publicKey, text } = data
        
        // Validate parameters
        if (typeof secretKey !== 'string' || typeof publicKey !== 'string' || typeof text !== 'string') {
          self.postMessage({ 
            type: 'error', 
            id, 
            error: `unexpected type, use Uint8Array or string. Got: sk=${typeof secretKey}, pk=${typeof publicKey}, text=${typeof text}` 
          })
          return
        }
        
        const sk = robustDecodeBase64(secretKey)
        const pk = robustDecodeBase64(publicKey)
        const nonce = nacl.randomBytes(24)
        const messageBytes = encodeUTF8(text as any as any)
        
        const encrypted = nacl.box(messageBytes as any, nonce, pk, sk)
        
        self.postMessage({ 
          type: 'success', 
          id, 
          result: {
            cipher: encodeBase64(encrypted),
            nonce: encodeBase64(nonce)
          }
        })
        break
      }
      
      case 'batchEncrypt': {
        const { secretKey, recipients, text } = data
        
        // Validate parameters
        if (typeof secretKey !== 'string' || typeof text !== 'string') {
          self.postMessage({ 
            type: 'error', 
            id, 
            error: `unexpected type, use Uint8Array or string. Got: sk=${typeof secretKey}, text=${typeof text}` 
          })
          return
        }
        
        const sk = robustDecodeBase64(secretKey)
        const results: Record<string, { cipher: string, nonce: string }> = {}
        
        for (const [memberId, publicKey] of Object.entries(recipients)) {
          const pk = decodeBase64(publicKey as string)
          const nonce = nacl.randomBytes(24)
          const messageBytes = encodeUTF8(text as any as any)
          const encrypted = nacl.box(messageBytes as any, nonce, pk, sk)
          
          results[memberId] = {
            cipher: encodeBase64(encrypted),
            nonce: encodeBase64(nonce)
          }
        }
        
        self.postMessage({ type: 'success', id, result: results })
        break
      }
      
      default:
        self.postMessage({ type: 'error', id, error: 'Unknown operation' })
    }
  } catch (error: any) {
    self.postMessage({ type: 'error', id, error: error.message })
  }
}
