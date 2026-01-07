/**
 * Session management service
 */

export interface SessionServiceContext {
  API_URL: string
  sessionToken: string
}

export interface SessionValidation {
  id: string
  valid: boolean
  token?: string
}

export function createSessionService(context: SessionServiceContext) {
  let validationFailures = 0
  let lastValidationAttempt = 0
  let sessionActive = true
  const VALIDATION_COOLDOWN = 30000 // 30 seconds

  async function validateSession(userId: string): Promise<boolean> {
    // Rate limiting
    const now = Date.now()
    if (now - lastValidationAttempt < VALIDATION_COOLDOWN && validationFailures < 3) {
      return sessionActive
    }

    lastValidationAttempt = now

    try {
      const res = await fetch(`${context.API_URL}/validate-session?id=${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${context.sessionToken}`
        }
      })

      if (res.ok) {
        validationFailures = 0
        sessionActive = true
        return true
      } else {
        validationFailures++
        if (validationFailures >= 3) {
          sessionActive = false
        }
        return false
      }
    } catch (e) {
      console.error('Session validation failed:', e)
      validationFailures++
      if (validationFailures >= 3) {
        sessionActive = false
      }
      return false
    }
  }

  function resetValidationState() {
    validationFailures = 0
    lastValidationAttempt = 0
    sessionActive = true
  }

  function logout() {
    resetValidationState()
    sessionActive = false
    localStorage.removeItem('bytechat_session')
    localStorage.removeItem('bytechat_session_backup')
    sessionStorage.clear()
  }

  return {
    validateSession,
    resetValidationState,
    logout,
    get isValid() {
      return sessionActive
    },
    get failureCount() {
      return validationFailures
    }
  }
}

export type SessionService = ReturnType<typeof createSessionService>
