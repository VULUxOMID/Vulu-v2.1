/**
 * One-time script to fix corrupted currency balances
 * Run this with: node fix-currency-balance.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixAllUserBalances() {
  try {
    console.log('🔧 Starting currency balance fix...\n');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    let totalUsers = 0;
    let fixedUsers = 0;
    let alreadyOkUsers = 0;
    
    for (const doc of usersSnapshot.docs) {
      totalUsers++;
      const userId = doc.id;
      const userData = doc.data();
      const balances = userData.currencyBalances || {};
      
      // Check if balances need fixing
      const needsFix = (
        balances.gold < 0 ||
        balances.gems < 0 ||
        balances.tokens < 0 ||
        isNaN(balances.gold) ||
        isNaN(balances.gems) ||
        isNaN(balances.tokens)
      );
      
      if (needsFix) {
        const oldBalances = { ...balances };
        const newBalances = {
          gold: Math.max(0, Math.floor(balances.gold || 0)),
          gems: Math.max(0, Math.floor(balances.gems || 0)),
          tokens: Math.max(0, Math.floor(balances.tokens || 0)),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        
        console.log(`\n👤 User: ${userId}`);
        console.log(`   Email: ${userData.email || 'N/A'}`);
        console.log(`   Old balances:`, oldBalances);
        console.log(`   New balances:`, newBalances);
        
        // Update in Firestore
        await doc.ref.update({
          currencyBalances: newBalances
        });
        
        console.log('   ✅ Fixed!');
        fixedUsers++;
      } else {
        alreadyOkUsers++;
      }
    }
    
    console.log(`\n\n📊 Summary:`);
    console.log(`   Total users checked: ${totalUsers}`);
    console.log(`   Users fixed: ${fixedUsers}`);
    console.log(`   Users already OK: ${alreadyOkUsers}`);
    console.log('\n✨ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixAllUserBalances();

