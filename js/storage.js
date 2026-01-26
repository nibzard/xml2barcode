/**
 * ABOUTME: LocalStorage module for managing invoice history
 * ABOUTME: Stores recent conversions for quick access
 */

const STORAGE_KEY = 'xml2barcode-history';
const MAX_HISTORY_ITEMS = 20;

class Storage {
    constructor() {
        this.history = this.loadHistory();
    }

    loadHistory() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.warn('Failed to load history:', e);
            return [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
        } catch (e) {
            console.warn('Failed to save history:', e);
        }
    }

    add(invoiceData, hub3String = null) {
        console.log('storage.add() called with:', invoiceData);
        const historyItem = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            invoiceNumber: invoiceData.invoiceNumber || 'N/A',
            supplierName: invoiceData.supplierName || 'N/A',
            amount: invoiceData.amount || '0',
            currency: invoiceData.currency || 'EUR',
            iban: invoiceData.iban || '',
            model: invoiceData.model || '',
            reference: invoiceData.reference || '',
            description: invoiceData.description || '',
            invoiceDate: invoiceData.invoiceDate || '',
            dueDate: invoiceData.dueDate || '',
            warnings: invoiceData.warnings || [],
            hub3String: hub3String
        };

        console.log('Creating history item:', historyItem);

        // Remove exact duplicates (same invoice number, supplier, AND amount)
        // Allow different invoices to coexist even if they have same invoice number
        this.history = this.history.filter(item =>
            !(item.invoiceNumber === historyItem.invoiceNumber &&
              item.supplierName === historyItem.supplierName &&
              item.amount === historyItem.amount)
        );

        // Add new item at the beginning
        this.history.unshift(historyItem);

        // Keep only MAX_HISTORY_ITEMS
        if (this.history.length > MAX_HISTORY_ITEMS) {
            this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
        }

        this.saveHistory();
        return historyItem;
    }

    remove(id) {
        this.history = this.history.filter(item => item.id !== id);
        this.saveHistory();
    }

    clear() {
        this.history = [];
        this.saveHistory();
    }

    get(id) {
        return this.history.find(item => item.id === id);
    }

    getAll() {
        return this.history;
    }

    renderInvoicesList() {
        const invoicesList = document.getElementById('invoicesList');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const invoicesSection = document.getElementById('invoicesSection');

        if (this.history.length === 0) {
            invoicesList.innerHTML = `<div class="invoices-empty">${i18n.t('noHistory')}</div>`;
            downloadAllBtn.classList.add('hidden');
            invoicesSection.classList.add('hidden');
            return;
        }

        // Show as invoices section and download all button
        invoicesSection.classList.remove('hidden');
        downloadAllBtn.classList.remove('hidden');

        // Generate download buttons HTML
        const hub3BtnHtml = '<button class="btn secondary small" data-download-type="hub3">HUB-3</button>';

        invoicesList.innerHTML = this.history.map(item => {
            return `
                <div class="invoices-item" data-id="${item.id}">
                    <div class="invoices-item-info">
                        <div class="invoices-item-title">${this.escapeHtml(item.invoiceNumber)}</div>
                        <div class="invoices-item-subtitle">${this.escapeHtml(item.supplierName)} · ${item.amount} ${item.currency}</div>
                    </div>
                    <div class="invoices-item-actions">
                        ${hub3BtnHtml}
                        <button class="invoices-item-delete" data-delete-id="${item.id}" aria-label="Delete">×</button>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers for delete buttons
        invoicesList.querySelectorAll('.invoices-item-delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = el.getAttribute('data-delete-id');
                this.remove(id);
                this.renderInvoicesList();
            });
        });

        // Add click handlers for invoice items
        invoicesList.querySelectorAll('.invoices-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('invoices-item-delete') && !e.target.closest('.invoices-item-actions')) {
                    const id = el.getAttribute('data-id');
                    const item = this.get(id);
                    if (item) {
                        ui.loadInvoiceFromHistory(item);
                    }
                }
            });
        });

        // Add click handlers for download buttons
        invoicesList.querySelectorAll('.invoices-item-actions .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const invoiceItemEl = btn.closest('.invoices-item');
                const id = invoiceItemEl.getAttribute('data-id');
                const item = this.get(id);

                // Generate PNG on-demand from stored string
                if (item.hub3String) {
                    this.generateHub3AndDownload(item.hub3String, item.invoiceNumber || 'invoice');
                }
            });
        });
    }

    generateHub3AndDownload(string, invoiceNumber) {
        try {
            if (typeof bwipjs === 'undefined') {
                console.error('bwip-js library not loaded');
                return;
            }

            const filename = `${invoiceNumber}-hub3.png`;
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

            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('HUB-3 generation error:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const storage = new Storage();
