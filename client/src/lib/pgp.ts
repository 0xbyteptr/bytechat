import * as openpgp from 'openpgp'

export async function generatePGPKey(name: string, email: string) {
  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: 'rsa',
    rsaBits: 2048,
    userIDs: [{ name, email }],
  })
  return { privateKey, publicKey, revocationCertificate }
}

export async function getPublicKeyFromPrivate(privateKeyArmored: string) {
  const privKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  return await privKey.toPublic().armor()
}

export async function signMessage(privateKeyArmored: string, message: string, passphrase?: string) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })
  const unlockedPrivateKey = passphrase 
    ? await openpgp.decryptKey({ privateKey, passphrase })
    : privateKey
    
  const signedMessage = await openpgp.sign({
    message: await openpgp.createMessage({ text: message }),
    signingKeys: unlockedPrivateKey,
    detached: true
  })
  return signedMessage // This is the armored signature
}

export async function verifySignature(publicKeyArmored: string, signatureArmored: string, message: string) {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })
  const signature = await openpgp.readSignature({ armoredSignature: signatureArmored })
  const verificationResult = await openpgp.verify({
    message: await openpgp.createMessage({ text: message }),
    signature,
    verificationKeys: publicKey
  })
  const { verified } = verificationResult.signatures[0]
  try {
    await verified
    return true
  } catch (e) {
    return false
  }
}

export async function getPublicKeyInfo(publicKeyArmored: string) {
  const key = await openpgp.readKey({ armoredKey: publicKeyArmored })
  return {
    id: key.getFingerprint(),
    userIDs: key.getUserIDs()
  }
}

export async function encryptPGP(publicKeyArmored: string, text: string) {
  const publicKey = await openpgp.readKey({ armoredKey: publicKeyArmored })
  const message = await openpgp.createMessage({ text })
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey
  })
  return encrypted // Armored string
}

export async function decryptPGP(privateKeyArmored: string, encryptedArmored: string, passphrase?: string) {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored.trim() })
  const unlockedPrivateKey = passphrase 
    ? await openpgp.decryptKey({ privateKey, passphrase })
    : privateKey
    
  const message = await openpgp.readMessage({ armoredMessage: encryptedArmored.trim() })
  const { data: decrypted } = await openpgp.decrypt({
    message,
    decryptionKeys: unlockedPrivateKey
  })
  
  if (typeof decrypted === 'string') {
    return decrypted
  }
  
  const decoder = new TextDecoder()
  if (decrypted instanceof Uint8Array) {
    return decoder.decode(decrypted)
  }
  
  // If it's a stream (WebStream), we need to read it
  const reader = (decrypted as any).getReader()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value, { stream: true })
  }
  result += decoder.decode() // flush
  return result
}
