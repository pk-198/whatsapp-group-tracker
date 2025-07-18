# WhatsApp Monitor Debug Guide

## Running in Debug Mode

To run the application with verbose debugging output:

```bash
npm run start:debug
```

Or:

```bash
DEBUG=true npm start
```

## Debug Features

When running in debug mode, you'll see:

1. **Performance Timers**: Execution time for each major function
2. **DOM State Logging**: Current state of the WhatsApp Web page at key points
3. **Selector Search Results**: What elements are found with each selector
4. **Detailed Error Messages**: More context when things go wrong
5. **Message Extraction Details**: Step-by-step logging of message parsing

## Browser Console Debugging

When the app is running and a chat is open, you can:

1. **Run the debug script**: Copy and paste the contents of `debug-script.js` into the browser console
2. **Check specific selectors**: 
   ```javascript
   document.querySelectorAll('.message-in, .message-out').length
   ```
3. **Inspect message structure**:
   ```javascript
   const msg = document.querySelector('.message-in');
   console.log(msg.innerHTML);
   ```

## Common Issues & Debug Steps

### Issue: "No messages extracted"

1. Run in debug mode: `npm run start:debug`
2. Look for the line: `[DEBUG] Selector "..." found X elements`
3. If all selectors show 0 elements, run `debug-script.js` in browser console
4. Share the console output for analysis

### Issue: "Group not found"

1. Check the exact group name in WhatsApp
2. Look for: `Found titles in search:` in the output
3. Ensure the group name matches exactly (case-sensitive)

### Issue: "Chat not opening"

1. Look for: `Chat detection results:` in the output
2. Check which detection criteria are failing
3. Manually verify the chat opened in the browser

## Debug Output Interpretation

### Success Flow
```
🔍 SEARCHING FOR GROUP: GroupName
✅ Search button found
✅ Search box found
⌨️ Typing group name: "GroupName"
✅ Successfully opened group: GroupName
📋 Extracting messages from: GroupName
✅ Found conversation panel with selector: #main
[SUCCESS] Using selector: .message-in, .message-out (found 22 messages)
Processing 22 messages...
```

### Failure Points
- `❌ Search button not found` - WhatsApp UI may have changed
- `No message containers found` - Message selectors need updating
- `0 recent messages` - Time parsing or filtering issues

## Sharing Debug Information

When reporting issues, please include:

1. Full console output from debug mode
2. Results from running `debug-script.js` 
3. Screenshot of the browser window
4. Your WhatsApp Web language settings
5. Browser and OS versions

## Advanced Debugging

### Check Specific Selectors
```bash
# In browser console
document.querySelector('#main') // Should exist
document.querySelectorAll('.message-in').length // Should be > 0
document.querySelector('[aria-label="Search input textbox"]') // Search box
```

### Monitor Real-time Changes
```javascript
// Watch for DOM changes
const observer = new MutationObserver((mutations) => {
  console.log('DOM changed:', mutations.length, 'mutations');
});
observer.observe(document.body, { childList: true, subtree: true });
```

### Export Full Page State
```javascript
// Save current page state for analysis
const state = {
  url: location.href,
  title: document.title,
  mainExists: !!document.querySelector('#main'),
  messageCount: document.querySelectorAll('.message-in, .message-out').length,
  html: document.documentElement.outerHTML
};
console.save(state, 'whatsapp-state.json');
```