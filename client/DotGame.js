/**
 * DotGame.js - Client-side dot visualization component
 * A simple multiplayer dot visualization using Ably for real-time communication
 */
import { 
  logDebug, 
  getRandomColor, 
  getAblyChannel, 
  subscribeToChannel, 
  publishToChannel, 
  closeAblyConnection 
} from './utils.js';

class DotGame {
  constructor(container, instanceId, userId, onLeaveCallback) {
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.channel = null;
    this.dots = new Map();
    this.userColor = getRandomColor();
    this.isConnected = false;
    
    // Create UI components
    this.createUI();
    
    // Connect to Ably and setup the channel
    this.connectAbly();
    
    // Log important game initialization info
    logDebug(`DotGame initialized for user: ${userId} in instance: ${instanceId}`);
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
    this.container.querySelector('#leave-dot-game').addEventListener('click', this.handleLeaveGame.bind(this));
    
    // Handle click on the dot display to move your dot
    this.dotDisplay.addEventListener('click', this.handleDisplayClick.bind(this));
    
    // Set initial status
    this.setStatus('Connecting to dot game...');
  }
  
  async connectAbly() {
    try {
      this.setStatus('Connecting to Ably...');
      
      // Create channel name from instanceId to group users in same Discord activity
      const channelName = `dotgame-${this.instanceId}`;
      this.channel = getAblyChannel(channelName);
      
      // Subscribe to various event types
      await this.setupSubscriptions();
      
      // Announce joining and request current state
      this.sendJoinMessage();
      
      // Send initial position
      this.sendPosition(Math.random() * 500, Math.random() * 300);
      
      this.isConnected = true;
      this.setStatus('Connected to dot game');
    } catch (error) {
      logDebug(`Failed to connect to Ably: ${error.message}`, 'error');
      this.setStatus(`Connection error: ${error.message}`);
      this.showRetryButton();
    }
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
    const rect = this.dotDisplay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Send new position via Ably
    this.sendPosition(x, y);
  }
  
  showRetryButton() {
    // Add retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Retry Connection';
    retryButton.className = 'canvas-button retry-button';
    retryButton.style.marginTop = '10px';
    retryButton.addEventListener('click', () => {
      this.connectAbly();
    });
    
    // Add to controls if it doesn't already have a retry button
    const controls = this.container.querySelector('.dot-game-controls');
    if (controls && !controls.querySelector('.retry-button')) {
      controls.appendChild(retryButton);
    }
  }
  
  updateDot(participantId, x, y, color) {
    let dot;
    
    if (this.dots.has(participantId)) {
      // Update existing dot
      dot = this.dots.get(participantId);
    } else {
      // Create new dot
      dot = document.createElement('div');
      dot.className = 'user-dot';
      dot.style.position = 'absolute';
      dot.style.width = '20px';
      dot.style.height = '20px';
      dot.style.borderRadius = '50%';
      dot.style.transition = 'all 0.3s ease';
      
      // Add username tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'dot-tooltip';
      tooltip.textContent = participantId;
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '25px';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '3px 8px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '12px';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.style.opacity = '0';
      tooltip.style.transition = 'opacity 0.2s';
      
      dot.appendChild(tooltip);
      
      // Show tooltip on hover
      dot.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
      });
      
      dot.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
      
      this.dotDisplay.appendChild(dot);
      this.dots.set(participantId, dot);
    }
    
    // Update position and color
    dot.style.backgroundColor = color || '#00ff00';
    dot.style.left = `${x - 10}px`; // Center the dot
    dot.style.top = `${y - 10}px`;
    
    // Highlight if it's the current user
    if (participantId === this.userId) {
      dot.style.border = '2px solid white';
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
  
  setStatus(message) {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = message;
    }
  }
  
  destroy() {
    // Send leave message and disconnect
    this.sendLeaveMessage();
    
    // Close Ably connection
    closeAblyConnection();
    
    // Remove event listeners
    if (this.dotDisplay) {
      this.dotDisplay.removeEventListener('click', this.handleDisplayClick);
    }
    
    const leaveButton = this.container.querySelector('#leave-dot-game');
    if (leaveButton) {
      leaveButton.removeEventListener('click', this.handleLeaveGame);
    }
  }
}

export default DotGame; 