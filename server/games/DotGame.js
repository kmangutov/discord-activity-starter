/**
 * DotGame.js - Simple multiplayer dot visualization
 * Shows a colored dot for each participant that can be moved around
 */

import { GameInterface } from './GameInterface.js';
import { getRandomColor } from '../utils.js';

class DotGame extends GameInterface {
  // Static properties for game registry
  static id = 'dotgame';
  static name = 'Dot Game';
  static description = 'Simple multiplayer dot visualization';
  static minPlayers = 1;
  static maxPlayers = 10;
  static thumbnail = '/thumbnails/dotgame.png';
  
  constructor(instanceId, activityId = null) {
    super(instanceId, activityId);
    
    // Initialize state with positions map
    this.state = {
      ...this.state,  // Include base state from GameInterface
      positions: {},  // Map of userId -> {x, y, color}
    };
    
    console.log(`DotGame instance created: ${instanceId}, activity: ${activityId || 'none'}`);
  }
  
  onMessage(socket, messageData) {
    const { type, position } = messageData;
    
    switch (type) {
      case 'update_position':
        if (position && typeof position.x === 'number' && typeof position.y === 'number') {
          this.updatePosition(socket.userId, position);
        }
        break;
      
      default:
        console.log(`DotGame: Unknown message type: ${type}`);
    }
  }
  
  onLeave(socket, userId) {
    // Remove the user's position from the state
    if (this.state.positions[userId]) {
      delete this.state.positions[userId];
      this.state.lastUpdate = Date.now();
    }
  }
  
  updatePosition(userId, position) {
    // Update the user's position
    this.state.positions[userId] = {
      x: position.x,
      y: position.y,
      color: position.color || getRandomColor()
    };
    
    this.state.lastUpdate = Date.now();
    
    // Broadcast the position update to all participants
    this.broadcast({
      type: 'dot_update',
      userId: userId,
      position: this.state.positions[userId]
    });
  }
}

export { DotGame }; 