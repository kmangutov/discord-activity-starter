/**
 * GameCanvas.js - Client-side canvas component
 * A simple collaborative canvas that can be controlled via WebSocket
 */

class GameCanvas {
  constructor(container, instanceId, userId, onLeaveCallback) {
    this.container = container;
    this.instanceId = instanceId;
    this.userId = userId;
    this.onLeaveCallback = onLeaveCallback;
    this.socket = null;
    this.circles = [];
    
    // Create UI components
    this.createUI();
    
    // Connect to WebSocket
    this.connectWebSocket();
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
    
    this.setStatus('Connecting to game...');
  }
  
  connectWebSocket() {
    // Connect to the WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.socket = new WebSocket(wsUrl);
    
    this.socket.onopen = () => {
      this.setStatus('Connected! Joining game...');
      
      // Join the room
      this.socket.send(JSON.stringify({
        type: 'join_room',
        instanceId: this.instanceId,
        userId: this.userId,
        gameType: 'canvas'
      }));
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
      this.setStatus('Disconnected from game');
    };
    
    this.socket.onerror = (error) => {
      this.setStatus('Connection error');
      console.error('WebSocket error:', error);
    };
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'state_sync':
        this.circles = message.state.circles || [];
        this.drawCanvas();
        this.setStatus(`Connected with ${message.state.circles?.length || 0} circles`);
        break;
      
      case 'circle_added':
        this.circles.push(message.circle);
        this.drawCanvas();
        break;
      
      case 'canvas_cleared':
        this.circles = [];
        this.drawCanvas();
        this.setStatus(`Canvas cleared by user ${message.clearedBy}`);
        break;
      
      case 'user_joined':
        this.setStatus(`User joined! (${message.participantCount} total)`);
        break;
      
      case 'user_left':
        this.setStatus(`User left. (${message.participantCount} remaining)`);
        break;
      
      case 'error':
        this.setStatus(`Error: ${message.message}`);
        break;
    }
  }
  
  handleCanvasClick(event) {
    // Get the click coordinates relative to the canvas
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Send the circle to the server
    this.socket.send(JSON.stringify({
      type: 'add_circle',
      payload: {
        x,
        y,
        radius: 20,
        color: null // Let the server assign a random color
      }
    }));
  }
  
  handleClearCanvas() {
    // Send clear canvas command
    this.socket.send(JSON.stringify({
      type: 'clear_canvas'
    }));
  }
  
  handleLeaveGame() {
    // Close the WebSocket connection
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    
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
    if (this.socket) {
      this.socket.close();
    }
    
    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.handleCanvasClick);
    }
  }
}

export default GameCanvas; 