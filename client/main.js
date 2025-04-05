import { DiscordSDK, Events } from "@discord/embedded-app-sdk";

import rocketLogo from '/rocket.png';
import "./style.css";

// Will eventually store the authenticated user's access_token
let auth;
// Store participants data
let participants = [];

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

setupDiscordSdk().then(() => {
  console.log("Discord SDK is authenticated");
  
  // Fetch initial participants
  fetchParticipants();
  
  // Subscribe to participant updates
  discordSdk.subscribe(Events.ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE, updateParticipants);
});

async function setupDiscordSdk() {
  await discordSdk.ready();
  console.log("Discord SDK is ready");

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
    renderParticipants();
  } catch (error) {
    console.error("Failed to fetch participants:", error);
  }
}

// Update participants when they change
function updateParticipants(newParticipants) {
  participants = newParticipants;
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
  </div>
`;

// Initial render of participants
renderParticipants();
