/**
 * DotGame.js - Client-side dot visualization component
 * A simple multiplayer dot visualization that can be controlled via WebSocket
 */
import { logDebug, getRandomColor } from './utils.js';

class DotGame {
  constructor(container, instanceId, userId, onLeaveCallback) {
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.socket = null;
    this.dots = new Map();
    this.userColor = getRandomColor();
    
    // Create UI components
    this.createUI();
    
    // Connect to WebSocket
    this.connectWebSocket();
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
  
  connectWebSocket() {
    // Connect to the WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.setStatus('Connected! Joining dot game...');
      
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
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.socket.onclose = () => {
      this.setStatus('Disconnected from dot game');
    };
    
    this.socket.onerror = (error) => {
      this.setStatus('Connection error');
      console.error('WebSocket error:', error);
    };
  }
  
  handleMessage(message) {
    try {
      switch (message.type) {
        case 'state_sync':
          // Sync existing dots
          if (message.state && message.state.positions) {
            for (const [participantId, position] of Object.entries(message.state.positions)) {
              this.updateDot(participantId, position.x, position.y, position.color);
            }
          }
          this.setStatus('Connected to dot game');
          break;
          
        case 'dot_update':
          // Update a dot position
          this.updateDot(
            message.userId,
            message.position.x,
            message.position.y,
            message.position.color
          );
          break;
          
        case 'user_joined':
          this.setStatus(`User joined! (${message.participantCount} total)`);
          break;
          
        case 'user_left':
          // Remove the dot for this user
          if (this.dots.has(message.userId)) {
            this.dotDisplay.removeChild(this.dots.get(message.userId));
            this.dots.delete(message.userId);
          }
          this.setStatus(`User left. (${message.participantCount} remaining)`);
          break;
      }
    } catch (error) {
      console.error('Error handling dot game message:', error);
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