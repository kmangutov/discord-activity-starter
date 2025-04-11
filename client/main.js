import { DiscordSDK } from '@discord/embedded-app-sdk';

// Initialize Discord SDK if running in Discord
let discordSDK;
const isDiscordActivity = window.location.search.includes('activityId');

// Generate a random user ID for local testing
const generateUserId = () => {
  return Math.random().toString(36).substring(2, 10);
};

// Extract URL parameters
const getUrlParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    instanceId: params.get('instanceId') || "local-instance", //Math.random().toString(36).substring(2, 10),
    activityId: params.get('activityId'),
    guildId: params.get('guildId'),
    channelId: params.get('channelId'),
  };
};

// Get the WebSocket URL based on environment
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  return `${protocol}//${host}`;
};

// Main application class
class ChatApp {
  constructor() {
    this.userId = null;
    this.username = "User-" + generateUserId();
    this.discordData = null;
    this.socket = null;
    this.connected = false;
    this.params = getUrlParams();
    
    // DOM elements
    this.statusEl = document.getElementById('status');
    this.messagesEl = document.getElementById('messages');
    this.messageForm = document.getElementById('message-form');
    this.messageInput = document.getElementById('message-input');
    
    // Initialize
    this.init();
  }
  
  async init() {
    // Add event listeners
    this.messageForm.addEventListener('submit', (e) => this.handleSubmit(e));
    
    if (isDiscordActivity) {
      await this.initDiscord();
    } else {
      // For local testing, just generate a random user ID
      this.userId = generateUserId();
      this.connectWebSocket();
    }
  }
  
  async initDiscord() {
    // Update status
    this.updateStatus('connecting', 'Initializing Discord...');
    
    try {
      // Initialize Discord SDK
      discordSDK = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
      await discordSDK.ready();
      
      // Get authorization code
      const { code } = await discordSDK.commands.authorize({
        client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify"],
      });
      
      // Exchange code for token with backend
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!response.ok) {
        throw new Error('Failed to authenticate with Discord');
      }
      
      const { access_token } = await response.json();
      
      // Authenticate with Discord
      const auth = await discordSDK.commands.authenticate({ access_token });
      
      // Get user data
      this.userId = auth.user.id;
      this.username = auth.user.username;
      console.log('Discord user:', auth.user);
      
      // Connect to WebSocket after Discord initialization
      this.connectWebSocket();
    } catch (error) {
      console.error('Error initializing Discord:', error);
      this.updateStatus('disconnected', 'Discord initialization failed');
    }
  }
  
  connectWebSocket() {
    this.updateStatus('connecting', 'Connecting to server...');
    
    // Create WebSocket connection
    this.socket = new WebSocket(getWebSocketUrl());
    
    // WebSocket event handlers
    this.socket.onopen = () => this.handleSocketOpen();
    this.socket.onmessage = (event) => this.handleSocketMessage(event);
    this.socket.onclose = () => this.handleSocketClose();
    this.socket.onerror = (error) => this.handleSocketError(error);
  }
  
  handleSocketOpen() {
    console.log('WebSocket connected');
    this.connected = true;
    this.updateStatus('connected', 'Connected');
    
    // Send join message
    this.socket.send(JSON.stringify({
      type: 'join',
      userId: this.userId,
      username: this.username,
      instanceId: this.params.instanceId,
      activityId: this.params.activityId
    }));
  }
  
  handleSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      switch (data.type) {
        case 'message':
          this.displayMessage(data.userId, data.message);
          break;
        case 'user_joined':
          this.displaySystemMessage(`User ${data.userId} joined the chat`);
          break;
        case 'user_left':
          this.displaySystemMessage(`User ${data.userId} left the chat`);
          break;
        case 'error':
          console.error('Server error:', data.message);
          this.displaySystemMessage(`Error: ${data.message}`);
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }
  
  handleSocketClose() {
    console.log('WebSocket disconnected');
    this.connected = false;
    this.updateStatus('disconnected', 'Disconnected');
    
    // Try to reconnect after a delay
    setTimeout(() => {
      if (!this.connected) {
        this.connectWebSocket();
      }
    }, 5000);
  }
  
  handleSocketError(error) {
    console.error('WebSocket error:', error);
    this.updateStatus('disconnected', 'Connection error');
  }
  
  handleSubmit(event) {
    event.preventDefault();
    
    const message = this.messageInput.value.trim();
    if (!message || !this.connected) return;
    
    // Send message to server
    this.socket.send(JSON.stringify({
      type: 'message',
      message: message
    }));
    
    // Display own message immediately
    this.displayMessage(this.userId, message, true);
    
    // Clear input
    this.messageInput.value = '';
  }
  
  displayMessage(userId, message, isMe = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMe ? 'own-message' : ''}`;
    
    const authorDiv = document.createElement('div');
    authorDiv.className = 'author';
    authorDiv.textContent = isMe ? 'You' : `User-${userId.substring(0, 6)}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(authorDiv);
    messageDiv.appendChild(contentDiv);
    
    this.messagesEl.appendChild(messageDiv);
    this.scrollToBottom();
  }
  
  displaySystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system-message';
    messageDiv.textContent = message;
    
    this.messagesEl.appendChild(messageDiv);
    this.scrollToBottom();
  }
  
  updateStatus(status, message) {
    this.statusEl.className = status;
    this.statusEl.textContent = message;
  }
  
  scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}

// Initialize the application once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ChatApp();
});
