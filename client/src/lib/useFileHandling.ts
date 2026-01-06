import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'

export async function exportKeys(
  id: string,
  keypair: {publicKey: string, secretKey: string} | null
): Promise<boolean> {
  if (!keypair) {
    alert('No keys found to export')
    return false
  }
  
  const content = `ByteChat Nacl Keys for ${id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
  const filename = `bytechat_${id}_keys.txt`
  
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })
      
      await FileOpener.open({
        filePath: result.uri,
        contentType: 'text/plain'
      })
      
      return true
    } catch (e) {
      console.error('Failed to export keys on native', e)
      alert('Failed to export keys')
      return false
    }
  } else {
    // Web download
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return true
  }
}

export async function handleFileUpload(file: File, maxSize: number): Promise<{
  fileName: string
  fileType: string
  fileData: string
} | null> {
  if (file.size > maxSize) {
    alert(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`)
    return null
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve({
        fileName: file.name,
        fileType: file.type,
        fileData: base64
      })
    }
    reader.onerror = () => {
      alert('Failed to read file')
      resolve(null)
    }
    reader.readAsDataURL(file)
  })
}

export async function downloadFile(fileName: string, fileType: string, fileData: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await Filesystem.writeFile({
        path: fileName,
        data: fileData,
        directory: Directory.Documents
      })
      
      await FileOpener.open({
        filePath: result.uri,
        contentType: fileType
      })
    } catch (e) {
      console.error('Failed to download file on native', e)
      alert('Failed to open file')
    }
  } else {
    // Web download
    const byteCharacters = atob(fileData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: fileType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
}
