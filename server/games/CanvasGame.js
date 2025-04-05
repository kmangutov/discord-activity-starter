/**
 * Example game implementation with a simple shared canvas
 */

import { GameInterface } from './GameInterface.js';
import { getRandomColor } from '../utils.js';

/**
 * CanvasGame extends the base GameInterface with canvas-specific functionality
 */
class CanvasGame extends GameInterface {
  // Static properties for game registry
  static id = 'canvas';
  static name = 'Canvas Game';
  static description = 'A collaborative drawing canvas';
  static minPlayers = 1;
  static maxPlayers = 8;
  static thumbnail = '/thumbnails/canvas.png';
  
  constructor(instanceId, activityId = null) {
    super(instanceId, activityId);
    
    // Initialize with empty state for the canvas
    this.state = {
      ...this.state,
      circles: [], // Array of {x, y, color, radius, userId}
    };
    
    console.log(`CanvasGame instance created: ${instanceId}, activity: ${activityId || 'none'}`);
  }

  onMessage(socket, messageData) {
    const { type, payload } = messageData;
    
    switch (type) {
      case 'add_circle':
        this.addCircle(socket.userId, payload);
        break;
      
      case 'clear_canvas':
        this.clearCanvas(socket.userId);
        break;
      
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }

  addCircle(userId, circleData) {
    const { x, y, color, radius } = circleData;
    
    // Validate the input
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }
    
    // Create the circle with attribution to the user
    const circle = {
      x,
      y,
      color: color || getRandomColor(),
      radius: radius || 20,
      userId,
      timestamp: Date.now()
    };
    
    // Add to state
    this.state.circles.push(circle);
    this.state.lastUpdate = Date.now();
    
    // Broadcast to all participants
    this.broadcast({
      type: 'circle_added',
      circle
    });
  }

  clearCanvas(userId) {
    // Clear the canvas
    this.state.circles = [];
    this.state.lastUpdate = Date.now();
    
    // Broadcast to all participants
    this.broadcast({
      type: 'canvas_cleared',
      clearedBy: userId,
      timestamp: this.state.lastUpdate
    });
  }
}

export { CanvasGame }; 