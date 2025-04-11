/**
 * Discord authentication and SDK initialization
 */
import { DiscordSDK } from '@discord/embedded-app-sdk';

let discordSDK = null;

/**
 * Initialize Discord SDK
 * @param {string} clientId - Discord client ID
 * @returns {Promise<DiscordSDK>} Discord SDK instance
 */
export async function initializeSDK(clientId) {
  // Check if we've already initialized
  if (discordSDK) {
    return discordSDK;
  }
  
  // Initialize Discord SDK
  discordSDK = new DiscordSDK(clientId);
  await discordSDK.ready();
  
  return discordSDK;
}

/**
 * Authenticate with Discord
 * @param {string} clientId - Discord client ID
 * @returns {Promise<Object>} User data
 */
export async function authenticate(clientId) {
  try {
    // Initialize SDK
    const sdk = await initializeSDK(clientId);
    
    // Get authorization code
    const { code } = await sdk.commands.authorize({
      client_id: clientId,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify"],
    });
    
    // Exchange code for token with backend
    const response = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    
    if (!response.ok) {
      throw new Error('Failed to authenticate with Discord');
    }
    
    const { access_token } = await response.json();
    
    // Authenticate with Discord
    const auth = await sdk.commands.authenticate({ access_token });
    
    return {
      userId: auth.user.id,
      username: auth.user.username,
      user: auth.user
    };
  } catch (error) {
    console.error('Discord authentication error:', error);
    throw error;
  }
}

/**
 * Check if running in Discord activity
 * @returns {boolean} True if running in Discord activity
 */
export function isDiscordActivity() {
  return window.location.search.includes('activityId');
}

/**
 * Get parameters from URL
 * @returns {Object} URL parameters
 */
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    instanceId: params.get('instanceId') || "local-instance",
    activityId: params.get('activityId'),
    guildId: params.get('guildId'),
    channelId: params.get('channelId'),
  };
}

/**
 * Get Discord SDK instance
 * @returns {DiscordSDK|null} Discord SDK instance
 */
export function getSDK() {
  return discordSDK;
} 