# XML2Barcode - E-Račun u Bar Kod

[Live Demo](https://nibzard.github.io/xml2barcode/) · A 100% client-side web application that converts Croatian e-racun XML files into payment barcodes (HUB-3 PDF417 and EPC QR codes) for mobile banking payment scanning.

## Features

- **100% Client-Side Processing** - All processing happens in your browser. No data is sent to any server.
- **Dual Barcode Generation**
  - HUB-3 PDF417 for domestic HRK payments
  - EPC QR codes for SEPA EUR payments
- **Batch Processing** - Upload multiple XML files at once and download all barcodes as ZIP
- **Local History** - Recent conversions are stored locally for quick access
- **Printable Invoices** - Generate formatted invoices with embedded barcodes
- **Dark Mode** - Automatic system preference detection with manual toggle
- **Bilingual** - Croatian and English language support
- **PWA Support** - Installable on mobile devices, works offline

## How to Use

1. **Upload XML File**
   - Drag and drop your e-racun XML file onto the upload area
   - Or click to select a file

2. **View Results**
   - The app will parse the XML and display invoice details
   - Both HUB-3 PDF417 and EPC QR codes will be generated

3. **Download or Print**
   - Download barcodes as PNG or SVG
   - Print the invoice with embedded barcodes

## Supported Formats

### Input
- UBL Invoice 2.1 format (Croatian e-racun standard)
- Files with `.xml` extension

### Output
- **HUB-3 PDF417** - For domestic payments (HRK)
  - Format: `HR00|IBAN|Amount|Currency|Model|Reference|Purpose|Name`
- **EPC QR Code** - For SEPA payments (EUR)
  - Format per EPC069-12 v3.1 standard

## Security & Privacy

- **No Server-Side Processing** - All logic runs in your browser
- **No External API Calls** - Except CDN for libraries (auditable)
- **Open Source** - Full code visibility on GitHub
- **No Tracking** - No analytics, no cookies
- **HTTPS Only** - Enforced by GitHub Pages
- **Local Storage Only** - History is stored in your browser's localStorage

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Vanilla JavaScript + HTML/CSS |
| QR Generation | qrcode.js |
| PDF417 Generation | pdf417-js |
| XML Parsing | Browser DOMParser API |
| Hosting | GitHub Pages |

## Project Structure

```
xml2barcode/
├── index.html          # Main application
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
├── css/
│   └── styles.css     # Application styles
├── js/
│   ├── i18n.js        # Internationalization
│   ├── storage.js     # localStorage management
│   ├── xml-parser.js  # XML parsing utilities
│   ├── hub3-generator.js  # HUB-3 PDF417 generation
│   ├── epc-generator.js   # EPC QR code generation
│   ├── ui.js          # UI helpers
│   └── app.js         # Main application logic
└── examples/          # Sample XML files
```

## Development

### Local Testing

1. Clone the repository
2. Serve the files using a local server (required for service worker):

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve

# Or use any static file server
```

3. Open `http://localhost:8000` in your browser

### Building for Production

No build step required! The app uses vanilla JavaScript and CDN-hosted libraries.

To deploy:

1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select the branch to serve from

## Supported Croatian Banks

The generated barcodes are compatible with mobile banking apps from:

- PBZ (Privredna banka Zagreb)
- ZABA (Zagrebačka banka)
- OTP banka
- Addiko Bank
- Erste Bank
- Raiffeisen Bank
- Split banka
- HPB (Hrvatska poštanska banka)
- And all other Croatian banks with mobile banking

## Testing

Test the app with the included example XML files in the `/examples` directory:

- `260021751-99-02.xml` - CROATIA OSIGURANJE insurance invoice
- `2000012603-R900-800.xml` - Telecom invoice

## Known Limitations

- Only UBL Invoice 2.1 format is supported
- PDF417 barcode size may be large for complex invoices
- Some mobile banking apps may have difficulty scanning large PDF417 codes

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - feel free to use this project for any purpose.

## Resources

- [HUB-3 Specification](https://hub.hr/sites/default/files/inline-files/2DBK_EUR_Uputa_0.pdf)
- [EPC069-12 v3.1 Specification](https://www.europeanpaymentscouncil.eu/)
- [Croatian Fina](https://fina.hr/)

## Changelog

### v1.0.0 (2025-01-26)
- Initial release
- UBL Invoice XML parsing
- HUB-3 PDF417 generation
- EPC QR code generation
- Batch processing
- Local history
- Dark mode
- Bilingual support (HR/EN)
- PWA support
