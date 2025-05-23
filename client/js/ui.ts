/**
 * UI handler for chat interface
 */

// Define a type for connection status
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// Define a type for the return value of initialize
interface UIElements {
  statusEl: HTMLElement | null;
  messagesEl: HTMLElement | null;
  messageForm: HTMLFormElement | null;
  messageInput: HTMLInputElement | null;
}

// DOM elements
let statusEl: HTMLElement | null;
let messagesEl: HTMLElement | null;
let messageForm: HTMLFormElement | null;
let messageInput: HTMLInputElement | null;

/**
 * Initialize UI elements
 * @returns UI elements
 */
export function initialize(): UIElements {
  statusEl = document.getElementById('status');
  messagesEl = document.getElementById('messages');
  messageForm = document.getElementById('message-form') as HTMLFormElement | null;
  messageInput = document.getElementById('message-input') as HTMLInputElement | null;
  
  return {
    statusEl,
    messagesEl,
    messageForm,
    messageInput
  };
}

/**
 * Display chat message
 * @param userId - User ID
 * @param message - Message text
 * @param isMe - Whether the message is from the current user
 */
export function displayMessage(userId: string, message: string, isMe: boolean = false): void {
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
 * @param message - Message text
 */
export function displaySystemMessage(message: string): void {
  if (!messagesEl) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system-message';
  messageDiv.textContent = message;
  
  messagesEl.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Update connection status
 * @param status - Status type (connected, disconnected, connecting)
 * @param message - Status message
 */
export function updateStatus(status: ConnectionStatus, message: string): void {
  if (!statusEl) return;
  
  statusEl.className = status;
  statusEl.textContent = message;
}

/**
 * Clear message input
 */
export function clearInput(): void {
  if (messageInput) {
    messageInput.value = '';
  }
}

/**
 * Scroll messages to bottom
 */
export function scrollToBottom(): void {
  if (messagesEl) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

/**
 * Add submit handler to message form
 * @param callback - Submit callback function
 */
export function onSubmit(callback: (message: string) => void): void {
  if (messageForm && messageInput) {
    messageForm.addEventListener('submit', (event) => {
      event.preventDefault();
      
      if (messageInput) {
        const message = messageInput.value.trim();
        if (message) {
          // Check for debug commands
          if (message === '/debug' || message === '/test') {
            displaySystemMessage('Running connection diagnostics...');
            // This is handled in main.ts with a special handler
            callback('__DEBUG_TEST_CONNECTION__');
          } else {
            callback(message);
          }
        }
      }
    });
  }
}

/**
 * Display debug message with raw data
 * @param title - Debug message title
 * @param data - Raw data to display
 */
export function displayDebugMessage(title: string, data: any): void {
  if (!messagesEl) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message debug-message';
  
  const titleDiv = document.createElement('div');
  titleDiv.className = 'debug-title';
  titleDiv.textContent = `🐞 ${title}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'debug-content';
  
  let content = '';
  if (typeof data === 'object') {
    try {
      content = JSON.stringify(data, null, 2);
    } catch (e) {
      content = String(data);
    }
  } else {
    content = String(data);
  }
  
  // Create a pre element for formatted display
  const pre = document.createElement('pre');
  pre.textContent = content;
  contentDiv.appendChild(pre);
  
  messageDiv.appendChild(titleDiv);
  messageDiv.appendChild(contentDiv);
  
  messagesEl.appendChild(messageDiv);
  scrollToBottom();
} 