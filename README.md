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

1. **Create server-side game implementation**:
   ```javascript
   // server/games/YourGame.js
   import { GameInterface } from './GameInterface.js';
   
   class YourGame extends GameInterface {
     // Required static properties for registry
     static id = 'yourgame';
     static name = 'Your Game Name';
     static description = 'Description of your game';
     static minPlayers = 1;
     static maxPlayers = 8;
     static thumbnail = '/thumbnails/yourgame.png';
     
     constructor(instanceId, activityId = null) {
       super(instanceId, activityId);
       
       // Initialize game-specific state
       this.state = {
         ...this.state,
         // Your game state properties
       };
     }
     
     // Handle incoming messages
     onMessage(socket, messageData) {
       const { type, payload } = messageData;
       
       switch (type) {
         case 'your_action':
           // Handle action
           break;
         
         default:
           console.log(`Unknown message type: ${type}`);
       }
     }
     
     // Add game-specific methods
   }
   
   export { YourGame };
   ```

2. **Create client-side game implementation**:
   ```javascript
   // client/game_frontends/YourGameFrontend.js
   import GameInterface from './GameInterface.js';
   
   class YourGameFrontend extends GameInterface {
     constructor(container, instanceId, userId, onLeaveCallback) {
       super(container, instanceId, userId, onLeaveCallback);
       
       // Initialize game-specific properties
       this.gameState = {};
     }
     
     getGameId() {
       return 'yourgame';
     }
     
     createUI() {
       // Create game UI elements
       this.container.innerHTML = `
         <div class="your-game">
           <!-- Game elements -->
           <button id="leave-game">Leave Game</button>
         </div>
       `;
       
       // Set up event listeners
       document.getElementById('leave-game').addEventListener('click', () => {
         this.handleLeaveGame();
       });
     }
     
     async setupSubscriptions() {
       if (!this.channel) return;
       
       // Subscribe to game events
       await subscribeToChannel(this.channel, 'state_sync', (event) => {
         this.updateGameState(event.data.state);
       });
       
       // Add more subscriptions as needed
     }
     
     // Add game-specific methods
   }
   
   export default YourGameFrontend;
   ```

3. **Register the game in the server**:
   Update your server initialization to import and register the new game:
   ```javascript
   // In server/server.js or where you initialize your server
   import { YourGame } from './games/YourGame.js';
   import { registerGame } from '../shared/game_registry.js';
   
   // Register your game
   registerGame(YourGame);
   ```

   This should also be done in the frontend maybe? idk

4. **Test your game locally**:
   - Run your local development server
   - Create or update your Discord Application with appropriate URL mappings
   - Launch your Activity in Discord to test

Currently, the deployment process is being solidified, but you can test your games by either running locally with appropriate Discord Application settings or by pushing to the main branch to deploy through Discord's infrastructure.

## Project Structure

```
.
├── client/                 # Frontend Discord Activity client
│   ├── dist/               # Built client files
│   ├── GameCanvas.js       # Example canvas drawing game
│   ├── DotGame.js          # Example dot visualization game
│   ├── main.js             # Main client application
│   ├── utils-websocket.js  # WebSocket client utilities
│   ├── style.css           # Client styles
│   └── index.html          # Client entry point
│
├── server/                 # Backend server
│   ├── server.js           # Express & WebSocket server
│   ├── rooms.js            # Game room management
│   ├── games/              # Game implementations
│   │   └── DotGame.js      # Server-side game logic for DotGame
│   └── game-example.js     # Template for creating new games
│
├── DISCORD_URL_MAPPINGS.md # Guide for Discord URL mappings
└── package.json            # Root package.json
```

## How It Works

1. **Game Selection**: Users start in a lobby where they can select from available games
2. **Game Instances**: When a game is selected, a new game instance is created for the Discord Activity
3. **WebSocket Communication**: Players in the same game automatically connect via WebSockets
4. **Participant Tracking**: The framework handles tracking who's in each game
5. **Game API**: Games use a consistent API to integrate with the framework

## Adding a New Game

To add a new game:

1. Create a server-side game file in `server/games/`
2. Create a client-side game file in `client/`
3. Register the game in the main application

The framework handles all the WebSocket connections, participant management, and game lifecycle.

## Deployment

This project is designed to be easily hosted on platforms like Railway, with all necessary Discord Activity integration handled automatically.

