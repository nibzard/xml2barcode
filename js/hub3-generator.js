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
     * Format: HR00|IBAN|Amount|Currency|Model|Reference|Purpose|Name
     */
    formatPaymentString(data) {
        const parts = [
            'HR00',                              // Format identifier
            data.iban || '',                     // IBAN
            data.amount || '',                   // Amount
            data.currency || 'EUR',              // Currency
            data.model || '',                    // Model
            data.reference || '',                // Reference number
            i18n.t('purposeDefault'),            // Purpose code
            this.truncate(data.supplierName || '', 30) // Supplier name (max 30 chars)
        ];

        return parts.join('|');
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
                scale: 2,               // Scale factor (smaller = better for mobile)
                height: 20,             // Module height (in pixels) - doubled for better scanning
                includetext: false,     // Show human-readable text
                eclevel: 5,             // Error correction level (0-8)
                columns: 6,             // Number of columns (fewer = wider barcode)
                rows: 0                 // Auto-calculate rows
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

        // Update the payment string display
        const stringContainer = document.getElementById('hub3String');
        if (stringContainer) {
            stringContainer.textContent = this.currentBarcode.data;
        }

        // If barcode generation failed, show error message
        if (this.currentBarcode.error || !this.canvas) {
            container.innerHTML = '<p class="text-error">PDF417 biblioteka nije učitana. Bar kod se neće prikazati, ali su podaci ispravni.</p>';
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
                scale: 2,
                height: 20,
                includetext: false,
                eclevel: 5,
                columns: 6,
                rows: 0
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
