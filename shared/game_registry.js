/**
 * Game Registry for Discord Activities
 * Handles registration and instantiation of games
 */

// Store registered games
const registeredGames = [];

/**
 * Register a new game type
 * @param {Class} gameClass - Game class with static properties
 */
function registerGame(gameClass) {
  // Validate that the game class has all required static properties
  const requiredProps = ['id', 'name', 'description'];
  for (const prop of requiredProps) {
    if (!gameClass[prop]) {
      throw new Error(`Game class missing required static property: ${prop}`);
    }
  }
  
  // Check for duplicate registration
  if (registeredGames.some(game => game.id === gameClass.id)) {
    console.warn(`Game with ID ${gameClass.id} already registered. Skipping duplicate registration.`);
    return;
  }
  
  // Register the game
  registeredGames.push(gameClass);
  console.log(`Registered game: ${gameClass.name} (${gameClass.id})`);
}

/**
 * Get a list of all registered games
 * @returns {Array} Array of registered game classes
 */
function getRegisteredGames() {
  return [...registeredGames];
}

/**
 * Create a new instance of a registered game
 * @param {string} gameId - The ID of the game to instantiate
 * @param {string} instanceId - Discord Activity instance ID
 * @param {string} activityId - Discord Activity ID
 * @returns {Object|null} Game instance or null if game not found
 */
function getGameInstance(gameId, instanceId, activityId) {
  const gameClass = registeredGames.find(game => game.id === gameId);
  
  if (!gameClass) {
    console.warn(`Game with ID ${gameId} not found in registry`);
    return null;
  }
  
  try {
    return new gameClass(instanceId, activityId);
  } catch (error) {
    console.error(`Error creating instance of game ${gameId}:`, error);
    return null;
  }
}

/**
 * Clear all game registrations (primarily for testing)
 */
function clearRegisteredGames() {
  registeredGames.length = 0;
}

export {
  registerGame,
  getRegisteredGames,
  getGameInstance,
  clearRegisteredGames
}; 