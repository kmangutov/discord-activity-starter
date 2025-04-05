// Test script to verify Ably connectivity
import * as Ably from 'ably';

// Function to test Ably connection
async function testAbly() {
  console.log('Testing Ably connection...');
  
  try {
    // Get API key from environment or use fallback
    const apiKey = import.meta.env.ABLY_API_KEY || 'wJCxmg.MM9QRw:YCEe19Xuz85-vFqXmcHwSHavTTDYAX542v7tiSCSR9o';
    
    // Create Ably client
    const ably = new Ably.Realtime({
      key: apiKey,
      clientId: `test-user-${Date.now()}`
    });
    
    // Create a promise to wait for connection
    const connectionPromise = new Promise((resolve, reject) => {
      ably.connection.once('connected', () => {
        console.log('Ably connected successfully!');
        resolve(true);
      });
      
      ably.connection.once('failed', (err) => {
        console.error('Ably connection failed:', err);
        reject(err);
      });
      
      // Set a timeout
      setTimeout(() => {
        if (ably.connection.state !== 'connected') {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
    
    // Wait for connection
    await connectionPromise;
    
    // Create a test channel
    const channel = ably.channels.get('test-channel');
    console.log('Created test channel');
    
    // Send a test message
    await channel.publish('test-event', { message: 'Hello from Ably test!' });
    console.log('Sent test message');
    
    // Subscribe to messages
    channel.subscribe('test-event', (message) => {
      console.log('Received message:', message.data);
    });
    console.log('Subscribed to test channel');
    
    // Send another test message after subscription
    setTimeout(async () => {
      await channel.publish('test-event', { message: 'Second test message' });
      console.log('Sent second test message');
      
      // Close connection after tests
      setTimeout(() => {
        ably.close();
        console.log('Test completed, connection closed');
      }, 2000);
    }, 1000);
    
    return true;
  } catch (error) {
    console.error('Ably test failed:', error);
    return false;
  }
}

// Run the test
testAbly();

// Export for use in main app
export { testAbly }; 