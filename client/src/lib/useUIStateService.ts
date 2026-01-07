/**
 * UI state management service
 */

export type SettingsTab = 'general' | 'profile' | 'notifications' | 'security'

export interface UIState {
  showSidebar: boolean
  showSettings: boolean
  settingsTab: SettingsTab
  showGroupSettings: boolean
  showUserProfile: boolean
  showPermissionsDialog: boolean
  selectedUser: string | null
  selectedGroup: any
  isDevelopersPage: boolean
}

export function createUIStateService() {
  let state: UIState = {
    showSidebar: true,
    showSettings: false,
    settingsTab: 'general',
    showGroupSettings: false,
    showUserProfile: false,
    showPermissionsDialog: false,
    selectedUser: null,
    selectedGroup: null,
    isDevelopersPage: false
  }

  const listeners = new Set<() => void>()

  function notifyListeners() {
    listeners.forEach((fn) => fn())
  }

  function openSettings(tab: SettingsTab = 'general') {
    state.showSettings = true
    state.settingsTab = tab
    notifyListeners()
  }

  function closeSettings() {
    state.showSettings = false
    notifyListeners()
  }

  function setSettingsTab(tab: SettingsTab) {
    state.settingsTab = tab
    notifyListeners()
  }

  function openGroupSettings(group: any) {
    state.showGroupSettings = true
    state.selectedGroup = group
    notifyListeners()
  }

  function closeGroupSettings() {
    state.showGroupSettings = false
    state.selectedGroup = null
    notifyListeners()
  }

  function openUserProfile(userId: string) {
    state.showUserProfile = true
    state.selectedUser = userId
    notifyListeners()
  }

  function closeUserProfile() {
    state.showUserProfile = false
    state.selectedUser = null
    notifyListeners()
  }

  function toggleSidebar(show?: boolean) {
    state.showSidebar = show !== undefined ? show : !state.showSidebar
    notifyListeners()
  }

  function showPermissions(show: boolean = true) {
    state.showPermissionsDialog = show
    notifyListeners()
  }

  function setDevelopersPage(isDevelopers: boolean) {
    state.isDevelopersPage = isDevelopers
    notifyListeners()
  }

  function getState(): Readonly<UIState> {
    return { ...state }
  }

  function subscribe(callback: () => void) {
    listeners.add(callback)
    return () => listeners.delete(callback)
  }

  return {
    openSettings,
    closeSettings,
    setSettingsTab,
    openGroupSettings,
    closeGroupSettings,
    openUserProfile,
    closeUserProfile,
    toggleSidebar,
    showPermissions,
    setDevelopersPage,
    getState,
    subscribe
  }
}

export type UIStateService = ReturnType<typeof createUIStateService>
