// Debug helper functions for comprehensive logging

// Enable debug mode via environment variable or flag
export const DEBUG_MODE = process.env.DEBUG === 'true' || process.argv.includes('--debug');

// Console colors for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Debug logger with color coding
export function debugLog(category, message, data = null) {
  if (!DEBUG_MODE) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const categoryColors = {
    'SEARCH': colors.blue,
    'EXTRACT': colors.green,
    'ERROR': colors.red,
    'SUCCESS': colors.green,
    'WARNING': colors.yellow,
    'INFO': colors.cyan,
    'DOM': colors.magenta
  };
  
  const color = categoryColors[category] || colors.reset;
  console.log(`${color}[${timestamp}] [${category}]${colors.reset} ${message}`);
  
  if (data) {
    console.log(`${color}  └─ Data:${colors.reset}`, JSON.stringify(data, null, 2));
  }
}

// Log DOM state for debugging
export async function logDOMState(page, context) {
  if (!DEBUG_MODE) return;
  
  const domInfo = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasMainElement: !!document.querySelector('#main'),
      hasChatList: !!document.querySelector('[aria-label="Chat list"]'),
      hasSearchBox: !!document.querySelector('[aria-label="Search input textbox"]'),
      messageContainers: {
        '.message-in': document.querySelectorAll('.message-in').length,
        '.message-out': document.querySelectorAll('.message-out').length,
        '[data-testid^="msg-"]': document.querySelectorAll('[data-testid^="msg-"]').length,
        '[role="row"]': document.querySelectorAll('[role="row"]').length
      },
      visibleText: Array.from(document.querySelectorAll('span')).slice(0, 5).map(el => el.textContent?.trim()).filter(Boolean)
    };
  });
  
  debugLog('DOM', `DOM State at ${context}`, domInfo);
}

// Log selector search results
export async function logSelectorSearch(page, selector, context) {
  if (!DEBUG_MODE) return;
  
  const results = await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    return {
      selector: sel,
      count: elements.length,
      firstFew: Array.from(elements).slice(0, 3).map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        textContent: el.textContent?.substring(0, 50)
      }))
    };
  }, selector);
  
  debugLog('DOM', `Selector search for "${selector}" in ${context}`, results);
}

// Performance timer
export class PerfTimer {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    if (DEBUG_MODE) {
      debugLog('INFO', `⏱️ Starting timer: ${name}`);
    }
  }
  
  end() {
    const duration = Date.now() - this.startTime;
    if (DEBUG_MODE) {
      debugLog('INFO', `⏱️ ${this.name} completed in ${duration}ms`);
    }
    return duration;
  }
}

// Log function entry and exit
export function logFunction(fnName) {
  return function decorator(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      if (DEBUG_MODE) {
        debugLog('INFO', `→ Entering ${fnName || propertyKey}`, { args });
      }
      
      try {
        const result = await originalMethod.apply(this, args);
        if (DEBUG_MODE) {
          debugLog('INFO', `← Exiting ${fnName || propertyKey}`, { success: true });
        }
        return result;
      } catch (error) {
        if (DEBUG_MODE) {
          debugLog('ERROR', `✗ Error in ${fnName || propertyKey}`, { error: error.message });
        }
        throw error;
      }
    };
    
    return descriptor;
  };
}