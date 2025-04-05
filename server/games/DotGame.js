/**
 * DotGame.js - Simple multiplayer dot visualization
 * Shows a colored dot for each participant that can be moved around
 */

import { Room } from '../rooms.js';

class DotGame extends Room {
  constructor(instanceId) {
    super(instanceId);
    
    // Initialize state with positions map
    this.state = {
      positions: {}, // Map of userId -> {x, y, color}
      lastUpdate: Date.now()
    };
  }
  
  onJoin(socket, userId) {
    // Send current state to the new participant
    socket.send(JSON.stringify({
      type: 'state_sync',
      state: this.state
    }));
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
      color: position.color || this.getRandomColor()
    };
    
    this.state.lastUpdate = Date.now();
    
    // Broadcast the position update to all participants
    this.broadcast({
      type: 'dot_update',
      userId: userId,
      position: this.state.positions[userId]
    });
  }
  
  getRandomColor() {
    const colors = [
      '#FF5733', // Red
      '#33FF57', // Green
      '#3357FF', // Blue
      '#FF33F5', // Pink
      '#F5FF33', // Yellow
      '#33FFF5'  // Cyan
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export { DotGame }; 