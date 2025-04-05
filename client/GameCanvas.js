/**
 * GameCanvas.js - Client-side canvas component
 * A simple collaborative canvas that can be controlled via Ably for real-time communication
 */
import { 
  logDebug, 
  getRandomColor, 
  getAblyChannel, 
  subscribeToChannel, 
  publishToChannel, 
  closeAblyConnection,
  reconnectAbly as reconnectAblyUtil
} from './utils.js';

class GameCanvas {
  constructor(container, instanceId, userId, onLeaveCallback) {
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.channel = null;
    this.circles = [];
    this.isConnected = false;
    
    // Create UI components
    this.createUI();
    
    // Connect to Ably
    this.connectAbly();
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
    leaveButton.addEventListener('click', this.handleLeaveGame.bind(this));
    toolbar.appendChild(leaveButton);
    
    this.container.appendChild(toolbar);
    
    // Status message area
    this.statusArea = document.createElement('div');
    this.statusArea.className = 'status-area';
    this.container.appendChild(this.statusArea);
    
    this.setStatus('Initializing canvas...');
  }
  
  async connectAbly() {
    try {
      this.setStatus('Connecting to Ably...');
      
      // Create channel name from instanceId to group users in same Discord activity
      const channelName = `canvas-${this.instanceId}`;
      this.channel = getAblyChannel(channelName);
      
      // Subscribe to various event types
      await this.setupSubscriptions();
      
      // Announce joining and request current state
      this.sendJoinMessage();
      
      this.isConnected = true;
      this.setStatus('Connected to canvas game');
    } catch (error) {
      logDebug(`Failed to connect to Ably: ${error.message}`, 'error');
      this.setStatus(`Connection error: ${error.message}`);
      this.showRetryButton();
      
      // Auto-retry once after 5 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          logDebug('Auto-retrying Ably connection...', 'info');
          this.reconnectAbly();
        }
      }, 5000);
    }
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
  
  sendJoinMessage() {
    publishToChannel(this.channel, 'user_joined', {
      userId: this.userId,
      timestamp: Date.now()
    });
    
    // Request current state from other users
    publishToChannel(this.channel, 'request_state', {
      userId: this.userId,
      timestamp: Date.now()
    });
  }
  
  sendLeaveMessage() {
    if (this.channel && this.isConnected) {
      publishToChannel(this.channel, 'user_left', {
        userId: this.userId,
        timestamp: Date.now()
      });
    }
  }
  
  handleCanvasClick(event) {
    if (!this.channel || !this.isConnected) return;
    
    // Get the click coordinates relative to the canvas
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create a new circle
    const newCircle = {
      x,
      y,
      radius: 20,
      color: getRandomColor(),
      userId: this.userId,
      timestamp: Date.now()
    };
    
    // Add locally first for instant feedback
    this.circles.push(newCircle);
    this.drawCanvas();
    
    // Send the circle to all other clients
    publishToChannel(this.channel, 'circle_added', newCircle);
  }
  
  handleClearCanvas() {
    if (!this.channel || !this.isConnected) return;
    
    // Clear locally first
    this.circles = [];
    this.drawCanvas();
    
    // Send clear command to all clients
    publishToChannel(this.channel, 'canvas_cleared', {
      clearedBy: this.userId,
      timestamp: Date.now()
    });
  }
  
  showRetryButton() {
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Connection';
    retryButton.className = 'canvas-button retry-button';
    retryButton.style.marginTop = '10px';
    retryButton.addEventListener('click', () => {
      retryButton.textContent = 'Reconnecting...';
      retryButton.disabled = true;
      this.reconnectAbly();
      
      // Re-enable button after a delay
      setTimeout(() => {
        retryButton.textContent = 'Retry Connection';
        retryButton.disabled = false;
      }, 3000);
    });
    
    // Add to toolbar if it doesn't already have a retry button
    const toolbar = this.container.querySelector('.canvas-toolbar');
    if (toolbar && !toolbar.querySelector('.retry-button')) {
      toolbar.appendChild(retryButton);
    }
  }
  
  reconnectAbly() {
    this.setStatus('Attempting to reconnect...');
    
    try {
      // Use the imported reconnectAbly from utils.js
      reconnectAblyUtil();
      
      // Try to reconnect with a new channel
      setTimeout(() => this.connectAbly(), 1000);
    } catch (error) {
      logDebug(`Error during reconnection: ${error.message}`, 'error');
      this.setStatus(`Reconnection failed: ${error.message}`);
    }
  }
  
  handleLeaveGame() {
    // Send leave message
    this.sendLeaveMessage();
    
    // Disconnect from Ably
    closeAblyConnection();
    
    // Call the callback to return to the lobby
    if (this.onLeaveCallback) {
      this.onLeaveCallback();
    }
  }
  
  drawCanvas() {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw all circles
    for (const circle of this.circles) {
      this.ctx.beginPath();
      this.ctx.arc(circle.x, circle.y, circle.radius || 20, 0, 2 * Math.PI);
      this.ctx.fillStyle = circle.color || '#FF5733';
      this.ctx.fill();
      
      // Add a stroke if this circle belongs to the current user
      if (circle.userId === this.userId) {
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }
  }
  
  setStatus(message) {
    this.statusArea.textContent = message;
  }
  
  // Clean up when the component is destroyed
  destroy() {
    // Send leave message
    this.sendLeaveMessage();
    
    // Close Ably connection
    closeAblyConnection();
    
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.handleCanvasClick);
    }
  }
}

export default GameCanvas; 