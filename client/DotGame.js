/**
 * DotGame.js - Client-side dot visualization component
 * A simple multiplayer dot visualization that can be controlled via WebSocket
 */
import { logDebug, getRandomColor, checkWebSocketConnectivity, setupWebSocketLogging } from './utils.js';

class DotGame {
  constructor(container, instanceId, userId, onLeaveCallback) {
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.socket = null;
    this.dots = new Map();
    this.userColor = getRandomColor();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    
    // Create UI components
    this.createUI();
    
    // Test connectivity before attempting to connect
    this.checkConnectivityAndConnect();
    
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
  
  async checkConnectivityAndConnect() {
    // Get WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.setStatus('Testing WebSocket connectivity...');
    
    try {
      // First check connectivity
      await checkWebSocketConnectivity(wsUrl);
      // If we get here, connectivity test passed
      this.connectWebSocket();
    } catch (error) {
      logDebug(`WebSocket connectivity test failed: ${error.message}`, 'error');
      this.setStatus(`Cannot connect to game server. Check your network connection.`);
      
      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry Connection';
      retryButton.className = 'canvas-button';
      retryButton.style.marginTop = '10px';
      retryButton.addEventListener('click', () => {
        this.checkConnectivityAndConnect();
      });
      
      // Add to controls if it doesn't already have a retry button
      const controls = this.container.querySelector('.dot-game-controls');
      if (controls && !controls.querySelector('.retry-button')) {
        retryButton.classList.add('retry-button');
        controls.appendChild(retryButton);
      }
    }
  }
  
  connectWebSocket() {
    // Connect to the WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    logDebug(`Connecting to WebSocket at ${wsUrl}`);
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      // Set up enhanced logging
      setupWebSocketLogging(this.socket, 'DotGame: ');
      
      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('Connected! Joining dot game...');
        logDebug(`WebSocket connection established, joining room: ${this.instanceId}`);
        
        // Join the room with dotgame type
        this.socket.send(JSON.stringify({
          type: 'join_room',
          instanceId: this.instanceId,
          userId: this.userId,
          gameType: 'dotgame'
        }));
        
        // Also send our initial position
        this.sendPosition(Math.random() * 500, Math.random() * 300);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Log incoming message types for debugging
          logDebug(`Received message type: ${message.type}`);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          logDebug(`WebSocket message parse error: ${error.message}`, 'error');
        }
      };
      
      this.socket.onclose = (event) => {
        logDebug(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`, 'warning');
        this.setStatus(`Disconnected from dot game (Code: ${event.code})`);
        
        // Try to reconnect if not intentionally closed
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectAttempts * 1000;
          this.setStatus(`Connection lost. Reconnecting in ${delay/1000}s...`);
          logDebug(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
          
          setTimeout(() => {
            this.connectWebSocket();
          }, delay);
        }
      };
      
      this.socket.onerror = (error) => {
        const errorDetail = JSON.stringify(error);
        logDebug(`WebSocket error: ${errorDetail}`, 'error');
        this.setStatus(`Connection error. Check console for details.`);
        
        // Log more helpful information for debugging
        console.error('WebSocket error details:', {
          url: wsUrl,
          readyState: this.socket ? this.socket.readyState : 'socket not created',
          instance: this.instanceId,
          userId: this.userId
        });
      };
    } catch (error) {
      logDebug(`Failed to create WebSocket: ${error.message}`, 'error');
      this.setStatus(`Failed to create WebSocket connection: ${error.message}`);
    }
  }
  
  handleMessage(message) {
    try {
      switch (message.type) {
        case 'state_sync':
          // Sync existing dots
          logDebug(`Received state sync with ${message.state && message.state.positions ? Object.keys(message.state.positions).length : 0} positions`);
          if (message.state && message.state.positions) {
            for (const [participantId, position] of Object.entries(message.state.positions)) {
              logDebug(`Updating dot for participant: ${participantId}`);
              this.updateDot(participantId, position.x, position.y, position.color);
            }
          }
          this.setStatus('Connected to dot game');
          break;
          
        case 'dot_update':
          // Update a dot position
          logDebug(`Received dot update for user: ${message.userId}`);
          this.updateDot(
            message.userId,
            message.position.x,
            message.position.y,
            message.position.color
          );
          break;
          
        case 'user_joined':
          logDebug(`User joined: ${message.userId}, total: ${message.participantCount}`);
          this.setStatus(`User joined! (${message.participantCount} total)`);
          break;
          
        case 'user_left':
          // Remove the dot for this user
          logDebug(`User left: ${message.userId}, remaining: ${message.participantCount}`);
          if (this.dots.has(message.userId)) {
            this.dotDisplay.removeChild(this.dots.get(message.userId));
            this.dots.delete(message.userId);
          }
          this.setStatus(`User left. (${message.participantCount} remaining)`);
          break;
          
        case 'error':
          logDebug(`Server returned error: ${message.message}`, 'error');
          this.setStatus(`Server error: ${message.message}`);
          break;
          
        default:
          logDebug(`Unknown message type: ${message.type}`, 'warning');
      }
    } catch (error) {
      console.error('Error handling dot game message:', error);
      logDebug(`Error in handleMessage: ${error.message}`, 'error');
    }
  }
  
  handleDisplayClick(event) {
    const rect = this.dotDisplay.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Send new position to server
    this.sendPosition(x, y);
    
    // Also update locally
    this.updateDot(this.userId, x, y, this.userColor);
  }
  
  sendPosition(x, y) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'update_position',
        position: {
          x: x,
          y: y,
          color: this.userColor
        }
      }));
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
    // Close the WebSocket connection
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    
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