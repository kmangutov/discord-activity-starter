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
    // --- DEBUG LOGGING --- 
    console.log(`DotGame [${this.instanceId}] onMessage received raw data for user ${socket.userId}:`, JSON.stringify(messageData));
    // --- END DEBUG LOGGING --- 

    // Check if it's a publish message from our channel system
    if (messageData.type === 'publish' && messageData.event && messageData.data) {
      const eventType = messageData.event;
      const payload = messageData.data; // This is the actual game data
      
      switch (eventType) {
        case 'position_update':
          const { position } = payload;
          if (position && typeof position.x === 'number' && typeof position.y === 'number') {
            // --- DEBUG LOGGING --- 
            console.log(`DotGame [${this.instanceId}]: Calling updatePosition for ${socket.userId} with:`, position);
            // --- END DEBUG LOGGING --- 
            this.updatePosition(socket.userId, position);
          } else {
            // --- DEBUG LOGGING --- 
            console.log(`DotGame [${this.instanceId}]: Invalid position data in position_update for ${socket.userId}:`, payload);
            // --- END DEBUG LOGGING --- 
          }
          break;
        
        case 'user_joined':
          // Log user join event received via publish
          console.log(`DotGame [${this.instanceId}]: Received user_joined event for ${payload.userId}`);
          // No immediate action needed here, state sync handled by onJoin
          break;
          
        case 'request_state':
          // Send the current state back to the requesting client
          console.log(`DotGame [${this.instanceId}]: Received request_state from ${payload.userId}`);
          if (socket.readyState === 1) { // Check if socket is open
            socket.send(JSON.stringify({
              type: 'publish',
              channel: `dotgame-${this.instanceId}`, // Target the correct channel
              event: 'state_sync', // Use a specific event for state sync
              data: { 
                positions: this.state.positions 
              }
            }));
          }
          break;
          
        default:
          console.log(`DotGame [${this.instanceId}]: Unknown event type in publish message: ${eventType}`);
      }
    } else {
      // Handle other message types if necessary, or log them
      console.log(`DotGame [${this.instanceId}]: Received non-publish message type: ${messageData.type}`);
    }
  }
  
  // Override onJoin to send the specific dot game state
  onJoin(socket, userId) {
    // Call the base onJoin if needed (optional, depends on base class logic)
    // super.onJoin(socket, userId); 
    
    console.log(`DotGame [${this.instanceId}]: Sending initial state to ${userId}`);
    // Send the current positions state to the new participant
    if (socket.readyState === 1) { // Check if socket is open
      socket.send(JSON.stringify({
        type: 'publish',
        channel: `dotgame-${this.instanceId}`, // Target the correct channel
        event: 'state_sync', 
        data: { 
          positions: this.state.positions // Send only the positions part of the state
        }
      }));
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
    // --- DEBUG LOGGING --- 
    console.log(`DotGame [${this.instanceId}]: Updating position for ${userId} to:`, position);
    // --- END DEBUG LOGGING --- 

    // Update the user's position
    this.state.positions[userId] = {
      x: position.x,
      y: position.y,
      color: position.color || getRandomColor()
    };
    
    this.state.lastUpdate = Date.now();
    
    // --- DEBUG LOGGING --- 
    console.log(`DotGame [${this.instanceId}]: State after update:`, this.state.positions);
    // --- END DEBUG LOGGING --- 

    // Broadcast the position update to all OTHER participants
    const broadcastMessage = {
      type: 'publish', // Ensure we use the correct structure for the client
      channel: `dotgame-${this.instanceId}`,
      event: 'dot_update', // Use the event the client expects
      data: {
        userId: userId,
        position: this.state.positions[userId]
      }
    };
    // --- DEBUG LOGGING --- 
    console.log(`DotGame [${this.instanceId}]: Broadcasting dot_update:`, JSON.stringify(broadcastMessage));
    // --- END DEBUG LOGGING --- 
    
    // Find the socket that triggered this update to exclude it from broadcast
    const triggeringSocket = Array.from(this.participants).find(p => p.userId === userId);

    this.broadcast(broadcastMessage, triggeringSocket);
  }
}

export { DotGame }; 