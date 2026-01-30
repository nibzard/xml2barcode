/**
 * ABOUTME: EPC QR Code generator for SEPA EUR payments
 * ABOUTME: Generates QR codes per EPC069-12 standard
 */

class EPCGenerator {
    constructor() {
        this.currentData = null;
        this.currentQrCode = null;
    }

    /**
     * Format the EPC QR code string
     * Based on EPC069-12 v3.1 specification
     */
    formatPaymentString(data) {
        const lines = [];

        // Service Tag
        lines.push('BCD');
        // Version
        lines.push('001');
        // Character Set (1 = UTF-8)
        lines.push('1');
        // Identification (SCT = SEPA Credit Transfer)
        lines.push('SCT');
        // BIC (optional - can be empty for SEPA)
        lines.push('');
        // Beneficiary name
        lines.push(this.truncate(data.supplierName || '', 70));
        // Beneficiary account (IBAN)
        lines.push((data.iban || '').replace(/\s/g, ''));
        // Amount (EUR + amount, empty if variable)
        const amount = data.amount ? `EUR${parseFloat(data.amount).toFixed(2)}` : '';
        lines.push(amount);
        // Purpose (optional)
        lines.push('');
        // Reference (optional - can use payment reference)
        lines.push((data.reference || '').replace(/\s/g, ''));
        // Unstructured remittance information (keep it short to fit QR limits)
        let remittance = data.invoiceNumber || '';
        if (data.description && data.description.length < CONSTANTS.QR_CODE.REMITTANCE_THRESHOLD) {
            remittance = data.description;
        }
        lines.push(this.truncate(remittance, CONSTANTS.QR_CODE.REMITTANCE_MAX_LENGTH));

        // Return with CRLF line endings as per spec
        return lines.join('\r\n');
    }

    truncate(str, maxLength) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) : str;
    }

    /**
     * Generate EPC QR code
     */
    generate(data) {
        this.currentData = data;

        const paymentString = this.formatPaymentString(data);

        try {
            // Clear previous QR code
            this.currentQrCode = null;

            this.currentQrCode = {
                data: paymentString
            };

            return this.currentQrCode;
        } catch (error) {
            console.error('EPC QR generation error:', error);
            throw new Error('Failed to generate EPC QR code');
        }
    }

    /**
     * Render QR code to a container element
     */
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container || !this.currentQrCode) {
            return;
        }

        container.innerHTML = '';

        // Use qrcode.js library to generate the QR code
        try {
            const qrCode = new QRCode(container, {
                text: this.currentQrCode.data,
                width: CONSTANTS.QR_CODE.SIZE,
                height: CONSTANTS.QR_CODE.SIZE,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M  // Use M (medium) for better scanning
            });

            // Update the payment string display
            const stringContainer = document.getElementById('epcString');
            if (stringContainer) {
                // Show a preview of the data (first few lines)
                const lines = this.currentQrCode.data.split('\r\n');
                const preview = lines.slice(0, 6).join('\r\n') + '\r\n...';
                stringContainer.textContent = preview;
            }
        } catch (error) {
            console.error('QR code render error:', error);
            // Show error and the payment string
            container.innerHTML = `
                <p class="text-error">QR kod: Podaci su predugi za QR standard.</p>
                <p class="text-error" style="font-size: 0.875rem; margin-top: 0.5rem;">
                    Koristite HUB-3 bar kod za ova plaćanja.
                </p>
            `;

            // Still show the payment string
            const stringContainer = document.getElementById('epcString');
            if (stringContainer) {
                const lines = this.currentQrCode.data.split('\r\n');
                const preview = lines.slice(0, 6).join('\r\n') + '\r\n...';
                stringContainer.textContent = preview;
            }
        }
    }

    /**
     * Download QR code as PNG
     */
    downloadAsPng(filename = 'epc-qrcode.png') {
        const container = document.getElementById('epcQrCode');
        if (!container) return;

        const img = container.querySelector('img');
        const canvas = container.querySelector('canvas');

        let dataUrl;

        if (canvas) {
            dataUrl = canvas.toDataURL('image/png');
        } else if (img) {
            dataUrl = img.src;
        } else {
            return;
        }

        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
    }

    /**
     * Download QR code as SVG
     * Note: qrcode.js doesn't natively support SVG, so we sample the canvas
     */
    downloadAsSvg(filename = 'epc-qrcode.svg') {
        const container = document.getElementById('epcQrCode');
        if (!container) return;

        const canvas = container.querySelector('canvas');
        if (!canvas) return;

        // Get QR code module data from canvas
        const ctx = canvas.getContext('2d');
        const size = canvas.width;
        const imageData = ctx.getImageData(0, 0, size, size);

        // Calculate module size by finding first black module boundary
        let moduleSize = 0;
        const modulePositions = [8, 9, 10, 11]; // Common starting positions for QR versions

        for (const pos of modulePositions) {
            if (pos < size) {
                // Sample top-left of expected position
                const startPixel = imageData.data[pos * 4];
                const nextPixel = imageData.data[(pos + 1) * 4];
                if (startPixel !== nextPixel) {
                    moduleSize = 1;
                    break;
                }
            }
        }

        // If detection failed, estimate based on standard QR sizes
        if (!moduleSize) {
            // QR sizes: 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69...
            // Find closest match
            const standardSizes = [21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77];
            const estimatedModules = Math.round(size / 8); // Rough estimate
            const closest = standardSizes.reduce((prev, curr) =>
                Math.abs(curr - estimatedModules) < Math.abs(prev - estimatedModules) ? curr : prev
            );
            moduleSize = size / closest;
        }

        // Create SVG
        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="100%" height="100%" fill="white"/>
<g fill="black">`;

        // Sample the canvas to create SVG rectangles
        for (let y = 0; y < size; y += Math.ceil(moduleSize)) {
            for (let x = 0; x < size; x += Math.ceil(moduleSize)) {
                const centerX = Math.floor(x + moduleSize / 2);
                const centerY = Math.floor(y + moduleSize / 2);
                const pixel = imageData.data[(centerY * size + centerX) * 4];
                if (pixel < 128) { // Black pixel
                    const width = Math.min(Math.ceil(moduleSize), size - x);
                    const height = Math.min(Math.ceil(moduleSize), size - y);
                    svgContent += `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;
                }
            }
        }

        svgContent += '</g></svg>';
 
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Get the raw payment string for display
     */
    getPaymentString() {
        return this.currentQrCode ? this.currentQrCode.data : '';
    }
}

const epcGenerator = new EPCGenerator();
