/**
 * Room management for Discord Activities
 * Manages websocket connections for different game rooms based on instanceId
 */

// Map of instanceId to room objects
const rooms = new Map();

/**
 * Base Room class that handles participants and messages
 */
class Room {
  constructor(instanceId) {
    this.instanceId = instanceId;
    this.participants = new Set();
    this.state = {}; // Base state - can be extended by specific game implementations
  }

  addParticipant(socket, userId) {
    this.participants.add(socket);
    socket.userId = userId;
    socket.instanceId = this.instanceId;
    
    this.onJoin(socket, userId);
    this.broadcast({
      type: 'user_joined',
      userId: userId,
      participantCount: this.participants.size
    }, socket); // Broadcast to everyone except the new participant
  }

  removeParticipant(socket) {
    if (this.participants.has(socket)) {
      const userId = socket.userId;
      this.participants.delete(socket);
      this.onLeave(socket, userId);
      
      this.broadcast({
        type: 'user_left',
        userId: userId,
        participantCount: this.participants.size
      });
      
      return this.participants.size === 0;
    }
    return false;
  }

  broadcast(message, exceptSocket = null) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    // --- DEBUG LOGGING --- 
    let recipients = [];
    // --- END DEBUG LOGGING --- 

    for (const participant of this.participants) {
      if (participant !== exceptSocket && participant.readyState === 1) { // 1 = WebSocket.OPEN
        // --- DEBUG LOGGING --- 
        recipients.push(participant.userId || 'unknown');
        // --- END DEBUG LOGGING --- 
        participant.send(messageStr);
      }
    }
    // --- DEBUG LOGGING --- 
    if (recipients.length > 0) {
      console.log(`Room [${this.instanceId}]: Broadcasting message to [${recipients.join(', ')}]`);
    } else {
      console.log(`Room [${this.instanceId}]: No recipients for broadcast (Sender: ${exceptSocket?.userId || 'N/A'})`);
    }
    // --- END DEBUG LOGGING --- 
  }

  // Methods to be overridden by specific game implementations
  onJoin(socket, userId) {
    // Send current state to the new participant
    socket.send(JSON.stringify({
      type: 'state_sync',
      state: this.state
    }));
  }

  onMessage(socket, message) {
    // Default message handling
    // In specific games, this would be overridden
  }

  onLeave(socket, userId) {
    // Default leave handling
  }
}

/**
 * Create or get a room for an instanceId
 * @param {string} instanceId - Discord Activity instance ID
 * @param {string} gameType - Game type identifier (optional)
 * @param {Room} roomInstance - Existing room instance (optional)
 * @returns {Room} The room instance
 */
function getOrCreateRoom(instanceId, gameType = 'lobby', roomInstance = null) {
  // If room instance is provided, store it
  if (roomInstance) {
    rooms.set(instanceId, roomInstance);
    return roomInstance;
  }

  // Return existing room if it exists
  if (rooms.has(instanceId)) {
    return rooms.get(instanceId);
  }
  
  // Create a new basic room if no existing room and no instance provided
  const room = new Room(instanceId);
  rooms.set(instanceId, room);
  return room;
}

/**
 * Handle a participant leaving a room
 * @param {WebSocket} socket - The participant's socket
 * @returns {boolean} true if the room was deleted (empty)
 */
function leaveRoom(socket) {
  const instanceId = socket.instanceId;
  if (!instanceId || !rooms.has(instanceId)) return false;
  
  const room = rooms.get(instanceId);
  const isEmpty = room.removeParticipant(socket);
  
  if (isEmpty) {
    // Room is empty, clean it up
    rooms.delete(instanceId);
    return true;
  }
  
  return false;
}

export { 
  getOrCreateRoom, 
  leaveRoom, 
  Room 
}; 