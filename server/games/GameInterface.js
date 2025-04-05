/**
 * GameInterface.js - Base interface for all server-side games
 * 
 * This provides a minimal interface that all game implementations
 * must extend to be compatible with the Discord Activity framework.
 */

import { Room } from '../rooms.js';

class GameInterface extends Room {
  /**
   * Static properties that must be implemented by subclasses
   */
  static id = 'base'; // Must be overridden
  static name = 'Base Game'; // Must be overridden
  static description = 'Base game implementation'; // Must be overridden
  static minPlayers = 1;
  static maxPlayers = 10;
  static thumbnail = '/thumbnails/default.png';
  
  /**
   * @param {string} instanceId - Discord activity instance ID
   * @param {string} activityId - Discord Activity ID (optional)
   */
  constructor(instanceId, activityId = null) {
    super(instanceId);
    
    this.activityId = activityId;
    
    // Initialize with basic state tracking
    this.state = {
      lastUpdate: Date.now()
    };
    
    // Additional game-specific state should be initialized in subclasses
  }

  /**
   * Get the game ID for registration
   * @returns {string} Unique ID for this game
   */
  static getGameId() {
    throw new Error("Static method 'getGameId()' must be implemented by subclass");
  }
  
  /**
   * Get the game display name
   * @returns {string} Human-readable name for the game
   */
  static getDisplayName() {
    throw new Error("Static method 'getDisplayName()' must be implemented by subclass");
  }
  
  /**
   * Get the game description
   * @returns {string} Description of the game
   */
  static getDescription() {
    throw new Error("Static method 'getDescription()' must be implemented by subclass");
  }
  
  /**
   * Handle a new participant joining the game
   * @param {WebSocket} socket - WebSocket connection
   * @param {string} userId - User ID of the joining participant
   */
  onJoin(socket, userId) {
    // Send current state to the new participant
    socket.send(JSON.stringify({
      type: 'state_sync',
      state: this.state
    }));
  }

  /**
   * Handle incoming messages from participants
   * @param {WebSocket} socket - WebSocket connection
   * @param {Object} messageData - Message data
   */
  onMessage(socket, messageData) {
    // Should be implemented by subclasses
    console.log(`${this.constructor.name}: Received message`, messageData);
  }

  /**
   * Handle a participant leaving the game
   * @param {WebSocket} socket - WebSocket connection
   * @param {string} userId - User ID of the leaving participant
   */
  onLeave(socket, userId) {
    // Basic implementation, should be extended by subclasses if needed
    console.log(`${this.constructor.name}: User ${userId} left`);
  }
}

export { GameInterface }; 