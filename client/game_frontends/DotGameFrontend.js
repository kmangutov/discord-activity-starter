/**
 * DotGame.js - Client-side dot visualization component
 * A simple multiplayer dot visualization using WebSockets for real-time communication
 */
import GameInterface from './GameInterface.js';
import { 
  logDebug, 
  getRandomColor, 
  subscribeToChannel, 
  publishToChannel 
} from '../utils-websocket.js';

class DotGameFrontend extends GameInterface {
  constructor(container, instanceId, userId, onLeaveCallback) {
    super(container, instanceId, userId, onLeaveCallback);
    
    this.dots = new Map();
    this.userColor = getRandomColor();
    
    // Create UI components
    this.createUI();
    
    // Connect to WebSocket and setup the channel
    this.connectWebSocket();
    
    // Log important game initialization info
    logDebug(`DotGame initialized for user: ${userId} in instance: ${instanceId}`);
  }
  
  /**
   * Return the unique game ID
   */
  getGameId() {
    return 'dotgame';
  }
  
  createUI() {
    // Clear the container
    this.container.innerHTML = '';
    
    // Create game elements
    this.container.innerHTML = `
      <div class="dot-game">
        <div class="dot-game-display"></div>
        <div class="dot-game-controls">
          <button id="leave-dot-game" class="canvas-button leave-button">Leave Game</button>
        </div>
        <div class="dot-game-status"></div>
      </div>
    `;
    
    this.dotDisplay = this.container.querySelector('.dot-game-display');
    this.statusDisplay = this.container.querySelector('.dot-game-status');
    
    // Styling for the dot display
    this.dotDisplay.style.width = '600px';
    this.dotDisplay.style.height = '400px';
    this.dotDisplay.style.backgroundColor = '#333';
    this.dotDisplay.style.position = 'relative';
    this.dotDisplay.style.borderRadius = '8px';
    this.dotDisplay.style.margin = '0 auto';
    
    // Add leave button functionality
    this.container.querySelector('#leave-dot-game').addEventListener('click', () => this.handleLeaveGame());
    
    // Handle click on the dot display to move your dot
    this.dotDisplay.addEventListener('click', this.handleDisplayClick.bind(this));
    
    // Set initial status
    this.setStatus('Connecting to dot game...');
  }
  
  async setupSubscriptions() {
    if (!this.channel) return;
    
    // Handle position updates from other users
    await subscribeToChannel(this.channel, 'position_update', (message) => {
      const data = message.data;
      if (data.userId !== this.userId) { // Don't update our own dot twice
        this.updateDot(
          data.userId,
          data.position.x,
          data.position.y, 
          data.position.color
        );
      }
    });
    
    // Handle user join events
    await subscribeToChannel(this.channel, 'user_joined', (message) => {
      const data = message.data;
      logDebug(`User joined: ${data.userId}`);
      this.setStatus(`User joined: ${data.userId}`);
      
      // If we receive our own join message back, ignore it
      if (data.userId === this.userId) return;
      
      // If this is a new user joining, send our current position to them
      this.sendPosition(
        this.dots.has(this.userId) 
          ? parseFloat(this.dots.get(this.userId).style.left) + 10 // Adjust for centering
          : Math.random() * 500,
        this.dots.has(this.userId)
          ? parseFloat(this.dots.get(this.userId).style.top) + 10 // Adjust for centering
          : Math.random() * 300
      );
    });
    
    // Handle user leave events
    await subscribeToChannel(this.channel, 'user_left', (message) => {
      const data = message.data;
      logDebug(`User left: ${data.userId}`);
      this.setStatus(`User left: ${data.userId}`);
      
      // Remove the dot for this user
      if (this.dots.has(data.userId)) {
        this.dotDisplay.removeChild(this.dots.get(data.userId));
        this.dots.delete(data.userId);
      }
    });
    
    // Handle state sync requests
    await subscribeToChannel(this.channel, 'request_state', (message) => {
      const data = message.data;
      
      // Only respond if we have our position and it's not our own request
      if (data.userId !== this.userId && this.dots.has(this.userId)) {
        const dot = this.dots.get(this.userId);
        const x = parseFloat(dot.style.left) + 10; // Adjust for centering
        const y = parseFloat(dot.style.top) + 10;  // Adjust for centering
        
        this.sendPosition(x, y);
      }
    });
  }
  
  sendPosition(x, y) {
    if (!this.channel || !this.isConnected) return;
    
    publishToChannel(this.channel, 'position_update', {
      userId: this.userId,
      position: {
        x: x,
        y: y,
        color: this.userColor
      },
      timestamp: Date.now()
    });
    
    // Also update locally
    this.updateDot(this.userId, x, y, this.userColor);
  }
  
  handleDisplayClick(event) {
    // Don't process if not connected
    if (!this.isConnected) {
      this.setStatus('Not connected - cannot move dot');
      return;
    }
    
    // Get click coordinates relative to the display
    const rect = this.dotDisplay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Send the position update
    this.sendPosition(x, y);
  }
  
  updateDot(participantId, x, y, color) {
    let dot = this.dots.get(participantId);
    
    // Create dot if it doesn't exist
    if (!dot) {
      dot = document.createElement('div');
      dot.className = 'user-dot';
      dot.style.position = 'absolute';
      dot.style.width = '20px';
      dot.style.height = '20px';
      dot.style.borderRadius = '50%';
      dot.style.transition = 'left 0.3s, top 0.3s';
      
      // Add a hover tooltip with participant ID
      dot.title = `User: ${participantId}`;
      
      // Highlight current user's dot
      if (participantId === this.userId) {
        dot.style.border = '2px solid white';
        dot.style.boxShadow = '0 0 10px white';
        
        // Also add an indicator telling this is you
        const indicator = document.createElement('div');
        indicator.textContent = 'YOU';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '-20px';
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.color = 'white';
        indicator.style.fontSize = '10px';
        indicator.style.fontWeight = 'bold';
        dot.appendChild(indicator);
      }
      
      this.dotDisplay.appendChild(dot);
      this.dots.set(participantId, dot);
    }
    
    // Update the dot's position and color
    dot.style.backgroundColor = color || getRandomColor();
    dot.style.left = `${x - 10}px`; // Adjust for dot size to center on cursor
    dot.style.top = `${y - 10}px`;  // Adjust for dot size to center on cursor
  }
  
  setStatus(message) {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = message;
    }
  }
  
  destroy() {
    // Remove all dots
    for (const dot of this.dots.values()) {
      if (dot.parentNode) {
        dot.parentNode.removeChild(dot);
      }
    }
    
    this.dots.clear();
    
    // Call parent destroy method to handle WebSocket cleanups
    super.destroy();
  }
}

export default DotGameFrontend; 