import nacl from 'tweetnacl'
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util'

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data

  try {
    switch (type) {
      case 'decrypt': {
        const { secretKey, publicKey, cipher, nonce } = data
        
        // Validate all parameters are strings
        if (typeof secretKey !== 'string' || typeof publicKey !== 'string' || 
            typeof cipher !== 'string' || typeof nonce !== 'string') {
          self.postMessage({ 
            type: 'error', 
            id, 
            error: `expected string, got: sk=${typeof secretKey}, pk=${typeof publicKey}, cipher=${typeof cipher}, nonce=${typeof nonce}` 
          })
          return
        }
        
        const sk = decodeBase64(secretKey)
        const pk = decodeBase64(publicKey)
        const cipherBytes = decodeBase64(cipher)
        const nonceBytes = decodeBase64(nonce)
        
        const decrypted: any = nacl.box.open(cipherBytes, nonceBytes, pk, sk)
        if (!decrypted) {
          self.postMessage({ type: 'error', id, error: 'Decryption failed' })
          return
        }
        
        const text = decodeUTF8(decrypted as any)
        self.postMessage({ type: 'success', id, result: text })
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
        
        const sk = decodeBase64(secretKey)
        const pk = decodeBase64(publicKey)
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
        
        const sk = decodeBase64(secretKey)
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
