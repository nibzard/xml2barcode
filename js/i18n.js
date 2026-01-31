/**
 * ABOUTME: Internationalization (i18n) module for XML2Barcode
 * ABOUTME: Supports Croatian (hr) and English (en) languages
 */

const translations = {
    hr: {
        subtitle: "E-Račun u Bar Kod",
        dropZoneTitle: "Povuci XML račun ovdje",
        dropZoneSubtitle: "ili kliknite za odabir datoteke",
        selectBtn: "Odaberi datoteku",
        invoiceSummary: "Sažetak računa",
        invoiceNumber: "Broj računa",
        invoiceDate: "Datum",
        supplier: "Primatelj",
        amount: "Iznos",
        paymentDetails: "Podaci za plaćanje",
        model: "Model",
        reference: "Poziv na broj",
        purpose: "Svrha plaćanja",
        copyDetails: "Kopiraj podatke",
        hub3Tab: "HUB-3 (HRK)",
        epcTab: "EPC QR (EUR)",
        hub3Title: "HUB-3 PDF417 Bar Kod",
        hub3Description: "Skenirajte s mobilnom bankarstvom.",
        epcTitle: "EPC QR Kod",
        epcDescription: "Za SEPA plaćanje u EUR. Skenirajte s mobilnom bankarstvom.",
        downloadPng: "Preuzmi PNG",
        downloadSvg: "Preuzmi SVG",
        printInvoice: "Ispiši račun",
        invoicesTitle: "Povijest",
        downloadAll: "Preuzmi sve (ZIP)",
        clearHistory: "Obriši",
        footerText: "100% klijentska obrada. Vaši podaci ne napuštaju preglednik.",
        reportIssue: "Prijavi problem",
        errorInvalidXml: "Neispravan XML format. Molim vas učitajte valjani e-račun.",
        errorFileTooLarge: "Datoteka je prevelika (maksimalno 5 MB)",
        errorLibraryNotLoaded: "PDF417 biblioteka nije učitana. Bar kod se neće prikazati, ali su podaci ispravni.",
        errorMissingFields: "Nedostaju obavezna polja:",
        warningMissingIban: "Nedostaje IBAN",
        warningMissingAmount: "Nedostaje iznos",
        warningMissingReference: "Nedostaje poziv na broj",
        warningDefaultedModel: "Model plaćanja je postavljen na HR00 (podrazumijevano). Provjerite račun.",
        copied: "Kopirano!",
        processing: "Obrađujem...",
        noHistory: "Nema zadnjih računa",
        purposeDefault: "PLAĆANJE",
        addMoreFiles: "+ Dodaj još datoteka",
        printSelected: "Ispiši odabrane",
        newBatch: "Novo",
        version: "Verzija"
    },
    en: {
        subtitle: "E-Invoice to Barcode",
        dropZoneTitle: "Drop XML invoice here",
        dropZoneSubtitle: "or click to select file",
        selectBtn: "Select File",
        invoiceSummary: "Invoice Summary",
        invoiceNumber: "Invoice Number",
        invoiceDate: "Date",
        supplier: "Payee",
        amount: "Amount",
        paymentDetails: "Payment Details",
        model: "Model",
        reference: "Reference Number",
        purpose: "Purpose",
        copyDetails: "Copy Details",
        hub3Tab: "HUB-3 (HRK)",
        epcTab: "EPC QR (EUR)",
        hub3Title: "HUB-3 PDF417 Barcode",
        hub3Description: "For domestic HRK payments. Scan with mobile banking.",
        epcTitle: "EPC QR Code",
        epcDescription: "For SEPA EUR payments. Scan with mobile banking.",
        downloadPng: "Download PNG",
        downloadSvg: "Download SVG",
        printInvoice: "Print Invoice",
        invoicesTitle: "History",
        downloadAll: "Download All (ZIP)",
        clearHistory: "Clear",
        footerText: "100% client-side processing. Your data never leaves the browser.",
        reportIssue: "Report Issue",
        errorInvalidXml: "Invalid XML format. Please upload a valid e-invoice.",
        errorFileTooLarge: "File too large (maximum 5 MB)",
        errorLibraryNotLoaded: "PDF417 library not loaded. Barcode will not display, but data is correct.",
        errorMissingFields: "Missing required fields:",
        warningMissingIban: "Missing IBAN",
        warningMissingAmount: "Missing amount",
        warningMissingReference: "Missing reference number",
        warningDefaultedModel: "Payment model defaulted to HR00. Please verify your invoice.",
        copied: "Copied!",
        processing: "Processing...",
        noHistory: "No recent invoices",
        purposeDefault: "PAYMENT",
        addMoreFiles: "+ Add more files",
        printSelected: "Print Selected",
        newBatch: "New",
        version: "Version"
    }
};

class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('xml2barcode-lang') || 'hr';
        this.init();
    }

    init() {
        this.updateLanguage();
    }

    t(key) {
        return translations[this.currentLang][key] || key;
    }

    setLanguage(lang) {
        if (lang === this.currentLang) return;
        this.currentLang = lang;
        localStorage.setItem('xml2barcode-lang', lang);
        this.updateLanguage();
    }

    toggleLanguage() {
        this.setLanguage(this.currentLang === 'hr' ? 'en' : 'hr');
    }

    updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        document.documentElement.lang = this.currentLang;
        document.getElementById('langToggle').textContent = this.currentLang === 'hr' ? 'EN' : 'HR';

        // Update version link
        const versionLink = document.getElementById('versionLink');
        if (versionLink) {
            versionLink.href = CONSTANTS.RELEASES_URL;
            versionLink.textContent = this.t('version') + ' ' + CONSTANTS.VERSION;
        }
    }
}

const i18n = new I18n();
