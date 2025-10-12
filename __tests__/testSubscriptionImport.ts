console.log('🔄 Testing subscription context import...');

try {
  // Test if we can import the subscription context (temporarily disabled)
  // import('../context/SubscriptionContext').then((module) => {
  //   console.log('✅ SubscriptionContext imported successfully:', Object.keys(module));
  // }).catch((error) => {
  //   console.error('❌ Failed to import SubscriptionContext:', error);
  // });
  console.log('🔧 SubscriptionContext import test disabled for debugging');
} catch (error) {
  console.error('❌ Error during SubscriptionContext import test:', error);
}

console.log('🔄 Subscription import test completed');
