# Can use this one-time script in console to get whatsap group names
 - Note, currently whatsapp has to be scrolled continously to see more groups , and collect their names (one time manual activity though)

         // Run this in WhatsApp Web browser console after all groups are loaded:

         // Method 1: Get all group names from the chat list
         const groupNames = [];
         const chatElements = document.querySelectorAll('[role="gridcell"] span[title]');

         chatElements.forEach(el => {
         const title = el.title;
         // add more keywords here that you can find in group names
         if (title && (title.toLowerCase().includes('startup') || title.toUpperCase().includes('YC'))) {
            groupNames.push(title);
         }
         });

         // Remove duplicates and sort
         const uniqueGroups = [...new Set(groupNames)].sort();
         console.log("Groups found:", uniqueGroups);
         console.log("Total found:", uniqueGroups.length);
         console.log("Copy this array:");
         console.log(JSON.stringify(uniqueGroups, null, 2));

# WhatsApp Monitor

A local monitoring system that periodically scans WhatsApp groups for specific keywords and sends desktop notifications when matches are found.

## Features

- 🔍 Monitors multiple WhatsApp groups for keywords
- 🔔 Desktop notifications for keyword matches
- ⏰ Configurable scan intervals (default: 30 minutes)
- 💾 Session persistence (no repeated QR scanning)
- 📝 Detailed logging of all matches
- 🗂️ Supports both regular and archived groups

## Prerequisites

- Node.js (v14 or higher)
- macOS (for desktop notifications)
- Chrome/Chromium browser

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd whatsapp-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Create configuration file:
```bash
cp config.example.js config.js
```

4. Edit `config.js` with your settings:
   - Add your WhatsApp group names to `TARGET_GROUPS`
   - Add keywords to monitor in `KEYWORDS`
   - Adjust `SCAN_INTERVAL_MINUTES` if needed


## CLI Commands
   Once running, you can use these commands:
   - `scan` - Trigger immediate scan
   - `status` - Show current status and statistics
   - `pause` - Pause automatic scanning
   - `resume` - Resume automatic scanning
   - `quit` - Exit the application gracefully
   - `help` - Show available commands

## Usage

Run the monitor:
```bash
npm start
```

On first run:
1. A Chrome browser window will open
2. Scan the WhatsApp Web QR code with your phone
3. The session will be saved for future runs

The monitor will:
- Scan all configured groups every 30 minutes
- Show desktop notifications for keyword matches
- Log all matches to `logs/whatsapp_matches.txt`

## Configuration

Edit `config.js` to customize:

- `TARGET_GROUPS`: Array of WhatsApp group names to monitor
- `KEYWORDS`: Array of keywords to search for (case-insensitive)
- `SCAN_INTERVAL_MINUTES`: Time between scans (default: 30)
- `PUPPETEER_OPTIONS`: Browser launch settings
- `SELECTORS`: WhatsApp Web element selectors
- `TIMEOUTS`: Various operation timeouts

## Project Structure

```
whatsapp-monitor/
├── index.js          # Main application file
├── config.js         # Configuration (create from config.example.js)
├── config.example.js # Example configuration template
├── package.json      # Node.js dependencies
├── whatsapp-session/ # Browser session data (auto-created)
└── logs/            # Match logs (auto-created)
```

## Troubleshooting

**Browser doesn't open:**
- Ensure Chrome/Chromium is installed
- Check Puppeteer installation: `npm install puppeteer`

**QR code appears every time:**
- Check `whatsapp-session/` directory permissions
- Delete the directory and rescan: `rm -rf whatsapp-session/`

**No notifications:**
- macOS only: Check System Preferences > Notifications
- Ensure Terminal/node has notification permissions

**Groups not found:**
- Verify exact group names in config.js
- Check if groups are archived (supported)
- Ensure you're a member of the groups

## Privacy & Security

- All data stays local on your machine
- No external servers or APIs used
- WhatsApp session stored locally
- Logs stored locally in `logs/` directory

## License

MIT

## Disclaimer

This tool is for personal use only. Please respect WhatsApp's Terms of Service and privacy of group members.