/**
 * User status service - handles custom status updates and syncing
 */

export interface StatusUpdatePayload {
  status: 'online' | 'away' | 'busy' | 'offline'
  customMessage?: string
}

export interface StatusServiceContext {
  API_URL: string
  sessionToken: string
  userId: string
}

export function createStatusService(context: StatusServiceContext) {
  async function updateStatus(status: 'online' | 'away' | 'busy' | 'offline', customMessage: string = ''): Promise<any> {
    try {
      const res = await fetch(`${context.API_URL}/profile/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${context.sessionToken}`,
          'X-ByteChat-ID': context.userId
        },
        body: JSON.stringify({
          status,
          customMessage: customMessage || ''
        })
      })

      if (!res.ok) {
        console.error('Failed to update status:', res.status)
        return null
      }

      const data = await res.json()
      console.log('Status updated successfully:', data)
      return data
    } catch (e) {
      console.error('Error updating status:', e)
      return null
    }
  }

  return {
    updateStatus
  }
}

export type StatusService = ReturnType<typeof createStatusService>
