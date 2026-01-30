/**
 * ABOUTME: HUB-3 PDF417 barcode generator for Croatian domestic payments
 * ABOUTME: Generates 2D barcodes per HUB-3 specification
 */

class HUB3Generator {
    constructor() {
        this.currentData = null;
        this.currentBarcode = null;
        this.canvas = null;
    }

    /**
     * Format the HUB-3 payment string
     * Format: HRVHUB30\nEUR\n[15-char amount]\n[payer]\n[payer address]\n[payer city]\n[receiver]\n[receiver address]\n[receiver city]\n[IBAN]\n[model]\n[reference]\n[intent code]\n[description]
     */
    formatPaymentString(data) {
        const parts = [
            'HRVHUB30',                        // Header
            data.currency || 'EUR',              // Currency
            this.encodeAmount(data.amount || '0'), // Amount (15 chars, no comma, padded)
            data.payerName || '',                // Payer name
            data.payerAddress || '',              // Payer address
            data.payerCity || '',                // Payer city
            data.receiverName || data.supplierName || '', // Receiver name (fallback to supplierName)
            data.receiverAddress || '',           // Receiver address
            data.receiverCity || '',             // Receiver city
            data.iban || '',                    // IBAN
            data.model || '',                    // Model
            data.reference || '',                // Reference number
            'GDSV',                           // Intent code (default: GDSV - kupovina/prodaja roba i usluga)
            this.truncate(data.invoiceNumber || data.description || '', 35) // Description (max 35 chars, use invoice number or description)
        ];

        return parts.join('\n');
    }

    encodeAmount(amount) {
        if (!amount) return '000000000000000';
        const amountWithoutComma = amount.toString().replace(',', '');
        return amountWithoutComma.padStart(15, '0');
    }

    truncate(str, maxLength) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) : str;
    }

    /**
     * Generate PDF417 barcode using bwip-js
     */
    generate(data) {
        this.currentData = data;

        const paymentString = this.formatPaymentString(data);

        // Use bwip-js library to generate the barcode
        try {
            // Check if library is loaded
            if (typeof bwipjs === 'undefined') {
                throw new Error('bwip-js library not loaded');
            }

            // Create canvas for rendering
            this.canvas = document.createElement('canvas');

            // Render PDF417 barcode with proper settings
            bwipjs.toCanvas(this.canvas, {
                bcid: 'pdf417',         // Barcode type
                text: paymentString,    // Text to encode
                scale: CONSTANTS.PDF417.SCALE,
                height: CONSTANTS.PDF417.HEIGHT,
                includetext: false,     // Show human-readable text
                eclevel: CONSTANTS.PDF417.ECLEVEL,
                columns: CONSTANTS.PDF417.COLUMNS,
                rows: CONSTANTS.PDF417.ROWS
            });

            this.currentBarcode = {
                data: paymentString,
                barcode: null,  // Not used with bwip-js
                canvas: this.canvas,
                error: false
            };

            return this.currentBarcode;
        } catch (error) {
            console.error('HUB-3 generation error:', error);
            // Return the string as fallback (will show as text)
            this.currentBarcode = {
                data: paymentString,
                barcode: null,
                canvas: null,
                error: true
            };
            return this.currentBarcode;
        }
    }

    /**
     * Render barcode to a container element
     */
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.currentBarcode) {
            return;
        }

        container.innerHTML = '';

        // If barcode generation failed, show error message
        if (this.currentBarcode.error || !this.canvas) {
            container.innerHTML = `<p class="text-error">${i18n.t('errorLibraryNotLoaded')}</p>`;
            return;
        }

        // Append the canvas directly (don't clone, cloning loses the drawing)
        container.appendChild(this.canvas);

        // Ensure the canvas is visible and styled
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0 auto';
    }

    /**
     * Download barcode as PNG
     */
    downloadAsPng(filename = 'hub3-barcode.png') {
        if (!this.canvas) return;

        const link = document.createElement('a');
        link.download = filename;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    /**
     * Download barcode as SVG - render to SVG first
     */
    downloadAsSvg(filename = 'hub3-barcode.svg') {
        try {
            // bwip-js uses render() and makeSvg() for SVG output
            const render = bwipjs.render({
                bcid: 'pdf417',
                text: this.currentBarcode.data,
                scale: CONSTANTS.PDF417.SVG_SCALE,
                height: CONSTANTS.PDF417.SVG_HEIGHT,
                includetext: false,
                eclevel: CONSTANTS.PDF417.ECLEVEL,
                columns: CONSTANTS.PDF417.COLUMNS,
                rows: CONSTANTS.PDF417.ROWS
            });

            const svgContent = render.makeSvg();

            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('SVG download error:', error);
            // Fallback: tell user SVG not available
            alert('SVG preuzimanje nije dostupno. Koristite PNG format.');
        }
    }

    /**
     * Get the raw payment string for display
     */
    getPaymentString() {
        return this.currentBarcode ? this.currentBarcode.data : '';
    }
}

const hub3Generator = new HUB3Generator();
