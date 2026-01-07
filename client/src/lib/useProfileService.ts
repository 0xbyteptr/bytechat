/**
 * Profile management service
 */

export interface ProfileCache {
  [userId: string]: any
}

export interface ProfileServiceContext {
  API_URL: string
  id: string
  sessionToken: string
}

const PROFILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function createProfileService(context: ProfileServiceContext) {
  let profiles: ProfileCache = {}
  let profileTimestamps: Record<string, number> = {}
  let profilesLoading = new Set<string>()

  async function loadProfile(userId: string): Promise<any | null> {
    // Check cache first
    const now = Date.now()
    const timestamp = profileTimestamps[userId]
    if (profiles[userId] && timestamp && now - timestamp < PROFILE_CACHE_TTL) {
      return profiles[userId]
    }

    // Skip if already loading
    if (profilesLoading.has(userId)) {
      return profiles[userId] || null
    }

    profilesLoading.add(userId)
    try {
      const res = await fetch(`${context.API_URL}/profile?id=${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${context.sessionToken}`,
          'X-ByteChat-ID': context.id
        }
      })

      if (res.ok) {
        const profile = await res.json()
        profiles[userId] = profile
        profileTimestamps[userId] = Date.now()
        return profile
      } else {
        console.warn(`Failed to load profile for ${userId}`)
        return null
      }
    } catch (e) {
      console.error(`Error loading profile for ${userId}:`, e)
      return null
    } finally {
      profilesLoading.delete(userId)
    }
  }

  async function saveProfile(profile: any): Promise<boolean> {
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
        // Update cache
        profiles[context.id] = profile
        profileTimestamps[context.id] = Date.now()
        return true
      } else {
        console.error('Failed to save profile')
        return false
      }
    } catch (e) {
      console.error('Error saving profile:', e)
      return false
    }
  }

  function getCached(userId: string): any | null {
    return profiles[userId] || null
  }

  function invalidateCache(userId: string) {
    delete profiles[userId]
    delete profileTimestamps[userId]
  }

  function getAllProfiles(): ProfileCache {
    return { ...profiles }
  }

  function isCacheValid(userId: string): boolean {
    const timestamp = profileTimestamps[userId]
    if (!timestamp) return false
    return Date.now() - timestamp < PROFILE_CACHE_TTL
  }

  return {
    loadProfile,
    saveProfile,
    getCached,
    invalidateCache,
    getAllProfiles,
    isCacheValid,
    get isLoading() {
      return profilesLoading.size > 0
    }
  }
}

export type ProfileService = ReturnType<typeof createProfileService>
