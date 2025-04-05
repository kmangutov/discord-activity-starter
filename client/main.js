import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

import rocketLogo from '/rocket.png';
import "./style.css";

// https://discord.com/developers/docs/activities/development-guides#instance-participants

// Will eventually store the authenticated user's access_token
let auth;
// Store participants data
let participants = [];

// Debug logger function
function logDebug(message, type = 'info') {
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

// Override console methods to also log to our debug console
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

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

setupDiscordSdk().then(() => {
  logDebug("Discord SDK is authenticated");
  
  // Fetch initial participants
  fetchParticipants();
  
  // Subscribe to participant updates
  discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
}).catch(error => {
  logDebug(`Failed to setup Discord SDK: ${error.message}`, 'error');
});

async function setupDiscordSdk() {
  await discordSdk.ready();
  logDebug("Discord SDK is ready");

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
      "applications.commands"
    ],
  });

  // Retrieve an access_token from your activity's server
  // Note: We need to prefix our backend `/api/token` route with `/.proxy` to stay compliant with the CSP.
  // Read more about constructing a full URL and using external resources at
  // https://discord.com/developers/docs/activities/development-guides#construct-a-full-url
  const response = await fetch("/.proxy/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const { access_token } = await response.json();

  // Authenticate with Discord client (using the access_token)
  auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }
}

// Fetch participants in the activity
async function fetchParticipants() {
  try {
    participants = await discordSdk.commands.getInstanceConnectedParticipants();
    logDebug(`Fetched ${participants.length} participants`);
    renderParticipants();
  } catch (error) {
    logDebug(`Failed to fetch participants: ${error.message}`, 'error');
  }
}

// Update participants when they change
function updateParticipants(newParticipants) {
  participants = newParticipants;
  logDebug(`Participants updated: ${participants.length} users in activity`);
  renderParticipants();
}

// Render participants in the UI
function renderParticipants() {
  const participantsList = document.getElementById('participants-list');
  if (!participantsList) return;
  
  participantsList.innerHTML = '';
  
  participants.forEach(user => {
    // Create avatar URL
    let avatarSrc = '';
    if (user.avatar) {
      avatarSrc = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
    } else {
      const defaultAvatarIndex = Number(BigInt(user.id) >> 22n % 6n);
      avatarSrc = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
    }
    
    // Create username
    const username = user.global_name ?? `${user.username}#${user.discriminator}`;
    
    // Create participant element
    const participantElement = document.createElement('div');
    participantElement.className = 'participant';
    participantElement.innerHTML = `
      <img src="${avatarSrc}" alt="Avatar" class="participant-avatar">
      <span class="participant-name">${username}</span>
    `;
    
    participantsList.appendChild(participantElement);
  });
}

document.querySelector('#app').innerHTML = `
  <div>
    <img src="${rocketLogo}" class="logo" alt="Discord" />
    <h1>Hello, World!</h1>
    <div class="participants-container">
      <h2>Activity Participants</h2>
      <div id="participants-list" class="participants-list"></div>
    </div>
    
    <div id="debug-console" class="debug-console">
      <div class="debug-header">
        <span>Debug Console</span>
        <button id="toggle-debug" class="toggle-debug">_</button>
      </div>
      <div id="debug-console-content" class="debug-console-content"></div>
    </div>
  </div>
`;

// Initial render of participants
renderParticipants();

// Debug console toggle
document.getElementById('toggle-debug').addEventListener('click', () => {
  const debugConsole = document.getElementById('debug-console');
  debugConsole.classList.toggle('minimized');
  
  const toggleButton = document.getElementById('toggle-debug');
  toggleButton.textContent = debugConsole.classList.contains('minimized') ? '□' : '_';
});

// Initial log
logDebug('Debug console initialized');
logDebug(`Discord instanceId: ${discordSdk.instanceId}`);
