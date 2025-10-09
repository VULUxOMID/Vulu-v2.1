console.log('🧪 [TEST] Starting SubscriptionContext import test...');

try {
  console.log('🧪 [TEST] Attempting to import SubscriptionContext...');
  
  // Try to import the SubscriptionContext (temporarily disabled for debugging)
  // import('../context/SubscriptionContext').then((module) => {
  //   console.log('✅ [TEST] SubscriptionContext imported successfully:', Object.keys(module));
  //   console.log('✅ [TEST] SubscriptionProvider available:', !!module.SubscriptionProvider);
  //   console.log('✅ [TEST] useSubscription available:', !!module.useSubscription);
  // }).catch((error) => {
  //   console.error('❌ [TEST] Failed to import SubscriptionContext:', error);
  //   console.error('❌ [TEST] Error details:', {
  //     message: error.message,
  //     stack: error.stack,
  //     name: error.name
  //   });
  // });
  console.log('🔧 [TEST] SubscriptionContext import disabled for debugging');
  
} catch (error) {
  console.error('❌ [TEST] Synchronous error importing SubscriptionContext:', error);
}

console.log('🧪 [TEST] SubscriptionContext import test setup complete');
