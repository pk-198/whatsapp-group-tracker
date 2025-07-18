// Configuration file for WhatsApp Monitor - Contains all app settings and constants
// Copy this file to config.js and update with your actual values

// Array of WhatsApp group names to monitor for keywords
export const TARGET_GROUPS = [
  'Group Name 1',
  'Group Name 2',
  'Group Name 3'
  // Add your WhatsApp group names here
];

// Keywords to search for in messages (case-insensitive)
export const KEYWORDS = [
  'keyword1',
  'keyword2',
  'keyword3'
  // Add your keywords here
];

// Interval between scan cycles in minutes
export const SCAN_INTERVAL_MINUTES = 30;

// Puppeteer browser launch configuration
export const PUPPETEER_OPTIONS = {
  headless: false, // Show browser window for QR scanning
  defaultViewport: null, // Use default window size
  userDataDir: './whatsapp-session', // Persist login session
  args: [
    '--no-sandbox', // Disable sandbox for Docker
    '--disable-setuid-sandbox', // Disable setuid sandbox
    '--disable-dev-shm-usage', // Overcome limited resource problems
    '--disable-accelerated-2d-canvas', // Disable GPU acceleration
    '--no-first-run', // Skip first run wizards
    '--no-zygote', // Disable zygote process
    '--disable-gpu' // Disable GPU hardware acceleration
  ]
};

// WhatsApp Web URL
export const WHATSAPP_WEB_URL = 'https://web.whatsapp.com';

// CSS selectors for WhatsApp Web elements
export const SELECTORS = {
  // Login elements
  qrCode: 'canvas[aria-label*="Scan"]',
  chatList: '[aria-label="Chat list"]', // Updated selector
  
  // Search elements
  searchButton: '[data-icon="search-refreshed-thin"], [data-icon="search"]', // Search icon selectors
  searchBox: 'div[contenteditable="true"][data-tab="3"], [aria-label="Search input textbox"]', // Multiple selectors
  searchResults: '[aria-label="Chat list"] [role="grid"]',
  
  // Chat elements - Updated for WhatsApp Web 2025
  conversationPanel: '#main [data-testid="conversation-panel-wrapper"], #main [data-testid="conversation-panel"], #main [role="application"], #main',
  messageContainer: '.message-in, .message-out, [data-testid^="msg-"], [data-testid="conv-msg-box"]',
  messageText: '.copyable-text span, .selectable-text span, [data-testid="msg-text"]',
  messageMeta: '[data-pre-plain-text]',
  messageTime: '[data-testid="msg-time"], span[dir="auto"]',
  
  // Group elements
  groupTitle: 'header span[title]',
  archivedChatsButton: '[aria-label="Archived"]', // Updated selector
  backButton: '[data-testid="back"]'
};

// Timeout configurations in milliseconds
export const TIMEOUTS = {
  navigation: 60000, // Page navigation timeout (1 minute)
  search: 5000, // Search operation timeout
  message: 3000, // Message loading timeout
  betweenGroups: 2000 // Delay between group switches
};

// Path to log file for storing keyword matches
export const LOG_FILE_PATH = './logs/whatsapp_matches.txt';