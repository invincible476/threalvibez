import { 
  ref, 
  onDisconnect, 
  set, 
  onValue,
  get,
  Database,
  DatabaseReference,
  serverTimestamp as rtServerTimestamp,
  query,
  orderByChild,
  DataSnapshot,
  QueryConstraint
} from 'firebase/database';
import { 
  doc, 
  updateDoc,
  serverTimestamp as firestoreServerTimestamp,
  DocumentReference,
  writeBatch,
  getDocs,
  query as firestoreQuery,
  collection,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { getDatabase } from 'firebase/database';
import { firebaseApp } from './firebase-init';
import { debounce } from 'lodash';

// Initialize Realtime Database
const rtdb: Database = getDatabase(firebaseApp);

// Constants
const PRESENCE_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds
  OFFLINE_THRESHOLD: 35000, // 35 seconds (slightly longer than heartbeat)
  CLEANUP_INTERVAL: 300000, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  DEBOUNCE_DELAY: 1000,
};

// Interface for presence data
interface PresenceData {
  state: 'online' | 'offline';
  lastChanged: object | null;
  lastHeartbeat: object | null;
  connectedAt?: object;
  deviceId?: string;
  timestamp?: object;
  clientVersion?: string;
}

class PresenceManager {
  private presenceRef: DatabaseReference | null = null;
  private userDocRef: DocumentReference | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupFn: (() => void) | null = null;
  private uid: string | null = null;
  private deviceId: string;
  private retryCount: number = 0;
  private isReconnecting: boolean = false;
  private lastSuccessfulUpdate: number = 0;
  private readonly debouncedPresenceUpdate: ReturnType<typeof debounce<(state: 'online' | 'offline', force?: boolean) => Promise<void>>>;

  constructor() {
    this.deviceId = this.generateDeviceId();
    
    // Bind methods
    this.sendHeartbeat = this.sendHeartbeat.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    this._updatePresenceState = this._updatePresenceState.bind(this);
    this.cleanupStalePresence = this.cleanupStalePresence.bind(this);
    
    // Initialize debounced presence update
    this.debouncedPresenceUpdate = debounce(
      (state: 'online' | 'offline', force?: boolean) => this._updatePresenceState(state, force),
      PRESENCE_CONFIG.DEBOUNCE_DELAY
    );
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupStalePresence(), PRESENCE_CONFIG.CLEANUP_INTERVAL);
  }

  private generateDeviceId(): string {
    const timestamp = new Date().getTime().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${timestamp}-${random}`;
  }

  private async _updatePresenceState(state: 'online' | 'offline', force: boolean = false): Promise<void> {
    if (!this.presenceRef || !this.userDocRef || (!force && this.isReconnecting)) return;

    const now = Date.now();
    if (!force && now - this.lastSuccessfulUpdate < PRESENCE_CONFIG.DEBOUNCE_DELAY) {
      return;
    }

    try {
      const presenceData: PresenceData = {
        state,
        lastChanged: rtServerTimestamp(),
        lastHeartbeat: state === 'online' ? rtServerTimestamp() : null,
        deviceId: this.deviceId,
        timestamp: rtServerTimestamp(),
        clientVersion: '1.0.0' // Add client version for debugging
      };

      await Promise.all([
        set(this.presenceRef, presenceData),
        updateDoc(this.userDocRef, {
          status: state,
          lastSeen: firestoreServerTimestamp(),
          lastDeviceId: this.deviceId
        })
      ]);

      this.lastSuccessfulUpdate = Date.now();
      this.retryCount = 0;
    } catch (error) {
      console.error('Error updating presence state:', error);
      await this.handleUpdateError(state);
    }
  }

  private async handleUpdateError(state: 'online' | 'offline'): Promise<void> {
    if (this.retryCount >= PRESENCE_CONFIG.MAX_RETRY_ATTEMPTS) {
      this.isReconnecting = true;
      await this.reconnect();
      return;
    }

    this.retryCount++;
    await new Promise(resolve => setTimeout(resolve, PRESENCE_CONFIG.RETRY_DELAY * this.retryCount));
    await this._updatePresenceState(state, true);
  }

  private async reconnect(): Promise<void> {
    try {
      // Reset connection
      this.cleanup();
      
      if (this.uid) {
        await this.initialize(this.uid);
      }
      
      this.isReconnecting = false;
      this.retryCount = 0;
    } catch (error) {
      console.error('Reconnection failed:', error);
      // Schedule another reconnection attempt
      setTimeout(() => this.reconnect(), PRESENCE_CONFIG.RETRY_DELAY * 2);
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.uid || this.isReconnecting) return;
    await this.debouncedPresenceUpdate('online');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(this.sendHeartbeat, PRESENCE_CONFIG.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleVisibilityChange(): Promise<void> {
    if (!this.presenceRef || !this.userDocRef || this.isReconnecting) return;

    const isVisible = document.visibilityState === 'visible';
    await this.debouncedPresenceUpdate(isVisible ? 'online' : 'offline');

    if (isVisible) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
  }

  private handleBeforeUnload = (): void => {
    if (!this.presenceRef || !this.uid) return;

    // Use sendBeacon for more reliable offline status updates
    try {
      const offlineData = JSON.stringify({
        state: 'offline',
        lastChanged: { '.sv': 'timestamp' },
        lastHeartbeat: null
      });

      // Construct the RTDB URL using the project ID
      const databaseURL = `https://${firebaseApp.options.projectId}-default-rtdb.firebaseio.com`;
      const url = `${databaseURL}/status/${this.uid}.json`;
      navigator.sendBeacon(url, offlineData);

      // Also try to update Firestore
      const firestoreData = JSON.stringify({
        fields: {
          status: { stringValue: 'offline' },
          lastSeen: { timestampValue: new Date().toISOString() }
        }
      });

      navigator.sendBeacon(
        `https://firestore.googleapis.com/v1/projects/${firebaseApp.options.projectId}/databases/(default)/documents/users/${this.uid}`,
        firestoreData
      );
    } catch (error) {
      console.error('Error in beforeunload handler:', error);
    }
  }

  public async initialize(uid: string): Promise<void> {
    if (!uid) throw new Error('UID is required');

    // Cleanup any existing presence
    this.cleanup();

    this.uid = uid;
    this.presenceRef = ref(rtdb, `/status/${uid}`);
    this.userDocRef = doc(db, 'users', uid);

    const connectedRef = ref(rtdb, '.info/connected');

    try {
      if (!this.presenceRef) {
        throw new Error('Presence reference not initialized');
      }

      // Set up disconnect hook first
      await onDisconnect(this.presenceRef).set({
        state: 'offline',
        lastChanged: rtServerTimestamp(),
        lastHeartbeat: null
      });

      // Listen for connection state changes
      const unsubscribeConnection = onValue(connectedRef, async (snapshot) => {
        const isConnected = snapshot.val();
        
        if (isConnected === false) {
          this.stopHeartbeat();
          return;
        }

        try {
          if (!this.presenceRef || !this.userDocRef) {
            throw new Error('References not initialized');
          }

          await Promise.all([
            set(this.presenceRef, {
              state: 'online',
              lastChanged: rtServerTimestamp(),
              lastHeartbeat: rtServerTimestamp(),
              connectedAt: rtServerTimestamp()
            }),
            updateDoc(this.userDocRef, {
              status: 'online',
              lastSeen: firestoreServerTimestamp()
            })
          ]);

          this.startHeartbeat();
        } catch (error) {
          console.error('Error updating online status:', error);
        }
      });

      // Set up event listeners
      if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        window.addEventListener('beforeunload', this.handleBeforeUnload);

        // Additional cleanup on page hide
        document.addEventListener('pagehide', this.handleBeforeUnload);
        // Cleanup on freeze (mobile browsers)
        if ('onfreeze' in document) {
          document.addEventListener('freeze', this.handleBeforeUnload);
        }
      }

      // Store cleanup function
      this.cleanupFn = () => {
        unsubscribeConnection();
        this.stopHeartbeat();
        
        if (typeof window !== 'undefined') {
          document.removeEventListener('visibilitychange', this.handleVisibilityChange);
          window.removeEventListener('beforeunload', this.handleBeforeUnload);
          document.removeEventListener('pagehide', this.handleBeforeUnload);
          if ('onfreeze' in document) {
            document.removeEventListener('freeze', this.handleBeforeUnload);
          }
        }

        // Create an array to store cleanup tasks
        const cleanupTasks: Array<Promise<void>> = [];

        // Only add presence update if we have a valid reference
        if (this.presenceRef) {
          cleanupTasks.push(
            set(this.presenceRef, {
              state: 'offline',
              lastChanged: rtServerTimestamp(),
              lastHeartbeat: null
            })
          );
        }

        // Only add user document update if we have a valid reference
        const userDocRef = this.userDocRef;
        if (userDocRef) {
          cleanupTasks.push(
            updateDoc(userDocRef, {
              status: 'offline',
              lastSeen: firestoreServerTimestamp()
            })
          );
        }

        // Execute all cleanup tasks and catch any errors
        if (cleanupTasks.length > 0) {
          Promise.all(cleanupTasks).catch(console.error);
        }
      };
    } catch (error) {
      console.error('Error initializing presence:', error);
      throw error;
    }
  }

  private async cleanupStalePresence(): Promise<void> {
    try {
      const statusRef = ref(rtdb, '/status');
      const statusQuery = query(statusRef, orderByChild('lastHeartbeat') as QueryConstraint);
      const snapshot = await get(statusQuery);
      
      if (!snapshot.exists()) return;

      const now = Date.now();
      let hasStale = false;
      const batch = writeBatch(db);
      const stalePresences = new Set<string>();

      snapshot.forEach((childSnapshot: DataSnapshot) => {
        const presence = childSnapshot.val() as PresenceData;
        if (!presence.lastHeartbeat) return;

        const lastHeartbeat = presence.lastHeartbeat as { '.sv': string };
        const timestamp = parseInt(lastHeartbeat['.sv'], 10);

        if (now - timestamp > PRESENCE_CONFIG.OFFLINE_THRESHOLD) {
          hasStale = true;
          stalePresences.add(childSnapshot.key || '');
          
          set(childSnapshot.ref, {
            state: 'offline',
            lastChanged: rtServerTimestamp(),
            lastHeartbeat: null,
            deviceId: presence.deviceId
          }).catch(console.error);
        }
      });

      if (hasStale) {
        const userQuery = firestoreQuery(
          collection(db, 'users'),
          where('status', '==', 'online')
        );
        
        const staleUsers = await getDocs(userQuery);
        staleUsers.forEach(doc => {
          if (stalePresences.has(doc.id)) {
            batch.update(doc.ref, {
              status: 'offline',
              lastSeen: firestoreServerTimestamp()
            });
          }
        });

        await batch.commit();
      }
    } catch (error) {
      console.error('Error cleaning up stale presence:', error);
    }
  }

  public cleanup(): void {
    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.uid = null;
    this.presenceRef = null;
    this.userDocRef = null;
    this.stopHeartbeat();
  }

  public async setOffline(): Promise<void> {
    if (!this.presenceRef || !this.userDocRef) return;

    this.stopHeartbeat();

    try {
      await Promise.all([
        set(this.presenceRef, {
          state: 'offline',
          lastChanged: rtServerTimestamp(),
          lastHeartbeat: null
        }),
        updateDoc(this.userDocRef, {
          status: 'offline',
          lastSeen: firestoreServerTimestamp()
        })
      ]);
    } catch (error) {
      console.error('Error setting offline status:', error);
    }
  }
}

// Create singleton instance
const presenceManager = new PresenceManager();

// Export functions that match the previous API
export const setupPresence = async (uid: string): Promise<(() => void) | void> => {
  await presenceManager.initialize(uid);
  return () => presenceManager.cleanup();
};

export const setOfflineStatus = async (uid: string): Promise<void> => {
  await presenceManager.setOffline();
};