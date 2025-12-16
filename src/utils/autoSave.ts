import type { ProjectData } from '../types/ProjectFormat'

const AUTOSAVE_KEY = 'endless-tiles-autosave'
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

/**
 * Save project data to localStorage with size checking
 */
export function saveToLocalStorage(projectData: ProjectData): boolean {
  try {
    const jsonString = JSON.stringify(projectData)
    const sizeBytes = new Blob([jsonString]).size

    // Check size limit
    if (sizeBytes > MAX_SIZE_BYTES) {
      console.warn(`Project size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds ${MAX_SIZE_MB}MB limit`)
      return false
    }

    localStorage.setItem(AUTOSAVE_KEY, jsonString)
    return true
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded')
      return false
    }
    console.error('Failed to save to localStorage:', error)
    return false
  }
}

/**
 * Load project data from localStorage
 */
export function loadFromLocalStorage(): ProjectData | null {
  try {
    const jsonString = localStorage.getItem(AUTOSAVE_KEY)
    if (!jsonString) return null

    return JSON.parse(jsonString) as ProjectData
  } catch (error) {
    console.error('Failed to load from localStorage:', error)
    return null
  }
}

/**
 * Check if autosave exists
 */
export function hasAutosave(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null
}

/**
 * Clear autosave data
 */
export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY)
}

/**
 * Get total localStorage usage
 */
export function getLocalStorageSize(): number {
  let total = 0
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length
    }
  }
  return total
}
