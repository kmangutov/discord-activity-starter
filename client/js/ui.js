/**
 * UI handler for chat interface
 */

// DOM elements
let statusEl;
let messagesEl;
let messageForm;
let messageInput;

/**
 * Initialize UI elements
 * @returns {Object} UI elements
 */
export function initialize() {
  statusEl = document.getElementById('status');
  messagesEl = document.getElementById('messages');
  messageForm = document.getElementById('message-form');
  messageInput = document.getElementById('message-input');
  
  return {
    statusEl,
    messagesEl,
    messageForm,
    messageInput
  };
}

/**
 * Display chat message
 * @param {string} userId - User ID
 * @param {string} message - Message text
 * @param {boolean} isMe - Whether the message is from the current user
 */
export function displayMessage(userId, message, isMe = false) {
  if (!messagesEl) return;
  
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
  
  messagesEl.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Display system message
 * @param {string} message - Message text
 */
export function displaySystemMessage(message) {
  if (!messagesEl) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system-message';
  messageDiv.textContent = message;
  
  messagesEl.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Update connection status
 * @param {string} status - Status type (connected, disconnected, connecting)
 * @param {string} message - Status message
 */
export function updateStatus(status, message) {
  if (!statusEl) return;
  
  statusEl.className = status;
  statusEl.textContent = message;
}

/**
 * Clear message input
 */
export function clearInput() {
  if (messageInput) {
    messageInput.value = '';
  }
}

/**
 * Scroll messages to bottom
 */
export function scrollToBottom() {
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

/**
 * Add submit handler to message form
 * @param {Function} callback - Submit callback function
 */
export function onSubmit(callback) {
  if (messageForm) {
    messageForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      const message = messageInput.value.trim();
      if (message) {
        callback(message);
      }
    });
  }
} 