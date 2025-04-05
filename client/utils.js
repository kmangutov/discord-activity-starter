/**
 * Utility functions for Discord Activity app
 */

// Debug logger function
export function logDebug(message, type = 'info') {
  const debugConsole = document.getElementById('debug-console-content');
  if (!debugConsole) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry log-${type}`;
  logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="log-message">${message}</span>`;
  
  debugConsole.appendChild(logEntry);
  // Auto-scroll to bottom
  debugConsole.scrollTop = debugConsole.scrollHeight;
  
  // Limit entries to prevent overflow
  if (debugConsole.children.length > 50) {
    debugConsole.removeChild(debugConsole.children[0]);
  }
}

// Setup console overrides to log to debug console
export function setupConsoleOverrides() {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'error');
  };

  console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    logDebug(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '), 'warning');
  };
}

// Render participants in the UI
export function renderParticipants(participants, containerId = 'participants-list') {
  const participantsList = document.getElementById(containerId);
  if (!participantsList) return;
  
  participantsList.innerHTML = '';
  
  // Guard against non-array participants
  if (!Array.isArray(participants)) {
    logDebug('Participants is not an array in renderParticipants', 'error');
    return;
  }
  
  if (participants.length === 0) {
    participantsList.innerHTML = '<div class="no-participants">No participants found</div>';
    return;
  }
  
  participants.forEach(user => {
    try {
      // Guard against invalid user objects
      if (!user || typeof user !== 'object') {
        logDebug(`Invalid user object: ${JSON.stringify(user)}`, 'warning');
        return;
      }
      
      // Create avatar URL
      let avatarSrc = '';
      if (user.avatar) {
        avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
      } else {
        // Safely handle potential BigInt conversion issues
        try {
          const defaultAvatarIndex = Number(BigInt(user.id) >> 22n % 6n);
          avatarSrc = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
        } catch (error) {
          // Fallback to avatar 0 if we can't calculate
          avatarSrc = `https://cdn.discordapp.com/embed/avatars/0.png`;
          logDebug(`Avatar calculation error: ${error.message}`, 'warning');
        }
      }
      
      // Create username with fallbacks
      const username = user.global_name || user.username || 
                       (user.user ? (user.user.global_name || user.user.username) : 'Unknown User');
      
      // Create participant element
      const participantElement = document.createElement('div');
      participantElement.className = 'participant-item';
      participantElement.innerHTML = `
        <img src="${avatarSrc}" alt="Avatar" class="participant-avatar">
        <span class="participant-name">${username}</span>
      `;
      
      participantsList.appendChild(participantElement);
    } catch (error) {
      logDebug(`Error rendering participant: ${error.message}`, 'error');
    }
  });
}

// Setup debug console toggle
export function setupDebugConsole() {
  const toggleButton = document.getElementById('toggle-debug');
  if (!toggleButton) return;
  
  toggleButton.addEventListener('click', () => {
    const debugConsole = document.getElementById('debug-console');
    debugConsole.classList.toggle('minimized');
    
    toggleButton.textContent = debugConsole.classList.contains('minimized') ? '□' : '_';
  });
  
  // Initial log
  logDebug('Debug console initialized');
}

// Create and add debug console to the DOM
export function createDebugConsole(container) {
  const debugConsole = document.createElement('div');
  debugConsole.id = 'debug-console';
  debugConsole.className = 'debug-console';
  debugConsole.innerHTML = `
    <div class="debug-header">
      <span>Debug Console</span>
      <button id="toggle-debug" class="toggle-debug">_</button>
    </div>
    <div id="debug-console-content" class="debug-console-content"></div>
  `;
  
  container.appendChild(debugConsole);
  setupDebugConsole();
}

// Generate a random color
export function getRandomColor() {
  const colors = [
    '#FF5733', // Red
    '#33FF57', // Green
    '#3357FF', // Blue
    '#FF33F5', // Pink
    '#F5FF33', // Yellow
    '#33FFF5'  // Cyan
  ];
  return colors[Math.floor(Math.random() * colors.length)];
} 