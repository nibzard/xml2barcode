# XML2Barcode - Agent Notes

## Development Server

### Starting the Server
```bash
python3 -m http.server 8080 > /tmp/server.log 2>&1 &
```

### Restarting the Server
When making changes to JavaScript files, you MUST restart the server:

```bash
# Kill existing server
ps aux | grep -E "python.*8080" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null

# Start new server
python3 -m http.server 8080 > /tmp/server.log 2>&1 &
```

### Verify Server is Running
```bash
# Check if server is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
# Should return: 200
```

## Browser Caching Issues

### Problem
When you modify JavaScript files (js/*.js), the browser may cache the old version and continue running it, causing errors like:

- `TypeError: X is not a function`
- `storage is not defined`
- Function signatures not matching

### Solution: Hard Refresh

When encountering caching issues, instruct the user to perform a hard refresh:

**Mac:**
- `Cmd + Shift + R`

**Windows/Linux:**
- `Ctrl + Shift + R`

This clears the browser cache and forces reload of all JavaScript files.

## Project Structure

### File Organization
```
xml2barcode/
├── index.html              # Main HTML
├── css/
│   └── styles.css          # Styles
├── js/
│   ├── i18n.js            # Internationalization
│   ├── storage.js          # LocalStorage (invoices list)
│   ├── xml-parser.js        # XML parsing
│   ├── hub3-generator.js    # PDF417 generation
│   ├── epc-generator.js     # QR code generation
│   ├── ui.js              # UI helpers
│   └── app.js             # Main app logic
├── examples/               # Sample XML invoices
├── manifest.json           # PWA manifest
├── sw.js                 # Service worker
└── README.md              # Documentation
```

### Key Files and Their Responsibilities

| File | Purpose |
|-------|---------|
| app.js | Main application logic, file handling, initialization |
| storage.js | LocalStorage management, invoices list rendering |
| ui.js | UI helpers, displayInvoiceData, theme switching |
| xml-parser.js | XML parsing, extracts invoice data |
| hub3-generator.js | PDF417 barcode generation (HUB-3 format) |
| epc-generator.js | QR code generation (EPC format) |
| i18n.js | Croatian/English translations |

## Common Patterns

### Function Naming
- **Event handlers**: `setupX()`, `handleX()`
- **Actions**: `processX()`, `renderX()`
- **Getters**: `getX()` (no side effects)

### Data Flow
1. User uploads XML file
2. `app.js:handleFiles()` validates file
3. `app.js:processFile()` calls `xmlParser.parse()`
4. `xmlParser.parse()` returns invoice data
5. `app.js:processFile()` generates barcodes via `hub3Generator` and `epcGenerator`
6. `app.js:processFile()` captures barcode data URLs
7. `app.js:processFile()` calls `storage.add()` with data URLs
8. `storage.add()` saves to localStorage
9. `app.js:processFile()` calls `ui.displayInvoiceData()`
10. `ui.displayInvoiceData()` updates DOM
11. `app.js:processFile()` calls `storage.renderInvoicesList()`
12. `storage.renderInvoicesList()` renders unified invoices list

### Important Notes

1. **No build step**: This is a vanilla JavaScript project - no compilation needed
2. **No mock mode**: Always use real data, never mock APIs
3. **LocalStorage**: All invoice history is stored in browser localStorage
4. **Server**: Python 3 http.server on port 8080
5. **Service Worker**: For PWA offline support (sw.js)

## Debugging

### Check for Syntax Errors
```bash
# Look for console errors in browser DevTools
# Common issues:
# - Missing function declarations
# - Undefined variables
# - Type mismatches
```

### Test XML Parsing
```bash
# Example XMLs in examples/ directory
# Upload and verify:
# - Invoice number extracted correctly
# - IBAN extracted correctly
# - Model/reference parsed correctly
# - Barcodes generated correctly
```

## Before Making Changes

1. **Restart server** after editing JS files
2. **Hard refresh browser** to clear cache
3. **Test with both example XML files**
4. **Check console for errors**
5. **Verify all features work** (single file, multiple files, history, downloads, print)

## Translation Keys (i18n)

All translatable text uses `data-i18n="key"` in HTML:
- `invoiceSummary`
- `historyTitle` (renamed from batchResults)
- `downloadAll`
- etc.

See js/i18n.js for full list of keys.
