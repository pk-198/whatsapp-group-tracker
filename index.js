// Main application file - Monitors WhatsApp groups for keywords and sends notifications

import puppeteer from 'puppeteer'; // Browser automation library
import notifier from 'node-notifier'; // macOS desktop notifications
import fs from 'fs/promises'; // File system operations
import path from 'path'; // Path manipulation utilities
import { fileURLToPath } from 'url'; // URL to file path converter
import { DEBUG_MODE, debugLog, logDOMState, logSelectorSearch, PerfTimer } from './debug-helpers.js'; // Debug utilities
import { 
  TARGET_GROUPS, 
  KEYWORDS, 
  SCAN_INTERVAL_MINUTES,
  PUPPETEER_OPTIONS,
  WHATSAPP_WEB_URL,
  SELECTORS,
  TIMEOUTS,
  LOG_FILE_PATH
} from './config.js';

// Get current file's directory (ES modules compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global variables for browser state
let browser = null; // Puppeteer browser instance
let page = null; // Current page/tab
let isShuttingDown = false; // Shutdown flag to prevent multiple shutdowns

// Store processed messages to prevent duplicate notifications
const processedMessages = new Map(); // Key: messageId, Value: timestamp

// Debug: Function to analyze processed messages
function analyzeProcessedMessages() {
  console.log(`📊 Processed Messages Analysis:`);
  console.log(`  - Total entries: ${processedMessages.size}`);
  
  const groupStats = {};
  for (const [messageId, timestamp] of processedMessages.entries()) {
    const groupName = messageId.split('-')[0];
    groupStats[groupName] = (groupStats[groupName] || 0) + 1;
  }
  
  console.log('  - By group:');
  for (const [group, count] of Object.entries(groupStats)) {
    console.log(`    ${group}: ${count} messages`);
  }
}

// Daily summary tracking
let dailySummary = {
  date: new Date().toDateString(),
  matches: {},
  totalMatches: 0
};

// Scanning state management
let isScanning = false; // Prevent concurrent scans
const groupScanStatus = new Map(); // Track per-group scan status
let isPaused = false; // Pause/resume scanning
let lastScanTime = null; // Track last scan completion
let totalMatchesAllTime = 0; // Total matches counter
let currentScanProgress = null; // Current scan progress
let scanErrors = []; // Track errors during scan

// Scan state for recovery
const scanState = {
  lastProcessedIndex: 0,
  lastSuccessfulGroup: null,
  scanStartTime: null
};

// Initialize Puppeteer browser with WhatsApp Web
async function initBrowser() {
  try {
    console.log('🚀 Starting WhatsApp Monitor...');
    
    browser = await puppeteer.launch(PUPPETEER_OPTIONS);
    page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to WhatsApp Web
    await page.goto(WHATSAPP_WEB_URL, { waitUntil: 'networkidle2', timeout: TIMEOUTS.navigation });
    
    console.log('📱 Opened WhatsApp Web');
    
    // Check if already logged in
    const isLoggedIn = await checkLoginStatus();
    
    if (!isLoggedIn) {
      console.log('📲 Please scan the QR code to login...');
      await waitForLogin();
    } else {
      console.log('✅ Already logged in to WhatsApp');
    }
    
    return { browser, page };
  } catch (error) {
    console.error('❌ Failed to initialize browser:', error);
    throw error;
  }
}

// Generate random delay between min and max milliseconds (human-like behavior)
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to wait for a specified time (replaces wait)
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Type text character by character with random delays (mimics human typing)
async function typeWithDelay(element, text) {
  for (const char of text) {
    await element.type(char, { delay: randomDelay(50, 100) });
  }
}

// Check if user is already logged in to WhatsApp Web
async function checkLoginStatus() {
  try {
    console.log('🔍 Checking login status...');
    
    // Give the page a moment to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Wait for either QR code or chat list to appear
    await page.waitForSelector(`${SELECTORS.qrCode}, ${SELECTORS.chatList}`, { timeout: 10000 });
    
    // Check if QR code is present
    const qrCodePresent = await page.$(SELECTORS.qrCode);
    const chatListPresent = await page.$(SELECTORS.chatList);
    
    console.log(`QR Code present: ${!!qrCodePresent}, Chat list present: ${!!chatListPresent}`);
    
    return !qrCodePresent && chatListPresent;
  } catch (error) {
    console.log('⚠️ Error checking login status:', error.message);
    return false;
  }
}

// Wait for user to scan QR code and complete login
async function waitForLogin() {
  try {
    // Wait for chat list or any sign of successful login
    await page.waitForSelector(SELECTORS.chatList, { timeout: 300000 }); // 5 minutes timeout
    console.log('✅ Successfully logged in to WhatsApp');
    
    // Extra wait to ensure page is fully loaded
    await wait(3000);
  } catch (error) {
    console.log('⚠️ Chat list selector not found, checking alternative selectors...');
    
    // Try alternative selectors
    try {
      await page.waitForSelector('[data-testid="chat-list-search-container"]', { timeout: 5000 });
      console.log('✅ Successfully logged in to WhatsApp (alternative method)');
    } catch (altError) {
      throw new Error('Login timeout - QR code not scanned or page not loading properly');
    }
  }
}

// Simulate human-like mouse movement to element
async function humanMouseMove(element) {
  const box = await element.boundingBox();
  if (!box) return;
  
  // Move in a slight curve to the element
  const startX = await page.evaluate(() => window.innerWidth / 2);
  const startY = await page.evaluate(() => window.innerHeight / 2);
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  
  // Create intermediate point for curve
  const midX = (startX + targetX) / 2 + randomDelay(-50, 50);
  const midY = (startY + targetY) / 2 + randomDelay(-50, 50);
  
  await page.mouse.move(startX, startY);
  await page.mouse.move(midX, midY, { steps: randomDelay(5, 10) });
  await page.mouse.move(targetX, targetY, { steps: randomDelay(5, 10) });
}

// Search for a WhatsApp group by name and open it (checks archived if needed)
async function searchAndOpenGroup(groupName) {
  const fnTimer = new PerfTimer(`searchAndOpenGroup(${groupName})`);
  
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 SEARCHING FOR GROUP: ${groupName}`);
    console.log(`${'='.repeat(60)}`);
    
    debugLog('SEARCH', `Starting search for group: ${groupName}`);
    await logDOMState(page, 'Before Search');
    
    // Try to find and click search button
    let searchButton = null;
    debugLog('SEARCH', `Looking for search button with selector: ${SELECTORS.searchButton}`);
    await logSelectorSearch(page, SELECTORS.searchButton, 'Search Button');
    
    try {
      searchButton = await page.waitForSelector(SELECTORS.searchButton, { visible: true, timeout: 5000 });
      debugLog('SUCCESS', 'Search button found');
    } catch (error) {
      console.log('⚠️ Search button not found, trying alternative method...');
      debugLog('WARNING', 'Search button not found', { error: error.message });
      
      // Debug: List all available data-icon attributes
      if (DEBUG_MODE) {
        const availableIcons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[data-icon]')).map(el => ({
            icon: el.getAttribute('data-icon'),
            ariaLabel: el.getAttribute('aria-label'),
            className: el.className
          }));
        });
        debugLog('DOM', 'Available data-icon elements', availableIcons.slice(0, 10));
      }
      
      // Try clicking the search area directly
      const searchArea = await page.$('[data-testid="chatlist-header"]');
      if (searchArea) {
        debugLog('INFO', 'Found chatlist header, clicking...');
        await searchArea.click();
        await wait(500);
      } else {
        debugLog('WARNING', 'Chatlist header not found either');
      }
    }
    
    if (searchButton) {
      await humanMouseMove(searchButton);
      await wait(randomDelay(100, 300));
      await searchButton.click();
    }
    
    // Wait for search box and type group name
    debugLog('SEARCH', `Looking for search box with selector: ${SELECTORS.searchBox}`);
    await logSelectorSearch(page, SELECTORS.searchBox, 'Search Box');
    
    const searchBox = await page.waitForSelector(SELECTORS.searchBox, { visible: true });
    debugLog('SUCCESS', 'Search box found');
    
    await searchBox.click();
    await wait(randomDelay(200, 400));
    
    // Clear existing text and type new search
    debugLog('INFO', 'Clearing search box and typing group name');
    await searchBox.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await typeWithDelay(searchBox, groupName);
    
    // Wait for search results to load
    debugLog('INFO', 'Waiting for search results to load...');
    await wait(randomDelay(1500, 2500));
    
    // Log DOM state after search
    await logDOMState(page, 'After Search');
    
    // Try to find group by title
    let groupFound = false;
    
    // First, try to find the group in search results
    try {
      // Debug: List all found titles
      const allTitles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('span[title]')).map(el => el.title);
      });
      console.log(`Found titles in search: ${allTitles.join(', ')}`);
      
      // Find all elements with the group name and click the right one
      const groupElements = await page.$$(`span[title="${groupName}"]`);
      console.log(`Found ${groupElements.length} elements with title "${groupName}"`);
      
      if (groupElements.length > 0) {
        // If multiple elements, try each one
        for (let i = 0; i < groupElements.length; i++) {
          console.log(`Attempting to click element ${i + 1}/${groupElements.length}...`);
          
          const element = groupElements[i];
          const box = await element.boundingBox();
          
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            
            // Wait for chat to load
            await wait(2000);
            
            // Wait for navigation to complete
            await wait(2500);
            
            // Check if we're in a chat by looking for multiple indicators
            const chatOpened = await page.evaluate(() => {
              // Multiple ways to detect if chat is open
              // 1. Check for main chat area
              const mainElement = document.querySelector('#main');
              // 2. Check for conversation panel with messages
              const conversationPanel = document.querySelector('[data-testid="conversation-panel-wrapper"]') || 
                                      document.querySelector('[data-testid="conversation-panel"]') ||
                                      document.querySelector('div[role="application"]');
              // 3. Check for message input area
              const messageInput = document.querySelector('div[contenteditable="true"][data-tab="10"]') ||
                                 document.querySelector('[data-testid="conversation-compose-box-input"]');
              // 4. Check for any messages
              const messages = document.querySelectorAll('.message-in, .message-out, [data-testid^="msg-"]');
              
              // Debug logging
              console.log('Chat detection:', {
                main: !!mainElement,
                conversationPanel: !!conversationPanel,
                messageInput: !!messageInput,
                messagesCount: messages.length
              });
              
              // Consider chat opened if we have main element and either messages or input
              return mainElement && (messages.length > 0 || messageInput || conversationPanel);
            });
            
            if (chatOpened) {
              groupFound = true;
              console.log(`✅ Successfully opened group: ${groupName}`);
              
              // Log what's in the header for debugging
              const headerTitle = await page.$eval('header span[title]', el => el.title).catch(() => null);
              if (headerTitle) {
                console.log(`📍 Group is part of community: ${headerTitle}`);
              }
              
              // Extra wait to ensure messages load fully
              await wait(2000);
              break;
            } else if (i < groupElements.length - 1) {
              console.log(`⚠️ Chat not loaded yet, trying next element...`);
            }
          }
        }
      } else {
        console.log(`⚠️ No elements found with exact title: ${groupName}`);
      }
    } catch (error) {
      console.log(`Error finding group: ${error.message}`);
    }
    
    // If still not found, log the error
    if (!groupFound) {
      console.log(`❌ Group not found: ${groupName}`);
      console.log(`Make sure the group name exactly matches what appears in WhatsApp`);
    }
    
    // Random delay after opening group
    if (groupFound) {
      await wait(randomDelay(1000, 3000));
    }
    
    fnTimer.end();
    return groupFound;
  } catch (error) {
    console.error(`❌ Error searching for group ${groupName}:`, error);
    fnTimer.end();
    return false;
  }
}

// Clear search box and return to chat list
async function clearSearch() {
  try {
    console.log('🧹 Clearing search...');
    
    // Press Escape multiple times to clear search and go back
    await page.keyboard.press('Escape');
    await wait(randomDelay(300, 500));
    
    await page.keyboard.press('Escape');
    await wait(randomDelay(300, 500));
    
    // Clear search box directly if it exists
    try {
      const searchBox = await page.$(SELECTORS.searchBox);
      if (searchBox) {
        await searchBox.click({ clickCount: 3 }); // Select all
        await page.keyboard.press('Backspace'); // Delete
        await page.keyboard.press('Escape'); // Exit search
        await wait(randomDelay(200, 400));
      }
    } catch (e) {
      // Search box might not be visible, that's okay
    }
    
    // Ensure we're back at main chat list
    await wait(randomDelay(500, 1000));
    console.log('✅ Search cleared');
  } catch (error) {
    console.error('Error clearing search:', error);
  }
}

// Handle application shutdown gracefully - closes browser and cleans up resources
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
  
  try {
    if (page) {
      await page.close();
    }
    
    if (browser) {
      await browser.close();
    }
    
    console.log('👋 WhatsApp Monitor stopped successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Setup signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error);
  await gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (error) => {
  console.error('💥 Unhandled Rejection:', error);
  await gracefulShutdown('unhandledRejection');
});

// Get file size for log rotation
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

// Rotate log file if it exceeds 10MB
async function rotateLogIfNeeded() {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const fileSize = await getFileSize(LOG_FILE_PATH);
  
  if (fileSize > maxSize) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedPath = LOG_FILE_PATH.replace('.txt', `-${timestamp}.txt`);
    
    try {
      await fs.rename(LOG_FILE_PATH, rotatedPath);
      console.log(`📁 Rotated log file to: ${rotatedPath}`);
    } catch (error) {
      console.error('❌ Failed to rotate log file:', error);
    }
  }
}

// Write keyword match to log file with timestamp and details
async function logMatch(groupName, sender, message, keyword, timestamp) {
  // Rotate log if needed
  await rotateLogIfNeeded();
  
  const date = new Date(timestamp);
  const formattedTime = date.toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${formattedTime}] Group: ${groupName} | Sender: ${sender} | Keyword: ${keyword} | Message: ${message.substring(0, 200)}...\n`;
  
  try {
    await fs.appendFile(LOG_FILE_PATH, logEntry);
    console.log(`📝 Logged match: ${keyword} in ${groupName}`);
  } catch (error) {
    console.error('❌ Failed to write to log file:', error);
  }
}

// Write daily summary to log file
async function writeDailySummary() {
  if (dailySummary.totalMatches === 0) return;
  
  const summaryText = `\n=== DAILY SUMMARY ${dailySummary.date} ===\n` +
    `Total matches: ${dailySummary.totalMatches}\n` +
    Object.entries(dailySummary.matches)
      .map(([key, count]) => `- ${key}: ${count} matches`)
      .join('\n') +
    '\n========================================\n\n';
  
  try {
    await fs.appendFile(LOG_FILE_PATH, summaryText);
    console.log(`📊 Daily summary written: ${dailySummary.totalMatches} total matches`);
    
    // Reset daily summary
    dailySummary = {
      date: new Date().toDateString(),
      matches: {},
      totalMatches: 0
    };
  } catch (error) {
    console.error('❌ Failed to write daily summary:', error);
  }
}

// Check if we need to write daily summary (new day)
function checkDailySummary() {
  const currentDate = new Date().toDateString();
  if (currentDate !== dailySummary.date) {
    writeDailySummary();
  }
}

// Send macOS desktop notification when keyword is found
function sendNotification(groupName, message, keyword) {
  notifier.notify({
    title: `WhatsApp Match - ${groupName}`,
    message: `${keyword}: ${message.substring(0, 100)}...`,
    sound: true,
    wait: false,
    // Click handler for notification tracking
    click: function() {
      console.log(`📱 Notification clicked for ${keyword} in ${groupName}`);
    }
  });
}

// Send batched notifications for multiple matches in same group
function sendBatchedNotifications(matches) {
  // Group matches by group name
  const groupedMatches = matches.reduce((acc, match) => {
    if (!acc[match.groupName]) {
      acc[match.groupName] = [];
    }
    acc[match.groupName].push(match);
    return acc;
  }, {});
  
  // Send notifications per group (max 3 matches shown)
  for (const [groupName, groupMatches] of Object.entries(groupedMatches)) {
    const matchCount = groupMatches.length;
    const displayMatches = groupMatches.slice(0, 3); // Max 3 matches
    
    let message = '';
    displayMatches.forEach(match => {
      message += `${match.matchedKeyword}: ${match.text.substring(0, 50)}...\n`;
    });
    
    if (matchCount > 3) {
      message += `\n...and ${matchCount - 3} more matches`;
    }
    
    notifier.notify({
      title: `WhatsApp Match - ${groupName}`,
      message: message.trim(),
      subtitle: `${matchCount} keyword match${matchCount > 1 ? 'es' : ''}`,
      sound: true,
      wait: false,
      click: function() {
        console.log(`📱 Batch notification clicked for ${groupName} (${matchCount} matches)`);
      }
    });
  }
}

// Convert WhatsApp time format (12:34 PM) to JavaScript Date object
function parseWhatsAppTime(timeString) {
  const now = new Date();
  const [time, period] = timeString.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let hour24 = hours;
  if (period === 'PM' && hours !== 12) hour24 += 12;
  if (period === 'AM' && hours === 12) hour24 = 0;
  
  const messageDate = new Date(now);
  messageDate.setHours(hour24, minutes, 0, 0);
  
  // If time is in the future, it's from yesterday
  if (messageDate > now) {
    messageDate.setDate(messageDate.getDate() - 1);
  }
  
  return messageDate;
}

// Check if message timestamp is within the last 30 minutes
function isMessageRecent(timestamp) {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - (30 * 60 * 1000));
  return timestamp >= thirtyMinutesAgo;
}

// Generate unique message ID for deduplication
function generateMessageId(groupName, sender, text, timestamp) {
  return `${groupName}-${sender}-${timestamp}-${text.substring(0, 50)}`;
}

// Check messages for keyword matches with word boundaries
function findKeywordMatches(messages) {
  const matches = [];
  
  console.log(`🔍 findKeywordMatches: Processing ${messages.length} messages`);
  console.log(`🔍 Keywords to search: ${KEYWORDS.join(', ')}`);
  
  for (const message of messages) {
    let messageHasMatch = false;
    
    for (const keyword of KEYWORDS) {
      // Create regex - use word boundaries except for specific keywords
      const useWordBoundaries = !['insta', 'I'].includes(keyword);
      const regex = useWordBoundaries 
        ? new RegExp(`\\b${keyword}\\b`, 'i')
        : new RegExp(`${keyword}`, 'i');
      
      if (DEBUG_MODE) {
        console.log(`[DEBUG] Testing "${keyword}" ${useWordBoundaries ? 'with' : 'without'} word boundaries against: "${message.text.substring(0, 50)}..."`);
      }
      
      if (regex.test(message.text)) {
        const messageId = generateMessageId(
          message.groupName,
          message.sender,
          message.text,
          message.timestamp
        );
        
        // Skip if already processed
        if (!processedMessages.has(messageId)) {
          processedMessages.set(messageId, Date.now());
          
          matches.push({
            ...message,
            matchedKeyword: keyword,
            messageId
          });
          
          // Update daily summary
          const key = `${message.groupName}-${keyword}`;
          dailySummary.matches[key] = (dailySummary.matches[key] || 0) + 1;
          dailySummary.totalMatches++;
          
          console.log(`✅ Match found: "${keyword}" in "${message.text.substring(0, 50)}..." from ${message.groupName}`);
          messageHasMatch = true;
        } else {
          console.log(`⏭️ Skip duplicate: "${keyword}" in "${message.text.substring(0, 50)}..." from ${message.groupName}`);
        }
      }
    }
    
    // Log messages that didn't match any keywords (only first few to avoid spam)
    if (!messageHasMatch && matches.length < 5) {
      console.log(`❌ No match: "${message.text.substring(0, 50)}..." from ${message.groupName}`);
    }
  }
  
  // Clean old processed messages (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [messageId, timestamp] of processedMessages.entries()) {
    if (timestamp < oneHourAgo) {
      processedMessages.delete(messageId);
    }
  }
  
  console.log(`📊 findKeywordMatches: Found ${matches.length} total matches`);
  console.log(`📊 Processed messages cache size: ${processedMessages.size}`);
  
  // Debug: Analyze processed messages
  analyzeProcessedMessages();
  
  return matches;
}

// Extract last 50 messages from current group (all messages, no time filtering)
async function extractRecentMessages(groupName) {
  const fnTimer = new PerfTimer(`extractRecentMessages(${groupName})`);
  
  try {
    console.log(`📋 Extracting messages from: ${groupName}`);
    debugLog('EXTRACT', `Starting message extraction for: ${groupName}`);
    
    // Try multiple selectors for conversation panel
    let panelFound = false;
    const panelSelectors = [
      '#main [data-testid="conversation-panel-wrapper"]',
      '#main [data-testid="conversation-panel"]', 
      '#main [role="application"]',
      '#main'
    ];
    
    for (const selector of panelSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        panelFound = true;
        console.log(`✅ Found conversation panel with selector: ${selector}`);
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!panelFound) {
      console.log('⚠️ Conversation panel not found, trying to extract messages anyway...');
    }
    
    await wait(randomDelay(1000, 2000));
    
    // Scroll to load recent messages with human-like behavior
    await page.evaluate((selectors) => {
      // Try multiple selectors to find scrollable panel
      const panelSelectors = [
        '#main [data-testid="conversation-panel-wrapper"]',
        '#main [data-testid="conversation-panel"]',
        '#main [role="application"]',
        '#main'
      ];
      
      for (const selector of panelSelectors) {
        const panel = document.querySelector(selector);
        if (panel && panel.scrollHeight > 0) {
          panel.scrollTop = panel.scrollHeight;
          break;
        }
      }
    }, SELECTORS.conversationPanel);
    
    await wait(randomDelay(500, 1000));
    
    // Occasional random scroll action
    if (Math.random() < 0.3) {
      await page.evaluate(() => {
        const panelSelectors = [
          '#main [data-testid="conversation-panel-wrapper"]',
          '#main [data-testid="conversation-panel"]',
          '#main [role="application"]',
          '#main'
        ];
        
        for (const selector of panelSelectors) {
          const panel = document.querySelector(selector);
          if (panel && panel.scrollHeight > 0) {
            panel.scrollTop = panel.scrollHeight - Math.random() * 200;
            setTimeout(() => {
              panel.scrollTop = panel.scrollHeight;
            }, 300);
            break;
          }
        }
      });
      await wait(randomDelay(300, 600));
    }
    
    // Extract messages in a single page.evaluate for performance
    const recentMessages = await page.evaluate((selectors, groupName) => {
      const messages = [];
      
      // Try multiple message container selectors
      const messageSelectors = [
        '.message-in, .message-out',
        '[data-testid^="msg-"]',
        '[data-testid="conv-msg-box"]',
        '[role="row"]'
      ];
      
      let containers = null;
      for (const selector of messageSelectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          containers = found;
          console.log(`Found ${found.length} messages with selector: ${selector}`);
          break;
        }
      }
      
      if (!containers || containers.length === 0) {
        console.log('No message containers found with any selector');
        return messages;
      }
      const messagesToProcess = Math.min(containers.length, 50);
      
      // Process only the last 50 messages
      console.log(`Processing ${messagesToProcess} messages...`);
      
      for (let i = containers.length - messagesToProcess; i < containers.length; i++) {
        try {
          const container = containers[i];
          
          // Debug: log container info
          console.log(`Message ${i}: ${container.className}, has text: ${!!container.textContent}`);
          
          // Try multiple selectors to find message text
          let text = '';
          const textSelectors = [
            '.copyable-text span',
            '.selectable-text span',
            '[data-testid="msg-text"]',
            'span[dir="ltr"]',
            'span[dir="auto"]',
            '.copyable-text',
            'span'
          ];
          
          for (const selector of textSelectors) {
            const textEl = container.querySelector(selector);
            if (textEl && textEl.textContent) {
              text = textEl.textContent.trim();
              if (text) {
                console.log(`Found text with selector ${selector}: ${text.substring(0, 50)}...`);
                break;
              }
            }
          }
          
          // If still no text, try getting all text content
          if (!text) {
            text = container.textContent ? container.textContent.trim() : '';
            if (text) {
              console.log(`Using container text: ${text.substring(0, 50)}...`);
            }
          }
          
          if (!text) {
            console.log(`No text found in message ${i}`);
            continue;
          }
          
          // Extract metadata
          const metaEl = container.querySelector(selectors.messageMeta);
          let sender = 'Unknown';
          let timeString = '';
          
          if (metaEl) {
            const metaText = metaEl.textContent;
            const parts = metaText.split(',');
            if (parts.length >= 2) {
              sender = parts[0].trim();
              timeString = parts[1].trim();
            }
          }
          
          // Alternative time extraction
          if (!timeString) {
            const timeEl = container.querySelector(selectors.messageTime);
            if (timeEl) timeString = timeEl.textContent.trim();
          }
          
          messages.push({
            sender,
            text,
            timeString,
            groupName
          });
        } catch (error) {
          console.error('Error extracting message:', error);
        }
      }
      
      console.log(`Total messages extracted: ${messages.length}`);
      return messages;
    }, SELECTORS, groupName);
    
    console.log(`📊 Raw messages extracted: ${recentMessages.length}`);
    
    // Return all messages without filtering by timestamp
    const allMessages = recentMessages.map(msg => ({
      sender: msg.sender,
      text: msg.text,
      timestamp: new Date().toISOString(), // Use current time since we're not filtering
      groupName: msg.groupName
    }));
    
    console.log(`✅ Extracted ${allMessages.length} messages from ${groupName} (checking all for keywords)`);
    return allMessages;
    
  } catch (error) {
    console.error(`❌ Error extracting messages from ${groupName}:`, error);
    return [];
  }
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, i); // Exponential backoff
      console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Wrapper for selector operations with retry
async function waitForSelectorWithRetry(selector, options = {}) {
  return retryWithBackoff(async () => {
    return await page.waitForSelector(selector, { 
      visible: true, 
      timeout: 5000,
      ...options 
    });
  }, 2, 1000);
}

// Process a single group - search, extract messages, find matches
async function processGroup(groupName) {
  try {
    // Check if group is already being scanned
    if (groupScanStatus.get(groupName)) {
      console.log(`⏭️ Skipping ${groupName} - previous scan still running`);
      return [];
    }
    
    // Mark group as being scanned
    groupScanStatus.set(groupName, true);
    
    // Search and open the group with retry for network issues
    const groupFound = await retryWithBackoff(async () => {
      return await searchAndOpenGroup(groupName);
    }, 2, 2000);
    
    if (!groupFound) {
      console.log(`⚠️ Skipping ${groupName} - not found`);
      scanErrors.push(`Group not found: ${groupName}`);
      return [];
    }
    
    // Update scan state
    scanState.lastSuccessfulGroup = groupName;
    await saveScanState();
    
    // Extract recent messages with timeout handling
    let recentMessages = [];
    try {
      recentMessages = await extractRecentMessages(groupName);
    } catch (error) {
      console.error(`❌ Failed to extract messages from ${groupName}:`, error.message);
      scanErrors.push(`Message extraction failed for ${groupName}: ${error.message}`);
      return [];
    }
    
    if (recentMessages.length === 0) {
      console.log(`📭 No recent messages in ${groupName}`);
      return [];
    }
    
    // Find keyword matches
    const matches = findKeywordMatches(recentMessages);
    
    if (matches.length > 0) {
      console.log(`🎯 Found ${matches.length} matches in ${groupName}`);
      
      // Log all matches
      for (const match of matches) {
        await logMatch(
          match.groupName,
          match.sender,
          match.text,
          match.matchedKeyword,
          match.timestamp
        );
      }
    }
    
    return matches;
  } catch (error) {
    console.error(`❌ Error processing group ${groupName}:`, error);
    scanErrors.push(`Processing error for ${groupName}: ${error.message}`);
    return [];
  } finally {
    // Mark group scan as complete
    groupScanStatus.set(groupName, false);
    
    // Clear search after processing
    await clearSearch();
  }
}

// Process multiple groups sequentially to avoid search conflicts
async function processGroupBatch(groups) {
  const batchResults = [];
  
  for (let i = 0; i < groups.length; i++) {
    const groupName = groups[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔄 Processing group ${i + 1}/${groups.length}: ${groupName}`);
    console.log(`${'='.repeat(50)}`);
    
    const result = await processGroup(groupName);
    batchResults.push(...result);
    
    console.log(`✅ Group ${groupName} processed - Found ${result.length} matches`);
    console.log(`📊 Total matches so far: ${batchResults.length}`);
    
    // Clear search and add delay between groups
    await clearSearch();
    await wait(randomDelay(1000, 2000));
  }
  
  console.log(`🏁 Batch completed - Total matches: ${batchResults.length}`);
  
  // Add delay between batches
  await wait(randomDelay(2000, 4000));
  
  return batchResults;
}

// Save scan state to file for recovery
async function saveScanState() {
  try {
    const stateFile = path.join(__dirname, 'scan-state.json');
    await fs.writeFile(stateFile, JSON.stringify(scanState, null, 2));
  } catch (error) {
    console.error('Error saving scan state:', error);
  }
}

// Load scan state from file
async function loadScanState() {
  try {
    const stateFile = path.join(__dirname, 'scan-state.json');
    const data = await fs.readFile(stateFile, 'utf8');
    const savedState = JSON.parse(data);
    Object.assign(scanState, savedState);
    console.log('📂 Loaded previous scan state');
  } catch (error) {
    // File doesn't exist or is invalid, use defaults
  }
}

// Main scanning function - processes all groups with optimizations
async function scanAllGroups() {
  if (isScanning) {
    console.log('⚠️ Scan already in progress, skipping...');
    return;
  }
  
  if (isPaused) {
    console.log('⏸️ Scanning is paused');
    return;
  }
  
  isScanning = true;
  scanErrors = []; // Reset errors
  scanState.scanStartTime = Date.now();
  const startTime = Date.now();
  const allMatches = [];
  
  try {
    console.log(`\n🔄 Starting scan cycle at ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Scanning ${TARGET_GROUPS.length} groups in batches of 3`);
    
    // Check daily summary
    checkDailySummary();
    
    // Process groups in batches of 3
    const batchSize = 3;
    const startIndex = scanState.lastProcessedIndex || 0;
    
    for (let i = startIndex; i < TARGET_GROUPS.length && !isShuttingDown && !isPaused; i += batchSize) {
      const batch = TARGET_GROUPS.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(TARGET_GROUPS.length / batchSize);
      
      console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing: ${batch.join(', ')}`);
      currentScanProgress = `Batch ${batchNumber}/${totalBatches}`;
      
      // Save state before processing
      scanState.lastProcessedIndex = i;
      await saveScanState();
      
      const batchMatches = await processGroupBatch(batch);
      allMatches.push(...batchMatches);
      
      // Progress update
      const processed = Math.min(i + batchSize, TARGET_GROUPS.length);
      console.log(`Progress: ${processed}/${TARGET_GROUPS.length} groups processed`);
      
      // Update total matches counter
      totalMatchesAllTime += batchMatches.length;
    }
    
    // Send notifications for all matches
    if (allMatches.length > 0) {
      console.log(`\n📬 SCAN SUMMARY:`);
      console.log(`  - Total matches found: ${allMatches.length}`);
      
      // Group matches by group name for summary
      const matchesByGroup = {};
      allMatches.forEach(match => {
        const group = match.groupName;
        if (!matchesByGroup[group]) {
          matchesByGroup[group] = [];
        }
        matchesByGroup[group].push(match);
      });
      
      console.log(`  - Matches by group:`);
      for (const [group, matches] of Object.entries(matchesByGroup)) {
        console.log(`    ${group}: ${matches.length} matches`);
        matches.forEach(match => {
          console.log(`      - "${match.matchedKeyword}" in "${match.text.substring(0, 40)}..."`);
        });
      }
      
      sendBatchedNotifications(allMatches);
    } else {
      console.log(`\n😴 No matches found in this scan cycle`);
    }
    
    // Log scan completion
    const duration = Date.now() - startTime;
    lastScanTime = new Date();
    console.log(`✅ Scan completed in ${Math.round(duration / 1000)} seconds`);
    
    // Show error summary if any
    if (scanErrors.length > 0) {
      console.log(`\n⚠️ Errors encountered during scan:`);
      scanErrors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Reset scan state after successful completion
    scanState.lastProcessedIndex = 0;
    scanState.lastSuccessfulGroup = null;
    await saveScanState();
    
  } catch (error) {
    console.error('❌ Error during scan cycle:', error);
    scanErrors.push(`Scan cycle error: ${error.message}`);
  } finally {
    isScanning = false;
    currentScanProgress = null;
  }
  
  return allMatches;
}

// Setup CLI command interface
function setupCLI() {
  console.log('\n📟 WhatsApp Monitor CLI Commands:');
  console.log('  scan    - Trigger immediate scan');
  console.log('  status  - Show current status');
  console.log('  pause   - Pause scanning');
  console.log('  resume  - Resume scanning');
  console.log('  quit    - Exit application');
  console.log('  help    - Show this help\n');
  
  // Setup stdin for CLI commands
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (input) => {
    const command = input.trim().toLowerCase();
    
    switch (command) {
      case 'scan':
        if (isPaused) {
          console.log('⚠️ Scanning is paused. Use "resume" first.');
        } else if (isScanning) {
          console.log('⚠️ Scan already in progress...');
        } else {
          console.log('🔄 Starting manual scan...');
          await scanAllGroups();
        }
        break;
        
      case 'status':
        console.log('\n📊 WhatsApp Monitor Status:');
        console.log(`  Last scan: ${lastScanTime ? lastScanTime.toLocaleString() : 'Never'}`);
        console.log(`  Total matches (all time): ${totalMatchesAllTime}`);
        console.log(`  Today's matches: ${dailySummary.totalMatches}`);
        console.log(`  Active groups: ${TARGET_GROUPS.length}`);
        console.log(`  Scanning: ${isScanning ? 'Yes' : 'No'}`);
        console.log(`  Paused: ${isPaused ? 'Yes' : 'No'}`);
        if (currentScanProgress) {
          console.log(`  Current progress: ${currentScanProgress}`);
        }
        console.log();
        break;
        
      case 'pause':
        isPaused = true;
        console.log('⏸️ Scanning paused');
        break;
        
      case 'resume':
        isPaused = false;
        console.log('▶️ Scanning resumed');
        break;
        
      case 'quit':
      case 'exit':
        console.log('👋 Shutting down...');
        await gracefulShutdown('CLI_QUIT');
        break;
        
      case 'help':
        setupCLI(); // Show help again
        break;
        
      default:
        console.log(`❓ Unknown command: ${command}. Type "help" for available commands.`);
    }
  });
}

// Main monitoring loop - runs initial scan and schedules periodic scans
async function runMonitoringLoop() {
  // Load previous scan state if exists
  await loadScanState();
  
  // Setup CLI interface
  setupCLI();
  
  // Display welcome message
  console.log('\n🎯 WhatsApp Keyword Monitor v1.0');
  console.log('================================');
  console.log(`📱 Monitoring ${TARGET_GROUPS.length} groups`);
  console.log(`🔍 Keywords: ${KEYWORDS.join(', ')}`);
  console.log(`⏱️ Scan interval: ${SCAN_INTERVAL_MINUTES} minutes`);
  console.log('================================\n');
  
  // Run initial scan on startup
  console.log('🚀 Running initial scan on startup...');
  await scanAllGroups();
  
  // Set up interval for periodic scans
  const scanInterval = SCAN_INTERVAL_MINUTES * 60 * 1000; // Convert to milliseconds
  console.log(`\n⏰ Scheduled scans every ${SCAN_INTERVAL_MINUTES} minutes`);
  console.log('💡 Type "help" for available commands\n');
  
  // Schedule periodic scans
  const intervalId = setInterval(async () => {
    if (!isShuttingDown && !isPaused) {
      await scanAllGroups();
    }
  }, scanInterval);
  
  // Keep the process running
  while (!isShuttingDown) {
    await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
  }
  
  // Clear interval on shutdown
  clearInterval(intervalId);
}

// Main application loop - initializes browser and monitors groups continuously
async function startMonitoring() {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!isShuttingDown && retryCount < maxRetries) {
    try {
      await initBrowser();
      
      // Start the main monitoring loop
      await runMonitoringLoop();
      
      // If we reach here, it was a clean shutdown
      break;
      
    } catch (error) {
      console.error('❌ Monitor crashed:', error);
      retryCount++;
      
      // Browser crash recovery
      if (browser && !browser.isConnected()) {
        console.log('🔧 Browser disconnected, attempting recovery...');
        browser = null;
        page = null;
      }
      
      if (retryCount < maxRetries) {
        const backoffDelay = 5000 * Math.pow(2, retryCount - 1);
        console.log(`🔄 Attempting restart (${retryCount}/${maxRetries}) in ${backoffDelay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        console.error('❌ Max retries reached. Exiting...');
        
        // Final cleanup attempt
        await gracefulShutdown('MAX_RETRIES_REACHED');
      }
    }
  }
}

// Enhanced graceful shutdown with summary
async function enhancedShutdown(signal) {
  if (isShuttingDown) return;
  
  isShuttingDown = true;
  console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
  
  // Show final summary
  console.log('\n📊 Session Summary:');
  console.log(`  Total matches found: ${totalMatchesAllTime}`);
  console.log(`  Last scan: ${lastScanTime ? lastScanTime.toLocaleString() : 'Never completed'}`);
  console.log(`  Session duration: ${Math.round((Date.now() - (scanState.scanStartTime || Date.now())) / 60000)} minutes`);
  
  if (scanErrors.length > 0) {
    console.log(`\n⚠️ Errors encountered (${scanErrors.length}):`);
    scanErrors.slice(-5).forEach(err => console.log(`  - ${err}`));
  }
  
  // Write final daily summary if needed
  if (dailySummary.totalMatches > 0) {
    await writeDailySummary();
  }
  
  // Save final state
  await saveScanState();
  
  try {
    if (page) {
      await page.close();
    }
    
    if (browser) {
      await browser.close();
    }
    
    console.log('\n✅ WhatsApp Monitor stopped successfully');
    console.log('📁 Check logs/whatsapp_matches.txt for all matches');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Override the original gracefulShutdown
const originalGracefulShutdown = gracefulShutdown;
gracefulShutdown = enhancedShutdown;

// Start the monitor with welcome message
console.clear();
console.log('🚀 Starting WhatsApp Monitor...\n');

startMonitoring().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

// Test mode for debugging individual functions
if (process.argv[2] === 'test-search' && process.argv[3]) {
  (async () => {
    await initBrowser();
    const groupName = process.argv[3];
    console.log(`Testing search for: ${groupName}`);
    const found = await searchAndOpenGroup(groupName);
    console.log(`Result: ${found ? 'Found' : 'Not found'}`);
    await gracefulShutdown('test-complete');
  })();
}