# WhatsApp Monitor Testing Instructions

## Initial Setup

1. **Install Dependencies**
   ```bash
   cd whatsapp-monitor
   npm install
   ```

2. **Configure Groups (IMPORTANT)**
   - Edit `config.js`
   - Replace the sample group names in `TARGET_GROUPS` with your actual WhatsApp group names
   - Start with just 2-3 groups for initial testing
   ```javascript
   export const TARGET_GROUPS = [
     'Your Group Name 1',
     'Your Group Name 2',
     'Test Group'
   ];
   ```

3. **Set Test Keywords**
   - The default keywords are: startup, funding, investment, pitch, investor
   - You can modify them in `config.js` if needed

## Running the Application

1. **Start the Monitor**
   ```bash
   npm start
   ```

2. **First Run - WhatsApp Login**
   - Chrome browser will open automatically
   - Navigate to WhatsApp Web
   - Scan the QR code with your phone
   - Wait for "Successfully logged in" message
   - The session will be saved for future runs

3. **CLI Commands**
   Once running, you can use these commands:
   - `scan` - Trigger immediate scan
   - `status` - Show current status and statistics
   - `pause` - Pause automatic scanning
   - `resume` - Resume automatic scanning
   - `quit` - Exit the application gracefully
   - `help` - Show available commands

## Testing Scenarios

### Test 1: Basic Functionality
1. Start the app and complete WhatsApp login
2. Send a test message containing "startup" to one of your monitored groups
3. Wait for the initial scan to complete
4. Check for:
   - Desktop notification appears
   - Match logged in console
   - Entry added to `logs/whatsapp_matches.txt`

### Test 2: CLI Commands
1. While the app is running, type `status` and press Enter
   - Should show last scan time, total matches, etc.
2. Type `pause` and press Enter
   - Scanning should pause
3. Type `resume` and press Enter
   - Scanning should resume
4. Type `scan` and press Enter
   - Should trigger immediate scan

### Test 3: Multiple Keywords
1. Send messages with different keywords to your groups:
   - "Looking for investment opportunities"
   - "Need funding for my project"
   - "Pitch deck ready"
   - "Seeking investor connections"
2. Verify each keyword triggers a notification

### Test 4: Batch Processing
1. Add 6+ groups to `TARGET_GROUPS` in config.js
2. Restart the app
3. Watch console for batch processing:
   ```
   [Batch 1/2] Processing: Group1, Group2, Group3
   [Batch 2/2] Processing: Group4, Group5, Group6
   ```

### Test 5: Error Recovery
1. Start the app and let it complete first scan
2. Disconnect internet briefly
3. Reconnect and observe:
   - Error logged
   - Retry attempts with exponential backoff
   - Recovery when connection restored

### Test 6: Session Persistence
1. Run the app and complete a scan
2. Press Ctrl+C or type `quit` to exit
3. Start the app again
4. Should auto-login without QR code

### Test 7: Crash Recovery
1. Start the app
2. Close the Chrome browser window manually
3. Watch console for:
   - Browser disconnect detection
   - Automatic restart attempt
   - Recovery from last position

### Test 8: Log Rotation
1. Let the app run and accumulate matches
2. Check `logs/whatsapp_matches.txt` size
3. When it exceeds 10MB, it should rotate to a timestamped file

## Troubleshooting

### WhatsApp Web Issues
- **QR Code not appearing**: Clear `whatsapp-session/` folder and restart
- **Login loop**: Delete session folder and re-scan QR code
- **Groups not found**: Ensure exact group name match (case-sensitive)

### Notification Issues
- **macOS**: Check System Preferences > Notifications > Terminal/Node
- **No notifications**: Run `npm test` to verify node-notifier works

### Performance Issues
- Reduce number of groups in `TARGET_GROUPS`
- Increase `SCAN_INTERVAL_MINUTES` in config.js
- Check Chrome memory usage

### Debug Mode
For detailed debugging, run with test mode:
```bash
# Test group search
node index.js test-search "Your Group Name"
```

## Expected Console Output

### Successful Start
```
🚀 Starting WhatsApp Monitor...

🎯 WhatsApp Keyword Monitor v1.0
================================
📱 Monitoring 3 groups
🔍 Keywords: startup, funding, investment, pitch, investor
⏱️ Scan interval: 30 minutes
================================

🚀 Running initial scan on startup...
🔄 Starting scan cycle at 10:30:00 AM
📊 Scanning 3 groups in batches of 3

[Batch 1/1] Processing: Group1, Group2, Group3
🔍 Searching for group: Group1
✅ Found and opened group: Group1
📋 Extracting messages from: Group1
✅ Extracted 5 recent messages from Group1
🎯 Found 2 matches in Group1
```

### Match Found
```
📝 Logged match: startup in Tech Founders Group
🎯 Found 1 matches in Tech Founders Group
📬 Total matches found: 1
✅ Scan completed in 45 seconds
```

### Status Command Output
```
📊 WhatsApp Monitor Status:
  Last scan: 12/28/2024, 10:45:00 AM
  Total matches (all time): 15
  Today's matches: 5
  Active groups: 3
  Scanning: No
  Paused: No
```

## Production Tips

1. **For 50+ Groups**
   - Start with smaller batches, gradually increase
   - Monitor CPU and memory usage
   - Consider increasing scan interval to 45-60 minutes

2. **Long-term Running**
   - Use process manager like PM2: `pm2 start index.js --name whatsapp-monitor`
   - Enable log rotation
   - Monitor disk space for logs

3. **Keywords Optimization**
   - Test keywords in actual group messages first
   - Avoid too generic terms that match frequently
   - Use word boundaries to prevent false matches

## Security Notes
- Session data stored locally in `whatsapp-session/`
- No data sent to external servers
- All processing happens locally
- Keep your computer locked when away

Happy monitoring! 🎯