// Debug script to analyze WhatsApp Web DOM structure
// Run this in browser console when a chat is open

console.log('=== WhatsApp Web DOM Analysis ===');

// Check main element
const main = document.querySelector('#main');
console.log('Main element:', main ? 'Found' : 'Not found');
if (main) {
  console.log('Main children:', main.children.length);
  console.log('Main classes:', main.className);
}

// Check for messages with various selectors
const selectors = [
  '.message-in',
  '.message-out', 
  '[data-testid^="msg-"]',
  '[data-testid="conv-msg-box"]',
  '[role="row"]',
  'div[class*="message"]',
  '[data-testid*="message"]',
  'div[data-pre-plain-text]',
  'span.copyable-text',
  'span.selectable-text'
];

console.log('\n=== Message Container Search ===');
selectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  if (elements.length > 0) {
    console.log(`✓ ${selector}: ${elements.length} found`);
    // Show sample of first element
    if (elements[0]) {
      console.log(`  Sample classes: ${elements[0].className}`);
      console.log(`  Sample text: ${elements[0].textContent?.substring(0, 50)}...`);
    }
  } else {
    console.log(`✗ ${selector}: 0 found`);
  }
});

// Check message structure
console.log('\n=== Sample Message Structure ===');
const sampleMessage = document.querySelector('.message-in, .message-out');
if (sampleMessage) {
  console.log('Message element found!');
  console.log('Tag:', sampleMessage.tagName);
  console.log('Classes:', sampleMessage.className);
  console.log('Children:', sampleMessage.children.length);
  
  // Find text within message
  const textSelectors = [
    'span.copyable-text',
    'span.selectable-text',
    '[data-testid="msg-text"]',
    'span[dir="ltr"]',
    'span[dir="auto"]'
  ];
  
  console.log('\n=== Text extraction from message ===');
  textSelectors.forEach(sel => {
    const textEl = sampleMessage.querySelector(sel);
    if (textEl) {
      console.log(`✓ ${sel}: "${textEl.textContent?.substring(0, 50)}..."`);
    }
  });
}

// Check conversation panel
console.log('\n=== Conversation Panel Search ===');
const panelSelectors = [
  '[data-testid="conversation-panel-wrapper"]',
  '[data-testid="conversation-panel"]',
  '[role="application"]',
  '[data-testid="conversation-panel-messages"]'
];

panelSelectors.forEach(selector => {
  const el = document.querySelector(selector);
  console.log(`${selector}: ${el ? 'Found' : 'Not found'}`);
});

console.log('\n=== Analysis Complete ===');
console.log('Copy this output and share for debugging');