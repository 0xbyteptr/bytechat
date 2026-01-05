import nacl from 'tweetnacl'
import * as util from 'tweetnacl-util'


export function generateKeyPair() {
  const kp = nacl.box.keyPair()
  return {
    publicKey: util.encodeBase64(kp.publicKey),
    secretKey: util.encodeBase64(kp.secretKey)
  }
}

export function encrypt(senderSecretBase64: string, recipientPublicBase64: string, message: string) {
  const senderSk = util.decodeBase64(senderSecretBase64)
  const recipPk = util.decodeBase64(recipientPublicBase64)
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const msgUint8 = util.decodeUTF8(message)
  const cipher = nacl.box(msgUint8, nonce, recipPk, senderSk)
  return { cipher: util.encodeBase64(cipher), nonce: util.encodeBase64(nonce) }
}

export function decrypt(recipientSecretBase64: string, senderPublicBase64: string, cipherBase64: string, nonceBase64: string) {
  const recipSk = util.decodeBase64(recipientSecretBase64)
  const senderPk = util.decodeBase64(senderPublicBase64)
  const cipher = util.decodeBase64(cipherBase64)
  const nonce = util.decodeBase64(nonceBase64)
  const msg = nacl.box.open(cipher, nonce, senderPk, recipSk)
  if (!msg) return null
  return util.encodeUTF8(msg)
}
