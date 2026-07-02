/**
 * ABOUTME: Tests for the HUB-3 payment-string formatter
 * ABOUTME: Verifies the 14-field HRVHUB30 layout and data-driven purpose code (field 13)
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGeneratorContext } = require('./setup');

const { hub3Generator } = loadGeneratorContext();

const baseData = {
    currency: 'EUR',
    amount: '123.55',
    iban: 'HR1210010051863000160',
    model: 'HR01',
    reference: '7269-68499637766-00019',
    receiverName: '2DBK d.d.',
    description: 'Troškovi za 1. mjesec'
};

test('formatPaymentString emits 14 LF-separated fields per HUB 3A spec', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData }).split('\n');
    assert.strictEqual(fields.length, 14, 'exactly 14 positional fields');
    assert.strictEqual(fields[0], 'HRVHUB30', 'header');
    assert.strictEqual(fields[1], 'EUR', 'currency (field 2)');
    assert.strictEqual(fields[9], 'HR1210010051863000160', 'recipient IBAN (field 10)');
    assert.strictEqual(fields[10], 'HR01', 'recipient model (field 11)');
    assert.strictEqual(fields[11], '7269-68499637766-00019', 'recipient reference (field 12)');
    assert.strictEqual(fields[13], 'Troškovi za 1. mjesec', 'description (field 14)');
});

test('purpose code is empty when not provided (no hardcoded GDSV)', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData }).split('\n');
    assert.strictEqual(fields[12], '', 'field 13 (šifra namjene) must be empty, not a hardcoded GDSV');
});

test('purpose code is emitted when provided on the data object', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData, purposeCode: 'COST' }).split('\n');
    assert.strictEqual(fields[12], 'COST');
});

test('encodeAmount converts to spec-compliant eurocents (no decimal point)', () => {
    // HUB 3A spec: amount in eurocents, no decimal mark, right-aligned, zero-padded to 15.
    const cases = [
        ['123.55', '000000000012355'],     // spec worked example (123.55 EUR -> 12355 cents)
        ['933.73', '000000000093373'],
        ['500.00', '000000000050000'],
        ['100',    '000000000010000'],     // whole-euro integer
        ['1.50',   '000000000000150'],
        ['0.05',   '000000000000005'],
        ['99999999.99', '000009999999999'] // near the 15-digit ceiling
    ];
    for (const [inp, expected] of cases) {
        assert.strictEqual(hub3Generator.encodeAmount(inp), expected, `encodeAmount('${inp}')`);
    }
});

test('encodeAmount tolerates comma decimals and falsy input', () => {
    assert.strictEqual(hub3Generator.encodeAmount('933,73'), '000000000093373');
    assert.strictEqual(hub3Generator.encodeAmount(''), '000000000000000');
    assert.strictEqual(hub3Generator.encodeAmount(null), '000000000000000');
    assert.strictEqual(hub3Generator.encodeAmount(undefined), '000000000000000');
});

test('formatPaymentString amount field is pure eurocents (no decimal point)', () => {
    const fields = hub3Generator.formatPaymentString({
        amount: '933.73', iban: 'HR5423900013221482195', model: 'HR69', reference: '1'
    }).split('\n');
    assert.strictEqual(fields[2], '000000000093373');
    assert.ok(!fields[2].includes('.'), 'amount field must contain no decimal point');
});

test('encodeAmount rejects negatives, non-finite, and overflow to the zero sentinel', () => {
    const zeros = '000000000000000';
    // Negatives are reachable via storno/credit-note invoices and must not leak a '-'.
    for (const inp of ['-9.99', '-0.01', '-100', '-9999999999.99']) {
        assert.strictEqual(hub3Generator.encodeAmount(inp), zeros, `encodeAmount('${inp}')`);
    }
    // Non-finite values must not leak letters ("Infinity").
    for (const inp of ['Infinity', '-Infinity', '1e350']) {
        assert.strictEqual(hub3Generator.encodeAmount(inp), zeros, `encodeAmount('${inp}')`);
    }
    // Overflow beyond the 15-digit ceiling must collapse to the sentinel, not grow.
    assert.strictEqual(hub3Generator.encodeAmount('99999999999999.99'), zeros, 'overflow');
});

test('encodeAmount output always satisfies the 15-pure-digits format invariant', () => {
    const inputs = ['933.73', '0', '123.55', '-9.99', 'Infinity', '', null, undefined,
                    '99999999999999.99', '1e350', '1,50'];
    for (const inp of inputs) {
        assert.ok(/^\d{15}$/.test(hub3Generator.encodeAmount(inp)),
            `encodeAmount('${inp}') must be 15 pure digits, got '${hub3Generator.encodeAmount(inp)}'`);
    }
});
