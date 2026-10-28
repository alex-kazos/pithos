/**
 * Migration script to transfer data from legacy collections to the new structure
 * To run: node scripts/migrateFirestoreData.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Initialize Firebase Admin with service account
const app = initializeApp({
  credential: cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

/**
 * Migrates data from legacy shopify_credentials to users/{userId}/stores/{storeId}
 */
async function migrateShopifyCredentials() {
  console.log('Starting migration of Shopify credentials...');
  
  try {
    // Get all documents from the legacy collection
    const legacyCredentialsSnapshot = await db.collection('shopify_credentials').get();
    
    if (legacyCredentialsSnapshot.empty) {
      console.log('No legacy Shopify credentials found.');
      return;
    }
    
    console.log(`Found ${legacyCredentialsSnapshot.size} legacy credentials to migrate.`);
    
    // Migrate each credential
    let migratedCount = 0;
    const migrationPromises = legacyCredentialsSnapshot.docs.map(async (credentialDoc) => {
      const data = credentialDoc.data();
      const userId = credentialDoc.id;
      
      if (!data.shopUrl || !data.apiToken) {
        console.warn(`Skipping invalid credential for user ${userId}`);
        return;
      }
      
      // Generate storeId from shopUrl if not already present
      const storeId = data.storeId || data.shopUrl.replace(/^https?:\/\//, '').replace(/\.myshopify\.com\/?$/, '');
      
      // Check if the user document exists, create if not
      const userDoc = await db.doc(`users/${userId}`).get();
      if (!userDoc.exists) {
        await db.doc(`users/${userId}`).set({
          createdAt: new Date().toISOString()
        });
      }
      
      // Create the store document in the new structure
      const storeData = {
        shopUrl: data.shopUrl,
        apiToken: data.apiToken,
        userId,
        storeId,
        isActive: true, // Mark as active since it's the only store
        createdAt: data.createdAt || new Date().toISOString()
      };
      
      try {
        // Write to the new structure
        await db.doc(`users/${userId}/stores/${storeId}`).set(storeData);
        migratedCount++;
        console.log(`Migrated store ${storeId} for user ${userId}`);
      } catch (error) {
        console.error(`Failed to migrate store ${storeId} for user ${userId}:`, error);
      }
    });
    
    await Promise.all(migrationPromises);
    
    console.log(`Migration completed. Migrated ${migratedCount} of ${legacyCredentialsSnapshot.size} stores.`);
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  try {
    // Run all migrations
    await migrateShopifyCredentials();
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
