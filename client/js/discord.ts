/**
 * Discord authentication and SDK initialization
 */
import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';
import * as ui from './ui.js';

// Define types for Discord user
interface DiscordUser {
  id: string;
  username: string;
  [key: string]: any; // For other user properties
}

// Define authentication result type
interface AuthResult {
  userId: string;
  username: string;
  user: DiscordUser;
}

// Define URL params type
interface UrlParams {
  instanceId: string;
  activityId: string | null;
  guildId: string | null;
  channelId: string | null;
}

let discordSDK: DiscordSDK | null = null;

/**
 * Initialize Discord SDK
 * @param clientId - Discord client ID
 * @returns Discord SDK instance
 */
export async function initializeSDK(clientId: string): Promise<DiscordSDK> {
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
 * @param clientId - Discord client ID
 * @returns User data
 */
export async function authenticate(clientId: string): Promise<AuthResult> {
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
 * @returns True if running in Discord activity
 */
export function isDiscordActivity(): boolean {
  return window.location.search.includes('activityId');
}

/**
 * Get parameters from URL
 * @returns URL parameters
 */
export function getUrlParams(): UrlParams {
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
 * @returns Discord SDK instance
 */
export function getSDK(): DiscordSDK | null {
  return discordSDK;
}

/**
 * Initialize URL mappings for Discord proxy
 */
export function initDiscordProxy(): void {
  // Only patch in Discord environment
  if (isDiscordActivity()) {
    ui.displayDebugMessage('Initializing Discord URL mappings', { host: window.location.host });
    
    try {
      // Get server host from env or fallback to default
      const serverHost = import.meta.env.VITE_API_HOST || 'railway-production-ff97.up.railway.app';
      
      // Patch all URLs to use Discord's proxy
      patchUrlMappings([
        // WebSocket endpoint
        { prefix: '/ws', target: serverHost },
        // API endpoints
        { prefix: '/api', target: serverHost }
      ]);
      
      ui.displayDebugMessage('Discord URL mappings initialized', {
        mappings: [
          { prefix: '/ws', target: serverHost },
          { prefix: '/api', target: serverHost }
        ]
      });
    } catch (error) {
      console.error('Failed to initialize Discord URL mappings:', error);
      ui.displayDebugMessage('ERROR: Failed to initialize Discord proxy', error);
    }
  }
} 