#!/usr/bin/env node
/**
 * Migration script: copy `devices` array from each user document into
 * a `users/{uid}/devices/{deviceId}` subcollection document.
 *
 * Usage:
 *  - Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file path, or
 *  - Set FIREBASE_SERVICE_ACCOUNT env var to the service account JSON string
 *
 *  node -r dotenv/config scripts/migrate-devices-to-subcollection.js [--remove-parent]
 *
 *  --remove-parent  : will delete the parent `devices` array after migration
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

function initAdmin() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Initializing admin using GOOGLE_APPLICATION_CREDENTIALS file.');
    admin.initializeApp();
    return;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Initializing admin using FIREBASE_SERVICE_ACCOUNT env JSON.');
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(svc) });
    return;
  }

  console.error('No service account provided. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.');
  process.exit(1);
}

async function migrate() {
  initAdmin();
  const db = admin.firestore();
  const removeParent = process.argv.includes('--remove-parent');

  console.log('Fetching users...');
  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users.`);

  let migratedCount = 0;
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();
    const devices = data?.devices;
    if (!devices || !Array.isArray(devices) || devices.length === 0) continue;

    console.log(`Migrating ${devices.length} devices for user ${uid}`);
    for (const d of devices) {
      try {
        const id = d?.id || uuidv4();
        const deviceRef = db.collection('users').doc(uid).collection('devices').doc(id);

        // Preserve loggedInAt if present, otherwise set serverTimestamp
        const loggedInAt = d && d.loggedInAt ? d.loggedInAt : admin.firestore.FieldValue.serverTimestamp();

        await deviceRef.set({ ...d, id, loggedInAt }, { merge: true });
        migratedCount++;
      } catch (err) {
        console.error(`Failed to migrate device for user ${uid}:`, err);
      }
    }

    if (removeParent) {
      try {
        await db.collection('users').doc(uid).update({ devices: admin.firestore.FieldValue.delete() });
        console.log(`Removed parent devices array for user ${uid}`);
      } catch (err) {
        console.error(`Failed to remove parent devices array for user ${uid}:`, err);
      }
    }
  }

  console.log(`Migration complete. Created/updated ${migratedCount} device documents.`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
