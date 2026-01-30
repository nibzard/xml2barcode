/**
 * ABOUTME: UI helper functions for XML2Barcode
 * ABOUTME: Handles theme toggling, tab switching, and UI interactions
 */

class UI {
    constructor() {
        this.currentInvoiceData = null;
        this.init();
    }

    init() {
        this.setupThemeToggle();
        this.setupLanguageToggle();
        this.setupTabSwitching();
        this.setupCopyButton();
        this.setupDownloadButtons();
        this.setupPrintButton();
        this.setupClearHistoryButton();
    }

    /**
     * Theme toggle (dark/light mode)
     */
    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return;

        // Load saved theme or use system preference
        const savedTheme = localStorage.getItem('xml2barcode-theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        } else if (systemDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
        }

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('xml2barcode-theme', newTheme);
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        });
    }

    /**
     * Language toggle
     */
    setupLanguageToggle() {
        const langToggle = document.getElementById('langToggle');
        if (!langToggle) return;

        langToggle.addEventListener('click', () => {
            i18n.toggleLanguage();
        });
    }

    /**
     * Tab switching (HUB-3 vs EPC)
     */
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                // Update button states
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update content visibility
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}Tab`).classList.add('active');
            });
        });
    }

    /**
     * Copy payment details to clipboard
     */
    setupCopyButton() {
        const copyBtn = document.getElementById('copyDetailsBtn');
        if (!copyBtn) return;

        copyBtn.addEventListener('click', () => {
            if (!this.currentInvoiceData) return;

            const data = this.currentInvoiceData;
            const text = `IBAN: ${data.iban}\nIznos: ${data.amount} ${data.currency}\nModel: ${data.model}\nPoziv na broj: ${data.reference}\nSvrha: ${i18n.t('purposeDefault')}\nPrimatelj: ${data.supplierName}`;

            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyBtn.textContent;
                copyBtn.textContent = i18n.t('copied');
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        });
    }

    /**
      * Download buttons for barcodes
      */
    setupDownloadButtons() {
        const hubBtn = document.getElementById('downloadHub3Png');
        const epcBtn = document.getElementById('downloadEpcPng');
        if (hubBtn) hubBtn.addEventListener('click', () => {
            hub3Generator.downloadAsPng(`${this.currentInvoiceData?.invoiceNumber || 'hub3'}-barcode.png`);
        });
        if (epcBtn) epcBtn.addEventListener('click', () => {
            epcGenerator.downloadAsPng(`${this.currentInvoiceData?.invoiceNumber || 'epc'}-qrcode.png`);
        });
    }

    /**
     * Print invoice button
     */
    setupPrintButton() {
        const printBtn = document.getElementById('printSelectedBtn');
        if (!printBtn) return;

        printBtn.addEventListener('click', () => {
            this.printSelectedInvoices();
        });
    }

    /**
     * Clear history button
     */
    setupClearHistoryButton() {
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (!clearBtn) return;

        clearBtn.addEventListener('click', () => {
            if (confirm(i18n.currentLang === 'hr' ? 'Želite li obrisati povijest?' : 'Clear history?')) {
                storage.clear();
                this.renderInvoicesList();
            }
        });
    }

    /**
     * Display invoice data in the UI
     */
    displayInvoiceData(data) {
        debug.info('UI', 'displayInvoiceData called with: ' + data.invoiceNumber);
        this.currentInvoiceData = data;

        // Invoice summary
        document.getElementById('invoiceNumber').textContent = data.invoiceNumber || '-';
        document.getElementById('invoiceDate').textContent = this.formatDate(data.invoiceDate);
        document.getElementById('supplier').textContent = data.supplierName || data.supplier || '-';
        document.getElementById('amount').textContent = `${data.amount || '0'} ${data.currency || ''}`;

        debug.info('UI', 'Set DOM elements - invoiceNumber: ' + document.getElementById('invoiceNumber').textContent);
        debug.info('UI', 'Set DOM elements - supplier: ' + document.getElementById('supplier').textContent);

        // Payment details
        document.getElementById('iban').textContent = this.formatIBAN(data.iban || '-');
        document.getElementById('model').textContent = data.model || '-';
        document.getElementById('reference').textContent = data.reference || '-';
        document.getElementById('purpose').textContent = i18n.t('purposeDefault');

        // Validation messages
        const validationContainer = document.getElementById('validationMessages');
        if (data.warnings && data.warnings.length > 0) {
            validationContainer.innerHTML = `
                <ul>
                    ${data.warnings.map(w => `<li>${this.escapeHtml(w)}</li>`).join('')}
                </ul>
            `;
            validationContainer.className = 'validation-messages warning';
            validationContainer.classList.remove('hidden');
        } else {
            validationContainer.classList.add('hidden');
        }

        // Generate and render barcodes
        hub3Generator.generate(data);
        hub3Generator.render('hub3Barcode');

        // Show results section
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.classList.remove('hidden');
        debug.info('Display', 'Showing results: ' + data.invoiceNumber);

        // Scroll to results on mobile - use setTimeout to ensure DOM is ready
        if (window.innerWidth <= 640) {
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'auto', block: 'start' });
                debug.info('Display', 'Scrolled to results');
            }, 100);
        }
    }

    /**
      * Load invoice from history
      */
    loadInvoiceFromHistory(item) {
        this.displayInvoiceData(item);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
      * Render invoices list
      */
    renderInvoicesList() {
        storage.renderInvoicesList();
    }

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';

        const date = new Date(dateStr);
        const lang = i18n.currentLang === 'hr' ? 'hr-HR' : 'en-US';
        return date.toLocaleDateString(lang, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Format IBAN for display (add spaces)
     */
    formatIBAN(iban) {
        if (!iban || iban === '-') return iban;
        // Add spaces every 4 characters
        return iban.replace(/(.{4})/g, '$1 ').trim();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Print invoice with barcode
     */
    printInvoice() {
        if (!this.currentInvoiceData) return;

        const data = this.currentInvoiceData;
        const hub3Canvas = document.querySelector('#hub3Barcode canvas');
        const epcCanvas = document.querySelector('#epcQrCode canvas, #epcQrCode img');

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert(i18n.currentLang === 'hr' ? 'Onemogućeno skočno prozore. Dopustite skočne prozore za ovu stranicu.' : 'Popup blocked. Please allow popups for this site.');
            return;
        }

        const lang = i18n.currentLang === 'hr' ? 'hr' : 'en';

        printWindow.document.write(`
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <title>${data.invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 2rem; color: #000; }
        .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #000; padding-bottom: 1rem; }
        .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
        .section { margin-bottom: 2rem; }
        .section h2 { font-size: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
        .row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
        .label { font-weight: 600; }
        .barcode-section { text-align: center; margin-top: 2rem; page-break-inside: avoid; }
        .barcode-section h2 { font-size: 1rem; margin-bottom: 1rem; }
        .barcode-container { display: flex; justify-content: center; gap: 2rem; margin-top: 1rem; }
        .barcode-item img, .barcode-item canvas { max-width: 300px; height: auto; }
        .barcode-label { font-size: 0.875rem; margin-top: 0.5rem; }
        @media print { .no-print { display: none; } }
        @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } .barcode-container { flex-direction: column; align-items: center; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>${i18n.t('invoiceSummary')}</h1>
    </div>

    <div class="grid">
        <div class="section">
            <h2>${i18n.t('invoiceSummary')}</h2>
            <div class="row"><span class="label">${i18n.t('invoiceNumber')}:</span> <span>${this.escapeHtml(data.invoiceNumber || '-')}</span></div>
            <div class="row"><span class="label">${i18n.t('invoiceDate')}:</span> <span>${this.formatDate(data.invoiceDate)}</span></div>
            <div class="row"><span class="label">${i18n.t('supplier')}:</span> <span>${this.escapeHtml(data.supplierName || '-')}</span></div>
            <div class="row"><span class="label">${i18n.t('amount')}:</span> <span>${data.amount || '0'} ${data.currency || ''}</span></div>
        </div>

        <div class="section">
            <h2>${i18n.t('paymentDetails')}</h2>
            <div class="row"><span class="label">IBAN:</span> <span>${this.formatIBAN(data.iban || '-')}</span></div>
            <div class="row"><span class="label">${i18n.t('model')}:</span> <span>${this.escapeHtml(data.model || '-')}</span></div>
            <div class="row"><span class="label">${i18n.t('reference')}:</span> <span>${this.escapeHtml(data.reference || '-')}</span></div>
            <div class="row"><span class="label">${i18n.t('purpose')}:</span> <span>${i18n.t('purposeDefault')}</span></div>
        </div>
    </div>

    <div class="barcode-section">
        <h2>Bar Kodovi / QR Kodovi</h2>
        <div class="barcode-container">
            <div class="barcode-item">
                ${hub3Canvas ? `<img src="${hub3Canvas.toDataURL()}" alt="HUB-3 PDF417">` : ''}
                <div class="barcode-label">HUB-3 (HRK)</div>
            </div>
            <div class="barcode-item">
                ${epcCanvas ? `<img src="${epcCanvas.src || epcCanvas.toDataURL()}" alt="EPC QR">` : ''}
                <div class="barcode-label">EPC QR (EUR)</div>
            </div>
        </div>
    </div>

    <div class="no-print" style="text-align: center; margin-top: 2rem;">
        <button onclick="window.print()" style="padding: 0.75rem 1.5rem; font-size: 1rem; cursor: pointer;">Print</button>
    </div>
</body>
</html>
        `);

        printWindow.document.close();
    }

    /**
     * Print selected invoices with barcodes in 2-column grid
     */
    printSelectedInvoices() {
        const selectedItems = storage.getSelectedItems();

        if (selectedItems.length === 0) {
            this.printInvoice();  // Fallback to single
            return;
        }

        // Generate barcodes for selected items
        const printItems = selectedItems.map(item => {
            let barcodeDataUrl = null;
            if (item.hub3String) {
                try {
                    const canvas = document.createElement('canvas');
                    bwipjs.toCanvas(canvas, {
                        bcid: 'pdf417', text: item.hub3String,
                        scale: CONSTANTS.PDF417.SCALE, height: CONSTANTS.PDF417.HEIGHT, includetext: false,
                        eclevel: CONSTANTS.PDF417.ECLEVEL_HIGH, columns: CONSTANTS.PDF417.COLUMNS, rows: CONSTANTS.PDF417.ROWS
                    });
                    barcodeDataUrl = canvas.toDataURL('image/png');
                } catch (e) { console.error('Barcode error:', e); }
            }
            return {
                invoiceNumber: item.invoiceNumber,
                supplierName: item.supplierName,
                amount: item.amount, currency: item.currency,
                barcodeDataUrl: barcodeDataUrl
            };
        }).filter(item => item.barcodeDataUrl);

        if (printItems.length === 0) {
            alert(i18n.currentLang === 'hr' ? 'Nema bar kodova' : 'No barcodes');
            return;
        }

        // Open print window with grid layout
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Popup blocked'); return; }

        const lang = i18n.currentLang === 'hr' ? 'hr' : 'en';
        const date = new Date().toLocaleDateString(lang === 'hr' ? 'hr-HR' : 'en-US');

        printWindow.document.write(`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <title>${i18n.t('printSelected')} - ${printItems.length}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, sans-serif; padding: 1rem; color: #000; background: white; }
        .print-header { text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #000; }
        .print-header h1 { font-size: 1.25rem; }
        .print-header p { font-size: 0.875rem; color: #666; }
        .print-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .print-item { border: 2px solid #000; padding: 0.75rem; page-break-inside: avoid; }
        .print-item-header { display: flex; justify-content: space-between; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.5rem; }
        .print-item-supplier { font-size: 0.8rem; margin-bottom: 0.25rem; }
        .print-item-amount { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
        .print-item-barcode { text-align: center; padding: 0.25rem; background: #f5f5f5; }
        .print-item-barcode img { max-width: 100%; height: auto; }
        @media print { .no-print { display: none; } body { padding: 0; } }
    </style>
</head>
<body>
    <div class="print-header">
        <h1>${i18n.t('invoicesTitle')} - ${printItems.length}</h1>
        <p>${date}</p>
    </div>
    <div class="print-grid">
        ${printItems.map(item => `
            <div class="print-item">
                <div class="print-item-header">
                    <span>${this.escapeHtml(item.invoiceNumber)}</span>
                </div>
                <div class="print-item-supplier">${this.escapeHtml(item.supplierName)}</div>
                <div class="print-item-amount">${item.amount} ${item.currency}</div>
                <div class="print-item-barcode">
                    <img src="${item.barcodeDataUrl}" alt="HUB-3">
                </div>
            </div>
        `).join('')}
    </div>
    <div class="no-print" style="text-align: center; margin-top: 2rem;">
        <button onclick="window.print()" style="padding: 0.75rem 1.5rem; cursor: pointer;">
            ${i18n.currentLang === 'hr' ? 'Ispiši' : 'Print'}
        </button>
    </div>
</body>
</html>`);
        printWindow.document.close();
    }

    /**
     * Show loading state
     */
    showLoading() {
        const dropZone = document.getElementById('dropZone');
        dropZone.classList.add('loading');
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const dropZone = document.getElementById('dropZone');
        dropZone.classList.remove('loading');
    }

    /**
     * Show error message
     */
    showError(message) {
        const validationContainer = document.getElementById('validationMessages');
        validationContainer.innerHTML = `<p>${this.escapeHtml(message)}</p>`;
        validationContainer.className = 'validation-messages error';
        validationContainer.classList.remove('hidden');
    }

    /**
     * Clear all error messages
     */
    clearErrors() {
        const validationContainer = document.getElementById('validationMessages');
        validationContainer.classList.add('hidden');
    }

    /**
     * Clear current invoice display (used when next file fails)
     */
    clearCurrentDisplay() {
        const resultsSection = document.getElementById('resultsSection');
        const barcodeContainer = document.getElementById('hub3Barcode');

        if (barcodeContainer) {
            barcodeContainer.innerHTML = '';
        }
    }

    /**
      * Reset the UI to initial state
      */
    reset() {
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('validationMessages').classList.add('hidden');
        this.currentInvoiceData = null;
    }
}

const ui = new UI();
