// migrate-videos-to-cloudinary.js (node)
const admin = require('firebase-admin');
const cloudinary = require('cloudinary').v2;

// Initialize Firebase Admin SDK
// Ensure you have your service account key file and set the GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
});

// Configure Cloudinary
// Ensure you have these environment variables set in your .env file
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const db = admin.firestore();

async function runMigration() {
  console.log('Starting video migration...');

  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Error: Cloudinary environment variables are not set. Please check your .env file.');
    return;
  }

  const conversationsSnapshot = await db.collection('conversations').get();
  console.log(`Found ${conversationsSnapshot.docs.length} conversations to check.`);

  let migratedCount = 0;
  const migrationPromises = [];

  for (const convoDoc of conversationsSnapshot.docs) {
    const messagesRef = convoDoc.ref.collection('messages');
    const messagesSnapshot = await messagesRef.get();

    for (const messageDoc of messagesSnapshot.docs) {
      const data = messageDoc.data();
      const file = data.file;

      const isBase64Video = file && file.type && file.type.startsWith('video/') && file.url && file.url.startsWith('data:');
      const hasMediaData = data.mediaData && file && file.type && file.type.startsWith('video/');

      if (isBase64Video || hasMediaData) {
        console.log(`Found video to migrate in message ${messageDoc.id} from conversation ${convoDoc.id}`);
        
        const migrationPromise = (async () => {
          try {
            const base64Data = (file.url || data.mediaData).split(',')[1];
            
            // Upload to Cloudinary
            const uploadResponse = await new Promise((resolve, reject) => {
              const uploadStream = cloudinary.uploader.upload_stream(
                { resource_type: 'video', folder: 'migrated_videos' },
                (error, result) => {
                  if (error) return reject(error);
                  resolve(result);
                }
              );
              uploadStream.end(Buffer.from(base64Data, 'base64'));
            });

            if (!uploadResponse.secure_url) {
                throw new Error('Cloudinary did not return a secure_url');
            }

            // Update Firestore document
            await messageDoc.ref.update({
              'file.url': uploadResponse.secure_url,
              mediaData: admin.firestore.FieldValue.delete() // Remove the large base64 field
            });

            console.log(`Successfully migrated message ${messageDoc.id}. New URL: ${uploadResponse.secure_url}`);
            migratedCount++;
          } catch (error) {
            console.error(`Failed to migrate message ${messageDoc.id}:`, error);
          }
        })();
        migrationPromises.push(migrationPromise);
      }
    }
  }

  await Promise.all(migrationPromises);
  console.log(`\nMigration complete. Migrated ${migratedCount} video messages.`);
}

runMigration().catch(error => {
  console.error("Migration script failed with an error:", error);
  process.exit(1);
});
