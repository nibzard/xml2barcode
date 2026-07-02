/**
 * ABOUTME: Free-form text parser for XML2Barcode
 * ABOUTME: Turns pasted payment instructions (IBAN, amount, model/reference, description) into invoice data
 */

class TextParser {
    parse(text) {
        const raw = text || '';
        const lines = raw.split(/\r?\n/);

        const iban = this.getIBAN(lines);
        const amountInfo = this.getAmount(lines);
        const payeeRefRaw = this.getPayeeReference(lines);
        const payerRefRaw = this.getPayerReference(lines);
        const description = this.getDescription(lines);
        const supplierName = this.getSupplierName(lines);
        const oib = this.getOib(lines);
        const dueDate = this.getDueDate(lines);

        // Reuse XMLParser's model/reference split + validation. Collapse the "HR 69"
        // spacing seen in pasted text into "HR69" so parsePaymentId's anchored regex matches.
        const payeeRefClean = payeeRefRaw ? this.collapseModelPrefix(payeeRefRaw) : '';

        // Same object shape as xml-parser.js extractInvoiceData, so the downstream
        // pipeline (hub3Generator -> storage.add -> ui.displayInvoiceData) works unchanged.
        const data = {
            invoiceNumber: this.deriveInvoiceNumber(description, iban, amountInfo.amount),
            invoiceDate: null,
            dueDate: dueDate,
            currency: amountInfo.currency || 'EUR',
            amount: amountInfo.amount,
            supplierName: supplierName,
            supplierOib: oib,
            payerName: null,
            payerAddress: null,
            payerCity: null,
            receiverName: supplierName,
            receiverAddress: null,
            receiverCity: null,
            iban: iban,
            paymentId: payeeRefClean,
            model: '',
            reference: '',
            description: description || '',
            purposeCode: this.getPurposeCode(lines),
            // Informational only: the payer (platitelj) reference. The current HUB-3
            // generator encodes a single reference (the payee's), so this is not emitted.
            payerReference: payerRefRaw || ''
        };

        if (payeeRefClean) {
            const parsed = xmlParser.parsePaymentId(payeeRefClean);
            data.model = parsed.model;
            data.reference = parsed.reference;
        }

        data.warnings = xmlParser.validateData(data);

        debug.info('TextParser', 'Parsed text -> iban=' + data.iban + ' amount=' + data.amount + ' model=' + data.model + ' ref=' + data.reference);
        return data;
    }

    /**
     * Accent-insensitive, lowercased copy of a string for label matching.
     * For Croatian diacritics (č ć š ž) NFD + combining-mark removal is length-preserving
     * (1 char -> 1 char), so indices line up with the original string.
     */
    normalizeForMatch(s) {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    /**
     * Find the earliest matching label and return the rest of the ORIGINAL line after it.
     * On ties (same start index), the longest label wins so the value excludes the label tail.
     */
    valueAfterLabel(line, labels) {
        const nl = this.normalizeForMatch(line);
        let bestIdx = -1;
        let bestLen = 0;
        for (const label of labels) {
            const idx = nl.indexOf(label);
            if (idx === -1) continue;
            if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && label.length > bestLen)) {
                bestIdx = idx;
                bestLen = label.length;
            }
        }
        if (bestIdx === -1) return null;
        return line.substring(bestIdx + bestLen);
    }

    cleanValue(value) {
        return (value || '').replace(/^[:=\-\s]+/, '').trim();
    }

    collapseModelPrefix(raw) {
        // "HR 69 ..." -> "HR69 ..." so XMLParser.parsePaymentId's /^(HR\d{2})/ matches.
        return (raw || '').replace(/HR\s*(\d{2})/i, 'HR$1');
    }

    truncate(value, max) {
        const s = (value || '').trim();
        return s.length <= max ? s : s.substring(0, max).trim();
    }

    /**
     * Extract a standalone IBAN. Prefers one whose line is not the payer (platitelj) line.
     */
    getIBAN(lines) {
        const finders = Object.values(CONSTANTS.IBAN_PATTERNS).map((p) => {
            const src = p.regex.source.replace(/^\^/, '').replace(/\$$/, '');
            // Token must not be glued to surrounding alphanumerics (after de-spacing).
            return new RegExp('(?:^|[^A-Z0-9])(' + src + ')(?![A-Z0-9])', 'i');
        });

        let payee = null;
        let payer = null;

        for (const line of lines) {
            const noSpaces = line.replace(/\s+/g, '');
            for (const finder of finders) {
                const m = noSpaces.match(finder);
                if (!m || !m[1]) continue;
                const iban = m[1].toUpperCase();
                if (this.normalizeForMatch(line).includes('platitelj')) {
                    if (!payer) payer = iban;
                } else if (!payee) {
                    payee = iban;
                }
            }
        }

        return payee || payer;
    }

    getAmount(lines) {
        const labels = ['za platiti', 'ukupno za platiti', 'ukupno', 'za uplatu', 'iznos', 'amount', 'total'];
        for (const line of lines) {
            const value = this.valueAfterLabel(line, labels);
            if (!value) continue;
            const amount = this.parseAmount(value);
            if (amount === null) continue;
            return { amount: amount.toFixed(2), currency: this.detectCurrency(value) };
        }
        return { amount: null, currency: 'EUR' };
    }

    parseAmount(value) {
        if (!value) return null;
        const match = value.replace(/[^\d.,]/g, ' ').trim().match(/\d[\d.,]*\d|\d/);
        if (!match) return null;
        let s = match[0];

        if (s.includes(',') && s.includes('.')) {
            // The right-most separator is the decimal mark; the other is thousands.
            if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                s = s.replace(/\./g, '').replace(',', '.');
            } else {
                s = s.replace(/,/g, '');
            }
        } else if (s.includes(',')) {
            // A comma with 1-2 trailing digits is a decimal; otherwise treat as thousands.
            const after = s.split(',')[1] || '';
            s = after.length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
        }

        const num = parseFloat(s);
        return isNaN(num) ? null : num;
    }

    detectCurrency(value) {
        const v = (value || '').toLowerCase();
        if (/(kn|hrk|kuna)/.test(v)) return 'HRK';
        return 'EUR';
    }

    getPayeeReference(lines) {
        const labels = [
            'model i poziv na broj primatelja',
            'poziv na broj primatelja',
            'poziv na broj primatelj',
            'referenca primatelja',
            'model primatelja',
            'poziv primatelja',
            'reference (payee)',
            'payee reference',
            'creditor reference'
        ];
        for (const line of lines) {
            const value = this.valueAfterLabel(line, labels);
            if (value && this.cleanValue(value)) return this.cleanValue(value);
        }
        return null;
    }

    getPayerReference(lines) {
        const labels = [
            'model i poziv na broj platitelja',
            'poziv na broj platitelja',
            'poziv na broj platitelj',
            'referenca platitelja',
            'model platitelja',
            'reference (payer)',
            'payer reference',
            'debtor reference'
        ];
        for (const line of lines) {
            const value = this.valueAfterLabel(line, labels);
            if (value && this.cleanValue(value)) return this.cleanValue(value);
        }
        return null;
    }

    getPurposeCode(lines) {
        // Field 13 of HUB 3A: šifra namjene (ISO 20022 purpose code, e.g. COST, SALA).
        // Only set when the pasted text explicitly states it; otherwise left empty
        // (spec-compliant — only the Iznos field is padded).
        const labels = ['sifra namjene', 'purpose code', 'category purpose'];
        for (const line of lines) {
            const cleaned = this.cleanValue(this.valueAfterLabel(line, labels));
            if (!cleaned) continue;
            const match = cleaned.match(/^[A-Za-z]{2,4}\b/);
            if (match) return match[0].toUpperCase();
        }
        return '';
    }

    getDescription(lines) {        const labels = [
            'opis placanja',
            'svrha placanja',
            'svrha uplate',
            'opis',
            'svrha',
            'payment description',
            'description',
            'napomena'
        ];
        for (const line of lines) {
            const value = this.valueAfterLabel(line, labels);
            const cleaned = this.cleanValue(value);
            if (cleaned) return cleaned;
        }
        return null;
    }

    getSupplierName(lines) {
        const labels = ['naziv primatelja', 'ime primatelja', 'payee name', 'primatelj'];
        for (const line of lines) {
            // Skip reference lines that merely contain the word "primatelj".
            if (this.normalizeForMatch(line).includes('poziv na broj')) continue;
            const value = this.valueAfterLabel(line, labels);
            const cleaned = this.cleanValue(value);
            if (cleaned && !/^HR\d/i.test(cleaned)) return cleaned;
        }
        return null;
    }

    getOib(lines) {
        for (const line of lines) {
            if (!/\boib\b/.test(this.normalizeForMatch(line))) continue;
            const match = line.match(/\b(\d{11})\b/);
            if (match) return match[1];
        }
        return null;
    }

    getDueDate(lines) {
        const labels = ['rok placanja', 'datum dospijeca', 'datum valute', 'rok', 'due date'];
        for (const line of lines) {
            const value = this.valueAfterLabel(line, labels);
            const cleaned = this.cleanValue(value);
            if (cleaned) return cleaned;
        }
        return null;
    }

    /**
     * Text input has no invoice number; derive a readable, content-stable label so each
     * payment is identifiable in history and storage.add's dedup behaves sensibly.
     */
    deriveInvoiceNumber(description, iban, amount) {
        if (description && description.trim()) return this.truncate(description, 40);
        if (iban && iban.length >= 4) return 'IBAN …' + iban.slice(-4);
        if (amount) return 'Text ' + amount;
        return 'Text';
    }
}

const textParser = new TextParser();
