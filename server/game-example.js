/**
 * Example game implementation with a simple shared canvas
 */

import { Room } from './rooms.js';

/**
 * CanvasGame extends the base Room with canvas-specific functionality
 */
class CanvasGame extends Room {
  constructor(instanceId) {
    super(instanceId);
    // Initialize with empty state for the canvas
    this.state = {
      circles: [], // Array of {x, y, color, radius, userId}
      lastUpdate: Date.now()
    };
  }

  onJoin(socket, userId) {
    // Send the current state to the new participant
    socket.send(JSON.stringify({
      type: 'state_sync',
      state: this.state
    }));
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

  onLeave(socket, userId) {
    // Optional: We could mark this user's circles as "orphaned"
    // or give them a different appearance
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
      color: color || this.getRandomColor(),
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

export { CanvasGame }; 