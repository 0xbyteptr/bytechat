<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { cryptoPool } from './lib/cryptoPool'
  import Sidebar from './components/Sidebar.svelte'
  import ChatWindow from './components/ChatWindow.svelte'
  import GroupSettings from './components/GroupSettings.svelte'
  import UserProfile from './components/UserProfile.svelte'
  import Auth from './components/Auth.svelte'
  import LoadingScreen from './components/LoadingScreen.svelte'
  import PermissionsDialog from './components/PermissionsDialog.svelte'
  import Developers from './components/Developers.svelte'
  import pkg from '../package.json'
  
  // Composables
  import * as PermissionsLib from './lib/usePermissions'
  import * as VoipLib from './lib/useVoip'
  import * as NotificationsLib from './lib/useNotifications'
  import * as SessionLib from './lib/useSession'
  import * as MessagesLib from './lib/useMessages'
  import * as ContactsLib from './lib/useContacts'
  import { updateContactsList } from './lib/useContacts'
  import * as UpdatesLib from './lib/useUpdates'
  import * as FileHandlingLib from './lib/useFileHandling'
  import * as MessageCacheLib from './lib/useMessageCache'
  import type { CallState } from './lib/webrtc'
  import { connectWS } from './lib/ws';
  import { decrypt, encrypt } from './lib/crypto';
  import { Capacitor } from '@capacitor/core';
  import { App } from '@capacitor/app';
  import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
  import { FileOpener } from '@capacitor-community/file-opener';

  // Service imports
  import { createMessagingService } from './lib/useMessaging'
  import { createCallService } from './lib/useCallService'
  import { createSettingsService } from './lib/useSettingsService'
  import { createContactService } from './lib/useContactService'
  import { createProfileService } from './lib/useProfileService'
  import { createSessionService } from './lib/useSessionService'
  import { createUIStateService } from './lib/useUIStateService'
  import { createGroupService } from './lib/useGroupService'
  import { createStatusService } from './lib/useStatusService'
  import { useUserStatus } from './lib/useUserStatus'

  const API_URL = import.meta.env.VITE_API_URL || 'https://api.byteptr.xyz'
  const version = pkg.version

  type Route =
    | { kind: 'home' }
    | { kind: 'developers' }
    | { kind: 'chat'; chatId: string }

  const getInitialPath = () => (typeof window !== 'undefined' ? window.location.pathname || '/' : '/')

  function parseRoute(path: string): Route {
    if (path.startsWith('/developers')) return { kind: 'developers' }
    if (path.startsWith('/chat/')) {
      const chatId = decodeURIComponent(path.slice('/chat/'.length))
      return chatId ? { kind: 'chat', chatId } : { kind: 'home' }
    }
    return { kind: 'home' }
  }

  let route: Route = parseRoute(getInitialPath())

  function navigateTo(path: string) {
    if (typeof window === 'undefined') return
    history.pushState({}, '', path)
    route = parseRoute(path)
  }

  // Session state
  let id = ''
  let sessionToken = ''
  let keypair: {publicKey:string, secretKey:string} | null = null
  let isLoggedIn = false
  
  // Routing state
  let isDevelopersPage = route.kind === 'developers'
  
  // Contact and message state
  let contact: string | null = null
  let keys: Record<string,string> = {}
  let groups: Array<{id:string, name:string, members:string[], admin:string}> = []
  let contacts: Array<{ id: string; name?: string; last: string; unread: number }> = []
  let messagesMap: Record<string, any[]> = {}
  let unreadMap: Record<string, number> = {}
  let typingMap: Record<string, boolean> = {}
  let pendingKeys = new Set<string>()
  let failedKeys = new Set<string>()
  let pinnedMap: Record<string, string[]> = {}
  let profiles: Record<string, any> = {}
  let profileLoading = false
  let profileError = ''
  let profilesLoading = new Set<string>() // Track which profiles are currently loading
  let profileTimestamps: Record<string, number> = {} // Track when profiles were last fetched
  const PROFILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes cache TTL
  const MAX_MESSAGES_PER_CHAT = 500
  const capMessages = (list: any[] = []) => list.length > MAX_MESSAGES_PER_CHAT ? list.slice(-MAX_MESSAGES_PER_CHAT) : list
  
  // WebSocket state
  let ws: { send: (d: string) => void, close: () => void, readyState: number } | null = null
  let wsStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticating' = 'disconnected'
  let onlineUsers = new Set<string>()
  
  // UI state
  let showSidebar = true
  let showSettings = false
  let settingsTab: 'general' | 'profile' | 'notifications' | 'security' = 'general'
  let settingsProfile = { displayName: '', bio: '', avatarUrl: '', bannerUrl: '' }
  let settingsProfileLoading = false
  let settingsProfileError = ''
  let settingsProfileDirty = false
  let settingsProfileSaved = false
  let uploadingAvatar = false
  let uploadingBanner = false
  let isAppVisible = true
  let isSending = false
  const NOTIF_PREF_KEY = 'bytechat_notif_prefs'
  let notificationPrefs: Record<string, 'all' | 'mentions' | 'mute'> = {}
  try {
    notificationPrefs = JSON.parse(localStorage.getItem(NOTIF_PREF_KEY) || '{}')
  } catch (e) {
    notificationPrefs = {}
  }
  let typingTimeout: any = null
  
  // Updates state
  let updateAvailable = false
  let updateUrl = ''
  let isUpdating = false
  let isNewerThanRelease = false
  let latestVersion = ''
  let notificationPermission = 'default'
  
  // Session validation state
  let sessionValidationFailures = 0
  let lastValidationAttempt = 0
  
  // Loading and permissions state
  let isLoading = true
  let loadingStatus = 'Initializing...'
  let loadingProgress = 0
  let showPermissionsDialog = false
  let permissions = {
    microphone: false,
    notifications: false,
    camera: false,
    storage: false
  }
  
  // Group settings state
  let showGroupSettings = false
  let selectedGroup: any = null
  
  // User profile state
  let showUserProfile = false
  let selectedUser: string | null = null
  let selectedUserOnline = false
  let selectedUserCommonGroups: any[] = []
  
  // VoIP state (from composable)
  let callState: CallState = 'idle'
  let callContact: string | null = null
  let isMuted = false
  let remoteAudioEl: HTMLAudioElement | null = null
  
  // Service instances (initialized when data is available)
  let messagingService: any = null
  let callService: any = null
  let settingsService: any = null
  let contactService: any = null
  let profileService: any = null
  let sessionService: any = null
  let uiStateService: any = null
  let groupService: any = null
  let statusService: any = null
  
  // Status management
  const { state: userStatusState } = useUserStatus()
  let currentUserStatus = 'online'
  let currentCustomMessage = ''
  
  $: if ($userStatusState) {
    currentUserStatus = $userStatusState.status
    currentCustomMessage = $userStatusState.customMessage
  }
  
  // Subscribe to stores
  VoipLib.callState.subscribe(value => callState = value)
  VoipLib.callContact.subscribe(value => callContact = value)
  VoipLib.isMuted.subscribe(value => isMuted = value)
  
  MessagesLib.messagesMap.subscribe(value => messagesMap = value)
  MessagesLib.unreadMap.subscribe(value => unreadMap = value)
  MessagesLib.typingMap.subscribe(value => typingMap = value)
  MessagesLib.pinnedMap.subscribe(value => pinnedMap = value)
  
  ContactsLib.keys.subscribe(value => keys = value)
  ContactsLib.groups.subscribe(value => groups = value)
  ContactsLib.contacts.subscribe(value => contacts = value)
  
  ContactsLib.onlineUsers.subscribe(value => onlineUsers = value)

  // Derive sidebar contact list from messages, unread counts, and group membership
  $: updateContactsList(messagesMap, unreadMap, groups)
  
  SessionLib.id.subscribe(value => id = value)
  SessionLib.sessionToken.subscribe(value => sessionToken = value)
  SessionLib.keypair.subscribe(value => keypair = value)
  SessionLib.isLoggedIn.subscribe(value => isLoggedIn = value)

  async function requestAllPermissions() {
    loadingStatus = 'Requesting microphone access...'
    loadingProgress = 30
    
    const micGranted = await PermissionsLib.requestMicrophonePermission()
    permissions.microphone = micGranted

    loadingStatus = 'Requesting storage access...'
    loadingProgress = 50
    
    const storageGranted = await PermissionsLib.requestStoragePermission()
    permissions.storage = storageGranted

    loadingStatus = 'Requesting notification permissions...'
    loadingProgress = 70
    
    const notifGranted = await PermissionsLib.requestNotificationPermission()
    permissions.notifications = notifGranted

    // Setup notifications if granted
    if (notifGranted && id && sessionToken) {
      await NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    }

    loadingProgress = 90
    showPermissionsDialog = false
    
    return micGranted
  }

  async function initializeApp() {
    loadingStatus = 'Loading application...'
    loadingProgress = 10

    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500))

    loadingStatus = 'Checking permissions...'
    loadingProgress = 20
    
    const perms = await PermissionsLib.checkPermissions()
    permissions = perms

    // Check if we need to show permissions dialog
    if (!perms.microphone || !perms.notifications) {
      loadingProgress = 30
      showPermissionsDialog = true
      return
    }

    // Continue initialization
    await continueInitialization()
  }

  async function continueInitialization() {
    loadingStatus = 'Preparing...'
    loadingProgress = 70

    if (permissions.notifications && id && sessionToken) {
      await NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    }

    await new Promise(resolve => setTimeout(resolve, 300))
    
    loadingStatus = 'Ready!'
    loadingProgress = 100

    // Small delay to show completion
    await new Promise(resolve => setTimeout(resolve, 400))
    
    isLoading = false
  }

  async function handlePermissionsRequest() {
    await requestAllPermissions()
    await continueInitialization()
  }

  async function handlePermissionsSkip() {
    showPermissionsDialog = false
    await continueInitialization()
  }

  async function requestNotificationPermission() {
    const perm = await NotificationsLib.requestNotificationPermissionNative()
    notificationPermission = perm
  }

  function applyProfileToSettingsForm(profile?: any) {
    const target = profile ?? profiles[id]
    settingsProfile = {
      displayName: target?.displayName || '',
      bio: target?.bio || '',
      avatarUrl: target?.avatarUrl || '',
      bannerUrl: target?.bannerUrl || ''
    }
  }

  function markSettingsProfileDirty() {
    settingsProfileDirty = true
    settingsProfileSaved = false
    settingsProfileError = ''
  }

  function invalidateProfileCache(userId: string) {
    delete profileTimestamps[userId]
  }

  function getCachedProfile(userId: string) {
    return profiles[userId]
  }

  async function openSettings() {
    settingsTab = 'general'
    settingsProfileDirty = false
    settingsProfileSaved = false
    settingsProfileError = ''
    showSettings = true

    if (!id) return

    if (profiles[id]) {
      applyProfileToSettingsForm()
      return
    }

    settingsProfileLoading = true
    try {
      await profileService?.loadProfile(id)
      if (!settingsProfileDirty) {
        applyProfileToSettingsForm()
      }
    } finally {
      settingsProfileLoading = false
    }
  }

  $: currentMessages = contact ? (messagesMap[contact] || []) : []
  $: if (currentMessages.length > 0) {
    console.log('[App] currentMessages updated:', { contact, count: currentMessages.length, latest: currentMessages[currentMessages.length - 1]?.text?.substring(0, 30) })
  }

  $: if (contact) {
    showSidebar = false
    // Load cached messages for this contact
    if (!messagesMap[contact] || messagesMap[contact].length === 0) {
      MessageCacheLib.loadCachedMessages(contact)
        .then(cachedMessages => {
          if (cachedMessages.length > 0 && !messagesMap[contact]) {
            messagesMap = { ...messagesMap, [contact!]: cachedMessages }
          }
        })
        .catch(err => console.warn('Failed to load cached messages:', err))
    }
    
    // Load contact profile if not already loaded or if cache expired
    if (contact && !contact.startsWith('#')) {
      const now = Date.now()
      const profile = profiles[contact]
      const timestamp = profileTimestamps[contact]
      
      // Load if no profile or cache expired
      if (profile === undefined || !timestamp || (now - timestamp >= PROFILE_CACHE_TTL)) {
        profileService?.loadProfile(contact)
      }
    }
    
    // Send read receipts for unread messages from this contact
    if (messagesMap[contact]) {
      messagesMap[contact].forEach(msg => {
        if (msg.from === contact && !msg.read && msg.messageId) {
          sendReadReceipt(contact, msg.messageId)
        }
      })
    }
  }

  $: if (contact && unreadMap[contact]) {
    unreadMap = { ...unreadMap, [contact]: 0 }
  }

  $: if (showSettings && profiles[id] && !settingsProfileDirty) {
    applyProfileToSettingsForm()
  }

  // Auto-load profiles for all contacts in sidebar
  $: if (contacts && contacts.length > 0) {
    contacts.forEach(contact => {
      if (!contact.id.startsWith('#')) {
        const now = Date.now()
        const profile = profiles[contact.id]
        const timestamp = profileTimestamps[contact.id]
        
        // Load if no profile or cache expired
        if (profile === undefined || !timestamp || (now - timestamp >= PROFILE_CACHE_TTL)) {
          profileService?.loadProfile(contact.id)
        }
      }
    })
  }

  function handleAuthSuccess(e: any) {
    const data = e.detail
    if (!data) return
    id = data.id
    sessionToken = data.token || ''
    keypair = data.keypair
    keys = { ...keys, [id]: data.publicKey }
    isLoggedIn = true
    showSidebar = true
    connect()
    NotificationsLib.setupNotifications(id, sessionToken, API_URL)
    profileService?.loadProfile(id)
    saveSession()
  }

  function connect() {
    if(!id || !sessionToken) return
    
    // Initialize services that don't need WebSocket first
    uiStateService = createUIStateService()
    contactService = createContactService({ API_URL, id })
    profileService = createProfileService({ API_URL, id, sessionToken })
    sessionService = createSessionService({ API_URL, sessionToken })
    groupService = createGroupService({ API_URL, id, sessionToken })
    settingsService = createSettingsService({ id, API_URL, sessionToken, uploadFile, loadProfile: (userId: string) => profileService?.loadProfile(userId) })
    statusService = createStatusService({ API_URL, sessionToken, userId: id })
    
    // Establish WebSocket connection first
    ws = connectWS(id, sessionToken, async (msg)=>{
      // Handle presence updates - create new Set to trigger Svelte reactivity
      if (msg.type === 'presence') {
        const newOnlineUsers: any = new Set(msg.online || [])
        console.log('Presence update:', Array.from(newOnlineUsers))
        ContactsLib.onlineUsers.set(newOnlineUsers)
        return
      }
      
      // Handle status updates
      if (msg.type === 'status-update') {
        console.log('Status update from', msg.from, ':', msg.status)
        // Update profile cache with new status
        const profile = { ...profiles[msg.from] }
        if (profile) {
          profile.status = msg.status
          profile.customMessage = msg.customMessage
          profile.lastSeen = msg.lastSeen
          profiles = { ...profiles, [msg.from]: profile }
        }
        return
      }
      
      if (msg.type === 'typing') {
        typingMap = { ...typingMap, [msg.from]: msg.isTyping }
        return
      }
      
      // Handle VoIP signaling
      if (msg.type === 'call-offer') {
        try {
          await VoipLib.handleCallOffer(msg.from, msg.offer, true)
        } catch (error) {
          console.error('Failed to answer call:', error)
        }
        return
      }
      if (msg.type === 'call-answer') {
        if (msg.answer) {
          await VoipLib.handleCallAnswer(msg.answer)
        }
        return
      }
      if (msg.type === 'call-ice-candidate') {
        if (msg.candidate) {
          await VoipLib.handleIceCandidate(msg.candidate)
        }
        return
      }
      if (msg.type === 'call-end') {
        VoipLib.endCall()
        return
      }
      
      // Handle VoIP call cancellation
      if (msg.type === 'call-cancel') {
        VoipLib.endCall()
        return
      }
      
      // Handle edit message
      if (msg.type === 'edit') {
        const chatWith = msg.chatWith || msg.from
        if (messagesMap[chatWith] && msg.messageId) {
          // Decrypt the edited text
          const pk = keys[msg.from]
          if (pk && keypair && msg.cipher && msg.nonce) {
            try {
              const text = await cryptoPool.decrypt(keypair.secretKey, pk, msg.cipher, msg.nonce)
              messagesMap = {
                ...messagesMap,
                [chatWith]: messagesMap[chatWith].map(m => 
                  (msg.messageId && m.messageId === msg.messageId)
                    ? { ...m, text, editedAt: msg.editedAt || Date.now() } 
                    : m
                )
              }
            } catch (e) {
              console.error('Failed to decrypt edited message', e)
            }
          }
        }
        return
      }
      
      // Handle delete message
      if (msg.type === 'delete') {
        const chatWith = msg.chatWith || msg.from
        if (messagesMap[chatWith] && msg.messageId) {
          messagesMap = {
            ...messagesMap,
            [chatWith]: messagesMap[chatWith].map(m => 
              (msg.messageId && m.messageId === msg.messageId)
                ? { ...m, deleted: true, text: '' } 
                : m
            )
          }
        }
        return
      }
      
      // Handle read receipt
      if (msg.type === 'read') {
        const chatWith = msg.from
        if (messagesMap[chatWith] && msg.messageId) {
          const foundMessage = messagesMap[chatWith].find(m => m.messageId === msg.messageId)
          if (foundMessage) {
            messagesMap = {
              ...messagesMap,
              [chatWith]: messagesMap[chatWith].map(m => 
                (m.messageId === msg.messageId)
                  ? { ...m, read: true, readAt: msg.readAt || Date.now() } 
                  : m
              )
            }
            // Update cache silently - ignore failures
            MessageCacheLib.cacheMessage(chatWith, foundMessage).catch(() => {
              // Silently ignore cache failures
            })
          }
        }
        return
      }

      // Handle reactions
      if (msg.type === 'react') {
        const chatWith = msg.chatWith || msg.from
        const messageId = msg.messageId
        const emoji = msg.emoji
        const reactor = msg.from
        if (chatWith && messageId && emoji && reactor) {
          applyReaction(chatWith, messageId, emoji, reactor)
        }
        return
      }
      
      const from = msg.from
      const chatWith = msg.chatWith || from
      
      // Skip if we can't determine chat context
      if (!chatWith || !from) {
        console.warn('Skipping message without proper context:', msg)
        return
      }
      
      console.log('[App.handleMessage] Processing:', { messageId: msg.messageId, from, chatWith, currentContact: contact, isForCurrentChat: chatWith === contact })
      
      try {
        const fetchKey = async (targetId: string) => {
          if (pendingKeys.has(targetId)) {
            // Wait for existing request
            for (let i = 0; i < 10; i++) {
              await new Promise(r => setTimeout(r, 200))
              if (keys[targetId]) return keys[targetId]
            }
          }
          
          if (keys[targetId]) return keys[targetId]
          
          pendingKeys.add(targetId)
          try {
            const res = await fetch(`${API_URL}/keys?id=${encodeURIComponent(targetId)}`)
            if (res.ok) {
              const data = await res.json()
              keys = { ...keys, [targetId]: data.publicKey }
              return data.publicKey
            }
          } finally {
            pendingKeys.delete(targetId)
          }
          return null
        }

        let decryptPkName = chatWith
        if (chatWith.startsWith('#')) {
          decryptPkName = from
        }

        let decryptPk = keys[decryptPkName]
        if (!decryptPk) {
          decryptPk = await fetchKey(decryptPkName)
        }

        if (!decryptPk) {
          console.warn(`No key found for ${decryptPkName}, skipping message`)
          return
        }
        
        let text = ''
        const attemptDecrypt = async (pk: string) => {
          let cipher = msg.cipher
          let nonce = msg.nonce

          if (msg.groupCiphers && msg.groupCiphers[id]) {
            cipher = msg.groupCiphers[id].cipher
            nonce = msg.groupCiphers[id].nonce
          }

          console.log('[Decrypt] Attempting decryption:', {
            messageId: msg.messageId,
            from: msg.from,
            hasCipher: !!cipher,
            cipherLength: typeof cipher === 'string' ? cipher.length : 'not a string',
            hasNonce: !!nonce,
            nonceLength: typeof nonce === 'string' ? nonce.length : 'not a string',
            hasGroupCiphers: !!msg.groupCiphers,
            decryptPkName,
            pkLength: pk.length
          })

          // Validate we have all required string parameters
          if (!cipher || !nonce || typeof cipher !== 'string' || typeof nonce !== 'string') {
            console.error('Invalid cipher/nonce for decryption:', { 
              cipher: typeof cipher, 
              nonce: typeof nonce, 
              messageId: msg.messageId,
              from: msg.from
            })
            return null
          }

          // Use worker pool to prevent UI blocking
          if (keypair && pk) {
            try {
              const result = await cryptoPool.decrypt(keypair.secretKey, pk, cipher, nonce)
              console.log('[Decrypt] Decryption successful:', { messageId: msg.messageId, from: msg.from })
              return result
            } catch (e) {
              console.warn('Worker decryption failed, trying fallback', { error: String(e), messageId: msg.messageId })
              try {
                const result = decrypt(keypair.secretKey, pk, cipher, nonce)
                console.log('[Decrypt] Fallback decryption successful:', { messageId: msg.messageId, from: msg.from })
                return result
              } catch (e2) {
                console.error('Fallback decryption also failed:', { error: String(e2), messageId: msg.messageId, from: msg.from })
                return null
              }
            }
          }
          console.error('Cannot decrypt - missing keypair or pk:', { hasKeypair: !!keypair, hasPk: !!pk })
          return null
        }

        text = await attemptDecrypt(decryptPk) || ''
        console.log('[Decrypt] After first attempt:', { success: !!text, messageId: msg.messageId, from: msg.from })

        // If decryption failed, try fetching the key again (it might have changed)
        if (!text && (msg.cipher || msg.groupCiphers) && !msg.cipher?.includes('typing')) {
          console.log('[Decrypt] Retrying with fresh key fetch:', { decryptPkName, messageId: msg.messageId })
          // Force a re-fetch if decryption failed
          keys = { ...keys }
          delete keys[decryptPkName] 
          const newPk = await fetchKey(decryptPkName)
          if (newPk && newPk !== decryptPk) {
            console.log('[Decrypt] Got new key, retrying:', { messageId: msg.messageId })
            text = await attemptDecrypt(newPk) || ''
          }
        }

        if (!text) {
          console.error('[Decrypt] Message failed to decrypt:', { messageId: msg.messageId, from: msg.from, messageType: msg.type })
          text = '<failed to decrypt message>'
        }
        
        let msgObj: any = { 
          from, 
          text, 
          ts: msg.ts || Date.now(),
          messageId: msg.messageId || (msg.ts + '_' + from),
          editedAt: msg.editedAt,
          deleted: msg.deleted,
          replyTo: msg.replyTo
        }
        try {
          if (text.startsWith('{') && text.includes('bytechat_file')) {
            const parsed = JSON.parse(text)
            if (parsed && parsed.bytechat_file) {
              msgObj.text = `Sent a file: ${parsed.fileName}`
              msgObj.file = {
                fileName: parsed.fileName,
                fileType: parsed.fileType,
                fileData: parsed.fileData,
                fileUrl: parsed.fileUrl
              }
            }
          }
        } catch (e) {
          // Not a JSON/file message, treat as plain text
        }

        // Avoid duplicates by checking messageId
        if (msgObj.messageId) {
          const isDuplicate = (messagesMap[chatWith] || []).some(m => 
            m.messageId && m.messageId === msgObj.messageId
          )
          if (isDuplicate) {
            console.log('Skipping duplicate message:', msgObj.messageId)
            return
          }
        }

        console.log('Processing message:', { messageId: msgObj.messageId, from: msgObj.from, text: msgObj.text?.substring(0, 50), isHistory: msg.isHistory })

        // Use requestIdleCallback for non-urgent UI updates
        const updateMessages = () => {
          console.log('[App] Updating messagesMap with received message:', { messageId: msgObj.messageId, chatWith, from: msgObj.from })
          const nextList = [...(messagesMap[chatWith]||[]), msgObj].sort((a, b) => (a.ts || 0) - (b.ts || 0))
          messagesMap = {
            ...messagesMap,
            [chatWith]: capMessages(nextList)
          }
          // Force reactivity by reassigning currentMessages if this is the current contact
          if (chatWith === contact) {
            currentMessages = messagesMap[contact] || []
          }
          // Cache the message
          MessageCacheLib.cacheMessage(chatWith, msgObj).catch(err => console.warn('Failed to cache message:', err))
        }
        
        // For history messages, defer to idle time
        if (msg.isHistory) {
          console.log('[App] Deferring history message to idle time')
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => updateMessages(), { timeout: 1000 })
          } else {
            setTimeout(updateMessages, 0)
          }
          return
        }
        
        // For live messages, update immediately
        console.log('[App] Updating live message immediately')
        updateMessages()

        const pref = notificationPrefs[chatWith] || 'all'
        const isMention = typeof text === 'string' && id && text.toLowerCase().includes(`@${id.toLowerCase()}`)

        if (chatWith !== contact) {
          unreadMap = { ...unreadMap, [chatWith]: (unreadMap[chatWith] || 0) + 1 }
          if (pref !== 'mute' && (pref === 'all' || isMention)) {
            const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
            const shortMsg = displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg
            NotificationsLib.notify(chatWith, shortMsg, isAppVisible, contact)
          }
        } else if (!isAppVisible) {
          if (pref !== 'mute' && (pref === 'all' || isMention)) {
            const displayMsg = msgObj.file ? `Sent a file: ${msgObj.file.fileName}` : text
            const shortMsg = displayMsg.length > 50 ? displayMsg.slice(0, 50) + '...' : displayMsg
            NotificationsLib.notify(chatWith, shortMsg, isAppVisible, contact)
          }
        }
      } catch (e) {
        console.error('Failed to process message', e)
      }
    }, (status) => {
      wsStatus = status
    })
    
    // Initialize services that need WebSocket after it's created
    messagingService = createMessagingService({
      ws,
      id,
      getKeypair: () => keypair,
      getKeys: () => keys,
      getGroups: () => groups,
      cryptoPool,
      API_URL,
      sessionToken,
      uploadFile,
      fetchContactKey: (name: string) => contactService?.fetchContactKey(name),
      messagesMap,
      updateMessagesMap: (updater) => {
        messagesMap = updater(messagesMap)
      }
    })
    callService = createCallService({ ws })
  }


  $: isDevelopersPage = route.kind === 'developers'
  $: if (route.kind === 'chat' && route.chatId && contact !== route.chatId) {
    contact = route.chatId
  }

  function sendReadReceipt(from: string, messageId: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !messageId) return
    
    ws.send(JSON.stringify({
      type: 'read',
      messageId: messageId,
      from: from,
      readAt: Date.now()
    }))
  }

  // sendTo is now in messagingService

  // sendFile is now in messagingService

  // sendVoice is now in messagingService

  function sendTyping(isTyping: boolean) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !contact) return
    ws.send(JSON.stringify({ type: 'typing', to: contact, isTyping }))
  }

  function handleTyping() {
    sendTyping(true)
    if (typingTimeout) clearTimeout(typingTimeout)
    typingTimeout = setTimeout(() => {
      sendTyping(false)
    }, 3000)
  }
  
  // handleEdit is now in messagingService
  
  // handleDelete is now in messagingService

  function applyReaction(chatId: string, messageId: string, emoji: string, userId: string) {
    const list = messagesMap[chatId]
    if (!list) return
    messagesMap = {
      ...messagesMap,
      [chatId]: list.map(m => {
        if (m.messageId !== messageId) return m
        const reactions = { ...(m.reactions || {}) }
        const set = new Set(reactions[emoji] || [])
        if (set.has(userId)) {
          set.delete(userId)
        } else {
          set.add(userId)
        }
        reactions[emoji] = Array.from(set)
        return { ...m, reactions }
      })
    }
  }

  function handleReact(e: CustomEvent<{ messageId: string; emoji: string }>) {
    if (!contact || !ws || ws.readyState !== WebSocket.OPEN) return
    const { messageId, emoji } = e.detail
    if (!messageId || !emoji) return

    ws.send(JSON.stringify({
      type: 'react',
      to: contact,
      messageId,
      emoji
    }))

    applyReaction(contact, messageId, emoji, id)
  }

  function handleTogglePin(e: CustomEvent<{ messageId?: string }>) {
    if (!contact || !e.detail.messageId) return
    MessagesLib.togglePin(contact, e.detail.messageId)
  }

  // VoIP Call Functions - using composable
  function sendVoipSignal(type: string, data: any, to: string) {
    if (ws) {
      ws.send(JSON.stringify({
        type,
        to,
        ...data
      }))
    }
  }
  
  // Call functions are now in callService, VoipLib handlers kept for WebSocket message routing

  // addContact is now in contactService

  async function exportKeys() {
    let content = ''
    let filename = `bytechat_${id}_keys.txt`
    
    if (keypair) {
      content = `ByteChat Nacl Keys for ${id}\n\nPublic Key: ${keypair.publicKey}\nSecret Key: ${keypair.secretKey}`
    } else {
      alert('No keys found to export')
      return
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
        await FileOpener.open({
          filePath: result.uri,
          contentType: 'text/plain'
        })
      } catch (e: any) {
        alert('Failed to save keys: ' + e.message)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // validateSession is now in sessionService

  function logout() {
    isLoggedIn = false
    id = ''
    sessionToken = ''
    keypair = null
    if (ws) {
      ws.close()
      ws = null
    }
    localStorage.removeItem('bytechat_session')
    localStorage.removeItem('bytechat_session_backup')
    keys = {}
    groups = []
    messagesMap = {}
    unreadMap = {}
    contact = null
    showSidebar = true
    route = { kind: 'home' }
    isDevelopersPage = false
    if (typeof window !== 'undefined') {
      history.pushState({}, '', '/home')
    }
  }

  async function checkForUpdates() {
    try {
      console.log('Checking for updates... current version:', version)
      
      // Check GitHub package.json for latest version
      const pkgRes = await fetch('https://raw.githubusercontent.com/0xbyteptr/bytechat/main/client/package.json')
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json()
        latestVersion = pkgData.version
        console.log('Latest version in repo:', latestVersion)
      }
      
      // Check GitHub releases
      const res = await fetch('https://api.github.com/repos/0xbyteptr/bytechat/releases/latest')
      if (res.ok) {
        const data = await res.json()
        const releaseVersion = data.tag_name.replace('v', '')
        console.log('Latest release version:', releaseVersion)
        
        const compareVersions = (v1: string, v2: string) => {
          const parts1 = v1.split('.').map(x => parseInt(x) || 0)
          const parts2 = v2.split('.').map(x => parseInt(x) || 0)
          const length = Math.max(parts1.length, parts2.length)
          for (let i = 0; i < length; i++) {
            const p1 = parts1[i] || 0
            const p2 = parts2[i] || 0
            if (p1 > p2) return 1
            if (p1 < p2) return -1
          }
          return 0
        }

        const comparison = compareVersions(version, releaseVersion)
        
        if (comparison > 0) {
          // Current version is newer than release (dev version)
          isNewerThanRelease = true
          console.log('Using dev version')
        } else if (comparison < 0) {
          // Release is newer (update available)
          updateAvailable = true
          const apkAsset = data.assets.find((a: any) => a.name.endsWith('.apk'))
          updateUrl = apkAsset ? apkAsset.browser_download_url : data.html_url
          console.log('Update found! URL:', updateUrl)
        }
      }
    } catch (e) {
      console.warn('Update check failed', e)
    }
  }

  async function installUpdate() {
    if (!updateUrl || isUpdating) return
    
    if (!Capacitor.isNativePlatform() || !updateUrl.endsWith('.apk')) {
      window.open(updateUrl, '_blank')
      return
    }

    try {
      isUpdating = true
      const filename = `bytechat_update.apk`
      
      console.log('Starting download from:', updateUrl)
      
      // Delete old file if exists
      try {
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Data
        })
      } catch (e) {}

      const download = await Filesystem.downloadFile({
        url: updateUrl,
        path: filename,
        directory: Directory.Data
      })

      if (download.path) {
        console.log('Download complete:', download.path)
        
        // On Android, we might need to convert the path to a proper URI
        let finalPath = download.path
        if (Capacitor.getPlatform() === 'android' && !finalPath.startsWith('file://')) {
          finalPath = 'file://' + finalPath
        }

        await FileOpener.open({
          filePath: finalPath,
          contentType: 'application/vnd.android.package-archive',
          openWithDefault: true
        })
      }
    } catch (e: any) {
      console.error('Update failed', e)
      alert('Update failed: ' + e.message)
    } finally {
      isUpdating = false
    }
  }

  async function fetchGroups() {
    if (!id || !sessionToken) return
    try {
      const res = await fetch(`${API_URL}/groups?id=${encodeURIComponent(id)}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      if (res.status === 401) {
        console.warn('Session invalid, logging out')
        logout()
        return
      }
      if (res.ok) {
        groups = await res.json()
      }
    } catch (e) {}
  }

  // loadProfile is now in profileService

  function setNotificationPref(chatId: string, mode: 'all' | 'mentions' | 'mute') {
    if (!chatId) return
    notificationPrefs = { ...notificationPrefs, [chatId]: mode }
    try {
      localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(notificationPrefs))
    } catch (e) {
      console.warn('Failed to persist notification prefs', e)
    }
  }

  // saveProfile is now in profileService/settingsService

  async function uploadFile(file: File): Promise<string | null> {
    if (!id || !sessionToken) return null

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_URL}/cdn/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-ByteChat-ID': id
        },
        body: formData
      })

      if (!res.ok) throw new Error('upload failed')

      const data = await res.json()
      return data.url
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    }
  }

  // handleAvatarUpload is now in settingsService

  // handleBannerUpload is now in settingsService

  async function saveSettingsProfile() {
    if (!id || !sessionToken) return
    settingsProfileLoading = true
    settingsProfileError = ''
    settingsProfileSaved = false

    const payload = {
      id,
      displayName: settingsProfile.displayName?.trim() || '',
      bio: settingsProfile.bio?.trim() || '',
      avatarUrl: settingsProfile.avatarUrl?.trim() || '',
      bannerUrl: settingsProfile.bannerUrl?.trim() || ''
    }

    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) throw new Error('save failed')

      profiles = { ...profiles, [id]: { ...payload, updatedAt: Date.now() } }
      profileTimestamps[id] = Date.now() // Update cache timestamp
      contacts = contacts.map(c => c.id === id ? { ...c, name: payload.displayName || c.name } : c)
      settingsProfileDirty = false
      settingsProfileSaved = true
    } catch (err) {
      settingsProfileError = 'Failed to save profile'
    } finally {
      settingsProfileLoading = false
    }
  }

  async function createGroup(name: string, members: string[]) {
    if (!id || !sessionToken) return
    const gid = '#' + Math.random().toString(36).slice(2, 10)
    try {
      const res = await fetch(`${API_URL}/groups?id=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: gid, name, members: [...members, id] })
      })
      if (res.ok) {
        await fetchGroups()
        contact = gid
      }
    } catch (e: any) {
      alert('Failed to create group: ' + e.message)
    }
  }

  onMount(() => {
    if (route.kind === 'developers') {
      isLoading = false
      return
    }

    const handlePopState = () => {
      route = parseRoute(window.location.pathname || '/')
      isDevelopersPage = route.kind === 'developers'
    }
    window.addEventListener('popstate', handlePopState)

    // Initialize message cache
    MessageCacheLib.initializeCache().catch(err => console.warn('Failed to initialize message cache:', err))
    
    // Show loading screen and request permissions (async, non-blocking)
    initializeApp()
    
    // Initialize VoIP with remote audio element
    if (remoteAudioEl) {
      VoipLib.initVoIP(remoteAudioEl, sendVoipSignal)
    }
    
    try {
      checkForUpdates()
      fetchGroups()
      if ('Notification' in window) {
        notificationPermission = Notification.permission;
      }
      
      const handleVisibilityChange = () => {
        isAppVisible = document.visibilityState === 'visible'
        if (isAppVisible) {
          // Refresh groups and messages but don't validate session immediately
          // Session validation will happen on its regular interval
          fetchGroups()
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      const saved = localStorage.getItem('bytechat_session')
      if(saved) {
        try {
          const s = JSON.parse(saved)
          if (s.version !== 2) {
            // Old session format, upgrade or clear
            console.log('Upgrading session format')
          }
          id = s.id
          sessionToken = s.sessionToken || ''
          keypair = s.keypair || null
          keys = s.keys || {}
          groups = s.groups || []
          messagesMap = s.messagesMap || {}
          unreadMap = s.unreadMap || {}
          contact = s.lastContact || null
          if (id && sessionToken && keypair) {
            isLoggedIn = true
            // Rebuild contacts from restored messagesMap
            rebuildContacts()
            connect()
            NotificationsLib.setupNotifications(id, sessionToken, API_URL)
            profileService?.loadProfile(id)
            // Skip immediate validation - let periodic check handle it
          }
        } catch (e) {
          console.error('Failed to restore session:', e)
          // Try backup
          try {
            const backup = localStorage.getItem('bytechat_session_backup')
            if (backup) {
              const s = JSON.parse(backup)
              id = s.id
              sessionToken = s.sessionToken || ''
              keypair = s.keypair || null
              keys = s.keys || {}
              groups = s.groups || []
              messagesMap = s.messagesMap || {}
              unreadMap = s.unreadMap || {}
              contact = s.lastContact || null
              if (id && sessionToken && keypair) {
                isLoggedIn = true
                // Rebuild contacts from restored messagesMap
                rebuildContacts()
                connect()
                NotificationsLib.setupNotifications(id, sessionToken, API_URL)
                profileService?.loadProfile(id)
                console.log('Restored from backup')
              }
            }
          } catch (backupError) {
            console.error('Failed to restore from backup:', backupError)
          }
        }
      }

      // Check session every 5 minutes instead of every minute
      const sessionInterval = setInterval(() => {
        if (isLoggedIn) {
          sessionService?.validateSession()
          fetchGroups()
        }
      }, 300000)

      // Handle Android back button and keyboard
      if (Capacitor.isNativePlatform()) {
        if (Capacitor.getPlatform() === 'android') {
          // Handle back button
          App.addListener('backButton', () => {
            // If in a call, end the call instead of exiting app
            const currentCallState = VoipLib.callState
            let callStateValue: string = 'idle'
            const unsubscribe = currentCallState.subscribe(value => callStateValue = value)
            unsubscribe()
            
            if (callStateValue !== 'idle') {
              console.log('Back button: ending active call')
              callService?.endCall()
              return
            }
            
            // If sidebar is hidden (showing chat), go back to sidebar
            if (showSidebar === false && contact) {
              console.log('Back button: closing chat')
              contact = null
              showSidebar = true
              navigateTo('/home')
              return
            }
            
            // Otherwise exit app
            console.log('Back button: exiting app')
            App.exitApp()
          })
          
          // Handle keyboard show/hide to adjust UI
          try {
            // @ts-ignore - Keyboard API
            const { Keyboard } = Capacitor.Plugins
            if (Keyboard) {
              Keyboard.addListener('keyboardWillShow', () => {
                document.documentElement.style.setProperty('--keyboard-open', '1')
              })
              
              Keyboard.addListener('keyboardWillHide', () => {
                document.documentElement.style.setProperty('--keyboard-open', '0')
              })
            }
          } catch (e) {
            console.warn('Failed to setup keyboard listeners:', e)
          }
          
          // Set initial keyboard state
          document.documentElement.style.setProperty('--keyboard-open', '0')
        }
        
        // Setup status bar for both Android and iOS
        try {
          // @ts-ignore - StatusBar API
          const { StatusBar } = Capacitor.Plugins
          if (StatusBar) {
            StatusBar.setBackgroundColor({ color: '#313244' })
            StatusBar.setStyle({ style: 'DARK' })
            StatusBar.setOverlaysWebView({ overlay: false })
          }
        } catch (e) {
          console.warn('Failed to setup status bar:', e)
        }
        
        // Keep screen on during calls
        try {
          // @ts-ignore - ScreenBrightness API
          const { ScreenOrientation } = Capacitor.Plugins
          if (ScreenOrientation) {
            ScreenOrientation.lock({ orientation: 'PORTRAIT' })
          }
        } catch (e) {
          console.warn('Failed to lock screen orientation:', e)
        }
      }

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        clearInterval(sessionInterval)
        window.removeEventListener('popstate', handlePopState)
      }
    } catch (err) {
      console.error('Fatal onMount error:', err)
    }
  })
  
  onDestroy(() => {
    // End any active calls before cleanup
    const currentCallState = VoipLib.callState
    let callStateValue: string = 'idle'
    const unsubscribe = currentCallState.subscribe(value => callStateValue = value)
    unsubscribe()
    
    if (callStateValue !== 'idle') {
      try {
        VoipLib.endCall()
      } catch (e) {
        console.warn('Failed to end call during cleanup:', e)
      }
    }
    
    // Clean up crypto worker pool to prevent memory leaks
    if (cryptoPool) {
      cryptoPool.terminate()
    }
    // Clean up any pending timeouts
    if (contactsDebounce) clearTimeout(contactsDebounce)
    if (typingTimeout) clearTimeout(typingTimeout)
  })

  // Rebuild contacts from messagesMap (used on session restore)
  function rebuildContacts() {
    if (contactsDebounce) clearTimeout(contactsDebounce)
    contactsDebounce = setTimeout(() => {
      const dm = Object.keys(messagesMap)
        .filter(k => !k.startsWith('#'))
        .map(k => {
          const msgs = messagesMap[k] || []
          const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined
          const lastTs = lastMsg?.ts ?? 0
          return {
            id: k,
            last: lastMsg?.text ?? '',
            unread: unreadMap[k] || 0,
            _ts: lastTs
          }
        })
        .sort((a, b) => {
          if (b._ts !== a._ts) return b._ts - a._ts
          return (b.unread || 0) - (a.unread || 0)
        })
        .map(({ _ts, ...rest }) => rest)
      contacts = dm
      console.log('Contacts rebuilt from messagesMap:', contacts.length, 'contacts')
    }, 50)
  }

  // Session saving with backup and compression
  let saveTimeout: any = null
  let lastSaveTime = 0
  
  function saveSession() {
    const now = Date.now()
    // Rate limit saves to max once per 500ms
    if (now - lastSaveTime < 500) {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveSession, 500)
      return
    }
    
    lastSaveTime = now
    
    try {
      // Create backup of current session before saving new one
      const current = localStorage.getItem('bytechat_session')
      if (current) {
        try {
          localStorage.setItem('bytechat_session_backup', current)
        } catch (e) {
          console.warn('Failed to create session backup', e)
        }
      }
      
      // Strip large file data and limit message history to avoid quota errors
      const strippedMessages: Record<string, any[]> = {}
      Object.keys(messagesMap).forEach(contactId => {
        // Keep only last 100 messages per contact
        const messages = messagesMap[contactId].slice(-100)
        strippedMessages[contactId] = messages.map(m => {
          if (m.file && m.file.fileData) {
            // Keep small files (< 50KB), strip large ones
            if (m.file.fileData.length > 50000) {
              return { 
                ...m, 
                file: { 
                  fileName: m.file.fileName, 
                  fileType: m.file.fileType,
                  fileUrl: m.file.fileUrl,
                  fileData: '' 
                }, 
                text: m.text || `File: ${m.file.fileName}` 
              }
            }
          }
          return m
        })
      })

      const sessionData = {
        version: 2,
        id,
        sessionToken,
        keypair,
        keys,
        groups,
        messagesMap: strippedMessages,
        unreadMap,
        lastContact: contact,
        savedAt: now
      }
      
      const serialized = JSON.stringify(sessionData)
      
      // Check size and warn if approaching limits
      if (serialized.length > 4500000) { // 4.5MB (localStorage is typically 5-10MB)
        console.warn('Session data is large:', Math.round(serialized.length / 1024), 'KB')
        // Try more aggressive pruning
        Object.keys(strippedMessages).forEach(contactId => {
          strippedMessages[contactId] = strippedMessages[contactId].slice(-50)
        })
        sessionData.messagesMap = strippedMessages
      }
      
      localStorage.setItem('bytechat_session', JSON.stringify(sessionData))
    } catch (e) {
      console.error('Failed to save session:', e)
      
      // Try emergency save with minimal data
      try {
        localStorage.setItem('bytechat_session', JSON.stringify({
          version: 2,
          id,
          sessionToken,
          keypair,
          keys,
          groups,
          messagesMap: {}, // Drop all messages
          unreadMap: {},
          lastContact: contact,
          savedAt: Date.now()
        }))
        console.warn('Saved minimal session data (messages dropped)')
      } catch (emergencyError) {
        console.error('Emergency save failed:', emergencyError)
      }
    }
  }
  
  // Auto-save on data changes
  $: if(isLoggedIn && (id || sessionToken || keypair || keys || groups || messagesMap || unreadMap || contact)) {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(saveSession, 1000)
  }

  // small mock contacts list for UI
  let contactsDebounce: any = null
  
  $: if (messagesMap || unreadMap) {
    if (contactsDebounce) clearTimeout(contactsDebounce)
    contactsDebounce = setTimeout(() => {
      const dm = Object.keys(messagesMap)
        .filter(k => !k.startsWith('#')) // Exclude groups from contacts list
        .map(k => {
          const msgs = messagesMap[k] || []
          const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined
          const lastTs = lastMsg?.ts ?? 0
          return {
            id: k,
            last: lastMsg?.text ?? '',
            unread: unreadMap[k] || 0,
            _ts: lastTs
          }
        })
        .sort((a, b) => {
          if (b._ts !== a._ts) return b._ts - a._ts
          // tie-breaker: higher unread first
          return (b.unread || 0) - (a.unread || 0)
        })
        .map(({ _ts, ...rest }) => rest)
      contacts = dm
    }, 50)
  }

  $: totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)
  $: {
    if (typeof document !== 'undefined') {
      document.title = totalUnread > 0 ? `(${totalUnread}) ByteChat` : 'ByteChat'
    }
  }
</script>

<style>
  .top-bar {
    padding: 0.75rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border-bottom: 1px solid var(--surface-lighter);
    background: var(--surface);
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    border: none;
    transition: opacity 0.2s, transform 0.1s;
    min-height: 44px; /* Better touch target for mobile */
    -webkit-tap-highlight-color: transparent;
  }

  button:active { transform: scale(0.98); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary { background: var(--accent); color: var(--accent-fg); }
  .btn-secondary { background: var(--surface-lighter); color: var(--fg); }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 700;
  }

  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .dot.connected { background: var(--green); box-shadow: 0 0 8px var(--green); }
  .dot.connecting { background: var(--yellow); }
  .dot.disconnected { background: var(--red); }

  .sidebar-wrapper {
    width: 320px;
    height: 100%;
    flex-shrink: 0;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
    background: var(--surface);
    padding-left: env(safe-area-inset-left);
    z-index: 10;
    will-change: transform;
  }
  
  .chat-wrapper {
    flex: 1;
    height: 100%;
    min-width: 0;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
    will-change: transform;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .modal-content {
    background: var(--surface);
    border: 1px solid var(--surface-lighter);
    border-radius: 24px;
    width: 100%;
    max-width: 840px;
    padding: 2rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-height: 90vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touchex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .settings-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 1rem;
  }

  .settings-nav {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .settings-nav-item {
    border: none;
    min-height: 40px;
    -webkit-tap-highlight-color: transparent;
    font-size: 0.85rem;
    background: transparent;
    color: var(--subtext);
    padding: 0.5rem 0.6rem;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .settings-nav-item:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .settings-nav-item.active,
  .settings-nav-item[aria-selected="true"] {
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  }

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--accent);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--subtext);
    cursor: pointer;
    padding: 0.5rem;
    min-width: 44px;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
  }

  .close-btn:hover {
    color: var(--fg);
    background: var(--surface-lighter);
  }
  
  .close-btn:active {
    transform: scale(0.95);
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .settings-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--subtext);
  }

  .settings-item {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .settings-tabs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 12px;
    padding: 0.35rem;
  }

  .settings-tab {
    border: none;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
    font-size: 0.8rem;
    background: transparent;
    color: var(--subtext);
    padding: 0.65rem 0.75rem;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    transition: all 0.15s ease;
  }

  .settings-tab:hover {
    background: var(--surface-lighter);
    color: var(--fg);
  }

  .settings-tab.active {
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  }

  .profile-card {
    gap: 1rem;
  }

  .profile-visuals {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
  }

  .profile-banner {
    height: 120px;
    border-radius: 10px;
    background-size: cover;
    background-position: center;
  }

  .profile-avatar {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    background: var(--surface-lighter);
    color: var(--accent);
    display: grid;
    place-items: center;
    font-weight: 800;
    position: absolute;
    left: 12px;
    bottom: -20px;
    border: 3px solid var(--surface);
    overflow: hidden;
  }

  .profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-fields {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 1.25rem;
  }

  .settings-sub-label {
    font-size: 0.8rem;
    color: var(--subtext);
    font-weight: 700;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  .settings-textarea {
    resize: vertical;
    min-height: 96px;
    font-family: inherit;
  }

  .settings-input:disabled,
  .settings-textarea:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .settings-input:focus,
  .settings-textarea:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;  
  }
  .settings-textarea {
    resize: vertical;
    min-height: 96px;
  }

  .settings-input:disabled,
  .settings-textarea:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .settings-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .settings-error {
    color: var(--red);
    font-weight: 700;
  }

  .settings-success {
    color: var(--green);
    font-weight: 700;
    text-align: center;
  }

  .upload-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .upload-group .settings-input {
    flex: 1;
  }

  .upload-btn {
    background: var(--accent);
    color: var(--accent-fg);
    border: none;
    border-radius: 10px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: 1.2rem;
    transition: opacity 0.2s;
  }

  .status-selector-inline {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-select {
    background: var(--bg);
    border: 1px solid var(--surface-lighter);
    border-radius: 8px;
    padding: 0.75rem;
    color: var(--fg);
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1a1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1.2em 1.2em;
    padding-right: 2.5rem;
  }

  .status-select:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .status-select:hover {
    background-color: var(--surface-lighter);
  }

  @media (max-width: 768px) {
    .sidebar-wrapper {
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
    }

    .chat-wrapper {
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 25;
      padding-top: env(safe-area-inset-top);
    }

    .hidden-mobile {
      display: none !important;
    }
    
    .modal-overlay {
      padding: 0;
      align-items: flex-end;
    }
    
    .modal-content {
      border-radius: 24px 24px 0 0;
      max-width: 100%;
      max-height: 95vh;
      padding: 1.5rem;
      padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));
      margin: 0;
    }
    
    .modal-title {
      font-size: 1.25rem;
    }
    
    .settings-layout {
      grid-template-columns: 1fr;
    }
    .settings-nav {
      flex-direction: row;
      gap: 0.35rem;
    }
    .settings-nav-item {
      font-size: 0.75rem;
      padding: 0.45rem 0.55rem;
      white-space: nowrap;
    }
    
    .profile-banner {
      height: 100px;
    }
    
    .profile-avatar {
      width: 64px;
      height: 64px;
    }
    
    button {
      font-size: 0.9rem;
      padding: 0.65rem 1rem;
    }
    
    .settings-input,
    .settings-textarea {
      font-size: 16px; /* Prevents zoom on iOS */
    }
  }
  
  /* Smooth scrolling on mobile */
  @media (max-width: 768px) {
    * {
      -webkit-overflow-scrolling: touch;
    }
  }
  
  /* Better touch feedback */
  @media (hover: none) and (pointer: coarse) {
    button:hover {
      opacity: 1;
    }
    
    button:active {
      opacity: 0.8;
      transform: scale(0.97);
      z-index: 10;
    }

    .chat-wrapper {
      width: 100%;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 25;
    }

    .hidden-mobile {
      display: none;
    }
  }
</style>

<div class="flex flex-col h-screen w-screen overflow-hidden bg-bg text-fg">
  {#if isDevelopersPage}
    <Developers apiUrl={API_URL} {version} onNavigate={navigateTo} />
  {:else}
    {#if isLoading}
      <LoadingScreen status={loadingStatus} progress={loadingProgress} />
    {/if}

    {#if showPermissionsDialog}
      <PermissionsDialog
        {permissions}
        on:request={handlePermissionsRequest}
        on:skip={handlePermissionsSkip}
      />
    {/if}

    {#if !isLoggedIn && !isLoading}
      <Auth {id} {keypair} on:authSuccess={handleAuthSuccess} />
    {:else if !isLoading}
      <main class="flex flex-1 overflow-hidden relative bg-bg">
        <div class="sidebar-wrapper" class:hidden-mobile={!showSidebar}>
          <Sidebar
            {contacts}
            {groups}
            {profiles}
            {version}
            {updateAvailable}
            {isNewerThanRelease}
            {latestVersion}
            {isUpdating}
            {onlineUsers}
            userProfile={profiles[id]}
            userId={id}
            selected={contact}
            on:select={(e) => {
              contact = e.detail.id
              showSidebar = false
              navigateTo(`/chat/${encodeURIComponent(contact)}`)
            }}
            on:openProfile={(e) => {
              selectedUser = e.detail.userId
              selectedUserOnline = onlineUsers.has(e.detail.userId)
              selectedUserCommonGroups = groups.filter((g) => g.members.includes(e.detail.userId))
              profileService?.loadProfile(e.detail.userId)
              showUserProfile = true
            }}
            on:addContact={(e) => contactService?.addContact(e.detail.id)}
            on:createGroup={(e) => createGroup(e.detail.name, e.detail.members)}
            on:logout={logout}
            on:openSettings={openSettings}
            on:update={installUpdate}
            on:navigate={(e) => navigateTo(e.detail.path)}
          />
        </div>

        {#if contact}
          <div class="chat-wrapper" class:hidden-mobile={showSidebar}>
            <ChatWindow
              currentUserId={id}
              contactId={contact}
              contactName={profiles[contact]?.displayName || contacts.find((c) => c.id === contact)?.name}
              contactProfile={profiles[contact]}
              messages={currentMessages}
              isTyping={contact ? !!typingMap[contact] : false}
              isSending={isSending}
              callState={contact === callContact ? callState : 'idle'}
              isMuted={isMuted}
              isOnline={contact ? onlineUsers.has(contact) : false}
              isGroup={contact?.startsWith('#') || false}
              group={selectedGroup}
              pinned={pinnedMap[contact] || []}
              notificationMode={notificationPrefs[contact] || 'all'}
              on:send={(e) => {
                console.log('===== SEND EVENT FIRED =====', { to: e.detail.to, hasMessagingService: !!messagingService })
                if (!messagingService) {
                  console.error('[SEND] Messaging service NOT initialized', { ws: !!ws, id, keypair: !!keypair })
                  console.log('[SEND] messagingService object:', messagingService)
                  return
                }
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                  console.error('[SEND] WebSocket not connected', { ws: !!ws, readyState: ws?.readyState })
                  return
                }
                console.log('[SEND] Calling messagingService.sendTo', { to: e.detail.to, text: e.detail.text?.substring(0, 30) })
                messagingService.sendTo(e.detail.to, e.detail.text, e.detail.replyTo)
              }}
              on:sendFile={(e) => messagingService?.sendFile(e.detail.to, e.detail.fileData, e.detail.fileName, e.detail.fileType)}
              on:sendVoice={(e) => messagingService?.sendVoice(e.detail.to, e.detail.audioBlob, e.detail.duration)}
              on:edit={(e) => messagingService?.handleEdit(e.detail.to, e.detail.messageId, e.detail.text)}
              on:delete={(e) => messagingService?.handleDelete(e.detail.to, e.detail.messageId)}
              on:react={handleReact}
              on:setNotificationMode={(e) => setNotificationPref(contact, e.detail.mode)}
              on:togglePin={handleTogglePin}
              on:typing={handleTyping}
              on:startCall={(e) => callService?.startCall(e.detail.to)}
              on:endCall={() => callService?.endCall()}
              on:cancelCall={() => callService?.cancelCall()}
              on:toggleMute={() => callService?.toggleMute()}
              on:openGroupSettings={() => {
                selectedGroup = groups.find((g) => g.id === contact)
                showGroupSettings = true
              }}
              on:back={() => {
                contact = null
                showSidebar = true
                navigateTo('/home')
              }}
            />
          </div>
        {/if}
      </main>
    {/if}

    {#if showSettings}
      <div
        class="modal-overlay"
        on:click|self={() => (showSettings = false)}
        on:keydown={(e) => e.key === 'Escape' && (showSettings = false)}
        role="button"
        tabindex="-1"
      >
        <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <header class="modal-header">
            <h2 class="modal-title" id="settings-title">Settings</h2>
            <button class="close-btn" on:click={() => (showSettings = false)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="settings-layout">
            <div class="settings-nav" role="tablist" aria-orientation="vertical">
              <button class="settings-nav-item" aria-selected={settingsTab === 'general'} class:active={settingsTab === 'general'} on:click={() => (settingsTab = 'general')} role="tab">
                <span class="nav-icon">⚙️</span><span>General</span>
              </button>
              <button class="settings-nav-item" aria-selected={settingsTab === 'profile'} class:active={settingsTab === 'profile'} on:click={() => (settingsTab = 'profile')} role="tab">
                <span class="nav-icon">👤</span><span>Profile</span>
              </button>
              <button class="settings-nav-item" aria-selected={settingsTab === 'notifications'} class:active={settingsTab === 'notifications'} on:click={() => (settingsTab = 'notifications')} role="tab">
                <span class="nav-icon">🔔</span><span>Notifications</span>
              </button>
              <button class="settings-nav-item" aria-selected={settingsTab === 'security'} class:active={settingsTab === 'security'} on:click={() => (settingsTab = 'security')} role="tab">
                <span class="nav-icon">🔐</span><span>Security</span>
              </button>
            </div>
            <section class="settings-panel">
          {#if settingsTab === 'general'}
            <div class="settings-section">
              <span class="settings-label">Account</span>
              <div class="settings-item">
                <div class="flex justify-between items-center">
                  <span class="opacity-50 text-sm">Logged in as</span>
                  <span class="font-bold text-accent">{id}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                  <span class="opacity-50 text-sm">Status</span>
                  <div class="status-indicator">
                    <div class="dot {wsStatus}"></div>
                    <span class="opacity-50">{wsStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <span class="settings-label">API</span>
              <div class="settings-item">
                <div class="flex justify-between items-start gap-4">
                  <span class="opacity-50 text-sm">VITE_API_URL</span>
                  <span class="font-mono text-xs break-all text-right">{API_URL}</span>
                </div>
              </div>
            </div>

            <div class="mt-auto pt-2 text-center opacity-30 text-[10px] font-mono">
              ByteChat v{version}
            </div>
          {:else if settingsTab === 'profile'}
            <div class="settings-section">
              <span class="settings-label">Profile</span>
              
              <!-- User Status Section -->
              <div class="settings-item">
                <label for="status-select" class="settings-sub-label">Status</label>
                <div class="status-selector-inline">
                  <select id="status-select" bind:value={currentUserStatus} class="status-select" on:change={() => statusService?.updateStatus(currentUserStatus, currentCustomMessage)}>
                    <option value="online">🟢 Online</option>
                    <option value="away">🟡 Away</option>
                    <option value="busy">🔴 Busy</option>
                    <option value="offline">⚫ Offline</option>
                  </select>
                </div>
                <label for="custom-message-input" class="settings-sub-label" style="margin-top: 1rem">Custom Message</label>
                <input
                  id="custom-message-input"
                  class="settings-input"
                  type="text"
                  placeholder="What's on your mind?"
                  bind:value={currentCustomMessage}
                  maxlength="100"
                  on:blur={() => statusService?.updateStatus(currentUserStatus, currentCustomMessage)}
                />
              </div>
              
              {#if settingsProfileLoading || profileLoading}
                <div class="settings-item">Loading profile...</div>
              {:else}
                <div class="settings-item profile-card">
                  <div class="profile-visuals">
                    <div class="profile-banner" style={`background-image: ${settingsProfile.bannerUrl ? `url(${settingsProfile.bannerUrl})` : 'linear-gradient(135deg, var(--surface-lighter), var(--surface-darker))'}`}></div>
                    <div class="profile-avatar">
                      {#if settingsProfile.avatarUrl}
                        <img src={settingsProfile.avatarUrl} alt="avatar preview" />
                      {:else}
                        {(id || '?').slice(0, 1).toUpperCase()}
                      {/if}
                    </div>
                  </div>
                  <div class="profile-fields">
                    <label class="settings-sub-label" for="settings-display-name">Display name</label>
                    <input
                      id="settings-display-name"
                      class="settings-input"
                      placeholder="Add a display name"
                      bind:value={settingsProfile.displayName}
                      disabled={settingsProfileLoading}
                      on:input={markSettingsProfileDirty}
                    />

                    <label class="settings-sub-label" for="settings-bio">Bio</label>
                    <textarea
                      id="settings-bio"
                      class="settings-textarea"
                      rows="3"
                      placeholder="Tell people about you"
                      bind:value={settingsProfile.bio}
                      disabled={settingsProfileLoading}
                      on:input={markSettingsProfileDirty}
                    ></textarea>

                    <label class="settings-sub-label" for="settings-avatar-url">Avatar</label>
                    <div class="upload-group">
                      <input
                        id="settings-avatar-url"
                        class="settings-input"
                        placeholder="https://... or upload"
                        bind:value={settingsProfile.avatarUrl}
                        disabled={settingsProfileLoading}
                        on:input={markSettingsProfileDirty}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        style="display: none;"
                        on:change={(e) => settingsService?.handleAvatarUpload(e)}
                        id="avatar-upload"
                      />
                      <button
                        class="upload-btn"
                        on:click={() => document.getElementById('avatar-upload')?.click()}
                        disabled={uploadingAvatar || settingsProfileLoading}
                      >
                        {uploadingAvatar ? '⏳' : '📤'}
                      </button>
                    </div>

                    <label class="settings-sub-label" for="settings-banner-url">Banner</label>
                    <div class="upload-group">
                      <input
                        id="settings-banner-url"
                        class="settings-input"
                        placeholder="https://... or upload"
                        bind:value={settingsProfile.bannerUrl}
                        disabled={settingsProfileLoading}
                        on:input={markSettingsProfileDirty}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        style="display: none;"
                        on:change={(e) => settingsService?.handleBannerUpload(e)}
                        id="banner-upload"
                      />
                      <button
                        class="upload-btn"
                        on:click={() => document.getElementById('banner-upload')?.click()}
                        disabled={uploadingBanner || settingsProfileLoading}
                      >
                        {uploadingBanner ? '⏳' : '📤'}
                      </button>
                    </div>
                  </div>
                </div>
              {/if}

              {#if settingsProfileError}
                <div class="settings-error">{settingsProfileError}</div>
              {/if}

              <div class="settings-actions">
                <button
                  class="btn-secondary w-full py-3 rounded-xl"
                  on:click={saveSettingsProfile}
                  disabled={settingsProfileLoading || !settingsProfileDirty}
                >
                  {settingsProfileLoading ? 'Saving...' : settingsProfileDirty ? 'Save profile' : 'Saved'}
                </button>
                {#if settingsProfileSaved && !settingsProfileDirty}
                  <span class="settings-success">Profile saved</span>
                {/if}
              </div>
            </div>
          {:else if settingsTab === 'notifications'}
            <div class="settings-section">
              <span class="settings-label">Notifications</span>
              <div class="settings-item">
                <div class="flex justify-between items-center">
                  <span class="text-sm">Push Notifications</span>
                  {#if notificationPermission === 'granted'}
                    <span class="text-green text-xs font-bold uppercase">Enabled</span>
                  {:else}
                    <button class="btn-secondary text-xs py-1 px-3 rounded-lg" on:click={requestNotificationPermission}>Enable</button>
                  {/if}
                </div>
              </div>
            </div>
          {:else if settingsTab === 'security'}
            <div class="settings-section">
              <span class="settings-label">Data & Security</span>
              <div class="flex flex-col gap-2">
                <button class="btn-secondary w-full py-3 rounded-xl flex items-center justify-center gap-2" on:click={exportKeys}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export Keys
                </button>
                <button class="btn-secondary w-full py-3 rounded-xl text-red flex items-center justify-center gap-2" on:click={logout}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>
          {/if}
            </section>
          </div>
        </div>
      </div>
    {/if}

    {#if showGroupSettings && selectedGroup}
      <GroupSettings
        group={selectedGroup}
        currentUserId={id}
        isOpen={showGroupSettings}
        on:close={() => (showGroupSettings = false)}
      />
    {/if}

    {#if showUserProfile && selectedUser}
      <UserProfile
        userId={selectedUser}
        userNickname={profiles[selectedUser]?.displayName || contacts.find((c) => c.id === selectedUser)?.name || ''}
        profile={profiles[selectedUser]}
        loading={profileLoading}
        error={profileError}
        isSelf={selectedUser === id}
        isOpen={showUserProfile}
        isOnline={selectedUserOnline}
        commonGroups={selectedUserCommonGroups}
        on:saveProfile={(e) => profileService?.saveProfile(e)}
        on:startChat={() => {
          contact = selectedUser
          showUserProfile = false
        }}
        on:addToContacts={(e) => {
          contactService?.addContact(e.detail.userId, e.detail.name)
          showUserProfile = false
        }}
        on:removeFromContacts={(e) => {
          contacts = contacts.filter((c) => c.id !== e.detail.userId)
          showUserProfile = false
        }}
        on:blockUser={() => console.log('Block user:', selectedUser)}
        on:unblockUser={() => console.log('Unblock user:', selectedUser)}
        on:reportUser={() => console.log('Report user:', selectedUser)}
        on:viewEncryptionKey={() => console.log('View key:', selectedUser)}
        on:viewGroup={(e) => {
          selectedGroup = groups.find((g) => g.id === e.detail.groupId)
          showGroupSettings = true
        }}
        on:close={() => (showUserProfile = false)}
      />
    {/if}

    <!-- Hidden audio element for remote audio stream -->
    <audio bind:this={remoteAudioEl} autoplay style="display: none;"></audio>
  {/if}
</div>