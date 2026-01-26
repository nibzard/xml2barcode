/**
 * ABOUTME: XML Parser for Croatian e-račun (UBL Invoice format)
 * ABOUTME: Extracts payment data from UBL Invoice XML files
 */

const UBL_NAMESPACES = {
    ubl: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
};

class XMLParser {
    constructor() {
        this.parser = new DOMParser();
    }

    parse(xmlContent) {
        try {
            const doc = this.parser.parseFromString(xmlContent, 'text/xml');

            // Check for parsing errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                throw new Error(i18n.t('errorInvalidXml'));
            }

            // Verify it's a UBL Invoice
            const invoice = doc.getElementsByTagNameNS(UBL_NAMESPACES.ubl, 'Invoice')[0] ||
                           doc.getElementsByTagName('Invoice')[0];

            if (!invoice) {
                throw new Error(i18n.t('errorInvalidXml'));
            }

            return this.extractInvoiceData(doc, invoice);
        } catch (error) {
            console.error('XML parsing error:', error);
            throw error;
        }
    }

    extractInvoiceData(doc, invoice) {
        const data = {
            // Invoice identification
            invoiceNumber: this.getInvoiceNumber(invoice),
            invoiceDate: this.getTextContent(invoice, 'cbc:IssueDate') || this.getTextContent(invoice, 'IssueDate'),
            dueDate: this.getTextContent(invoice, 'cbc:DueDate') || this.getTextContent(invoice, 'DueDate'),

            // Currency and amount
            currency: this.getTextContent(invoice, 'cbc:DocumentCurrencyCode') || this.getTextContent(invoice, 'DocumentCurrencyCode') || 'EUR',
            amount: this.getAmount(invoice),

            // Supplier information
            supplierName: this.getSupplierName(invoice),
            supplierOib: this.getSupplierOib(invoice),

        // Payment information
        iban: this.getIBAN(invoice),
        paymentId: this.getPaymentId(invoice),
        model: '',
        reference: '',

        // Additional data
        description: this.getTextContent(invoice, 'cbc:Note') || this.getTextContent(invoice, 'Note') || ''
    };

    // Parse payment ID into model and reference
    if (data.paymentId) {
        const parsed = this.parsePaymentId(data.paymentId);
        data.model = parsed.model;
        data.reference = parsed.reference;
    }

    // Debug logging
    console.log('Extracted invoice data:', {
        invoiceNumber: data.invoiceNumber,
        supplierName: data.supplierName,
        amount: data.amount,
        iban: data.iban,
        paymentId: data.paymentId,
        model: data.model,
        reference: data.reference
    });

        // Validate and add warnings
        data.warnings = this.validateData(data);

        return data;
    }

    /**
     * Get invoice number with multiple fallback strategies
     */
    getInvoiceNumber(invoice) {
        // Look for cbc:ID as a DIRECT child of the Invoice element
        // In UBL, the invoice ID is a direct child: <Invoice><cbc:ID>...</cbc:ID>
        for (let i = 0; i < invoice.children.length; i++) {
            const child = invoice.children[i];
            const localName = child.localName || child.tagName;
            // Check if this is an ID element (with or without namespace)
            if (localName === 'ID' || localName.endsWith(':ID')) {
                const text = child.textContent.trim();
                // Invoice IDs are typically longer than 2 characters
                if (text && text.length > 2) {
                    console.log('Found direct child invoice ID:', text);
                    return text;
                }
            }
        }

        // Fallback: try namespace-based search but only check direct children
        const idElements = invoice.getElementsByTagNameNS(UBL_NAMESPACES.cbc, 'ID');
        for (let i = 0; i < idElements.length; i++) {
            // Check if this is a direct child of invoice (not nested deeper)
            let parent = idElements[i].parentNode;
            while (parent && parent !== invoice) {
                parent = parent.parentNode;
            }
            // Only use if it's a direct child
            if (parent === invoice && idElements[i].textContent.trim().length > 2) {
                const text = idElements[i].textContent.trim();
                console.log('Found namespace ID (direct child):', text);
                return text;
            }
        }

        console.log('No invoice ID found');
        return null;
    }

    getTextContent(element, tagName) {
        // Try with namespace first
        let el = element.getElementsByTagNameNS(UBL_NAMESPACES.cbc, tagName.replace('cbc:', ''))[0];
        if (!el) {
            el = element.getElementsByTagName(tagName)[0];
        }
        return el ? el.textContent.trim() : null;
    }

    getAmount(invoice) {
        // Try LegalMonetaryTotal first
        let monetaryTotal = invoice.getElementsByTagNameNS(UBL_NAMESPACES.cac, 'LegalMonetaryTotal')[0] ||
                           invoice.getElementsByTagName('LegalMonetaryTotal')[0];

        if (monetaryTotal) {
            const amount = this.getTextContent(monetaryTotal, 'cbc:PayableAmount') ||
                          this.getTextContent(monetaryTotal, 'PayableAmount');
            if (amount) {
                return parseFloat(amount).toFixed(2);
            }
        }

        return null;
    }

    getSupplierName(invoice) {
        const paths = [
            'cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName',
            'cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name'
        ];

        for (const path of paths) {
            const parts = path.split('/');
            let el = invoice;

            for (const part of parts) {
                const tag = part.replace(/^cbc:/, '').replace(/^cac:/, '');
                const ns = part.startsWith('cbc:') ? UBL_NAMESPACES.cbc : UBL_NAMESPACES.cac;
                const found = el.getElementsByTagNameNS(ns, tag)[0] || el.getElementsByTagName(part)[0];

                if (!found) {
                    el = null;
                    break;
                }
                el = found;
            }

            if (el && el.textContent) {
                return el.textContent.trim();
            }
        }

        // Fallback to simple search
        const partyLegalEntity = invoice.getElementsByTagName('PartyLegalEntity')[0];
        if (partyLegalEntity) {
            const regName = partyLegalEntity.getElementsByTagName('RegistrationName')[0];
            if (regName) return regName.textContent.trim();
        }

        return null;
    }

    getSupplierOib(invoice) {
        const paths = [
            'cac:AccountingSupplierParty/cac:Party/cbc:EndpointID',
            'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID'
        ];

        for (const path of paths) {
            const parts = path.split('/');
            let el = invoice;

            for (const part of parts) {
                const tag = part.replace(/^cbc:/, '').replace(/^cac:/, '');
                const ns = part.startsWith('cbc:') ? UBL_NAMESPACES.cbc : UBL_NAMESPACES.cac;
                const found = el.getElementsByTagNameNS(ns, tag)[0] || el.getElementsByTagName(part)[0];

                if (!found) {
                    el = null;
                    break;
                }
                el = found;
            }

            if (el && el.textContent) {
                return el.textContent.trim();
            }
        }

        return null;
    }

    getIBAN(invoice) {
        const paths = [
            'cac:PaymentMeans/cac:PayeeFinancialAccount/cbc:ID'
        ];

        for (const path of paths) {
            const parts = path.split('/');
            let el = invoice;

            for (const part of parts) {
                const tag = part.replace(/^cbc:/, '').replace(/^cac:/, '');
                const ns = part.startsWith('cbc:') ? UBL_NAMESPACES.cbc : UBL_NAMESPACES.cac;
                const found = el.getElementsByTagNameNS(ns, tag)[0] || el.getElementsByTagName(part)[0];

                if (!found) {
                    el = null;
                    break;
                }
                el = found;
            }

            if (el && el.textContent) {
                return el.textContent.trim().replace(/\s/g, '');
            }
        }

        // Fallback: find any element that looks like an IBAN
        const allElements = invoice.getElementsByTagName('*');
        for (const el of allElements) {
            const text = el.textContent.trim().replace(/\s/g, '');
            if (text.match(/^HR\d{19}$/)) {
                return text;
            }
        }

        return null;
    }

    getPaymentId(invoice) {
        // Path: cac:PaymentMeans/cbc:PaymentID
        const path = 'cac:PaymentMeans/cbc:PaymentID';

        // Try with namespace
        const parts = path.split('/');
        let el = invoice;

        for (const part of parts) {
            const tag = part.replace(/^cbc:/, '').replace(/^cac:/, '');
            const ns = part.startsWith('cbc:') ? UBL_NAMESPACES.cbc : UBL_NAMESPACES.cac;
            const found = el.getElementsByTagNameNS(ns, tag)[0] || el.getElementsByTagName(part)[0];

            if (!found) {
                el = null;
                break;
            }
            el = found;
        }

        const paymentId = el && el.textContent ? el.textContent.trim() : null;
        console.log('getPaymentId() found:', paymentId);
        return paymentId;
    }

    parsePaymentId(paymentId) {
        console.log('parsePaymentId() input:', paymentId);

        if (!paymentId) {
            return { model: '', reference: '' };
        }

        // Format: "HR01 79427-0269945262" or "7006840301-1"
        const trimmed = paymentId.trim();

        // Try to extract model and reference
        let model = '';
        let reference = '';

        // Match pattern like "HR01 79427-0269945262" (embedded in text)
        const modelMatch = trimmed.match(/^(HR\d{2})\s*(.*)$/);
        if (modelMatch) {
            model = modelMatch[1];
            reference = modelMatch[2].trim();
        } else {
            // No model found in text - default to HR00 (generic/default)
            // and use entire payment ID as reference
            model = 'HR00';
            reference = trimmed;
        }

        console.log('parsePaymentId() output: model="' + model + '" reference="' + reference + '"');
        return { model, reference };
    }

    validateData(data) {
        const warnings = [];

        if (!data.iban) {
            warnings.push(i18n.t('warningMissingIban'));
        }

        if (!data.amount) {
            warnings.push(i18n.t('warningMissingAmount'));
        }

        if (!data.reference && !data.model) {
            warnings.push(i18n.t('warningMissingReference'));
        }

        // Warning if model was defaulted to HR01
        if (data.paymentId && !data.paymentId.match(/^HR\d{2}\s/)) {
            warnings.push(i18n.t('warningDefaultedModel'));
        }

        return warnings;
    }
}

const xmlParser = new XMLParser();
