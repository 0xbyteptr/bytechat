import nacl from 'tweetnacl'
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util'

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data

  try {
    switch (type) {
      case 'decrypt': {
        const { secretKey, publicKey, cipher, nonce } = data
        const sk = decodeBase64(secretKey)
        const pk = decodeBase64(publicKey)
        const cipherBytes = decodeBase64(cipher)
        const nonceBytes = decodeBase64(nonce)
        
        const decrypted: any = nacl.box.open(cipherBytes, nonceBytes, pk, sk)
        if (!decrypted) {
          self.postMessage({ type: 'error', id, error: 'Decryption failed' })
          return
        }
        
        const text = decodeUTF8(decrypted)
        self.postMessage({ type: 'success', id, result: text })
        break
      }
      
      case 'encrypt': {
        const { secretKey, publicKey, text } = data
        const sk = decodeBase64(secretKey)
        const pk = decodeBase64(publicKey)
        const nonce = nacl.randomBytes(24)
        const messageBytes: any = encodeUTF8(text)
        
        const encrypted = nacl.box(messageBytes, nonce, pk, sk)
        
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
        const sk = decodeBase64(secretKey)
        const results: Record<string, { cipher: string, nonce: string }> = {}
        
        for (const [memberId, publicKey] of Object.entries(recipients)) {
          const pk = decodeBase64(publicKey as string)
          const nonce = nacl.randomBytes(24)
          const messageBytes: any = encodeUTF8(text)
          const encrypted = nacl.box(messageBytes, nonce, pk, sk)
          
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
