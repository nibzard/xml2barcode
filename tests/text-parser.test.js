/**
 * ABOUTME: Unit + integration tests for the free-form text parser
 * ABOUTME: Verifies pasted payment text becomes the invoice-data shape storage.add consumes
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadParserContext } = require('./setup');

const { textParser } = loadParserContext();

// The example from the feature request (Croatian travel-expense payment note).
const NIKO_EXAMPLE = [
    'PUTNI NALOZI- upute za plaćanje 02.07.2026.',
    '',
    'Podaci za isplatu:',
    'TVOJ IBAN: HR5423900013221482195',
    'model i poziv na broj platitelja: HR 67  55950527428  -26183-0',
    'model i poziv na broj primatelja: HR 69  40002-  55950527428- 200',
    'Opis plaćanja: Isplata troškova službenog puta u Singapur',
    'Iznos: 933,73 eur'
].join('\n');

test('parses the full Croatian example correctly', () => {
    const d = textParser.parse(NIKO_EXAMPLE);

    assert.strictEqual(d.iban, 'HR5423900013221482195', 'payee IBAN');
    assert.strictEqual(d.amount, '933.73', 'amount normalized to 2 decimals');
    assert.strictEqual(d.currency, 'EUR', 'currency from "eur"');
    assert.strictEqual(d.model, 'HR69', 'payee model');
    assert.strictEqual(d.reference, '40002-55950527428-200', 'payee reference with spaces stripped');
    assert.ok(d.description.includes('Isplata troškova'), 'description preserved');
    assert.ok(d.description.includes('Singapur'), 'description tail preserved');
    assert.strictEqual(d.warnings.length, 0, 'no warnings when all fields present');
});

test('returns the exact invoice-data shape storage.add reads', () => {
    const d = textParser.parse(NIKO_EXAMPLE);
    const requiredKeys = [
        'invoiceNumber', 'supplierName', 'amount', 'currency', 'iban',
        'model', 'reference', 'description', 'invoiceDate', 'dueDate', 'warnings'
    ];
    for (const key of requiredKeys) {
        assert.ok(key in d, `missing key consumable by storage.add: ${key}`);
    }
    assert.ok(Array.isArray(d.warnings), 'warnings is an array');
    assert.strictEqual(typeof d.amount === 'string' || d.amount === null, true, 'amount is a string (or null)');
});

test('keys the history item on the description (sane dedup + readable title)', () => {
    const d = textParser.parse(NIKO_EXAMPLE);
    assert.ok(d.invoiceNumber.length > 0, 'invoiceNumber is populated for text input');
    assert.ok(d.invoiceNumber.startsWith('Isplata'), 'invoiceNumber derived from description');
});

test('parses English-labeled text', () => {
    const en = [
        'Payment details:',
        'IBAN: HR5423900013221482195',
        'Amount: 1200.50 EUR',
        'Reference (payee): HR69 40002-55950527428-200',
        'Description: Consulting services'
    ].join('\n');
    const d = textParser.parse(en);
    assert.strictEqual(d.iban, 'HR5423900013221482195');
    assert.strictEqual(d.amount, '1200.50');
    assert.strictEqual(d.currency, 'EUR');
    assert.strictEqual(d.model, 'HR69');
    assert.strictEqual(d.reference, '40002-55950527428-200');
    assert.strictEqual(d.description, 'Consulting services');
});

test('normalizes various amount and currency formats', () => {
    const cases = [
        { text: 'Iznos: 933,73 eur', amount: '933.73', currency: 'EUR' },
        { text: 'Iznos: 1.234,56', amount: '1234.56', currency: 'EUR' },
        { text: 'Iznos: 933.73', amount: '933.73', currency: 'EUR' },
        { text: 'Amount: 933.73 eur', amount: '933.73', currency: 'EUR' },
        { text: 'Iznos: 500 kn', amount: '500.00', currency: 'HRK' }
    ];
    for (const c of cases) {
        const d = textParser.parse(c.text);
        assert.strictEqual(d.amount, c.amount, `amount for "${c.text}"`);
        assert.strictEqual(d.currency, c.currency, `currency for "${c.text}"`);
    }
});

test('reports warnings and leaves fields null when data is missing', () => {
    const d = textParser.parse('Iznos: 100 eur');
    assert.strictEqual(d.iban, null);
    assert.strictEqual(d.amount, '100.00');
    assert.strictEqual(d.model, '');
    assert.strictEqual(d.reference, '');
    assert.ok(d.warnings.includes('warningMissingIban'));
    assert.ok(d.warnings.includes('warningMissingReference'));
});

test('does not flag a defaulted model when a real HRxx reference is present', () => {
    const d = textParser.parse([
        'IBAN: HR5423900013221482195',
        'Iznos: 50,00 eur',
        'Poziv na broj primatelja: HR69 40002-55950527428-200'
    ].join('\n'));
    assert.strictEqual(d.model, 'HR69');
    assert.ok(!d.warnings.includes('warningDefaultedModel'), 'no spurious defaulted-model warning');
    assert.ok(!d.warnings.includes('warningMissingReference'));
});

test('prefers the non-payer IBAN when multiple IBANs are present', () => {
    const d = textParser.parse([
        'IBAN platitelja: HR1212000011112223334',
        'IBAN: HR5423900013221482195',
        'Iznos: 10,00 eur'
    ].join('\n'));
    assert.strictEqual(d.iban, 'HR5423900013221482195', 'payee IBAN chosen over payer IBAN');
});

test('does not throw on empty or garbage input', () => {
    assert.doesNotThrow(() => textParser.parse(''));
    assert.doesNotThrow(() => textParser.parse('   \n\n  '));
    const garbage = textParser.parse('asdf qwer 123 nothing useful here');
    assert.strictEqual(garbage.iban, null);
    assert.strictEqual(garbage.amount, null);
    assert.ok(garbage.warnings.includes('warningMissingIban'));
    assert.ok(garbage.warnings.includes('warningMissingAmount'));
});

test('extracts šifra namjene (purpose code) when the label is present', () => {
    const d = textParser.parse([
        'IBAN: HR5423900013221482195',
        'Iznos: 50,00 eur',
        'Šifra namjene: COST',
        'Opis plaćanja: Troškovi putovanja'
    ].join('\n'));
    assert.strictEqual(d.purposeCode, 'COST');
});

test('purpose code is empty when the text contains no šifra namjene', () => {
    const d = textParser.parse(NIKO_EXAMPLE);
    assert.strictEqual(d.purposeCode, '');
});
