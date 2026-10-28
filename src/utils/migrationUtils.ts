import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { logger } from './logger';

/**
 * Migrates data from the legacy shopify_credentials collection to the new users/{userId}/stores structure
 * @returns Promise that resolves when migration is complete
 */
export async function migrateShopifyCredentials(): Promise<void> {
  const db = getFirestore();
  const fileName = 'migrationUtils.ts';
  
  try {
    logger.info('Migration', 'Starting migration of legacy shopify_credentials', { fileName });
    
    // Get all documents from the legacy collection
    const legacyCredentialsSnapshot = await getDocs(collection(db, 'shopify_credentials'));
    
    if (legacyCredentialsSnapshot.empty) {
      logger.info('Migration', 'No legacy credentials found to migrate', { fileName });
      return;
    }
    
    let migratedCount = 0;
    const migrationPromises = legacyCredentialsSnapshot.docs.map(async (credentialDoc) => {
      const data = credentialDoc.data();
      const userId = credentialDoc.id;
      
      if (!data.shopUrl || !data.apiToken) {
        logger.warn('Migration', 'Skipping invalid credential document', { 
          fileName, 
          userId,
          hasShopUrl: !!data.shopUrl,
          hasApiToken: !!data.apiToken 
        });
        return;
      }
      
      // Generate storeId from shopUrl if not already present
      const storeId = data.storeId || data.shopUrl.replace(/^https?:\/\//, '').replace(/\.myshopify\.com\/?$/, '');
      
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
        await setDoc(doc(db, `users/${userId}/stores`, storeId), storeData);
        migratedCount++;
        
        logger.success('Migration', 'Successfully migrated store', { 
          fileName, 
          userId, 
          storeId 
        });
      } catch (error) {
        logger.error('Migration', 'Failed to migrate store', { 
          fileName, 
          userId, 
          storeId, 
          error: (error as Error).message 
        });
      }
    });
    
    await Promise.all(migrationPromises);
    
    logger.success('Migration', 'Migration completed', { 
      fileName, 
      totalMigrated: migratedCount,
      totalAttempted: legacyCredentialsSnapshot.size
    });
  } catch (error) {
    logger.error('Migration', 'Migration failed', { 
      fileName, 
      error: (error as Error).message 
    });
    throw new Error(`Migration failed: ${(error as Error).message}`);
  }
}

/**
 * Deletes all documents in the legacy shopify_credentials collection
 * CAUTION: Only run this after verifying that migration was successful
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteLegacyShopifyCredentials(): Promise<void> {
  const db = getFirestore();
  const fileName = 'migrationUtils.ts';
  
  try {
    logger.info('Migration', 'Starting deletion of legacy shopify_credentials', { fileName });
    
    // Get all documents from the legacy collection
    const legacyCredentialsSnapshot = await getDocs(collection(db, 'shopify_credentials'));
    
    if (legacyCredentialsSnapshot.empty) {
      logger.info('Migration', 'No legacy credentials found to delete', { fileName });
      return;
    }
    
    let deletedCount = 0;
    const deletionPromises = legacyCredentialsSnapshot.docs.map(async (credentialDoc) => {
      const userId = credentialDoc.id;
      
      try {
        // Delete the document
        await deleteDoc(doc(db, 'shopify_credentials', userId));
        deletedCount++;
        
        logger.success('Migration', 'Successfully deleted legacy credential', { 
          fileName, 
          userId
        });
      } catch (error) {
        logger.error('Migration', 'Failed to delete legacy credential', { 
          fileName, 
          userId, 
          error: (error as Error).message 
        });
      }
    });
    
    await Promise.all(deletionPromises);
    
    logger.success('Migration', 'Deletion completed', { 
      fileName, 
      totalDeleted: deletedCount,
      totalAttempted: legacyCredentialsSnapshot.size
    });
  } catch (error) {
    logger.error('Migration', 'Deletion failed', { 
      fileName, 
      error: (error as Error).message 
    });
    throw new Error(`Deletion failed: ${(error as Error).message}`);
  }
}
