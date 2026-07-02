/**
 * ABOUTME: Unit + integration tests for IBAN normalization and mod-97 checksum validation
 * ABOUTME: Guards against transposition typos that produce a scannable-but-wrong barcode
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadParserContext } = require('./setup');

const { xmlParser } = loadParserContext();

// Known-good IBANs (pass mod-97) drawn from public IBAN examples.
const VALID = [
    'HR5423900013221482195',          // Croatia (the app's running example)
    'GB82WEST12345698765432',         // United Kingdom
    'DE89370400440532013000',         // Germany
    'FR1420041010050500013M02606',    // France
    'NL91ABNA0417164300'              // Netherlands
];

// The same IBANs with a transposed/edited digit -> must fail mod-97.
const INVALID = [
    'HR4523900013221482195',          // first two digits swapped
    'GB82WEST12345698765433',         // last digit changed
    'DE89370400440532013001',         // last digit changed
    'NL91ABNA0417164301'              // last digit changed
];

test('normalizeIBAN strips spaces and uppercases', () => {
    assert.strictEqual(xmlParser.normalizeIBAN('HR5423 9000 1322 1482 195'), 'HR5423900013221482195');
    assert.strictEqual(xmlParser.normalizeIBAN('hr5423900013221482195'), 'HR5423900013221482195');
    assert.strictEqual(xmlParser.normalizeIBAN('  HR5423 9000\n1322 1482 195 '), 'HR5423900013221482195');
});

test('normalizeIBAN returns empty string for falsy input', () => {
    assert.strictEqual(xmlParser.normalizeIBAN(null), '');
    assert.strictEqual(xmlParser.normalizeIBAN(undefined), '');
    assert.strictEqual(xmlParser.normalizeIBAN(''), '');
});

test('validateIBANChecksum returns true for known-good IBANs', () => {
    for (const iban of VALID) {
        assert.strictEqual(xmlParser.validateIBANChecksum(iban), true, `expected valid: ${iban}`);
    }
});

test('validateIBANChecksum returns false for transposed-digit typos', () => {
    for (const iban of INVALID) {
        assert.strictEqual(xmlParser.validateIBANChecksum(iban), false, `expected invalid: ${iban}`);
    }
});

test('validateIBANChecksum is space/case insensitive', () => {
    assert.strictEqual(xmlParser.validateIBANChecksum('hr5423 9000 1322 1482 195'), true);
});

test('validateIBANChecksum returns false (not throw) for non-IBAN strings', () => {
    assert.strictEqual(xmlParser.validateIBANChecksum('asdf'), false);
    assert.strictEqual(xmlParser.validateIBANChecksum('12345'), false);
    assert.strictEqual(xmlParser.validateIBANChecksum(''), false);
    assert.strictEqual(xmlParser.validateIBANChecksum(null), false);
});

test('validateData warns when a present IBAN fails mod-97', () => {
    const warnings = xmlParser.validateData({
        iban: 'HR4523900013221482195',   // transposed -> invalid
        amount: '10.00',
        model: 'HR00',
        reference: '40002-55950527428-200',
        paymentId: 'HR00 40002-55950527428-200'
    });
    assert.ok(warnings.includes('warningInvalidIban'), 'invalid IBAN must warn');
});

test('validateData does NOT warn for a valid IBAN', () => {
    const warnings = xmlParser.validateData({
        iban: 'HR5423900013221482195',
        amount: '10.00',
        model: 'HR69',
        reference: '40002-55950527428-200',
        paymentId: 'HR69 40002-55950527428-200'
    });
    assert.ok(!warnings.includes('warningInvalidIban'), 'valid IBAN must not warn');
});

test('validateData does NOT add an invalid-IBAN warning when IBAN is missing', () => {
    // Missing IBAN is already covered by warningMissingIban; do not double-warn.
    const warnings = xmlParser.validateData({
        iban: null,
        amount: '10.00',
        model: 'HR69',
        reference: '40002-55950527428-200',
        paymentId: 'HR69 40002-55950527428-200'
    });
    assert.ok(!warnings.includes('warningInvalidIban'), 'no IBAN -> no invalid-IBAN warning');
    assert.ok(warnings.includes('warningMissingIban'));
});
