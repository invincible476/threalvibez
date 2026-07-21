import { onSnapshot, doc, collection, query, where, Timestamp, runTransaction, getDocs, getDoc, updateDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import type { User } from '@/lib/types';

// Thresholds for different states
const DEVICE_STALENESS_THRESHOLD = 15 * 1000; // 15 seconds for very aggressive staleness detection
const OFFLINE_THRESHOLD = 30 * 1000; // 30 seconds of inactivity = offline
const CLEANUP_INTERVAL = 15 * 1000; // Check for stale devices every 15 seconds

export function useOnlineStatus(user: User | undefined | null) {
  const cleanupIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const devicesRef = collection(db, 'users', user.uid, 'devices');
    
    // Function to clean up stale devices and update status
    const cleanupAndUpdateStatus = async () => {
      try {
        // First, check if the user document exists
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.error('User document not found');
          return;
        }

        // Force offline if user document indicates offline
        const userData = userDoc.data();
        if (userData?.status === 'offline') {
          return;
        }

        // Get all devices for this user
        const snapshot = await getDocs(query(devicesRef));
        
        // If no devices, mark user as offline immediately
        if (snapshot.empty) {
          await updateDoc(userRef, {
            status: 'offline',
            deviceCount: 0,
            lastSeen: Timestamp.now()
          });
          return;
        }

        const devices = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          ...doc.data(),
          id: doc.id,
          lastSeen: doc.data().lastSeen?.toDate?.().getTime() || 0
        }));
      
        const now = Date.now();
      
        // Get user's last activity time
        const lastActive = userData?.lastActive?.toDate?.().getTime() || now;
        const inactivePeriod = now - lastActive;

      // If user has been inactive for more than a day, mark them as offline
      if (inactivePeriod > 24 * 60 * 60 * 1000) {
        await updateDoc(userRef, {
          status: 'offline',
          deviceCount: 0,
          lastSeen: Timestamp.now()
        });
        return;
      }
      
      // Categorize devices by their staleness
      const activeDevices = devices.filter(device => 
        device.lastSeen && (now - device.lastSeen) < DEVICE_STALENESS_THRESHOLD
      );
      
      const inactiveDevices = devices.filter(device => {
        const timeSinceLastSeen = now - device.lastSeen;
        return device.lastSeen && 
          timeSinceLastSeen >= DEVICE_STALENESS_THRESHOLD && 
          timeSinceLastSeen < OFFLINE_THRESHOLD;
      });
      
      const staleDevices = devices.filter(device => 
        !device.lastSeen || (now - device.lastSeen) >= OFFLINE_THRESHOLD
      );

      // Immediately delete any stale devices
      const deletePromises = staleDevices.map(device => {
        const staleRef = doc(devicesRef, device.id);
        return updateDoc(staleRef, {
          status: 'offline',
          lastSeen: Timestamp.now()
        }).catch(err => {
          console.warn(`Failed to update stale device ${device.id}:`, err);
        });
      });
      
      // Wait for all device updates to complete
      await Promise.all(deletePromises);

      // Update user's status based on current devices
      try {
        await runTransaction(db, async (transaction) => {
          // Get the current user document
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) {
            console.error('User document not found');
            return;
          }

          // Get current devices state
          const currentDevicesSnapshot = await getDocs(query(devicesRef));
          if (currentDevicesSnapshot.empty) {
            // No devices = definitely offline
            transaction.update(userRef, {
              status: 'offline',
              lastSeen: Timestamp.now(),
              deviceCount: 0,
              lastActive: userDoc.data()?.lastActive || Timestamp.now()
            });
            return;
          }

          const currentDevices = currentDevicesSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            ...doc.data(),
            id: doc.id,
            lastSeen: doc.data().lastSeen?.toDate?.().getTime() || 0
          }));

          const now = Date.now();
          const actualActiveDevices = currentDevices.filter((device: { lastSeen: number }) => 
            device.lastSeen && (now - device.lastSeen) < DEVICE_STALENESS_THRESHOLD
          );
          
          const actualInactiveDevices = currentDevices.filter((device: { lastSeen: number }) => {
            const timeSinceLastSeen = now - device.lastSeen;
            return device.lastSeen && 
              timeSinceLastSeen >= DEVICE_STALENESS_THRESHOLD && 
              timeSinceLastSeen < OFFLINE_THRESHOLD;
          });

          // Update user status based on actual device count - being more strict
          const mostRecentActivity = Math.max(...currentDevices.map(d => d.lastSeen));
          const timeSinceLastActivity = now - mostRecentActivity;

          // If no recent activity at all, mark as offline
          if (timeSinceLastActivity >= OFFLINE_THRESHOLD) {
            transaction.update(userRef, {
              status: 'offline',
              lastSeen: Timestamp.now(),
              deviceCount: 0,
              lastActive: userDoc.data()?.lastActive || Timestamp.now()
            });
          } else if (actualActiveDevices.length > 0 && timeSinceLastActivity < DEVICE_STALENESS_THRESHOLD) {
            // Only mark as online if we have active devices AND recent activity
            transaction.update(userRef, {
              status: 'online',
              lastSeen: Timestamp.now(),
              deviceCount: actualActiveDevices.length,
              lastActive: Timestamp.now()
            });
          } else {
            // Any other case, mark as away or offline
            transaction.update(userRef, {
              status: timeSinceLastActivity < OFFLINE_THRESHOLD ? 'away' : 'offline',
              lastSeen: Timestamp.now(),
              deviceCount: actualInactiveDevices.length,
              lastActive: mostRecentActivity ? new Timestamp(Math.floor(mostRecentActivity / 1000), 0) : Timestamp.now()
            });
          }
        });
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    } catch (error) {
      console.error('Error in cleanup and status update:', error);
    }
    };

    // Initial cleanup and status update
    cleanupAndUpdateStatus();
    
    // Set up periodic cleanup
    cleanupIntervalRef.current = setInterval(cleanupAndUpdateStatus, CLEANUP_INTERVAL);
    
    // Watch devices collection for real-time changes
    const unsubscribe = onSnapshot(query(devicesRef), snapshot => {
      // Only trigger cleanup if there are changes
      if (!snapshot.empty) {
        cleanupAndUpdateStatus();
      }
    });

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
      unsubscribe();
    };
  }, [user?.uid]);
}