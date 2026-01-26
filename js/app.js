/**
 * ABOUTME: Main application logic for XML2Barcode
 * ABOUTME: Handles drag & drop, file selection, and coordinates all modules
 */

class App {
    constructor() {
        this.hasDisplayed = false;
        this.init();
    }

    /**
      * Download single invoice item (for use by UI event handlers)
      */
    downloadItem(item, type) {
        const dataUrl = type === 'hub3' ? item.hub3DataUrl : item.epcDataUrl;
        const filename = `${item.invoiceNumber || 'invoice'}-${type}.png`;

        if (dataUrl) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
        }
    }

    init() {
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupClearHistory();
        this.setupDownloadAll();
        this.renderInvoicesList();
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');

        if (!dropZone) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop zone when dragging over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        }, false);
    }

    /**
     * Setup file input button
     */
    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        const selectBtn = document.getElementById('selectBtn');

        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        // Make entire drop zone clickable
        const dropZone = document.getElementById('dropZone');
        if (dropZone && !selectBtn) {
            dropZone.addEventListener('click', () => {
                fileInput.click();
            });
        }
    }

    /**
     * Prevent default browser behavior
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
      * Handle selected/dropped files
      */
    async handleFiles(files) {
        if (!files || files.length === 0) return;

        ui.clearErrors();
        ui.reset();

        // Process all files (single or batch - same logic)
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.xml')) {
                continue;
            }

            await this.processFile(file);
        }

        // Re-render invoices list
        this.renderInvoicesList();
    }

    /**
      * Process a single XML file
      */
    async processFile(file) {
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.xml')) {
            ui.showError(i18n.t('errorInvalidXml'));
            return;
        }

        ui.showLoading();

        try {
            const content = await this.readFile(file);
            const invoiceData = xmlParser.parse(content);

            // Generate barcodes
            hub3Generator.generate(invoiceData);
            epcGenerator.generate(invoiceData);

            // Capture barcodes as data URLs
            const hub3DataUrl = this.getHub3DataUrl();
            const epcDataUrl = this.getEpcDataUrl();

            // Add to storage
            storage.add(invoiceData, hub3DataUrl, epcDataUrl);

            // Show first invoice in UI
            if (!this.hasDisplayed) {
                ui.displayInvoiceData(invoiceData);
                this.hasDisplayed = true;
            }
        } catch (error) {
            console.error('Error processing file:', error);
            ui.showError(error.message || i18n.t('errorInvalidXml'));
        } finally {
            ui.hideLoading();
        }

        // Re-render invoices list
        this.renderInvoicesList();
    }

    /**
      * Get HUB-3 barcode as data URL
      */
    getHub3DataUrl() {
        const container = document.getElementById('hub3Barcode');
        const canvas = container?.querySelector('canvas');
        return canvas ? canvas.toDataURL('image/png') : null;
    }

    /**
      * Get EPC QR code as data URL
      */
    getEpcDataUrl() {
        const container = document.getElementById('epcQrCode');
        const canvas = container?.querySelector('canvas');
        const img = container?.querySelector('img');
        return canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
    }

    /**
      * Setup download all button
      */
    setupDownloadAll() {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (!downloadAllBtn) return;

        downloadAllBtn.addEventListener('click', async () => {
            const invoices = storage.getAll();
            if (invoices.length === 0) return;

            const zip = new JSZip();

            invoices.forEach((item) => {
                if (!item.hub3DataUrl && !item.epcDataUrl) return;

                const invoiceNumber = item.invoiceNumber || `invoice`;

                if (item.hub3DataUrl) {
                    const hub3Data = this.dataUrlToBlob(item.hub3DataUrl);
                    zip.file(`${invoiceNumber}-hub3.png`, hub3Data);
                }

                if (item.epcDataUrl) {
                    const epcData = this.dataUrlToBlob(item.epcDataUrl);
                    zip.file(`${invoiceNumber}-epc.png`, epcData);
                }
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipBlob);

            const link = document.createElement('a');
            link.download = 'barcodes.zip';
            link.href = zipUrl;
            link.click();

            URL.revokeObjectURL(zipUrl);
        });
    }

    /**
     * Convert data URL to Blob
     */
    dataUrlToBlob(dataUrl) {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        return new Blob([u8arr], { type: mime });
    }

    /**
      * Read file content
      */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                resolve(e.target.result);
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
      * Setup clear history button
      */
    setupClearHistory() {
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
      * Render unified invoices list
      */
    renderInvoicesList() {
        storage.renderInvoicesList();
    }

    /**
      * Download single invoice item
      */
    downloadItem(item, type) {
        const dataUrl = type === 'hub3' ? item.hub3DataUrl : item.epcDataUrl;
        const filename = `${item.invoiceNumber || 'invoice'}-${type}.png`;

        if (dataUrl) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            link.click();
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
});
