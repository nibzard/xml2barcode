/**
 * ABOUTME: Main application logic for XML2Barcode
 * ABOUTME: Handles drag & drop, file selection, and coordinates all modules
 */

const FEATURE_FLAGS = {
    ENABLE_EPC: false
};

class App {
    constructor() {
        this.hasDisplayed = false;
        this.init();
    }

    init() {
        this.setupFeatureFlags();
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupDownloadAll();
        this.setupAddMoreButton();
        this.renderInvoicesList();
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

    setupFeatureFlags() {
        if (!FEATURE_FLAGS.ENABLE_EPC) {
            const epcTabBtn = document.querySelector('[data-tab="epc"]');
            const epcTabContent = document.getElementById('epcTab');
            const downloadEpcBtn = document.getElementById('downloadEpcPng');

            if (epcTabBtn) epcTabBtn.style.display = 'none';
            if (epcTabContent) epcTabContent.style.display = 'none';
            if (downloadEpcBtn) downloadEpcBtn.style.display = 'none';
        }
    }

    /**
      * Setup drag and drop functionality
      */
    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');

        if (!dropZone) return;

        // Prevent default drag behaviors on body
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight entire page when dragging
        ['dragenter', 'dragover'].forEach(eventName => {
            document.body.addEventListener(eventName, () => {
                document.body.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, () => {
                document.body.classList.remove('drag-over');
            }, false);
        });

        // Handle dropped files on body
        document.body.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        }, false);

        // Click handlers for dropZone
        dropZone.addEventListener('dragenter', () => {
            dropZone.classList.add('drag-over');
        }, false);

        dropZone.addEventListener('dragleave', (e) => {
            if (!dropZone.contains(e.relatedTarget)) {
                dropZone.classList.remove('drag-over');
            }
        }, false);

        dropZone.addEventListener('drop', () => {
            dropZone.classList.remove('drag-over');
        }, false);
    }

    /**
      * Setup add more files button
      */
    setupAddMoreButton() {
        const addMoreBtn = document.getElementById('addMoreBtn');
        const fileInput = document.getElementById('fileInput');

        if (!addMoreBtn || !fileInput) return;

        addMoreBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    /**
      * Toggle dropZone visibility
      */
    toggleDropZone(show) {
        const dropZone = document.getElementById('dropZone');
        const addMoreBtn = document.getElementById('addMoreBtn');

        if (dropZone) {
            if (show) {
                dropZone.classList.remove('hidden');
            } else {
                dropZone.classList.add('hidden');
            }
        }

        if (addMoreBtn) {
            if (show) {
                addMoreBtn.classList.add('hidden');
            } else {
                addMoreBtn.classList.remove('hidden');
            }
        }
    }

    /**
     * Setup file input button
     */
    setupFileInput() {
        const fileInput = document.getElementById('fileInput');
        const selectBtn = document.getElementById('selectBtn');
        const dropZone = document.getElementById('dropZone');

        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }

        // Make entire drop zone clickable (even with selectBtn present)
        if (dropZone) {
            dropZone.addEventListener('click', (e) => {
                // Don't double-trigger if they clicked the button itself
                if (e.target.closest('#selectBtn')) return;
                fileInput.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                // Immediately convert to array before FileList gets cleared (mobile Safari quirk)
                const files = [];
                for (let i = 0; i < e.target.files.length; i++) {
                    files.push(e.target.files[i]);
                }
                this.handleFiles(files);
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

        // Reset file input so same file can be selected again
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }

        // Process all files (single or batch - same logic)
        for (const file of files) {
            if (!file.name.toLowerCase().endsWith('.xml')) {
                continue;
            }
            await this.processFile(file);
        }

        // Hide dropZone, show add more button
        this.toggleDropZone(false);

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

            // Generate HUB3 and capture string
            const hub3 = hub3Generator.generate(invoiceData);
            const hub3String = hub3?.data || null;

            // Add to storage
            storage.add(invoiceData, hub3String, null);

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
      * Setup download all button
      */
    setupDownloadAll() {
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (!downloadAllBtn) return;

        downloadAllBtn.addEventListener('click', async () => {
            const invoices = storage.getAll();
            if (invoices.length === 0) return;

            const zip = new JSZip();

            for (const item of invoices) {
                if (!item.hub3String) continue;

                const invoiceNumber = item.invoiceNumber || `invoice`;

                if (item.hub3String) {
                    const hub3Png = await this.generateHub3Png(item.hub3String);
                    if (hub3Png) {
                        zip.file(`${invoiceNumber}-hub3.png`, hub3Png);
                    }
                }
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipBlob);

            const link = document.createElement('a');
            link.download = 'barcodes.zip';
            link.href = zipUrl;
            link.click();

            URL.revokeObjectURL(zipUrl);
        });
    }

    async generateHub3Png(string) {
        try {
            if (typeof bwipjs === 'undefined') {
                console.error('bwip-js library not loaded');
                return null;
            }

            const canvas = document.createElement('canvas');
            bwipjs.toCanvas(canvas, {
                bcid: 'pdf417',
                text: string,
                scale: 2,
                height: 20,
                includetext: false,
                eclevel: 5,
                columns: 6,
                rows: 0
            });

            return this.dataUrlToBlob(canvas.toDataURL('image/png'));
        } catch (error) {
            console.error('HUB-3 PNG generation error:', error);
            return null;
        }
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
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
});
