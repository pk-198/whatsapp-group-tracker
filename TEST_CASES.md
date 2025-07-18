# WhatsApp Monitor Test Cases & Debugging Guide

## NEW TEST CASES FOR STEP 3: Keyword Detection & Notifications

### Test 6: Keyword Detection Tests

**Test 6.1: Word Boundary Matching**
```javascript
// Test messages to send in a group:
"startup" -> Should match
"startups" -> Should match
"startup's" -> Should match
"mystartup" -> Should NOT match
"startuptime" -> Should NOT match

// Expected: Only proper word boundaries trigger matches
// Debug: Check regex in findKeywordMatches()
```

**Test 6.2: Case Insensitive Matching**
```javascript
// Test messages:
"VOICE ai"
"Voice ai"
"voice ai idea"
"VoIcE ai"

// Expected: All should match regardless of case
// Debug: Verify 'i' flag in regex
```

**Test 6.3: Duplicate Prevention**
```javascript
// Send same message twice quickly
"Looking for voice ai"
// Expected: Only one notification
// Debug: Check processedMessages Map
```

### Test 7: Notification Tests

**Test 7.1: Single Match Notification**
```javascript
// Send one message with keyword
"Voice ai for my startup"
// Expected: One notification with group name and keyword
// Debug: Check sendNotification() function
```

**Test 7.2: Batch Notification (Multiple Matches)**
```javascript
// Send multiple messages in same group:
"voice ai"
"ai calling"
"voice agents"

// Expected: One batched notification showing up to 3 matches
// Debug: Check sendBatchedNotifications()
```

**Test 7.3: Notification Click Tracking**
```javascript
// Click on notification
// Expected: Console log "Notification clicked for..."
// Debug: Check click handler in notifier.notify()
```

### Test 8: Logging Tests

**Test 8.1: Log File Creation**
```bash
# Check log file exists
ls -la logs/whatsapp_matches.txt

# Expected: File exists with match entries
# Debug: Check file permissions
```

**Test 8.2: Log Rotation**
```bash
# Create large test file
dd if=/dev/zero of=logs/whatsapp_matches.txt bs=1M count=11

# Run app and trigger a match
# Expected: File rotated with timestamp
# Debug: Check getFileSize() and rotateLogIfNeeded()
```

**Test 8.3: Daily Summary**
```javascript
// Change system date or modify dailySummary.date
// Trigger some matches
// Expected: Daily summary written to log
// Debug: Check checkDailySummary() and writeDailySummary()
```

### Test 9: Full Integration Test

**Test 9.1: Complete Scan Cycle**
```bash
# Add test group to config.js TARGET_GROUPS
# Send test messages with keywords
npm start

# Expected output sequence:
# 1. "Starting scan cycle..."
# 2. "Processing: [GroupName]"
# 3. "Found X matches in [GroupName]"
# 4. "Logged match: [keyword] in [GroupName]"
# 5. Desktop notification appears
# 6. "Total matches this cycle: X"
# 7. "Next scan in 30 minutes..."
```

### Test Commands for Step 3

```bash
# Test keyword detection only
node -e "
const regex = new RegExp('\\\\bstartup\\\\b', 'i');
console.log('startup:', regex.test('startup'));
console.log('startups:', regex.test('startups'));
console.log('mystartup:', regex.test('mystartup'));
"

# Test notification
node -e "
import notifier from 'node-notifier';
notifier.notify({
  title: 'Test WhatsApp Match',
  message: 'startup: Test message...',
  sound: true
});
"

# Monitor log file
tail -f logs/whatsapp_matches.txt
```

## NEW TEST CASES FOR STEP 4: Scanning Engine & Scheduler

### Test 10: Batch Processing Tests

**Test 10.1: Batch Processing**
```javascript
// Add 6 test groups to config.js
// Expected: Groups processed in 2 batches of 3
// Console should show:
// "[Batch 1/2] Processing: Group1, Group2, Group3"
// "[Batch 2/2] Processing: Group4, Group5, Group6"
```

**Test 10.2: Concurrent Scan Prevention**
```javascript
// Manually trigger scanAllGroups twice quickly
await scanAllGroups();
await scanAllGroups(); // Should immediately return

// Expected: "Scan already in progress, skipping..."
// Debug: Check isScanning flag
```

**Test 10.3: Group Skip on Active Scan**
```javascript
// Set groupScanStatus.set('TestGroup', true)
// Try to process 'TestGroup'
// Expected: "Skipping TestGroup - previous scan still running"
```

### Test 11: Performance Tests

**Test 11.1: Message Extraction Performance**
```bash
# Time message extraction
console.time('extraction');
await extractRecentMessages('TestGroup');
console.timeEnd('extraction');

# Expected: < 3 seconds for 50 messages
# Debug: Check page.evaluate optimization
```

**Test 11.2: Scan Duration**
```javascript
// Monitor full scan cycle time
// Expected: Logged as "Scan completed in X seconds"
// Should complete all groups within reasonable time
```

### Test 12: Scheduler Tests

**Test 12.1: Initial Scan**
```bash
npm start
# Expected: "Running initial scan on startup..."
# Immediate scan should begin
```

**Test 12.2: Scheduled Scans**
```javascript
// Set SCAN_INTERVAL_MINUTES to 1 for testing
// Expected: New scan every minute
// Console: "Starting scan cycle at [time]"
```

**Test 12.3: Clear Search Between Groups**
```javascript
// Watch browser during scan
// Expected: Search clears after each group
// Escape key pressed twice
```

### Test 13: Error Recovery

**Test 13.1: Group Error Handling**
```javascript
// Cause error in one group (e.g., network issue)
// Expected: Error logged, other groups continue
// "Error processing group X: [error]"
```

**Test 13.2: Batch Error Recovery**
```javascript
// Simulate error in one group of a batch
// Expected: Other groups in batch still process
// Batch completes with partial results
```

### Test Commands for Step 4

```bash
# Test batch processing
node -e "
const groups = ['G1', 'G2', 'G3', 'G4', 'G5'];
const batchSize = 3;
for (let i = 0; i < groups.length; i += batchSize) {
  const batch = groups.slice(i, i + batchSize);
  console.log('Batch:', batch);
}
"

# Test concurrent scan prevention
node index.js &
sleep 5
node index.js  # Should skip

# Monitor scanning progress
npm start 2>&1 | grep -E "(Batch|Progress|completed in)"
```

### Debugging Tips for Step 4

1. **Batch Processing Issues**
   - Add console.log in processGroupBatch
   - Check Promise.all error handling
   - Verify batch size calculations

2. **Search Not Clearing**
   - Check clearSearch() calls
   - Verify Escape key simulation
   - Monitor browser state between groups

3. **Scheduler Not Working**
   - Check setInterval setup
   - Verify SCAN_INTERVAL_MINUTES value
   - Monitor intervalId clearing

4. **Performance Issues**
   - Profile page.evaluate calls
   - Check batch delay timing
   - Monitor memory usage during scans

## Test Cases to Run

### 1. Initial Setup Tests

**Test 1.1: Browser Launch**
```bash
# Run the app and verify browser opens
npm start
# Expected: Chrome browser opens with WhatsApp Web
# Debug: Check if Puppeteer is installed correctly
```

**Test 1.2: QR Code Detection**
```bash
# Run without being logged in
npm start
# Expected: "Please scan the QR code" message appears
# Debug: Check SELECTORS.qrCode in config.js
```

**Test 1.3: Session Persistence**
```bash
# Run, login, close, and run again
npm start
# Login with QR code
# Ctrl+C to stop
npm start
# Expected: Auto-login without QR code
# Debug: Check whatsapp-session/ directory exists
```

### 2. Group Search Tests

**Test 2.1: Search Existing Group**
```javascript
// Add test group name to TARGET_GROUPS in config.js
// Run the app and watch console
// Expected: "Found and opened group: [GroupName]"
// Debug: Check if group name matches exactly
```

**Test 2.2: Search Non-Existent Group**
```javascript
// Add fake group name "TestGroup12345" to TARGET_GROUPS
// Expected: "Group not found: TestGroup12345"
// Debug: Verify search selectors are correct
```

**Test 2.3: Archived Group Search**
```javascript
// Archive a group and add to TARGET_GROUPS
// Expected: "Found and opened group in archived: [GroupName]"
// Debug: Check archivedChatsButton selector
```

### 3. Message Extraction Tests

**Test 3.1: Recent Messages Only**
```javascript
// Send test message with keyword "startup"
// Expected: Message appears in extraction within 30 min
// Debug: Check parseWhatsAppTime() function
```

**Test 3.2: Keyword Detection**
```javascript
// Send messages with each keyword: voice, agent, ai
// Expected: All keywords detected and logged
// Debug: Check case sensitivity in keyword matching
```

**Test 3.3: Log File Writing**
```bash
# Send message with keyword
# Check logs/whatsapp_matches.txt
# Expected: Entry with timestamp, group, keyword, message
# Debug: Check file permissions and path
```

### 4. Notification Tests

**Test 4.1: Desktop Notification**
```javascript
// Send message with keyword
// Expected: macOS notification popup appears
// Debug: Check System Preferences > Notifications > Terminal/Node
```

### 5. Error Handling Tests

**Test 5.1: Network Disconnection**
```bash
# Start app, then disconnect internet
# Expected: Error logged, app attempts retry
# Debug: Check retry logic in startMonitoring()
```

**Test 5.2: WhatsApp Logout**
```bash
# Start app, then logout from WhatsApp on phone
# Expected: App detects logout and prompts for QR
# Debug: Check login status detection
```

## Debugging Commands

### Enable Debug Logging
```javascript
// Add to index.js for verbose logging
const DEBUG = true;

// Wrap console.logs with debug check
if (DEBUG) console.log('Debug:', variable);
```

### Test Individual Functions
```javascript
// Add test mode to index.js
if (process.argv[2] === 'test') {
  await initBrowser();
  
  // Test specific function
  const found = await searchAndOpenGroup('Test Group Name');
  console.log('Group found:', found);
  
  process.exit(0);
}
```

### Monitor Selector Changes
```javascript
// Add selector validation
async function validateSelectors() {
  for (const [name, selector] of Object.entries(SELECTORS)) {
    try {
      await page.waitForSelector(selector, { timeout: 1000 });
      console.log(`✅ ${name}: ${selector}`);
    } catch {
      console.log(`❌ ${name}: ${selector} - NOT FOUND`);
    }
  }
}
```

### Performance Monitoring
```javascript
// Add timing logs
const startTime = Date.now();
await searchAndOpenGroup(groupName);
console.log(`Group search took: ${Date.now() - startTime}ms`);
```

## Common Issues & Solutions

### Issue 1: Selectors Not Working
- WhatsApp Web updates frequently
- Solution: Inspect element and update selectors in config.js
- Use data-testid attributes when available

### Issue 2: Messages Not Detected
- Time parsing might be incorrect
- Solution: Log timeString format and adjust parseWhatsAppTime()

### Issue 3: Notifications Not Showing
- macOS permissions required
- Solution: System Preferences > Security & Privacy > Notifications

### Issue 4: Session Not Persisting
- Directory permissions issue
- Solution: Check write permissions for whatsapp-session/

### Issue 5: High CPU Usage
- Too many groups or short intervals
- Solution: Increase SCAN_INTERVAL_MINUTES or reduce TARGET_GROUPS

## Test Data Setup

### Create Test Messages
```javascript
// Test message templates
const testMessages = [
  "Looking for voice agents",
  "Series A funding closed"
  //more
];
```

### Simulate Different Scenarios
```javascript
// Add to config.js for testing
export const TEST_MODE = process.env.TEST_MODE === 'true';
export const TEST_GROUPS = ['Test Group 1', 'Test Group 2'];

// Use TEST_GROUPS when in test mode
const groupsToMonitor = TEST_MODE ? TEST_GROUPS : TARGET_GROUPS;
```

## Run Specific Tests

```bash
# Test login flow
node index.js test-login

# Test group search
node index.js test-search "Group Name"

# Test message extraction
node index.js test-messages

# Test notifications
node index.js test-notify
```