import nacl from 'tweetnacl'
import * as util from 'tweetnacl-util'

const cleanBase64 = (s: string) => {
  if (typeof s !== 'string') return ''
  // Remove all whitespace and handle URL-safe base64
  return s.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
}

// Robust base64 decoder that doesn't throw "invalid encoding" like tweetnacl-util
function robustDecodeBase64(s: string): Uint8Array {
  if (!s || typeof s !== 'string') return new Uint8Array(0)
  const cleaned = cleanBase64(s)
  if (!cleaned) return new Uint8Array(0)
  try {
    // Use atob if available (browser/webview)
    if (typeof atob !== 'undefined') {
      const binary = atob(cleaned)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return bytes
    }
  } catch (e) {
    // Fallback to tweetnacl-util if atob fails or is missing
  }
  try {
    return util.decodeBase64(cleaned)
  } catch (e) {
    return new Uint8Array(0)
  }
}

export function generateKeyPair() {
  const kp = nacl.box.keyPair()
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    secretKey: util.encodeBase64(kp.secretKey)
  }
}

export function encrypt(senderSecretBase64: string, recipientPublicBase64: string, message: string) {
  const senderSk = robustDecodeBase64(senderSecretBase64)
  const recipPk = robustDecodeBase64(recipientPublicBase64)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const msgUint8 = util.decodeUTF8(message)
  const cipher = nacl.box(msgUint8, nonce, recipPk, senderSk)
  return { cipher: util.encodeBase64(cipher), nonce: util.encodeBase64(nonce) }
}

export function decrypt(recipientSecretBase64: string, senderPublicBase64: string, cipherBase64: string, nonceBase64: string) {
  const recipSk = robustDecodeBase64(recipientSecretBase64)
  const senderPk = robustDecodeBase64(senderPublicBase64)
  const cipher = robustDecodeBase64(cipherBase64)
  const nonce = robustDecodeBase64(nonceBase64)
  
  if (recipSk.length !== 32 || senderPk.length !== 32) return null

  const msg = nacl.box.open(cipher, nonce, senderPk, recipSk)
  if (!msg) return null
  try {
    return new TextDecoder().decode(msg)
  } catch (e) {
    return util.encodeUTF8(msg)
  }
}
