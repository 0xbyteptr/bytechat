import pkg from '../../package.json'

export async function checkForUpdates(): Promise<{
  available: boolean
  url: string
  isNewer: boolean
  latestVersion: string
}> {
  try {
    const res = await fetch('https://api.github.com/repos/byteptr/bytechat/releases/latest')
    if (res.ok) {
      const data = await res.json()
      const latestVersion = data.tag_name.replace('v', '')
      const currentVersion = pkg.version
      
      const isNewer = compareVersions(latestVersion, currentVersion) > 0
      const apkAsset = data.assets.find((a: any) => a.name.endsWith('.apk'))
      
      return {
        available: isNewer && !!apkAsset,
        url: apkAsset?.browser_download_url || '',
        isNewer,
        latestVersion
      }
    }
  } catch (e) {
    console.error('Failed to check for updates', e)
  }
  
  return {
    available: false,
    url: '',
    isNewer: false,
    latestVersion: pkg.version
  }
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0
    const bPart = bParts[i] || 0
    
    if (aPart > bPart) return 1
    if (aPart < bPart) return -1
  }
  
  return 0
}

export async function downloadAndInstallUpdate(url: string): Promise<boolean> {
  if (!url) return false
  
  try {
    // Open download link
    window.open(url, '_blank')
    return true
  } catch (e) {
    console.error('Failed to download update', e)
    return false
  }
}
