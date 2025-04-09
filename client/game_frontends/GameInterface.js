/**
 * GameInterface.js - Base interface for all client-side games
 * 
 * This provides a minimal interface that all games must implement
 * to be compatible with the Discord Activity framework.
 */
import { 
  getWebSocketChannel, 
  subscribeToChannel,
  publishToChannel,
  closeWebSocketConnection,
  joinGameRoom
} from '../utils-websocket.js';

class GameInterface {
  /**
   * @param {HTMLElement} container - DOM element to render the game in
   * @param {string} instanceId - Discord activity instance ID
   * @param {string} userId - Current user ID
   * @param {Function} onLeaveCallback - Function to call when user leaves the game
   */
  constructor(container, instanceId, userId, onLeaveCallback) {
    if (new.target === GameInterface) {
      throw new Error("GameInterface is abstract and cannot be instantiated directly");
    }
    
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.channel = null;
    this.isConnected = false;
    
    // Game-specific state should be initialized in subclasses
  }
  
  /**
   * Create the game UI elements
   */
  createUI() {
    throw new Error("Method 'createUI()' must be implemented by subclass");
  }
  
  /**
   * Connect to WebSocket channel
   */
  async connectWebSocket() {
    try {
      // Send join_room message to server
      const gameId = this.getGameId();
      joinGameRoom(this.instanceId, this.userId, gameId);
      
      // Get channel for game-specific messages
      const channelName = `${gameId}-${this.instanceId}`;
      this.channel = getWebSocketChannel(channelName);
      
      // Setup game-specific subscriptions
      await this.setupSubscriptions();
      
      // Send join message in the game channel
      this.sendJoinMessage();
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Set up WebSocket subscriptions for game events
   */
  async setupSubscriptions() {
    throw new Error("Method 'setupSubscriptions()' must be implemented by subclass");
  }
  
  /**
   * Return the unique ID for this game type
   */
  getGameId() {
    throw new Error("Method 'getGameId()' must be implemented by subclass");
  }
  
  /**
   * Send join message to the channel
   */
  sendJoinMessage() {
    if (!this.channel) return;
    
    publishToChannel(this.channel, 'user_joined', {
      userId: this.userId,
      timestamp: Date.now()
    });
    
    publishToChannel(this.channel, 'request_state', {
      userId: this.userId,
      timestamp: Date.now()
    });
  }
  
  /**
   * Send leave message to the channel
   */
  sendLeaveMessage() {
    if (this.channel && this.isConnected) {
      publishToChannel(this.channel, 'user_left', {
        userId: this.userId,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle player leaving the game
   */
  handleLeaveGame() {
    this.sendLeaveMessage();
    closeWebSocketConnection();
    
    if (this.onLeaveCallback) {
      this.onLeaveCallback();
    }
  }
  
  /**
   * Clean up resources when game is destroyed
   */
  destroy() {
    this.sendLeaveMessage();
    closeWebSocketConnection();
  }
}

export default GameInterface; 