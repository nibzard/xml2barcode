/**
 * ABOUTME: Main application logic for XML2Barcode
 * ABOUTME: Handles drag & drop, file selection, and coordinates all modules
 */

class App {
    constructor() {
        this.hasDisplayed = false;
        this.init();
    }

    init() {
        debug.info('App', 'Initialized');
        this.setupDragAndDrop();
        this.setupFileInput();
        this.setupDownloadAll();
        this.setupAddMoreButton();
        this.setupViewResultsButton();
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
        const uploadSuccess = document.getElementById('uploadSuccess');

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

        if (uploadSuccess) {
            if (show) {
                uploadSuccess.classList.add('hidden');
            } else {
                uploadSuccess.classList.remove('hidden');
            }
        }
    }

    /**
     * Setup view results button
     */
    setupViewResultsButton() {
        const viewResultsBtn = document.getElementById('viewResultsBtn');
        if (!viewResultsBtn) return;

        viewResultsBtn.addEventListener('click', () => {
            const resultsSection = document.getElementById('resultsSection');
            if (resultsSection) {
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
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
                debug.info('FileInput', 'Selected: ' + files.length + ' files');
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
        debug.info('HandleFiles', 'Processing ' + files.length + ' files');
        if (!files || files.length === 0) return;

        ui.clearErrors();
        ui.reset();

        // Reset file input so same file can be selected again
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.value = '';
        }

        // Process all files (single or batch - same logic)
        let successCount = 0;
        let errorCount = 0;
        for (const file of files) {
            debug.info('HandleFiles', 'Processing: ' + file.name);
            if (!file.name.toLowerCase().endsWith('.xml')) {
                debug.warn('HandleFiles', 'Skipped (not XML): ' + file.name);
                continue;
            }

            const success = await this.processFile(file);
            if (success) {
                successCount++;
            } else {
                errorCount++;
            }
        }

        debug.info('HandleFiles', 'Complete: ' + successCount + ' success, ' + errorCount + ' errors');

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
            ui.showError(`${file.name}: ${i18n.t('errorInvalidXml')}`);
            return false;
        }

        // Validate file size
        if (file.size > CONSTANTS.MAX_FILE_SIZE) {
            ui.showError(`${file.name}: ${i18n.t('errorFileTooLarge')}`);
            return false;
        }

        ui.showLoading();
        debug.info('ProcessFile', 'Starting: ' + file.name);

        try {
            debug.info('ProcessFile', 'Reading file...');
            const content = await this.readFile(file);

            debug.info('ProcessFile', 'Parsing XML...');
            const invoiceData = xmlParser.parse(content);
            debug.info('ProcessFile', 'Parsed: ' + (invoiceData?.invoiceNumber || 'unknown') + ' | ' + (invoiceData?.amount || '0') + ' ' + (invoiceData?.currency || ''));

            // Generate HUB3 and capture string
            const hub3 = hub3Generator.generate(invoiceData);
            const hub3String = hub3?.data || null;

            // Add to storage
            storage.add(invoiceData, hub3String);
            debug.info('ProcessFile', 'Added to history');

            // Show first invoice in UI
            if (!this.hasDisplayed) {
                ui.displayInvoiceData(invoiceData);
                this.hasDisplayed = true;
                debug.info('ProcessFile', 'Displayed in UI');
            }
            return true;  // Success
        } catch (error) {
            console.error('Error processing file:', error);
            debug.error('ProcessFile', 'Error: ' + error.message);
            // Clear current display if showing previous file's data
            if (this.hasDisplayed) {
                ui.clearCurrentDisplay();
            }
            ui.showError(`${file.name}: ${error.message || i18n.t('errorInvalidXml')}`);
            return false;  // Failure
        } finally {
            ui.hideLoading();
        }
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
                scale: CONSTANTS.PDF417.SCALE,
                height: CONSTANTS.PDF417.HEIGHT,
                includetext: false,
                eclevel: CONSTANTS.PDF417.ECLEVEL_HIGH,
                columns: CONSTANTS.PDF417.COLUMNS,
                rows: CONSTANTS.PDF417.ROWS
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
