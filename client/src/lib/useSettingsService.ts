/**
 * Settings service - handles user profile and settings management
 */

export interface SettingsProfile {
  displayName: string
  bio: string
  avatarUrl: string
  bannerUrl: string
}

export interface SettingsServiceContext {
  id: string
  API_URL: string
  sessionToken: string
  uploadFile: (file: File) => Promise<string | null>
  loadProfile: (userId: string) => Promise<void>
}

export function createSettingsService(context: SettingsServiceContext) {
  let uploadingAvatar = false
  let uploadingBanner = false
  let error = ''

  function resetUploadStates() {
    uploadingAvatar = false
    uploadingBanner = false
  }

  async function handleAvatarUpload(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file'
      return null
    }

    if (file.size > 5 * 1024 * 1024) {
      error = 'Avatar must be less than 5MB'
      return null
    }

    uploadingAvatar = true
    error = ''

    try {
      const url = await context.uploadFile(file)
      if (!url) {
        error = 'Failed to upload avatar'
        return null
      }
      return url
    } finally {
      uploadingAvatar = false
    }
  }

  async function handleBannerUpload(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file'
      return null
    }

    if (file.size > 10 * 1024 * 1024) {
      error = 'Banner must be less than 10MB'
      return null
    }

    uploadingBanner = true
    error = ''

    try {
      const url = await context.uploadFile(file)
      if (!url) {
        error = 'Failed to upload banner'
        return null
      }
      return url
    } finally {
      uploadingBanner = false
    }
  }

  async function saveProfile(profile: SettingsProfile): Promise<boolean> {
    try {
      const res = await fetch(`${context.API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.sessionToken}`,
          'X-ByteChat-ID': context.id
        },
        body: JSON.stringify(profile)
      })

      if (res.ok) {
        return true
      } else {
        error = 'Failed to save profile'
        return false
      }
    } catch (e) {
      console.error('Failed to save profile:', e)
      error = 'Error saving profile'
      return false
    }
  }

  async function exportKeys(keypair: { publicKey: string; secretKey: string } | null): Promise<boolean> {
    if (!keypair) {
      error = 'No keys found to export'
      return false
    }

    const content = `ByteChat Nacl Keys for ${context.id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
    const filename = `bytechat_${context.id}_keys.txt`

    // Web download implementation (others can be added for other platforms)
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    return true
  }

  return {
    handleAvatarUpload,
    handleBannerUpload,
    saveProfile,
    exportKeys,
    resetUploadStates,
    get uploadingAvatar() {
      return uploadingAvatar
    },
    get uploadingBanner() {
      return uploadingBanner
    },
    get error() {
      return error
    },
    setError(msg: string) {
      error = msg
    },
    clearError() {
      error = ''
    }
  }
}

export type SettingsService = ReturnType<typeof createSettingsService>
