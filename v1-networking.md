Updated Plan for Networking (based on your current structure)
Here’s how to layer WebSockets on top of the existing discord-activity/ structure:

bash
Copy
Edit
discord-activity/
├── .env
├── client/
│   ├── main.js                # Discord SDK + UI
│   ├── style.css
│   ├── GameCanvas.js          # Component exposed to a room
│   └── package.json
├── server/
│   ├── server.js              # Express + WebSocket server
│   ├── rooms.js               # Room management logic
│   ├── game-example.js        # Example game logic for one room
│   └── package.json
└── v0-networking.md
🧠 WebSocket Behavior Plan
Server (server.js):
Serve the frontend

Set up a WebSocket server (ws or socket.io)

Use instanceId as the room ID

Keep track of:

Which users are in each room

Shared game state (canvas or other)

Handle edge cases:

If all users leave, destroy the room

When someone joins, sync them with current state

Support "leave room" action to go back to the lobby

Client (main.js, GameCanvas.js):
Connect to WebSocket using instanceId

Join room and render current canvas state

Send local changes to server (e.g. move, draw, chat)

Handle "Leave Room" button → disconnects + returns to lobby

✏️ Prompt for Cursor Agent
Here’s a prompt you can paste directly into Cursor:

Prompt:

I'd like to implement WebSocket-based multiplayer for a Discord Activity using Node.js and the ws package. The project has a client/ folder (with main.js and Discord SDK setup) and a server/ folder (with an existing server.js using Express). Here's what I want you to do:

🔌 WebSocket Server Setup
In server/server.js, set up a WebSocket server using the ws package and bind it to the same HTTP server.

Each connected user sends their instanceId on connection.

Use instanceId as a room ID. Maintain an in-memory rooms object with:

participants: Set<socket>

state: any (canvas state or shared data)

When a user joins:

Add them to the room

Sync them with the current state

Broadcast a "user joined" event to others

When a user leaves or disconnects:

Remove them from the room

If the room is empty, delete it

🧠 Game Room Example
Create server/game-example.js:

Export a basic GameRoom class with onJoin, onMessage, and onLeave handlers

Handles updates to a simple canvas object (e.g. list of circles)

🖼️ Frontend Updates
In client/GameCanvas.js, create a simple canvas that:

Connects to the WebSocket server with the instanceId

Renders shared circles on the canvas

Lets users click to add a circle

Sends events like { type: "addCircle", x, y }

Update client/main.js to:

Import GameCanvas

Show it when connected to a room

Show a "Leave Room" button that:

Sends a leave event

Disconnects WebSocket

Returns to the main lobby UI

✅ Bonus (Optional)
Expose an API route (/api/games) that scans a games/ folder and returns a list of available game folders, with name and metadata.

Each game exports a GameHandler so the server can auto-load it based on room type.

📦 Use only native Node.js, express, and ws — no extra frameworks. Maintain clean separation of concerns between rooms and message handling.

Let me know if you'd like help wiring up the canvas or room manager!

