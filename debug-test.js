#!/usr/bin/env node

// Debug test script to run the monitoring system with enhanced debugging
console.log('🚀 Starting WhatsApp Monitor in DEBUG mode');
console.log('This will show detailed information about:');
console.log('- Message extraction per group');
console.log('- Keyword matching process');
console.log('- Processed message deduplication');
console.log('- Group processing sequence');
console.log('');

// Set debug mode
process.env.DEBUG = 'true';

// Import and run the main application
import('./index.js').then(() => {
  console.log('✅ Debug mode application started');
}).catch((error) => {
  console.error('❌ Failed to start debug mode:', error);
  process.exit(1);
});