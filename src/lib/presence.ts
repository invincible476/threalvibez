import { db } from './firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, increment, runTransaction, Timestamp } from 'firebase/firestore';

const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

export async function setupPresence(userId: string) {
  // Generate a unique device ID
  const deviceId = crypto.randomUUID();
  
  // Get references to the user and device documents
  const userRef = doc(db, 'users', userId);
  const deviceRef = doc(db, 'users', userId, 'devices', deviceId);
  
  // Initialize presence
  await runTransaction(db, async (transaction) => {
    // Add this device and increment device count
    transaction.set(deviceRef, {
      lastSeen: Timestamp.now(),
      updatedAt: serverTimestamp()
    });
    transaction.update(userRef, {
      deviceCount: increment(1),
      status: 'online',
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  // Setup heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await updateDoc(deviceRef, {
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating heartbeat:', error);
    }
  }, HEARTBEAT_INTERVAL);

  // Cleanup function for disconnection
  const cleanup = async () => {
    clearInterval(heartbeatInterval);
    
    try {
      await runTransaction(db, async (transaction) => {
        // Remove this device and decrement device count
        transaction.delete(deviceRef);
        transaction.update(userRef, {
          deviceCount: increment(-1),
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Error cleaning up presence:', error);
    }
  };

  // Handle browser/tab close
  window.addEventListener('beforeunload', cleanup);
  
  // Return cleanup function for component unmount
  return () => {
    window.removeEventListener('beforeunload', cleanup);
    cleanup();
  };
}