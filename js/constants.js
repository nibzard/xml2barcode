/**
 * Shared constants for XML2Barcode application
 */
const CONSTANTS = {
    // Application info
    VERSION: '1.3.2',
    GITHUB_URL: 'https://github.com/nibzard/xml2barcode',
    RELEASES_URL: 'https://github.com/nibzard/xml2barcode/releases',
    // File validation
    MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB

    // IBAN validation patterns for all EU/SEPA countries (~35)
    IBAN_PATTERNS: {
        // Western Europe
        AT: { length: 20, regex: /^AT\d{18}$/ },  // Austria
        BE: { length: 16, regex: /^BE\d{14}$/ },  // Belgium
        DE: { length: 22, regex: /^DE\d{20}$/ },  // Germany
        FR: { length: 27, regex: /^FR\d{12}[A-Z0-9]{11}\d{2}$/ },  // France
        NL: { length: 18, regex: /^NL\d{2}[A-Z]{4}\d{10}$/ },  // Netherlands
        LU: { length: 20, regex: /^LU\d{16}$/ },  // Luxembourg
        CH: { length: 21, regex: /^CH\d{17}$/ },  // Switzerland (SEPA)

        // Southern Europe
        HR: { length: 21, regex: /^HR\d{19}$/ },  // Croatia
        SI: { length: 19, regex: /^SI\d{15}$/ },  // Slovenia
        IT: { length: 27, regex: /^IT\d{2}[A-Z]{1}\d{10}[A-Z0-9]{12}$/ },  // Italy
        ES: { length: 24, regex: /^ES\d{22}$/ },  // Spain
        PT: { length: 25, regex: /^PT\d{21}$/ },  // Portugal
        GR: { length: 27, regex: /^GR\d{25}$/ },  // Greece
        CY: { length: 28, regex: /^CY\d{26}$/ },  // Cyprus
        MT: { length: 31, regex: /^MT\d{2}[A-Z]{4}\d{5}[A-Z0-9]{18}$/ },  // Malta

        // Northern Europe
        DK: { length: 18, regex: /^DK\d{16}$/ },  // Denmark
        SE: { length: 24, regex: /^SE\d{20}$/ },  // Sweden
        NO: { length: 15, regex: /^NO\d{13}$/ },  // Norway (EEA)
        FI: { length: 18, regex: /^FI\d{16}$/ },  // Finland
        IS: { length: 26, regex: /^IS\d{24}$/ },  // Iceland (EEA)

        // Central/Eastern Europe
        PL: { length: 28, regex: /^PL\d{24}$/ },  // Poland
        CZ: { length: 24, regex: /^CZ\d{22}$/ },  // Czech Republic
        SK: { length: 24, regex: /^SK\d{22}$/ },  // Slovakia
        HU: { length: 28, regex: /^HU\d{26}$/ },  // Hungary
        RO: { length: 24, regex: /^RO\d{2}[A-Z]{4}\d{16}$/ },  // Romania
        BG: { length: 22, regex: /^BG\d{2}[A-Z]{4}\d{6}[A-Z0-9]{8}$/ },  // Bulgaria
        LT: { length: 20, regex: /^LT\d{16}$/ },  // Lithuania
        LV: { length: 21, regex: /^LV\d{2}[A-Z]{4}\d{13}$/ },  // Latvia
        EE: { length: 20, regex: /^EE\d{16}$/ },  // Estonia

        // British Isles (non-EU)
        GB: { length: 22, regex: /^GB\d{2}[A-Z]{4}\d{14}$/ },  // United Kingdom
        IE: { length: 22, regex: /^IE\d{2}[A-Z]{4}\d{14}$/ },  // Ireland

        // Others
        LI: { length: 21, regex: /^LI\d{17}$/ },  // Liechtenstein
        MC: { length: 27, regex: /^MC\d{12}[A-Z0-9]{11}\d{2}$/ },  // Monaco
        SM: { length: 27, regex: /^SM\d{2}[A-Z]{1}\d{10}[A-Z0-9]{12}$/ },  // San Marino
        VA: { length: 22, regex: /^VA\d{18}$/ },  // Vatican
        AD: { length: 24, regex: /^AD\d{20}$/ },  // Andorra
        AX: { length: 18, regex: /^FI\d{16}$/ },  // Åland (uses FI)
    },

    // PDF417/HUB-3 barcode settings
    PDF417: {
        SCALE: 2,
        HEIGHT: 20,
        ECLEVEL: 3,
        ECLEVEL_HIGH: 5,  // For batch printing
        COLUMNS: 6,
        ROWS: 0,
        SVG_SCALE: 3,
        SVG_HEIGHT: 10
    },

    // QR code settings
    QR_CODE: {
        SIZE: 300,
        REMITTANCE_THRESHOLD: 50,
        REMITTANCE_MAX_LENGTH: 70
    },

    // Storage settings
    STORAGE: {
        BATCH_TIME_WINDOW_MS: 30000,  // 30 seconds
        MAX_HISTORY_ITEMS: 20
    },

    // Validation thresholds
    VALIDATION: {
        MIN_INVOICE_ID_LENGTH: 2,
        HR_MODEL_DIGITS: 2  // HRxx format
    }
};
