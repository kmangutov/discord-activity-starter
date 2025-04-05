/**
 * CanvasGameFrontend.js - Client-side canvas component
 * A simple collaborative canvas that can be controlled via WebSockets for real-time communication
 */
import GameInterface from './GameInterface.js';
import { 
  logDebug, 
  getRandomColor, 
  subscribeToChannel, 
  publishToChannel,
  reconnectWebSocket
} from '../utils-websocket.js';

class CanvasGameFrontend extends GameInterface {
  constructor(container, instanceId, userId, onLeaveCallback) {
    super(container, instanceId, userId, onLeaveCallback);
    
    this.circles = [];
    
    // Create UI components
    this.createUI();
    
    // Connect to WebSocket
    this.connectWebSocket();
    
    // Log important initialization info
    logDebug(`CanvasGame initialized for user: ${userId} in instance: ${instanceId}`);
  }
  
  /**
   * Return the unique game ID
   */
  getGameId() {
    return 'canvas';
  }
  
  createUI() {
    // Clear the container
    this.container.innerHTML = '';
    
    // Create the canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.canvas.className = 'game-canvas';
    this.container.appendChild(this.canvas);
    
    // Get the drawing context
    this.ctx = this.canvas.getContext('2d');
    
    // Add event listener for adding circles
    this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
    
    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'canvas-toolbar';
    
    // Clear button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Canvas';
    clearButton.className = 'canvas-button';
    clearButton.addEventListener('click', this.handleClearCanvas.bind(this));
    toolbar.appendChild(clearButton);
    
    // Leave button
    const leaveButton = document.createElement('button');
    leaveButton.textContent = 'Leave Game';
    leaveButton.className = 'canvas-button leave-button';
    leaveButton.addEventListener('click', () => this.handleLeaveGame());
    toolbar.appendChild(leaveButton);
    
    this.container.appendChild(toolbar);
    
    // Status message area
    this.statusArea = document.createElement('div');
    this.statusArea.className = 'status-area';
    this.container.appendChild(this.statusArea);
    
    this.setStatus('Initializing canvas...');
  }
  
  async setupSubscriptions() {
    if (!this.channel) return;
    
    // Handle state sync (initial state)
    await subscribeToChannel(this.channel, 'state_sync', (message) => {
      const data = message.data;
      this.circles = data.circles || [];
      this.drawCanvas();
      this.setStatus(`Connected with ${this.circles.length} circles`);
    });
    
    // Handle new circles being added
    await subscribeToChannel(this.channel, 'circle_added', (message) => {
      const circle = message.data;
      this.circles.push(circle);
      this.drawCanvas();
    });
    
    // Handle canvas clearing
    await subscribeToChannel(this.channel, 'canvas_cleared', (message) => {
      const data = message.data;
      this.circles = [];
      this.drawCanvas();
      this.setStatus(`Canvas cleared by user ${data.clearedBy}`);
    });
    
    // Handle user join events
    await subscribeToChannel(this.channel, 'user_joined', (message) => {
      const data = message.data;
      logDebug(`User joined canvas: ${data.userId}`);
      this.setStatus(`User joined!`);
      
      // If someone else joined and we have state, send it to them
      if (data.userId !== this.userId && this.isConnected) {
        publishToChannel(this.channel, 'state_sync', {
          circles: this.circles,
          syncedBy: this.userId
        });
      }
    });
    
    // Handle user leave events
    await subscribeToChannel(this.channel, 'user_left', (message) => {
      const data = message.data;
      logDebug(`User left canvas: ${data.userId}`);
      this.setStatus(`User left: ${data.userId}`);
    });
    
    // Handle state requests
    await subscribeToChannel(this.channel, 'request_state', (message) => {
      const data = message.data;
      
      // Only respond if it's not our own request
      if (data.userId !== this.userId) {
        publishToChannel(this.channel, 'state_sync', {
          circles: this.circles,
          syncedBy: this.userId
        });
      }
    });
  }
  
  handleCanvasClick(event) {
    if (!this.channel || !this.isConnected) return;
    
    // Get the click coordinates relative to the canvas
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create a new circle
    const circle = {
      x: x,
      y: y,
      radius: 20 + Math.random() * 20,
      color: getRandomColor()
    };
    
    // Send the circle to the server
    publishToChannel(this.channel, 'add_circle', circle);
  }
  
  handleClearCanvas() {
    if (!this.channel || !this.isConnected) return;
    
    // Send clear command
    publishToChannel(this.channel, 'clear_canvas', {
      clearedBy: this.userId,
      timestamp: Date.now()
    });
  }
  
  drawCanvas() {
    if (!this.ctx) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw all circles
    for (const circle of this.circles) {
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = circle.color;
      this.ctx.fill();
      this.ctx.closePath();
    }
  }
  
  setStatus(message) {
    if (this.statusArea) {
      this.statusArea.textContent = message;
    }
  }
  
  destroy() {
    // Clear canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Call parent destroy method to handle WebSocket cleanups
    super.destroy();
  }
}

export default CanvasGameFrontend; 