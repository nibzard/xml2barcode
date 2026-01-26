/**
 * ABOUTME: LocalStorage module for managing invoice history
 * ABOUTME: Stores recent conversions for quick access
 */

const STORAGE_KEY = 'xml2barcode-history';
const MAX_HISTORY_ITEMS = 10;

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

    add(invoiceData, hub3DataUrl = null, epcDataUrl = null) {
        console.log('storage.add() called with:', invoiceData);
        const historyItem = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            invoiceNumber: invoiceData.invoiceNumber || 'N/A',
            supplier: invoiceData.supplierName || 'N/A',
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
            hub3DataUrl: hub3DataUrl,
            epcDataUrl: epcDataUrl
        };

        console.log('Creating history item:', historyItem);

        // Remove duplicates with same invoice number
        this.history = this.history.filter(item => item.invoiceNumber !== historyItem.invoiceNumber);

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

        return `
                <div class="invoices-item" data-id="${item.id}">
                    <div class="invoices-item-info">
                        <div class="invoices-item-title">${this.escapeHtml(item.invoiceNumber)}</div>
                        <div class="invoices-item-subtitle">${this.escapeHtml(item.supplier)} · ${item.amount} ${item.currency}</div>
                    </div>
                    <div class="invoices-item-actions">
                        ${hub3BtnHtml}
                        ${epcBtnHtml}
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
                this.renderInvoicesList(onItemClick, onDownloadClick);
            });
        });

        // Add click handlers for invoice items (but not for download buttons - they'll be handled after render)
        invoicesList.querySelectorAll('.invoices-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('invoices-item-delete') && !e.target.closest('.invoices-item-actions')) {
                    const id = el.getAttribute('data-id');
                    const item = this.get(id);
                    if (item && onItemClick) {
                        onItemClick(item);
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
                const type = btn.textContent === 'HUB-3' ? 'hub3' : 'epc';

                // Get data URL from stored item
                const dataUrl = type === 'hub3' ? item.hub3DataUrl : item.epcDataUrl;

                if (dataUrl) {
                    const link = document.createElement('a');
                    link.download = `${item.invoiceNumber || 'invoice'}-${type}.png`;
                    link.href = dataUrl;
                    link.click();
                }
            });
        });
    }

        // Show the invoices section and download all button
        invoicesSection.classList.remove('hidden');
        downloadAllBtn.classList.remove('hidden');

        invoicesList.innerHTML = this.history.map(item => {
            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString(i18n.currentLang === 'hr' ? 'hr-HR' : 'en-US', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            return `
                <div class="invoices-item" data-id="${item.id}">
                    <div class="invoices-item-info">
                        <div class="invoices-item-title">${this.escapeHtml(item.invoiceNumber)}</div>
                        <div class="invoices-item-subtitle">${this.escapeHtml(item.supplier)} · ${item.amount} ${item.currency}</div>
                    </div>
                    <div class="invoices-item-actions">
                        ${hub3BtnHtml}
                        ${epcBtnHtml}
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
                this.renderInvoicesList(onItemClick, onDownloadClick);
            });
        });

        // Add click handlers for invoice items
        invoicesList.querySelectorAll('.invoices-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('invoices-item-delete') && !e.target.classList.contains('btn')) {
                    const id = el.getAttribute('data-id');
                    const item = this.get(id);
                    if (item && onItemClick) {
                        onItemClick(item);
                    }
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const storage = new Storage();
