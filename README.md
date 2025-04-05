# Discord Activity Game Hub

A "sidecart" framework for easily adding and hosting multiplayer games in Discord Activities. This project handles all the scaffolding needed to create, manage, and connect games through WebSockets, allowing developers to focus on creating the games themselves.

## Features

- **Easy Game Development**: Add new games by simply creating game files in the repo
- **Game Lifecycle Management**: Handles game selection, joining, and leaving
- **WebSocket Networking**: Built-in multiplayer support for all games
- **Discord Integration**: Seamlessly works within Discord Activities
- **Participant Management**: Tracks and displays users in each game

> **Note:** For debugging Discord Activities, please refer to the official [Discord Activities Development Guide](https://discord.com/developers/docs/activities/development-guides).

## Adding a New Game (Technical Guide)

To add a new game to the framework, follow these steps:

### 1. Create Server-Side Game Implementation

Create a file in `server/games/YourGame.js` that implements the server-side `GameInterface`:

```javascript
// server/games/YourGame.js
import { GameInterface } from './GameInterface.js';
import { getRandomColor } from '../utils.js'; // Optional utility

class YourGame extends GameInterface {
  // Required static properties for the game registry
  static id = 'yourgame';            // Unique identifier - must match client-side!
  static name = 'Your Game Name';    // Display name shown in the lobby
  static description = 'Description of your game';
  static minPlayers = 1;             // Minimum players needed
  static maxPlayers = 8;             // Maximum players supported
  static thumbnail = '/thumbnails/yourgame.png'; // Path to game thumbnail
  
  constructor(instanceId, activityId = null) {
    super(instanceId, activityId);
    
    // Initialize game-specific state - will be synced to clients
    this.state = {
      ...this.state, // Include base state (lastUpdate)
      yourGameState: {}, // Your game-specific state
    };
    
    console.log(`YourGame instance created: ${instanceId}`);
  }
  
  // Handle incoming messages from clients
  onMessage(socket, messageData) {
    const { type, payload } = messageData;
    
    switch (type) {
      case 'your_action':
        // Handle the action
        this.handleYourAction(socket.userId, payload);
        break;
      
      default:
        console.log(`Unknown message type: ${type}`);
    }
  }
  
  // Handle a player leaving the game
  onLeave(socket, userId) {
    // Clean up player-specific state when they leave
    console.log(`Player ${userId} left YourGame`);
    
    // Update game state as needed
    this.state.lastUpdate = Date.now();
    
    // Notify other players if needed
    this.broadcast({
      type: 'player_left',
      userId: userId
    });
  }
  
  // Example game-specific method
  handleYourAction(userId, actionData) {
    // Process the action
    console.log(`Player ${userId} performed action:`, actionData);
    
    // Update game state
    // this.state.yourGameState.someProperty = actionData.value;
    this.state.lastUpdate = Date.now();
    
    // Broadcast the action to all clients
    this.broadcast({
      type: 'action_performed',
      userId: userId,
      action: actionData
    });
  }
}

export { YourGame };
```
Note: the websocket connection may be flaky/do reconnects

### 2. Create Client-Side Game Implementation

Create a file in `client/game_frontends/YourGameFrontend.js` that implements the client-side `GameInterface`:

```javascript
// client/game_frontends/YourGameFrontend.js
import GameInterface from './GameInterface.js';
import { 
  logDebug, 
  getRandomColor, 
  subscribeToChannel, 
  publishToChannel 
} from '../utils-websocket.js';

class YourGameFrontend extends GameInterface {
  constructor(container, instanceId, userId, onLeaveCallback) {
    super(container, instanceId, userId, onLeaveCallback);
    
    // Initialize game-specific properties
    this.gameState = {};
    
    // Create UI and connect WebSocket
    this.createUI();
    this.connectWebSocket();
    
    logDebug(`YourGame initialized for user: ${userId} in instance: ${instanceId}`);
  }
  
  // IMPORTANT: Must return the same ID as server-side static id property
  getGameId() {
    return 'yourgame';
  }
  
  // Create the game's UI
  createUI() {
    this.container.innerHTML = `
      <div class="your-game">
        <h2>Your Game Title</h2>
        <div class="game-area">
          <!-- Game-specific UI elements -->
        </div>
        <div class="game-controls">
          <button id="your-action-button">Perform Action</button>
          <button id="leave-game" class="leave-button">Leave Game</button>
        </div>
        <div class="game-status">Connecting...</div>
      </div>
    `;
    
    // Store references to important elements
    this.gameArea = this.container.querySelector('.game-area');
    this.statusDisplay = this.container.querySelector('.game-status');
    
    // Set up event listeners
    this.container.querySelector('#your-action-button').addEventListener('click', () => {
      this.performAction();
    });
    
    this.container.querySelector('#leave-game').addEventListener('click', () => {
      this.handleLeaveGame();
    });
  }
  
  // Subscribe to WebSocket events
  async setupSubscriptions() {
    if (!this.channel) return;
    
    // Handle state sync (receive full game state)
    await subscribeToChannel(this.channel, 'state_sync', (event) => {
      this.updateGameState(event.data.state);
    });
    
    // Handle custom game events
    await subscribeToChannel(this.channel, 'action_performed', (event) => {
      const { userId, action } = event.data;
      this.handleActionEvent(userId, action);
    });
    
    // Handle player leaving
    await subscribeToChannel(this.channel, 'player_left', (event) => {
      const { userId } = event.data;
      logDebug(`Player left: ${userId}`);
      // Update UI to reflect player leaving
    });
  }
  
  // Update the game state and UI
  updateGameState(state) {
    this.gameState = state;
    this.updateUI();
    this.setStatus('Connected');
  }
  
  // Update the UI based on current game state
  updateUI() {
    // Update your game display based on this.gameState
    // For example:
    // this.gameArea.innerHTML = `...`;
  }
  
  // Example function to send an action to the server
  performAction() {
    if (!this.channel || !this.isConnected) {
      this.setStatus('Not connected - cannot perform action');
      return;
    }
    
    const actionData = {
      type: 'example_action',
      value: Math.random()
    };
    
    publishToChannel(this.channel, 'your_action', actionData);
    this.setStatus('Action sent!');
  }
  
  // Handle action events from other players
  handleActionEvent(userId, action) {
    logDebug(`Player ${userId} performed action: ${JSON.stringify(action)}`);
    // Update UI to reflect the action
  }
  
  // Display status messages
  setStatus(message) {
    if (this.statusDisplay) {
      this.statusDisplay.textContent = message;
    }
  }
  
  // Clean up when game is destroyed
  destroy() {
    // Clean up any game-specific resources
    
    // Call parent destroy to handle WebSocket cleanup
    super.destroy();
  }
}

export default YourGameFrontend;
```

### 3. Register the Game on the Server

Add the game to the server initialization in `server/server.js`:

```javascript
// In server/server.js
import { YourGame } from './games/YourGame.js';
import { registerGame } from '../shared/game_registry.js';

// Register your game (add this alongside the other registerGame calls)
registerGame(YourGame);
```

### 4. Integrate with main.js for Game Instantiation

Update `client/main.js` to import and handle your new game:

```javascript
// At the top of client/main.js
import YourGameFrontend from './game_frontends/YourGameFrontend.js';

// Then find the startGame function and add your game handler:
function startGame(gameId) {
  // ... existing code ...
  
  // Initialize the appropriate game
  if (gameId === 'canvas') {
    // ... existing code for canvas game ...
  } else if (gameId === 'dotgame') {
    // ... existing code for dot game ...
  } else if (gameId === 'yourgame') {
    try {
      currentGame = new YourGameFrontend(
        gameContainer,
        discordSdk.instanceId,
        userId,
        () => showLobby() // Callback to return to lobby
      );
    } catch (error) {
      logDebug(`Error initializing Your Game: ${error.message}`, 'error');
      showGameError(gameContainer, error, gameId);
    }
  } else {
    // Handle unknown game type
    showGameError(gameContainer, new Error(`Unknown game type: ${gameId}`), gameId);
  }
  
  // ... rest of the function ...
}
```

### 5. Add Game Thumbnail (Optional)

Create a thumbnail for your game at `client/dist/thumbnails/yourgame.png`.

### 6. Testing Your Game

The server will automatically list your game in the `/api/games` endpoint once it's registered, and the client will display it in the lobby UI. To test your game:

1. **Run the server locally:**
   ```
   cd server
   npm install
   npm start
   ```

2. **Run the client in development mode:**
   ```
   cd client
   npm install
   npm run dev
   ```

3. **Configure Discord Application:**
   - Set up appropriate URL mappings in your Discord Developer Portal
   - Ensure the activity points to your local server
   - Launch the activity in Discord to test

### Common Issues & Troubleshooting

1. **Game doesn't appear in the lobby:**
   - Check server logs to ensure your game was registered
   - Verify that game IDs match exactly between client and server implementations
   - Check the `/api/games` endpoint response format (should be `{ "games": [...] }`)

2. **Cannot connect to game:**
   - Verify WebSocket connections are established
   - Check that channel names match between client and server 
   - Check for console errors related to WebSocket messaging

3. **Game state not syncing:**
   - Ensure your game properly extends GameInterface
   - Verify the message types match between client and server
   - Check that you're using the broadcast method for server-to-client messages

## Project Structure

The updated project structure after refactoring:

```
.
├── client/                    # Frontend Discord Activity client
│   ├── dist/                  # Built client files
│   │   └── thumbnails/        # Game thumbnail images
│   ├── game_frontends/        # Client-side game implementations
│   │   ├── GameInterface.js   # Base interface for client games
│   │   ├── CanvasGameFrontend.js  # Canvas drawing game
│   │   └── DotGameFrontend.js # Dot visualization game
│   ├── main.js                # Main client application
│   ├── utils-websocket.js     # WebSocket client utilities
│   ├── style.css              # Client styles
│   └── index.html             # Client entry point
│
├── server/                    # Backend server
│   ├── server.js              # Express & WebSocket server
│   ├── rooms.js               # Game room management
│   ├── games/                 # Server-side game implementations
│   │   ├── GameInterface.js   # Base interface for server games
│   │   ├── CanvasGame.js      # Server-side canvas game logic
│   │   └── DotGame.js         # Server-side dot game logic
│   └── utils.js               # Server utilities
│
├── shared/                    # Shared code between client and server
│   └── game_registry.js       # Game registration system
│
├── DISCORD_URL_MAPPINGS.md    # Guide for Discord URL mappings
└── package.json               # Root package.json
```

## How It Works

1. **Game Selection**: Users start in a lobby where they can select from available games
2. **Game Instances**: When a game is selected, a new game instance is created for the Discord Activity
3. **WebSocket Communication**: Players in the same game automatically connect via WebSockets
4. **Participant Tracking**: The framework handles tracking who's in each game
5. **Game API**: Games use a consistent API to integrate with the framework

## Deployment

This project is designed to be easily hosted on platforms like Railway, with all necessary Discord Activity integration handled automatically.

