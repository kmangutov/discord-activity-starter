/**
 * Utility functions
 */

/**
 * Generate a random user ID for local testing
 * @returns Random user ID
 */
export function generateUserId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Store value in session storage
 * @param key - Storage key
 * @param value - Value to store
 */
export function setSessionItem<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error setting session item:', error);
  }
}

/**
 * Get value from session storage
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Stored value or default
 */
export function getSessionItem<T>(key: string, defaultValue: T | null = null): T | null {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error getting session item:', error);
    return defaultValue;
  }
}

/**
 * Get stored user ID or generate a new one
 * @returns User ID
 */
export function getOrCreateLocalUserId(): string {
  let userId = getSessionItem<string>('local_user_id');
  
  if (!userId) {
    userId = generateUserId();
    setSessionItem('local_user_id', userId);
  }
  
  return userId;
} 